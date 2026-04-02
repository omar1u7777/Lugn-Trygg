"""
Live E2E test for AI Chat Assistant

Tests the full chat flow:
1. Firebase auth → backend JWT → CSRF
2. Normal chat message → OpenAI response
3. Crisis message detection (Swedish: "vill inte leva")
4. Chat history persistence (GET /history)
5. SSE streaming endpoint
"""
import json
import os
import sys
import time

import requests

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5004")

PASS = 0
FAIL = 0
results = []


def ok(name, detail=""):
    global PASS
    PASS += 1
    msg = f"  ✅ {name}" + (f" | {detail}" if detail else "")
    results.append(msg)
    print(msg)


def fail(name, detail=""):
    global FAIL
    FAIL += 1
    msg = f"  ❌ {name}" + (f" | {detail}" if detail else "")
    results.append(msg)
    print(msg)


def header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# ─── Step 1: Backend health ────────────────────────────────────
header("Step 1: Backend Health")
try:
    r = requests.get(f"{BACKEND_URL}/health", timeout=8)
    if r.status_code == 200:
        ok("Backend health", f"status={r.json().get('status','?')}")
    else:
        fail("Backend health", f"HTTP {r.status_code}")
        print("ABORT: Backend not reachable"); sys.exit(1)
except Exception as e:
    fail("Backend health", str(e))
    print("ABORT: Backend not reachable"); sys.exit(1)

# ─── Step 2: Firebase auth ─────────────────────────────────────
header("Step 2: Firebase Auth → Backend JWT")
sys.path.insert(0, os.path.dirname(__file__))

try:
    import firebase_admin
    from firebase_admin import auth, credentials, firestore as fs_module
    cred_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "serviceAccountKey.json")
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    # Fetch a real user from Firestore to get email/name for custom token
    _db = fs_module.client()
    _users = list(_db.collection("users").limit(1).stream())
    if not _users:
        fail("Firebase Admin SDK init", "No users in Firestore")
        sys.exit(1)
    _user_doc = _users[0]
    TEST_UID = _user_doc.id
    _user_data = _user_doc.to_dict() or {}
    TEST_EMAIL = _user_data.get("email") or "e2e-chat@lugntrygg.se"
    TEST_NAME = _user_data.get("name") or "E2E Chat Test User"
    ok("Firebase Admin SDK init", f"uid={TEST_UID}, email={TEST_EMAIL}")
except Exception as e:
    fail("Firebase Admin SDK init", str(e))
    sys.exit(1)

try:
    custom_token = auth.create_custom_token(TEST_UID, {
        "email": TEST_EMAIL,
        "name": TEST_NAME,
    })
    ok("Custom token created", f"uid={TEST_UID}")
except Exception as e:
    fail("Custom token created", str(e))
    sys.exit(1)

# Get Firebase API key from env or .env file
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY") or os.getenv("FIREBASE_WEB_API_KEY", "")

if not FIREBASE_API_KEY:
    # Try reading from .env files
    for env_path in [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local"),
    ]:
        try:
            from dotenv import dotenv_values
            env_vals = dotenv_values(env_path)
            FIREBASE_API_KEY = env_vals.get("FIREBASE_API_KEY") or env_vals.get("FIREBASE_WEB_API_KEY", "")
            if FIREBASE_API_KEY:
                break
        except Exception:
            pass

if not FIREBASE_API_KEY:
    fail("Firebase API key", "Not found — set FIREBASE_API_KEY env var or in Backend/.env")
    print(f"  Checked paths: Backend/.env and ../.env.local")
    sys.exit(1)

try:
    token_str = custom_token.decode() if isinstance(custom_token, bytes) else custom_token
    exchange_resp = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={FIREBASE_API_KEY}",
        json={"token": token_str, "returnSecureToken": True},
        timeout=15
    )
    if exchange_resp.status_code != 200:
        fail("Firebase ID token exchange", f"HTTP {exchange_resp.status_code}: {exchange_resp.text[:200]}")
        sys.exit(1)
    id_token = exchange_resp.json()["idToken"]
    ok("Firebase ID token", f"length={len(id_token)}")
