"""Live E2E test for mood tracking against running backend + live Firebase."""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:5001")
FIREBASE_WEB_API_KEY = os.getenv("FIREBASE_WEB_API_KEY", "")
SERVICE_ACCOUNT_PATH = os.getenv("SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")

cookie_jar = CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))


def _decode_json(raw: bytes) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw.decode("utf-8", errors="replace")}


def http_post(url: str, data: dict, headers: dict | None = None) -> tuple[int, dict]:
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers or {}, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with opener.open(req, timeout=20) as resp:
            return resp.status, _decode_json(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, _decode_json(e.read())


def http_get(url: str, headers: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    try:
        with opener.open(req, timeout=20) as resp:
            return resp.status, _decode_json(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, _decode_json(e.read())


def get_cookie(name: str) -> str | None:
    for c in cookie_jar:
        if c.name == name:
            return c.value
    return None


results: list[tuple[str, bool, str]] = []

print("\n══════════════════════════════════════════════")
print("  LUGN & TRYGG — LIVE E2E MOOD LOG TEST")
print("══════════════════════════════════════════════")

if not FIREBASE_WEB_API_KEY:
    print("  ❌ Missing FIREBASE_WEB_API_KEY environment variable")
    sys.exit(1)

if not os.path.isfile(SERVICE_ACCOUNT_PATH):
    print(f"  ❌ Service account file not found: {SERVICE_ACCOUNT_PATH}")
    sys.exit(1)

# 1) Health
print("\n[1/7] Backend health check...")
status, data = http_get(f"{BACKEND_URL}/health")
if status == 200 and data.get("status") == "healthy":
    print(f"  ✅ Backend healthy | Firebase: {data.get('firebase')} | env: {data.get('environment')}")
    results.append(("Backend health", True, ""))
else:
    print(f"  ❌ Backend not healthy: {status} {data}")
    results.append(("Backend health", False, str(data)))

# 2) Get existing Firebase user
print("\n[2/7] Fetching existing user from Firestore...")
sys.path.insert(0, os.path.dirname(__file__))
import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.client()
users = list(db.collection("users").limit(1).stream())
if not users:
    print("  ❌ No users in Firestore — cannot run live test")
    sys.exit(1)

user_doc = users[0]
user_id = user_doc.id
user_data = user_doc.to_dict() or {}
print(f"  ✅ Found user: {user_id}")
print(f"     Email: {user_data.get('email', 'N/A')}")

# 3) Firebase custom token -> Firebase id token
print("\n[3/7] Creating Firebase custom token + exchanging for Firebase ID token...")
email_claim = user_data.get("email") or "e2e-user@lugntrygg.se"
name_claim = user_data.get("name") or "E2E Test User"
custom_token = firebase_auth.create_custom_token(
    user_id,
    {
        "email": email_claim,
        "name": name_claim,
    },
)
if isinstance(custom_token, bytes):
    custom_token = custom_token.decode("utf-8")

exchange_url = (
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken"
    f"?key={FIREBASE_WEB_API_KEY}"
)
status, token_data = http_post(exchange_url, {"token": custom_token, "returnSecureToken": True})
if status != 200:
    print(f"  ❌ Token exchange failed: {status} {token_data}")
    results.append(("Firebase ID token", False, str(token_data)))
    sys.exit(1)

firebase_id_token = token_data.get("idToken")
if not firebase_id_token:
    print("  ❌ No Firebase ID token in response")
    results.append(("Firebase ID token", False, "missing idToken"))
    sys.exit(1)

print(f"  ✅ Firebase ID token obtained (length {len(firebase_id_token)})")
results.append(("Firebase ID token", True, ""))

# 4) Backend google-login -> backend JWT access token
print("\n[4/7] Exchanging Firebase ID token for backend JWT via /api/v1/auth/google-login...")
status, login_resp = http_post(
    f"{BACKEND_URL}/api/v1/auth/google-login",
    {"id_token": firebase_id_token},
)
if status != 200:
    print(f"  ❌ google-login failed: {status} {login_resp}")
    results.append(("Backend JWT login", False, str(login_resp)))
    sys.exit(1)

login_data = login_resp.get("data") or login_resp
access_token = login_data.get("accessToken")
if not access_token:
    print(f"  ❌ Backend JWT missing in login response: {login_resp}")
    results.append(("Backend JWT login", False, "missing accessToken"))
    sys.exit(1)

print(f"  ✅ Backend JWT acquired (length {len(access_token)})")
results.append(("Backend JWT login", True, ""))

# 5) Fetch CSRF token endpoint (sets cookie + returns token)
print("\n[5/7] Fetching CSRF token from /api/v1/dashboard/csrf-token...")
status, csrf_resp = http_get(f"{BACKEND_URL}/api/v1/dashboard/csrf-token")
csrf_data = csrf_resp.get("data") or csrf_resp
csrf_token = csrf_data.get("csrfToken")
csrf_cookie = get_cookie("csrf_token")
if status != 200 or not csrf_token or not csrf_cookie:
    print(f"  ❌ Failed CSRF setup: status={status}, token={bool(csrf_token)}, cookie={bool(csrf_cookie)}")
    print(f"     Response: {csrf_resp}")
    results.append(("CSRF token setup", False, str(csrf_resp)))
    sys.exit(1)

print("  ✅ CSRF token + cookie received")
results.append(("CSRF token setup", True, ""))

# 6) Log mood with backend JWT + CSRF header
print("\n[6/7] Logging mood with JWT + CSRF...")
auth_headers = {
    "Authorization": f"Bearer {access_token}",
    "X-CSRF-Token": csrf_token,
    "Cookie": f"csrf_token={csrf_cookie}",
    "Content-Type": "application/json",
}
mood_payload = {
    "score": 8,
    "mood_text": "Glad",
    "note": f"Live E2E test {time.strftime('%H:%M:%S')}",
    "tags": ["e2e-test", "dag", "lugn"],
    "valence": 8,
    "arousal": 6,
}

status, resp = http_post(f"{BACKEND_URL}/api/v1/mood/log", mood_payload, auth_headers)
if status in (200, 201):
    print(f"  ✅ Mood logged with status {status}")
    results.append(("Mood log POST", True, ""))
else:
    print(f"  ❌ Mood log failed: {status} {resp}")
    results.append(("Mood log POST", False, f"{status}: {resp}"))

# 6b) Verify Firestore save
time.sleep(1)
try:
    mood_ref = db.collection("users").document(user_id).collection("moods")
    recent = list(mood_ref.order_by("timestamp", direction="DESCENDING").limit(1).stream())
    if recent:
        latest = recent[0].to_dict() or {}
        ok = latest.get("score") == 8 and "e2e-test" in (latest.get("tags") or [])
        if ok:
            print(f"  ✅ Firestore verified: score={latest.get('score')} tags={latest.get('tags')}")
            results.append(("Firestore verification", True, ""))
        else:
            print(f"  ❌ Firestore data mismatch: {latest}")
            results.append(("Firestore verification", False, str(latest)))
    else:
        print("  ❌ No mood found in Firestore")
        results.append(("Firestore verification", False, "no mood found"))
except Exception as e:
    print(f"  ❌ Firestore verification error: {e}")
    results.append(("Firestore verification", False, str(e)))

# 7) Verify analytics endpoints using backend JWT
print("\n[7/7] Verifying analytics endpoints...")
read_headers = {"Authorization": f"Bearer {access_token}"}
endpoints = [
    ("GET /api/v1/mood", f"{BACKEND_URL}/api/v1/mood"),
    ("GET /api/v1/mood-stats/statistics", f"{BACKEND_URL}/api/v1/mood-stats/statistics"),
    ("GET /api/v1/mood-stats/daily", f"{BACKEND_URL}/api/v1/mood-stats/daily?days=7"),
    ("GET /api/v1/mood-stats/monthly", f"{BACKEND_URL}/api/v1/mood-stats/monthly?months=3"),
]

for label, url in endpoints:
    s, r = http_get(url, read_headers)
    if s == 200:
        payload = r.get("data") or r
        if "moods" in payload:
            summary = f"moods={len(payload.get('moods', []))}"
        elif "totalMoods" in payload:
            summary = f"totalMoods={payload.get('totalMoods')}"
        elif "totalEntries" in payload:
            summary = f"totalEntries={payload.get('totalEntries')}"
        else:
            summary = "OK"
        print(f"  ✅ {label} -> {summary}")
        results.append((label, True, ""))
    else:
        print(f"  ❌ {label} -> {s}: {r}")
        results.append((label, False, str(r)))

print("\n══════════════════════════════════════════════")
print("  TEST RESULTAT")
print("══════════════════════════════════════════════")
passed = sum(1 for _, ok, _ in results if ok)
failed = sum(1 for _, ok, _ in results if not ok)
for label, ok, msg in results:
    icon = "✅" if ok else "❌"
    extra = f" — {msg[:90]}" if msg else ""
    print(f"  {icon} {label}{extra}")

print(f"\n  {passed}/{passed + failed} tester godkända")
if failed > 0:
    sys.exit(1)
