from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from collections.abc import Callable

from flask import jsonify, request


CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_HEADER_NAME_LEGACY = "X-CSRFToken"
CSRF_TTL_SECONDS = 60 * 60 * 2


class CSRFMiddleware:
    def __init__(self, secret: str, exempt_paths: set[str] | None = None) -> None:
        self._secret = secret.encode("utf-8")
        self._exempt_paths = exempt_paths or set()

    def generate_token(self) -> str:
        nonce = secrets.token_urlsafe(32)
        ts = str(int(time.time()))
        payload = f"{nonce}:{ts}"
        sig = hmac.new(self._secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
        raw = f"{payload}:{sig}"
        return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")

    def validate_token(self, token: str) -> bool:
        try:
            decoded = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
            nonce, ts_raw, sig = decoded.split(":", 2)
            if not nonce or not ts_raw or not sig:
                return False

            ts = int(ts_raw)
            if int(time.time()) - ts > CSRF_TTL_SECONDS:
                return False

            payload = f"{nonce}:{ts_raw}"
            expected = hmac.new(self._secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
            return hmac.compare_digest(expected, sig)
        except Exception:
            return False

    def before_request(self):
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return None

        path = request.path or ""
        if path in self._exempt_paths:
            return None

        if not path.startswith("/api/"):
            return None

        cookie_token = request.cookies.get(CSRF_COOKIE_NAME, "")
        header_token = request.headers.get(CSRF_HEADER_NAME, "") or request.headers.get(CSRF_HEADER_NAME_LEGACY, "")

        if not cookie_token or not header_token:
            return jsonify({"error": "CSRF token missing"}), 403

        if cookie_token != header_token:
            return jsonify({"error": "CSRF token mismatch"}), 403

        if not self.validate_token(header_token):
            return jsonify({"error": "CSRF token invalid or expired"}), 403

        return None


def init_csrf_middleware(app, secret: str, exempt_paths: set[str] | None = None) -> CSRFMiddleware:
    middleware = CSRFMiddleware(secret=secret, exempt_paths=exempt_paths)
    app.before_request(middleware.before_request)
    return middleware
