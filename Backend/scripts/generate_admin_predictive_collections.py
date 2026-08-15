#!/usr/bin/env python3
"""Generate Postman collections for the admin and predictive blueprints.

Why these two
-------------
check_postman_drift.py reported 15 routes with no collection request at all,
and they were not scattered — they were these two blueprints, entire. Nothing
in Backend/postman/collections/ covered `admin` or `predictive`, including
`/api/v1/admin/users/<id>/status` (changes another user's account state) and
`/api/v1/predictive/crisis-check` (sits on the crisis path). Those are the two
worst places in the app to have zero contract coverage.

Why a generator
---------------
The other 39 collections were produced by something not in this repository, so
when the API moved they silently went stale — 21 requests still aimed at the
pre-/api/v1/ scheme. Committing generated JSON without the thing that generates
it is how that happens. This script is checked in so the collections can be
rebuilt when the routes change, and test_postman_drift.py catches it when they
have not been.

What the admin collection asserts
---------------------------------
Not the happy path. A run authenticates as an ordinary user, and every admin
endpoint must answer 403. `require_admin` is the only thing standing between a
normal account and other users' data, and nothing tested that it is applied to
each route. An endpoint that forgets the decorator fails here.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = REPO_ROOT / "Backend" / "postman" / "collections"

SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"

PREREQUEST = {
    "listen": "prerequest",
    "script": {
        "type": "text/javascript",
        "exec": [
            "// Generate unique UUID for this run if not set",
            "if (!pm.collectionVariables.get('testUuid')) {",
            "  const uuid = require('uuid');",
            "  pm.collectionVariables.set('testUuid', uuid.v4().substring(0, 8));",
            "}",
            "// Auto-inject Authorization header if accessToken is set (skip for noauth requests)",
            "const isNoAuth = pm.request.auth && pm.request.auth.type === 'noauth';",
            "if (pm.collectionVariables.get('accessToken') && !isNoAuth) {",
            "  pm.request.headers.upsert({",
            "    key: 'Authorization',",
            "    value: 'Bearer ' + pm.collectionVariables.get('accessToken'),",
            "    type: 'text'",
            "  });",
            "}",
        ],
    },
}


def variables(test_password: str = "AuditP@ss2026x!") -> list[dict]:
    return [
        {"key": "baseUrl", "value": "https://lugn-trygg-backend.onrender.com"},
        {"key": "accessToken", "value": ""},
        {"key": "userId", "value": ""},
        {"key": "testPassword", "value": test_password},
        {"key": "testUuid", "value": ""},
    ]


def url(path: str) -> dict:
    """Build both the raw URL and the structured path Postman actually sends.

    They have to agree: Postman sends `path`, not `raw`, so a collection with a
    corrected raw URL and a stale path array still hits the old endpoint.
    """
    clean = path.split("?")[0]
    return {
        "raw": "{{baseUrl}}" + path,
        "host": ["{{baseUrl}}"],
        "path": [seg for seg in clean.strip("/").split("/") if seg],
    }


def request(method: str, path: str, body: dict | None = None) -> dict:
    req: dict = {
        "method": method,
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "url": url(path),
    }
    if body is not None:
        req["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2, ensure_ascii=False)}
    return req


def test_script(lines: list[str]) -> list[dict]:
    return [{"listen": "test", "script": {"type": "text/javascript", "exec": lines}}]


def auth_setup(label: str, display_name: str) -> dict:
    email = f"e2e-{label}-{{{{testUuid}}}}@test.lugntrygg.se"
    return {
        "name": "0. Auth Setup",
        "item": [
            {
                "name": "Register Test User",
                "request": request(
                    "POST",
                    "/api/v1/auth/register",
                    {
                        "email": email,
                        "password": "{{testPassword}}",
                        "name": display_name,
                        "accept_terms": True,
                        "accept_privacy": True,
                    },
                ),
                "event": test_script([
                    "const status = pm.response.code;",
                    "",
                    "pm.test('Register returns 201, 409 or 429 (rate limited)', () => {",
                    "  pm.expect([201, 409, 429]).to.include(status);",
                    "});",
                    "",
                    "if (status === 201) {",
                    "  const responseData = pm.response.json().data || pm.response.json();",
                    "  if (responseData.accessToken) pm.collectionVariables.set('accessToken', responseData.accessToken);",
                    "  if (responseData.user_id) pm.collectionVariables.set('userId', responseData.user_id);",
                    "}",
                ]),
            },
            {
                "name": "Login Test User",
                "request": request(
                    "POST",
                    "/api/v1/auth/login",
                    {"email": email, "password": "{{testPassword}}"},
                ),
                "event": test_script([
                    "const status = pm.response.code;",
                    "",
                    "pm.test('Login returns 200 or 429 (rate limited)', () => {",
                    "  pm.expect([200, 429]).to.include(status);",
                    "});",
                    "",
                    "if (status === 200) {",
                    "  const data = pm.response.json().data || pm.response.json();",
                    "  pm.expect(data.accessToken, 'login must return an access token').to.be.a('string');",
                    "  pm.collectionVariables.set('accessToken', data.accessToken);",
                    "  if (data.user_id) pm.collectionVariables.set('userId', data.user_id);",
                    "}",
                ]),
            },
        ],
    }


# --------------------------------------------------------------------------
# admin — every route must refuse an ordinary account
# --------------------------------------------------------------------------

ADMIN_ROUTES = [
    ("GET", "/api/v1/admin/performance-metrics", None),
    ("GET", "/api/v1/admin/stats", None),
    ("GET", "/api/v1/admin/users", None),
    ("PUT", "/api/v1/admin/users/some-other-user-id/status", {"status": "suspended"}),
    ("GET", "/api/v1/admin/reports", None),
    ("POST", "/api/v1/admin/reports/nonexistent-report-id/resolve", {"resolution": "dismissed"}),
    ("GET", "/api/v1/admin/system/health", None),
]


def admin_collection() -> dict:
    denied = [
        {
            "name": f"{method} {path.replace('/api/v1', '')} - non-admin is refused",
            "request": request(method, path, body),
            "event": test_script([
                "const status = pm.response.code;",
                "",
                "// The account this collection authenticates as is an ordinary user.",
                "// require_admin is the only thing between it and other users' data.",
                "pm.test('Admin endpoint refuses a non-admin (403)', () => {",
                "  pm.expect(status, 'a 200 here means require_admin is missing from this route').to.eql(403);",
                "});",
                "",
                "pm.test('Refusal does not leak a payload', () => {",
                "  const body = pm.response.json();",
                "  pm.expect(body).to.not.have.property('users');",
                "  pm.expect(body).to.not.have.property('reports');",
                "});",
            ]),
        }
        for method, path, body in ADMIN_ROUTES
    ]

    unauthenticated = [
        {
            "name": f"{method} {path.replace('/api/v1', '')} - no token is refused",
            "request": {**request(method, path, body), "auth": {"type": "noauth"}},
            "event": test_script([
                "pm.test('Unauthenticated request is rejected (401)', () => {",
                "  pm.expect(pm.response.code).to.eql(401);",
                "});",
            ]),
        }
        for method, path, body in ADMIN_ROUTES
    ]

    return {
        "info": {
            "name": "Lugn & Trygg - Admin API",
            "schema": SCHEMA,
            "_postman_id": str(uuid.uuid5(uuid.NAMESPACE_URL, "lugntrygg/admin_routes")),
            "description": (
                "Contract collection for src/routes/admin_routes.py.\n\n"
                "This blueprint had NO collection at all — 7 routes, including one that "
                "changes another user's account status, with zero contract coverage.\n\n"
                "The collection authenticates as an ORDINARY user on purpose. Every "
                "request asserts 403: require_admin is the only control protecting these "
                "endpoints, and a route that loses the decorator answers 200 instead. "
                "Granting this collection admin rights would test the happy path and "
                "stop testing the thing that actually matters."
            ),
        },
        "variable": variables(),
        "event": [PREREQUEST],
        "item": [
            auth_setup("admin", "E2E Admin Tester"),
            {"name": "1. Admin routes refuse a non-admin", "item": denied},
            {"name": "2. Admin routes refuse an anonymous caller", "item": unauthenticated},
        ],
    }


# --------------------------------------------------------------------------
# predictive — ordinary JWT auth, so the happy path is reachable
# --------------------------------------------------------------------------

def predictive_collection() -> dict:
    ok = "pm.expect([200, 429, 503]).to.include(status);"

    reads = [
        (
            "GET /predictive/predict - mood predictions",
            request("GET", "/api/v1/predictive/predict?days=7"),
            [
                "const status = pm.response.code;",
                "",
                "pm.test('Returns 200, or 429/503 when rate limited or the model is unavailable', () => {",
                f"  {ok}",
                "});",
                "",
                "if (status === 200) {",
                "  const data = pm.response.json().data || pm.response.json();",
                "  pm.test('Payload is an object', () => pm.expect(data).to.be.an('object'));",
                "}",
            ],
        ),
        (
            "GET /predictive/predict - negative days is rejected, not 500",
            request("GET", "/api/v1/predictive/predict?days=-5"),
            [
                "// A negative limit reaching Firestore raises InvalidArgument and surfaces",
                "// as a 500. Five endpoints already had that bug (commit fd45a0a).",
                "pm.test('Negative days is a client error, never a 500', () => {",
                "  pm.expect(pm.response.code).to.be.oneOf([400, 422, 429]);",
                "});",
            ],
        ),
        (
            "GET /predictive/crisis-check - crisis risk",
            request("GET", "/api/v1/predictive/crisis-check"),
            [
                "const status = pm.response.code;",
                "",
                "pm.test('Returns 200, or 429/503 when rate limited or unavailable', () => {",
                f"  {ok}",
                "});",
                "",
                "if (status === 200) {",
                "  const data = pm.response.json().data || pm.response.json();",
                "  pm.test('A crisis check answers with an object, never a bare null', () => {",
                "    pm.expect(data).to.be.an('object');",
                "  });",
                "}",
            ],
        ),
        (
            "GET /predictive/insights - personal insights",
            request("GET", "/api/v1/predictive/insights"),
            ["pm.test('Returns 200, 429 or 503', () => {", f"  {ok}", "});"],
        ),
        (
            "GET /predictive/trends - mood trends",
            request("GET", "/api/v1/predictive/trends"),
            ["pm.test('Returns 200, 429 or 503', () => {", f"  {ok}", "});"],
        ),
    ]

    writes = [
        (
            "POST /predictive/train - train model",
            request("POST", "/api/v1/predictive/train", {}),
            [
                "pm.test('Returns 200/202, or 429/503 when rate limited or unavailable', () => {",
                "  pm.expect([200, 202, 429, 503]).to.include(pm.response.code);",
                "});",
            ],
        ),
        (
            "POST /predictive/mood-forecast - forecast",
            request("POST", "/api/v1/predictive/mood-forecast", {"days_ahead": 7}),
            [
                "pm.test('Returns 200, 429 or 503', () => {", f"  {ok}", "});",
            ],
        ),
    ]

    def items(rows):
        return [
            {"name": name, "request": req, "event": test_script(lines)}
            for name, req, lines in rows
        ]

    unauthenticated = {
        "name": "GET /predictive/crisis-check - no token is refused",
        "request": {**request("GET", "/api/v1/predictive/crisis-check"), "auth": {"type": "noauth"}},
        "event": test_script([
            "pm.test('Unauthenticated request is rejected (401)', () => {",
            "  pm.expect(pm.response.code).to.eql(401);",
            "});",
        ]),
    }

    return {
        "info": {
            "name": "Lugn & Trygg - Predictive API",
            "schema": SCHEMA,
            "_postman_id": str(uuid.uuid5(uuid.NAMESPACE_URL, "lugntrygg/predictive_routes")),
            "description": (
                "Contract collection for src/routes/predictive_routes.py.\n\n"
                "This blueprint had NO collection — 6 routes, one of them "
                "/crisis-check, which sits on the crisis path.\n\n"
                "Assertions accept 503 as well as 200: the ML stack (torch, "
                "transformers) is absent from requirements.txt, so these endpoints "
                "legitimately degrade in production. What they must never do is 500, "
                "and a negative ?days= must be a client error rather than an "
                "InvalidArgument from Firestore."
            ),
        },
        "variable": variables(),
        "event": [PREREQUEST],
        "item": [
            auth_setup("predictive", "E2E Predictive Tester"),
            {"name": "1. Reads", "item": items(reads)},
            {"name": "2. Writes", "item": items(writes)},
            {"name": "3. Auth required", "item": [unauthenticated]},
        ],
    }


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, builder in (
        ("admin_routes.postman_collection.json", admin_collection),
        ("predictive_routes.postman_collection.json", predictive_collection),
    ):
        target = OUT_DIR / filename
        target.write_text(
            json.dumps(builder(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        print(f"wrote {target.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