except Exception as e:
    fail("Firebase ID token exchange", str(e))
    sys.exit(1)

# Backend login → JWT
try:
    login_resp = requests.post(
        f"{BACKEND_URL}/api/v1/auth/google-login",
        json={"id_token": id_token},
        timeout=15
    )
    if login_resp.status_code != 200:
        fail("Backend JWT login", f"HTTP {login_resp.status_code}: {login_resp.text[:200]}")
        sys.exit(1)
    login_data = login_resp.json().get("data", {})
    backend_jwt = login_data.get("accessToken") or login_data.get("token")
    if not backend_jwt:
        fail("Backend JWT login", f"No token in response: {login_resp.json()}")
        sys.exit(1)
    ok("Backend JWT login", f"token_length={len(backend_jwt)}")
except Exception as e:
    fail("Backend JWT login", str(e))
    sys.exit(1)

# CSRF setup
session = requests.Session()
try:
    csrf_resp = session.get(
        f"{BACKEND_URL}/api/v1/dashboard/csrf-token",
        headers={"Authorization": f"Bearer {backend_jwt}"},
        timeout=10
    )
    if csrf_resp.status_code != 200:
        fail("CSRF setup", f"HTTP {csrf_resp.status_code}: {csrf_resp.text[:200]}")
        sys.exit(1)
    csrf_data = csrf_resp.json().get("data", {})
    csrf_token = csrf_data.get("csrf_token") or csrf_data.get("csrfToken")
    if not csrf_token:
        fail("CSRF token", f"No csrf_token in: {csrf_resp.json()}")
        sys.exit(1)
    ok("CSRF token", f"length={len(csrf_token)}")
except Exception as e:
    fail("CSRF setup", str(e))
    sys.exit(1)

AUTH_HEADERS = {
    "Authorization": f"Bearer {backend_jwt}",
    "X-CSRF-Token": csrf_token,
    "Cookie": f"csrf_token={csrf_token}",
    "Content-Type": "application/json"
}
# Debug: print cookie jar
print(f"  [debug] Session cookies: {dict(session.cookies)}")
# Manually ensure the CSRF cookie is in the session
session.cookies.set("csrf_token", csrf_token, domain="localhost", path="/")

# ─── Step 3: Normal chat message ──────────────────────────────
header("Step 3: Normal Chat Message → OpenAI Response")
try:
    chat_resp = session.post(
        f"{BACKEND_URL}/api/v1/chatbot/chat",
        headers=AUTH_HEADERS,
        json={"message": "Hej, jag känner mig lite stressad idag. Vad kan jag göra?"},
        timeout=45
    )
    if chat_resp.status_code == 200:
        data = chat_resp.json().get("data", {})
        response_text = data.get("response", "")
        model = data.get("modelUsed", "unknown")
        ai_gen = data.get("aiGenerated", False)
        ok("Normal chat → 200", f"model={model}, ai_generated={ai_gen}, len={len(response_text)}")
        if len(response_text) > 20:
            ok("Response has content", response_text[:80].replace('\n', ' ') + "...")
        else:
            fail("Response has content", f"Too short: '{response_text}'")
        if model and model != "unknown":
            ok("OpenAI model identified", model)
        else:
            fail("OpenAI model identified", f"model={model}")
    else:
        fail("Normal chat", f"HTTP {chat_resp.status_code}: {chat_resp.text[:300]}")
except Exception as e:
    fail("Normal chat", str(e))

