"""Reusable building blocks for generating Postman v2.1 collections for
Lugn & Trygg backend route audits.

Every past audit (crisis, peer_chat, privacy, referral, rewards, subscription,
sync_history, users, voice, auth, ...) hand-rolled the exact same auth-setup
folder, req() helper, and prerequest script. Import this module instead of
re-writing them.

Typical usage in a gen_<domain>.py script:

    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))  # if not already on path
    from postman_helpers import req, auth_setup_folder, write_collection

    SLUG = "widget_routes"
    NAME = "Widget"

    my_folder = {
        "name": "1. Widgets",
        "item": [
            req("GET /widgets/{{widgetId}} - Get own widget", "GET", "/api/v1/widgets/{{widgetId}}",
                test_lines=[
                    "pm.test('Get widget returns 200', () => { pm.expect(pm.response.code).to.eql(200); });",
                ]),
            req("GET /widgets/{{widgetId}} - No auth (expect 401)", "GET", "/api/v1/widgets/{{widgetId}}",
                auth_noauth=True,
                test_lines=["pm.test('No auth returns 401', () => { pm.expect([401, 403]).to.include(pm.response.code); });"]),
        ],
    }

    write_collection(
        name="Lugn & Trygg - Widget API",
        description="Widget CRUD.",
        folders=[auth_setup_folder(SLUG, NAME), my_folder],
        out_path=r"C:\...\Backend\postman\collections\widget_routes.postman_collection.json",
        extra_variables=[{"key": "widgetId", "value": ""}],
    )
"""

import json


def req(name, method, path, body=None, auth_noauth=False, headers=None, test_lines=None):
    """One Postman request item.

    - `body`: a JSON string (use Python dicts -> json.dumps, or an f-string with
      {{collectionVariable}} placeholders left literal -- Postman resolves those
      at request time, not at generation time).
    - `auth_noauth`: True strips the Authorization header entirely for this one
      request (the collection-level prerequest script skips injection for
      noauth-typed requests) -- use for testing "no auth -> 401" paths.
    - `headers`: extra raw headers, e.g. a forged/garbage Authorization value
      or a stripe-signature header, when you need something the prerequest
      script wouldn't produce.
    - `test_lines`: raw JS lines for the Postman "test" (post-response) event.
      Keep assertions to pm.expect(...) on status code and response shape --
      see references/known-bug-patterns.md for what's worth asserting.
    """
    hdrs = [{"key": "Content-Type", "value": "application/json"}] if body else []
    if headers:
        hdrs += headers
    r = {
        "name": name,
        "request": {
            "method": method,
            "header": hdrs,
            "url": {
                "raw": "{{baseUrl}}" + path,
                "host": ["{{baseUrl}}"],
                "path": [p for p in path.split("?")[0].strip("/").split("/")],
            },
        },
    }
    if "?" in path:
        r["request"]["url"]["query"] = [
            {"key": kv.split("=", 1)[0], "value": kv.split("=", 1)[1] if "=" in kv else ""}
            for kv in path.split("?", 1)[1].split("&")
        ]
    if body:
        r["request"]["body"] = {"mode": "raw", "raw": body}
    if auth_noauth:
        r["request"]["auth"] = {"type": "noauth"}
    if test_lines:
        r["event"] = [{"listen": "test", "script": {"type": "text/javascript", "exec": test_lines}}]
    return r


