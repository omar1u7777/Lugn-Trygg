"""Live E2E test for AI Chat Assistant with real Firebase auth and backend endpoints."""

import json
import os
import sys
import urllib.error
import urllib.request
from http.cookiejar import CookieJar

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:5002")
FIREBASE_WEB_API_KEY = os.getenv("FIREBASE_WEB_API_KEY", "")

jar = CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def _decode_json(raw: bytes) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw.decode("utf-8", errors="replace")}


def http_post(url: str, data: dict, headers: dict | None = None) -> tuple[int, dict, dict]:
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers or {}, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with opener.open(req, timeout=90) as resp:
            return resp.status, dict(resp.headers), _decode_json(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), _decode_json(e.read())


def http_get(url: str, headers: dict | None = None) -> tuple[int, dict, dict]:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    try:
        with opener.open(req, timeout=90) as resp:
            return resp.status, dict(resp.headers), _decode_json(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), _decode_json(e.read())


def get_cookie(name: str) -> str | None:
    for c in jar:
        if c.name == name:
            return c.value
    return None


def stream_chat(url: str, headers: dict, payload: dict) -> tuple[int, int, str]:
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    req.add_header("Content-Type", "application/json")
    token_count = 0
    full_text = []
    try:
        with opener.open(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            chunks = [line.strip() for line in raw.splitlines() if line.startswith("data: ")]
            for chunk in chunks:
                data = chunk[6:].strip()
                if data == "[DONE]":
                    break
                try:
                    payload = json.loads(data)
                    text = payload.get("content", "")
                    if text:
                        token_count += 1
                        full_text.append(text)
                except Exception:
                    pass
            return resp.status, token_count, "".join(full_text)
    except urllib.error.HTTPError as e:
        return e.code, 0, ""


def main() -> int:
    print("\n=== LIVE AI CHAT E2E TEST ===")

    # 1) Health
    status, _, health = http_get(f"{BACKEND_URL}/health")
    if status != 200:
        print(f"FAIL health: {status} {health}")
        return 1
    print(f"OK health: {health.get('status')} firebase={health.get('firebase')}")

    if not FIREBASE_WEB_API_KEY:
        print("FAIL missing FIREBASE_WEB_API_KEY in env")
        return 1

    # 2) Firebase bootstrap
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    users = list(db.collection("users").limit(1).stream())
    if not users:
        print("FAIL no users in Firestore")
        return 1

    user_doc = users[0]
    user_id = user_doc.id
    user_data = user_doc.to_dict() or {}
    email_claim = user_data.get("email", "chat-e2e@example.com")
    name_claim = user_data.get("name", "Chat E2E")

    # 3) Firebase custom token -> id token
    custom_token = firebase_auth.create_custom_token(user_id, {"email": email_claim, "name": name_claim})
    if isinstance(custom_token, bytes):
        custom_token = custom_token.decode("utf-8")

    status, _, token_res = http_post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={FIREBASE_WEB_API_KEY}",
        {"token": custom_token, "returnSecureToken": True},
    )
    if status != 200 or not token_res.get("idToken"):
        print(f"FAIL firebase token exchange: {status} {token_res}")
        return 1
    firebase_id_token = token_res["idToken"]
    print("OK firebase id token")

    # 4) Backend login -> JWT
    status, _, login_res = http_post(f"{BACKEND_URL}/api/v1/auth/google-login", {"id_token": firebase_id_token})
    login_data = login_res.get("data") or login_res
    access_token = login_data.get("accessToken")
    if status != 200 or not access_token:
        print(f"FAIL backend login: {status} {login_res}")
        return 1
    print("OK backend JWT")

    # 5) CSRF
    status, _, csrf_res = http_get(f"{BACKEND_URL}/api/v1/dashboard/csrf-token")
    csrf_data = csrf_res.get("data") or csrf_res
    csrf_token = csrf_data.get("csrfToken")
    csrf_cookie = get_cookie("csrf_token")
    if status != 200 or not csrf_token or not csrf_cookie:
        print(f"FAIL csrf setup: {status} token={bool(csrf_token)} cookie={bool(csrf_cookie)}")
        return 1
    print("OK csrf token")

    auth_headers = {
        "Authorization": f"Bearer {access_token}",
        "X-CSRF-Token": csrf_token,
        "Cookie": f"csrf_token={csrf_cookie}",
        "Content-Type": "application/json",
    }

    # 6) Non-stream chat
    msg = "Jag känner mig stressad över jobbet idag. Ge mig ett kort råd."
    status, _, chat_res = http_post(
        f"{BACKEND_URL}/api/v1/chatbot/chat",
        {"user_id": user_id, "message": msg},
        auth_headers,
    )
    data = chat_res.get("data") or chat_res
    response_text = data.get("response", "")
    if status != 200 or not response_text:
        print(f"FAIL chat endpoint: {status} {chat_res}")
        return 1
    print(f"OK chat response len={len(response_text)} model={data.get('modelUsed')}")

    # 7) Streaming chat
    stream_status, token_count, stream_text = stream_chat(
        f"{BACKEND_URL}/api/v1/chatbot/chat/stream",
        auth_headers,
        {"user_id": user_id, "message": "Kan du ge en andningsövning i 3 steg?"},
    )
    if stream_status != 200 or token_count == 0 or not stream_text.strip():
        print(f"FAIL stream endpoint: status={stream_status} tokens={token_count} text_len={len(stream_text)}")
        return 1
    print(f"OK stream tokens={token_count} text_len={len(stream_text)}")

    # 8) History should contain messages
    status, _, hist_res = http_get(f"{BACKEND_URL}/api/v1/chatbot/history?limit=10", {"Authorization": f"Bearer {access_token}"})
    hist_data = hist_res.get("data") or hist_res
    conv = hist_data.get("conversation", [])
    if status != 200 or len(conv) < 2:
        print(f"FAIL history endpoint: {status} messages={len(conv)} {hist_res}")
        return 1
    print(f"OK history messages={len(conv)}")

    # 9) Firestore persistence check
    conv_ref = db.collection("users").document(user_id).collection("conversations")
    docs = list(conv_ref.order_by("timestamp", direction="DESCENDING").limit(4).stream())
    if len(docs) < 2:
        print(f"FAIL firestore conversations persisted count={len(docs)}")
        return 1
    print(f"OK firestore saved conversations count={len(docs)}")

    print("\nPASS: Live AI chat E2E completed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
