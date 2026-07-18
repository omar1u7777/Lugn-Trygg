"""Live E2E tests for the AI Chat system against a running backend.

Requires:
  - Backend running (default http://127.0.0.1:5001)
  - FIREBASE_WEB_API_KEY env var
  - serviceAccountKey.json in Backend/ root

Run:
  python -m pytest live_tests/test_ai_chat_live_e2e.py -v --tb=short

Or standalone:
  python live_tests/test_ai_chat_live_e2e.py
"""

import json
import os
import sys
import urllib.error
import urllib.request
from http.cookiejar import CookieJar

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:5001").rstrip("/")
FIREBASE_WEB_API_KEY = os.getenv("FIREBASE_WEB_API_KEY", "")
TIMEOUT = 90

jar = CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _decode_json(raw: bytes) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw.decode("utf-8", errors="replace")}


def http_request(method: str, url: str, data: dict | None = None, headers: dict | None = None) -> tuple[int, dict, dict]:
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with opener.open(req, timeout=TIMEOUT) as resp:
            return resp.status, dict(resp.headers), _decode_json(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), _decode_json(e.read())


def http_post(url: str, data: dict, headers: dict | None = None) -> tuple[int, dict, dict]:
    return http_request("POST", url, data, headers)


def http_get(url: str, headers: dict | None = None) -> tuple[int, dict, dict]:
    return http_request("GET", url, None, headers)