def auth_setup_folder(slug, name, extra_register_fields=None):
    """Standard '0. Auth Setup' folder: register a disposable e2e test account,
    log in, capture accessToken/userId into collection variables.

    `slug` should match the domain (e.g. "peer_chat_routes") -- it becomes part
    of the throwaway email so runs across domains never collide, and so stray
    test accounts are easy to identify/clean up later if ever needed.
    `name` is a short human label used in the account's display name.
    """
    extra = extra_register_fields or {}
    extra_json = "".join(f',\n  "{k}": {json.dumps(v)}' for k, v in extra.items())
    return {
        "name": "0. Auth Setup",
        "item": [
            req(
                "Register Test User", "POST", "/api/v1/auth/register",
                body=(
                    '{\n  "email": "e2e-%s-{{testUuid}}@test.lugntrygg.se",\n'
                    '  "password": "{{testPassword}}",\n  "name": "E2E %s Tester",\n'
                    '  "accept_terms": true,\n  "accept_privacy": true%s\n}'
                ) % (slug, name, extra_json),
                auth_noauth=True,
                test_lines=[
                    "const status = pm.response.code; let body = {};",
                    "try { body = pm.response.json(); } catch (e) {}",
                    "pm.test('Register returns 201, 409 or 429', () => { pm.expect([201, 409, 429]).to.include(status); });",
                    "if (status === 201) {",
                    "  const responseData = body.data || body;",
                    "  const user = responseData.user || responseData;",
                    "  if (user.id) pm.collectionVariables.set('userId', user.id);",
                    "}",
                ],
            ),
            req(
                "Login Test User", "POST", "/api/v1/auth/login",
                body=(
                    '{\n  "email": "e2e-%s-{{testUuid}}@test.lugntrygg.se",\n'
                    '  "password": "{{testPassword}}"\n}'
                ) % slug,
                auth_noauth=True,
                test_lines=[
                    "const status = pm.response.code; let body = {};",
                    "try { body = pm.response.json(); } catch (e) {}",
                    "pm.test('Login returns 200 (or 429)', () => { pm.expect([200, 429]).to.include(status); });",
                    "if (status === 200) {",
                    "  const responseData = body.data || body;",
                    "  pm.collectionVariables.set('accessToken', responseData.accessToken);",
                    "  pm.collectionVariables.set('userId', responseData.userId || (responseData.user && responseData.user.id) || '');",
                    "  pm.test('AccessToken is set, requires2FA is falsy for fresh account', () => {",
                    "    pm.expect(pm.collectionVariables.get('accessToken')).to.not.be.empty;",
                    "    pm.expect(responseData.requires2FA).to.not.be.ok;",
                    "  });",
                    "}",
                ],
            ),
        ],
    }


def standard_prerequest_script():
    """Collection-level prerequest script: generate testUuid once, inject the
    Bearer token on every request except ones marked noauth. Must live in the
    collection's top-level "event" array (see write_collection), not on
    individual requests."""
    return [
        {
            "listen": "prerequest",
            "script": {
                "type": "text/javascript",
                "exec": [
                    "if (!pm.collectionVariables.get('testUuid')) {",
                    "  const uuid = require('uuid');",
                    "  pm.collectionVariables.set('testUuid', uuid.v4().substring(0, 8));",
                    "}",
                    "const isNoAuth = pm.request.auth && pm.request.auth.type === 'noauth';",
                    "if (pm.collectionVariables.get('accessToken') && !isNoAuth) {",
                    "  pm.request.headers.upsert({ key: 'Authorization', value: 'Bearer ' + pm.collectionVariables.get('accessToken'), type: 'text' });",
                    "}",
                ],
            },
        }
    ]


def write_collection(name, description, folders, out_path, extra_variables=None, base_url="https://lugn-trygg-backend.onrender.com"):
    """Assemble and write the full collection JSON.

    `folders` should already include auth_setup_folder(...) as its first
    element (build it explicitly in the caller so the auth-setup folder title
    stays visible and editable, rather than hiding it inside this function).
    """
    variables = [
        {"key": "baseUrl", "value": base_url},
        {"key": "accessToken", "value": ""},
        {"key": "userId", "value": ""},
        {"key": "testPassword", "value": "AuditP@ss2026x!"},
        {"key": "testUuid", "value": ""},
    ] + (extra_variables or [])

    collection = {
        "info": {
            "name": name,
            "description": description,
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "item": folders,
        "event": standard_prerequest_script(),
        "variable": variables,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(collection, f, indent=2)
    print("wrote", out_path)