# ─── Step 4: Crisis detection ─────────────────────────────────
header("Step 4: Crisis Detection ('vill inte leva')")
time.sleep(1)
try:
    crisis_resp = session.post(
        f"{BACKEND_URL}/api/v1/chatbot/chat",
        headers=AUTH_HEADERS,
        json={"message": "Jag mår så dåligt, jag vill inte leva längre."},
        timeout=45
    )
    if crisis_resp.status_code == 200:
        data = crisis_resp.json().get("data", {})
        crisis_detected = data.get("crisisDetected", False)
        response_text = data.get("response", "")
        ok("Crisis chat → 200")
        if crisis_detected:
            ok("Crisis DETECTED ✅", "crisisDetected=True — safety system working")
        else:
            fail("Crisis DETECTED", "crisisDetected=False — SAFETY GAP! Crisis keywords not triggering")
        # Check crisis response mentions emergency number
        if "90101" in response_text or "112" in response_text or "1177" in response_text:
            ok("Crisis response has emergency numbers", response_text[:80].replace('\n', ' ') + "...")
        else:
            fail("Crisis response has emergency numbers", f"No emergency numbers in: '{response_text[:100]}'")
    else:
        fail("Crisis chat", f"HTTP {crisis_resp.status_code}: {crisis_resp.text[:300]}")
except Exception as e:
    fail("Crisis detection test", str(e))

# ─── Step 5: Chat history ─────────────────────────────────────
header("Step 5: Chat History GET /history")
time.sleep(1)
try:
    hist_resp = session.get(
        f"{BACKEND_URL}/api/v1/chatbot/history",
        headers={"Authorization": f"Bearer {backend_jwt}", "X-CSRF-Token": csrf_token},
        timeout=15
    )
    if hist_resp.status_code == 200:
        data = hist_resp.json().get("data", {})
        messages = data.get("conversation", data.get("messages", data.get("conversations", [])))
        total = data.get("totalMessages", len(messages))
        ok("History GET → 200", f"messages={total}")
        if total >= 2:
            ok("History has saved messages", f"count={total}")
        else:
            fail("History has saved messages", f"count={total} — expected >= 2 (messages may save async)")
    else:
        fail("History GET", f"HTTP {hist_resp.status_code}: {hist_resp.text[:200]}")
except Exception as e:
    fail("Chat history", str(e))

# ─── Step 6: SSE Streaming ────────────────────────────────────
header("Step 6: SSE Streaming /chat/stream")
time.sleep(1)
try:
    stream_resp = session.post(
        f"{BACKEND_URL}/api/v1/chatbot/chat/stream",
        headers={**AUTH_HEADERS, "Accept": "text/event-stream"},
        json={"message": "Berätta kort om en avslappningsteknik."},
        stream=True,
        timeout=45
    )
    if stream_resp.status_code == 200:
        chunks_received = 0
        content_parts = []
        for line in stream_resp.iter_lines(decode_unicode=True):
            if line.startswith("data:"):
                raw = line[5:].strip()
                if raw == "[DONE]":
                    break
                try:
                    payload = json.loads(raw)
                    if payload.get("content"):
                        content_parts.append(payload["content"])
                        chunks_received += 1
                except Exception:
                    pass
        full_text = "".join(content_parts)
        ok("SSE streaming → 200", f"chunks={chunks_received}, total_len={len(full_text)}")
        if len(full_text) > 20:
            ok("SSE content received", full_text[:80].replace('\n', ' ') + "...")
        else:
            fail("SSE content received", f"Too short: '{full_text}'")
    else:
        fail("SSE streaming", f"HTTP {stream_resp.status_code}: {stream_resp.text[:200]}")
except Exception as e:
    fail("SSE streaming", str(e))

# ─── Summary ──────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  AI CHAT E2E RESULTS: {PASS} passed / {FAIL} failed / {PASS+FAIL} total")
print(f"{'='*60}")
for r in results:
    print(r)

total = PASS + FAIL
pct = int(100 * PASS / total) if total > 0 else 0
print(f"\n  Score: {PASS}/{total} ({pct}%)")

if FAIL == 0:
    print("\n  🎉 ALL TESTS PASSED — AI Chat is live and working!")
    sys.exit(0)
elif FAIL <= 2:
    print("\n  ⚠️  Minor issues — mostly working")
    sys.exit(1)
else:
    print("\n  ❌ Multiple failures — needs attention")
    sys.exit(2)