def stream_chat(url: str, headers: dict, payload: dict) -> tuple[int, int, str]:
    """Read SSE stream and return (status, token_count, full_text)."""
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "text/event-stream")
    token_count = 0
    full_text: list[str] = []
    try:
        with opener.open(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            for line in raw.splitlines():
                line = line.strip()
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    break
                try:
                    obj = json.loads(data)
                    text = obj.get("content", "")
                    if text:
                        token_count += 1
                        full_text.append(text)
                except Exception:
                    pass
            return resp.status, token_count, "".join(full_text)
    except urllib.error.HTTPError as e:
        return e.code, 0, ""


def get_cookie(name: str) -> str | None:
    for c in jar:
        if c.name == name:
            return c.value
    return None


# ---------------------------------------------------------------------------
# Test suite
# ---------------------------------------------------------------------------

class AIChatE2EResult:
    PASSED = 0
    FAILED = 0
    ERRORS: list[str] = []

    @classmethod
    def pass_test(cls, name: str):
        cls.PASSED += 1
        print(f"  PASS  {name}")

    @classmethod
    def fail_test(cls, name: str, detail: str = ""):
        cls.FAILED += 1
        msg = f"  FAIL  {name}: {detail}" if detail else f"  FAIL  {name}"
        cls.ERRORS.append(msg)
        print(msg)


def run_e2e_suite() -> int:
    """Run the full AI chat E2E suite. Returns exit code (0=pass, 1=fail)."""
    print("\n" + "=" * 60)
    print("  LIVE AI CHAT E2E TEST SUITE")
    print(f"  Backend: {BACKEND_URL}")
    print("=" * 60)

    AIChatE2EResult.PASSED = 0
    AIChatE2EResult.FAILED = 0
    AIChatE2EResult.ERRORS = []

    # --- 1. Health check ---
    print("\n[1/12] Health check")
    status, _, health = http_get(f"{BACKEND_URL}/health")
    if status != 200:
        AIChatE2EResult.fail_test("health", f"status={status}")
        return 1
    AIChatE2EResult.pass_test("health")
    fb_ok = health.get("firebase") in (True, "ok", "connected")
    print(f"        firebase={'ok' if fb_ok else 'degraded'}")

    # --- 2. Firebase bootstrap ---
    print("\n[2/12] Firebase bootstrap")
    if not FIREBASE_WEB_API_KEY:
        AIChatE2EResult.fail_test("firebase_key", "FIREBASE_WEB_API_KEY missing")
        return 1
    if not firebase_admin._apps:
        sa_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "serviceAccountKey.json")
        if not os.path.exists(sa_path):
            AIChatE2EResult.fail_test("service_account", f"serviceAccountKey.json not found at {sa_path}")
            return 1
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    users = list(db.collection("users").limit(1).stream())
    if not users:
        AIChatE2EResult.fail_test("firestore_users", "no users in Firestore")
        return 1
    user_doc = users[0]
    user_id = user_doc.id
    user_data = user_doc.to_dict() or {}
    email_claim = user_data.get("email", f"e2e-{user_id}@example.com")
    name_claim = user_data.get("name", "E2E Tester")
    AIChatE2EResult.pass_test("firebase_bootstrap")

    # --- 3. Firebase custom token -> ID token ---
    print("\n[3/12] Firebase token exchange")
    custom_token = firebase_auth.create_custom_token(user_id, {"email": email_claim, "name": name_claim})
    if isinstance(custom_token, bytes):
        custom_token = custom_token.decode("utf-8")
    status, _, token_res = http_post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={FIREBASE_WEB_API_KEY}",
        {"token": custom_token, "returnSecureToken": True},
    )
    if status != 200 or not token_res.get("idToken"):
        AIChatE2EResult.fail_test("firebase_token", f"status={status}")
        return 1
    firebase_id_token = token_res["idToken"]
    AIChatE2EResult.pass_test("firebase_token")

    # --- 4. Backend login -> JWT ---
    print("\n[4/12] Backend login")
    status, _, login_res = http_post(f"{BACKEND_URL}/api/v1/auth/google-login", {"id_token": firebase_id_token})
    login_data = login_res.get("data") or login_res
    access_token = login_data.get("accessToken")
    if status != 200 or not access_token:
        AIChatE2EResult.fail_test("backend_login", f"status={status}")
        return 1
    AIChatE2EResult.pass_test("backend_login")

    # --- 5. CSRF ---
    print("\n[5/12] CSRF token")
    status, _, csrf_res = http_get(f"{BACKEND_URL}/api/v1/dashboard/csrf-token")
    csrf_data = csrf_res.get("data") or csrf_res
    csrf_token = csrf_data.get("csrfToken")
    csrf_cookie = get_cookie("csrf_token")
    if status != 200 or not csrf_token or not csrf_cookie:
        AIChatE2EResult.fail_test("csrf", f"status={status} token={bool(csrf_token)} cookie={bool(csrf_cookie)}")
        return 1
    AIChatE2EResult.pass_test("csrf")

    auth_headers = {
        "Authorization": f"Bearer {access_token}",
        "X-CSRF-Token": csrf_token,
        "Cookie": f"csrf_token={csrf_cookie}",
        "Content-Type": "application/json",
    }

    # --- 6. Chat (non-streaming) ---
    print("\n[6/12] Chat endpoint")
    msg = "Jag känner mig stressad över jobbet idag. Ge mig ett kort råd."
    status, _, chat_res = http_post(
        f"{BACKEND_URL}/api/v1/chatbot/chat",
        {"message": msg},
        auth_headers,
    )
    data = chat_res.get("data") or chat_res
    response_text = data.get("response", "")
    if status != 200 or not response_text:
        AIChatE2EResult.fail_test("chat", f"status={status} response_len={len(response_text)}")
    else:
        AIChatE2EResult.pass_test("chat")
        print(f"        response_len={len(response_text)} model={data.get('modelUsed', 'n/a')}")

    # --- 7. Chat stream (SSE) ---
    print("\n[7/12] Chat stream (SSE)")
    stream_status, token_count, stream_text = stream_chat(
        f"{BACKEND_URL}/api/v1/chatbot/chat/stream",
        auth_headers,
        {"message": "Kan du ge en andningsövning i 3 steg?"},
    )
    if stream_status != 200 or token_count == 0 or not stream_text.strip():
        AIChatE2EResult.fail_test("chat_stream", f"status={stream_status} tokens={token_count} text_len={len(stream_text)}")
    else:
        AIChatE2EResult.pass_test("chat_stream")
        print(f"        tokens={token_count} text_len={len(stream_text)}")

    # --- 8. History ---
    print("\n[8/12] Chat history")
    status, _, hist_res = http_get(
        f"{BACKEND_URL}/api/v1/chatbot/history?limit=10",
        {"Authorization": f"Bearer {access_token}"},
    )
    hist_data = hist_res.get("data") or hist_res
    conv = hist_data.get("conversation", [])
    if status != 200 or len(conv) < 1:
        AIChatE2EResult.fail_test("history", f"status={status} messages={len(conv)}")
    else:
        AIChatE2EResult.pass_test("history")
        print(f"        messages={len(conv)}")

    # --- 9. Analyze patterns ---
    print("\n[9/12] Analyze mood patterns")
    status, _, patterns_res = http_post(
        f"{BACKEND_URL}/api/v1/chatbot/analyze-patterns",
        {},
        auth_headers,
    )
    if status != 200:
        AIChatE2EResult.fail_test("analyze_patterns", f"status={status}")
    else:
        AIChatE2EResult.pass_test("analyze_patterns")

    # --- 10. AI Story ---
    print("\n[10/12] AI Story generation")
    status, _, story_res = http_post(
        f"{BACKEND_URL}/api/v1/ai/story",
        {"locale": "sv"},
        auth_headers,
    )
    story_data = story_res.get("data") or story_res
    if status != 200:
        AIChatE2EResult.fail_test("ai_story", f"status={status}")
    else:
        AIChatE2EResult.pass_test("ai_story")
        has_story = bool(story_data.get("story") or story_data.get("title"))
        print(f"        has_content={has_story}")

    # --- 11. AI Forecast ---
    print("\n[11/12] AI Mood forecast")
    status, _, forecast_res = http_post(
        f"{BACKEND_URL}/api/v1/ai/forecast",
        {"days_ahead": 7},
        auth_headers,
    )
    if status != 200:
        AIChatE2EResult.fail_test("ai_forecast", f"status={status}")
    else:
        AIChatE2EResult.pass_test("ai_forecast")

    # --- 12. Exercise + close session ---
    print("\n[12/12] Exercise & session close")
    status, _, ex_res = http_post(
        f"{BACKEND_URL}/api/v1/chatbot/exercise",
        {"exercise_type": "breathing"},
        auth_headers,
    )
    if status != 200:
        AIChatE2EResult.fail_test("exercise_start", f"status={status}")
    else:
        AIChatE2EResult.pass_test("exercise_start")

    status, _, close_res = http_post(
        f"{BACKEND_URL}/api/v1/chatbot/session/close",
        {"session_id": "e2e-test-session"},
        auth_headers,
    )
    if status != 200:
        AIChatE2EResult.fail_test("session_close", f"status={status}")
    else:
        AIChatE2EResult.pass_test("session_close")

    # --- Summary ---
    print("\n" + "=" * 60)
    total = AIChatE2EResult.PASSED + AIChatE2EResult.FAILED
    print(f"  RESULTS: {AIChatE2EResult.PASSED}/{total} passed, {AIChatE2EResult.FAILED} failed")
    if AIChatE2EResult.ERRORS:
        print("\n  Failures:")
        for err in AIChatE2EResult.ERRORS:
            print(f"    {err}")
    print("=" * 60)

    return 0 if AIChatE2EResult.FAILED == 0 else 1


# ---------------------------------------------------------------------------
# pytest wrapper
# ---------------------------------------------------------------------------

def test_ai_chat_live_e2e():
    """Pytest entry point for the live E2E suite."""
    if not os.getenv("LIVE_E2E"):
        import pytest
        pytest.skip("Set LIVE_E2E=1 to run live E2E tests")
    assert run_e2e_suite() == 0, "Live E2E suite had failures"


if __name__ == "__main__":
    sys.exit(run_e2e_suite())
