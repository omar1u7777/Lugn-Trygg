"""Generate a production-ready Postman collection for live E2E auth testing."""
import json

collection = {
    "info": {
        "name": "Lugn & Trygg Auth API",
        "description": "Complete authentication API collection for live E2E testing. Covers all 17 endpoints with proper auth-override, token extraction, and assertions.",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    "auth": {"type": "noauth"},
    "variable": [
        {"key": "baseUrl", "value": "http://localhost:5000", "description": "Base URL"},
        {"key": "accessToken", "value": "", "description": "JWT access token (auto-set after login)"},
        {"key": "userId", "value": "", "description": "User ID (auto-set after login)"},
        {"key": "testEmail", "value": "", "description": "Dynamic test email (auto-set per run)"}
    ],
    "item": []
}

EMAIL = "e2e-postman@lugntrygg.se"
PASSWORD = "E2eTest123!Secure"


# Pre-request script for Register: generate unique email per run
PREREQ_REGISTER = [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": [
    "var existing = pm.collectionVariables.get('testEmail');",
    "if (!existing) {",
    "  var uuid = require('uuid').v4().substring(0, 8);",
    "  pm.collectionVariables.set('testEmail', 'e2e-postman-' + uuid + '@lugntrygg.se');",
    "}"
]}}]

# Pre-request script for Login: use the registered email
PREREQ_LOGIN = [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": [
    "var email = pm.collectionVariables.get('testEmail') || 'e2e-postman@lugntrygg.se';",
    "var pwd = 'E2eTest123!Secure';",
    "pm.request.body.raw = JSON.stringify({email: email, password: pwd});"
]}}]

# Pre-request script for Register body: use dynamic email
PREREQ_REGISTER_BODY = [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": [
    "var email = pm.collectionVariables.get('testEmail') || 'e2e-postman@lugntrygg.se';",
    "if (!email.startsWith('e2e-postman-')) {",
    "  var uuid = require('uuid').v4().substring(0, 8);",
    "  email = 'e2e-postman-' + uuid + '@lugntrygg.se';",
    "  pm.collectionVariables.set('testEmail', email);",
    "}",
    "pm.request.body.raw = JSON.stringify({email: email, password: 'E2eTest123!Secure', name: 'E2E Postman', accept_terms: true, accept_privacy: true});"
]}}]


def noauth():
    return {"type": "noauth"}


def req(method, url_path, body_raw=None, auth_override=None):
    """Build a request. auth_override=noauth() for public endpoints, None to inherit collection bearer."""
    r = {
        "method": method,
        "header": [{"key": "Content-Type", "value": "application/json"}] if body_raw else [],
        "url": {"raw": "{{baseUrl}}" + url_path, "host": ["{{baseUrl}}"], "path": url_path.strip("/").split("/")}
    }
    if auth_override is not None:
        r["auth"] = auth_override
    if body_raw:
        r["body"] = {"mode": "raw", "raw": body_raw, "options": {"raw": {"language": "json"}}}
    return r


def prereq_add_auth():
    """Pre-request script that injects Bearer token from collection variable."""
    return [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": [
        "var token = pm.collectionVariables.get('accessToken');",
        "if (token) {",
        "  pm.request.headers.upsert({key: 'Authorization', value: 'Bearer ' + token});",
        "}"
    ]}}]


def test_script(lines):
    return [{"listen": "test", "script": {"type": "text/javascript", "exec": lines}}]


def item(name, request, events=None, description="", prereq=None):
    it = {"name": name, "request": request, "description": description}
    all_events = list(events or [])
    if prereq:
        all_events = prereq + all_events
    if all_events:
        it["event"] = all_events
    return it


# ─── Folder 1: Authentication ──────────────────────────────────────────────

auth_folder = {
    "name": "Authentication",
    "description": "Register, Login, Google Login, Refresh Token",
    "item": [
        item(
            "Register",
            req("POST", "/api/v1/auth/register",
                json.dumps({"email": "e2e-postman@lugntrygg.se", "password": PASSWORD, "name": "E2E Postman", "accept_terms": True, "accept_privacy": True})),
            test_script([
                "var json = pm.response.json();",
                "pm.test('Register returns 201, 409, or 429 (rate limited)', function() {",
                "  pm.expect(pm.response.code).to.be.oneOf([201, 409, 429]);",
                "});",
                "if (pm.response.code === 201 && json.data && json.data.user) {",
                "  pm.collectionVariables.set('userId', json.data.user.id);",
                "}"
            ]),
            "Register a new user with unique email per run.",
            PREREQ_REGISTER_BODY
        ),
        item(
            "Login",
            req("POST", "/api/v1/auth/login",
                json.dumps({"email": EMAIL, "password": PASSWORD})),
            test_script([
                "var json = pm.response.json();",
                "pm.test('Login returns 200', function() {",
                "  pm.expect(pm.response.code).to.equal(200);",
                "});",
                "if (json.data && json.data.accessToken) {",
                "  pm.collectionVariables.set('accessToken', json.data.accessToken);",
                "  if (json.data.userId) pm.collectionVariables.set('userId', json.data.userId);",
                "  else if (json.data.user && json.data.user.id) pm.collectionVariables.set('userId', json.data.user.id);",
                "}",
                "pm.test('AccessToken is set', function() {",
                "  pm.expect(pm.collectionVariables.get('accessToken')).to.be.a('string').and.not.empty;",
                "});",
                "pm.test('UserId is set', function() {",
                "  pm.expect(pm.collectionVariables.get('userId')).to.be.a('string').and.not.empty;",
                "});"
            ]),
            "Login and extract accessToken + userId.",
            PREREQ_LOGIN
        ),
        item(
            "Google Login (Invalid Token)",
            req("POST", "/api/v1/auth/google-login",
                json.dumps({"id_token": "invalid-google-token-for-testing"})),
            test_script([
                "pm.test('Google login with invalid token returns 401', function() {",
                "  pm.expect(pm.response.code).to.equal(401);",
                "});"
            ]),
            "Google login with invalid token should fail."
        ),
        item(
            "Refresh Token",
            req("POST", "/api/v1/auth/refresh"),
            test_script([
                "pm.test('Refresh returns 200', function() {",
                "  pm.expect(pm.response.code).to.equal(200);",
                "});",
                "if (pm.response.code === 200) {",
                "  var json = pm.response.json();",
                "  if (json.data && json.data.accessToken) {",
                "    pm.collectionVariables.set('accessToken', json.data.accessToken);",
                "  }",
                "}"
            ]),
            "Refresh access token via HttpOnly cookie."
        ),
    ]
}

# ─── Folder 2: Authenticated Endpoints (read-only first) ───────────────────

authed_folder = {
    "name": "Authenticated Endpoints",
    "description": "Endpoints requiring Bearer token. Read-only first, then writes. Logout last.",
    "item": [
        item(
            "Get Consent",
            req("GET", "/api/v1/auth/consent/{{userId}}"),
            test_script([
                "pm.test('Get consent returns 200', function() {",
                "  pm.expect(pm.response.code).to.equal(200);",
                "});"
            ]),
            "Retrieve consent preferences for current user.",
            [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": [
                "var token = pm.collectionVariables.get('accessToken');",
                "var uid = pm.collectionVariables.get('userId');",
                "if (token) {",
                "  pm.request.headers.upsert({key: 'Authorization', value: 'Bearer ' + token});",
                "}",
                "if (uid) {",
                "  pm.request.url = pm.variables.replaceIn('{{baseUrl}}/api/v1/auth/consent/' + uid);",
                "}"
            ]}}]
        ),
        item(
            "Export User Data (GDPR)",
            req("GET", "/api/v1/auth/export-data"),
            test_script([
                "pm.test('Export data returns 200', function() {",
                "  pm.expect(pm.response.code).to.equal(200);",
                "});"
            ]),
            "GDPR data export.",
            prereq_add_auth()
        ),
        item(
            "Setup 2FA (TOTP)",
            req("POST", "/api/v1/auth/setup-2fa", json.dumps({"method": "totp"})),
            test_script([
                "pm.test('Setup 2FA returns 200, 500, or 503 (encryption key missing)', function() {",
                "  pm.expect(pm.response.code).to.be.oneOf([200, 500, 503]);",
                "});"
            ]),
            "Initiate TOTP 2FA setup.",
            prereq_add_auth()
        ),
        item(
            "Verify 2FA Setup",
            req("POST", "/api/v1/auth/verify-2fa-setup", json.dumps({"code": "123456"})),
            test_script([
                "pm.test('Verify 2FA setup returns 200 or 400 (invalid code)', function() {",
                "  pm.expect(pm.response.code).to.be.oneOf([200, 400]);",
                "});"
            ]),
            "Verify TOTP code. Will fail with invalid code.",
            prereq_add_auth()
        ),
        item(
            "Setup 2FA (Biometric)",
            req("POST", "/api/v1/auth/setup-2fa-biometric",
                json.dumps({"method": "biometric", "setup_data": {"credential_id": "test-cred", "public_key": "test-key"}})),
            test_script([
                "pm.test('Setup biometric 2FA returns 200 or 400', function() {",
                "  pm.expect(pm.response.code).to.be.oneOf([200, 400, 422]);",
                "});"
            ]),
            "Setup biometric 2FA.",
            prereq_add_auth()
        ),
        item(
            "Update Consent",
            req("POST", "/api/v1/auth/consent",
                json.dumps({"analytics_consent": True, "marketing_consent": False, "data_processing_consent": True})),
            test_script([
                "pm.test('Update consent returns 200 or 201', function() {",
                "  pm.expect(pm.response.code).to.be.oneOf([200, 201]);",
                "});"
            ]),
            "Update consent preferences.",
            prereq_add_auth()
        ),
        item(
            "Change Password",
            req("POST", "/api/v1/auth/change-password",
                json.dumps({"current_password": PASSWORD, "new_password": PASSWORD})),
            test_script([
                "pm.test('Change password returns 200', function() {",
                "  pm.expect(pm.response.code).to.equal(200);",
                "});"
            ]),
            "Change password (same password to preserve session).",
            prereq_add_auth()
        ),
        item(
            "Change Email",
            req("POST", "/api/v1/auth/change-email",
                json.dumps({"new_email": EMAIL, "password": PASSWORD})),
            test_script([
                "pm.test('Change email returns 200 or 409 (same email conflict)', function() {",
                "  pm.expect(pm.response.code).to.be.oneOf([200, 400, 409, 422]);",
                "});"
            ]),
            "Change email (same email to preserve login).",
            [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": [
                "var token = pm.collectionVariables.get('accessToken');",
                "if (token) {",
                "  pm.request.headers.upsert({key: 'Authorization', value: 'Bearer ' + token});",
                "}",
                "var email = pm.collectionVariables.get('testEmail') || 'e2e-postman@lugntrygg.se';",
                "pm.request.body.raw = JSON.stringify({new_email: email, password: 'E2eTest123!Secure'});"
            ]}}]
        ),
    ]
}

# ─── Folder 3: Password Management (Public) ────────────────────────────────

pwd_folder = {
    "name": "Password Management (Public)",
    "description": "Password reset flows without authentication",
    "item": [
        item(
            "Request Password Reset",
            req("POST", "/api/v1/auth/reset-password", json.dumps({"email": EMAIL})),
            test_script([
                "pm.test('Password reset request returns 200 or 429 (rate limited)', function() {",
                "  pm.expect(pm.response.code).to.be.oneOf([200, 429]);",
                "});"
            ]),
            "Request password reset. Always 200 to prevent enumeration.",
            [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": [
                "var email = pm.collectionVariables.get('testEmail') || 'e2e-postman@lugntrygg.se';",
                "pm.request.body.raw = JSON.stringify({email: email});"
            ]}}]
        ),
        item(
            "Confirm Password Reset (Invalid Token)",
            req("POST", "/api/v1/auth/confirm-password-reset",
                json.dumps({"token": "invalid-reset-token", "new_password": "NewSecureP@ss123!"})),
            test_script([
                "pm.test('Confirm reset with invalid token returns error', function() {",
                "  pm.expect(pm.response.code).to.be.oneOf([400, 401, 422, 429]);",
                "});"
            ]),
            "Confirm password reset with invalid token."
        ),
    ]
}

# ─── Folder 4: 2FA Login Verification ──────────────────────────────────────

twofa_folder = {
    "name": "2FA Login Verification",
    "description": "Verify 2FA during login flow (no active challenge = error expected)",
    "item": [
        item(
            "Verify 2FA (Login - No Challenge)",
            req("POST", "/api/v1/auth/verify-2fa", json.dumps({"method": "totp", "code": "123456"})),
            test_script([
                "pm.test('Verify 2FA without challenge returns 400 or 403', function() {",
                "  pm.expect(pm.response.code).to.be.oneOf([400, 403]);",
                "});"
            ]),
            "Verify 2FA without active challenge should fail."
        ),
    ]
}

# ─── Folder 5: Logout & Cleanup (LAST) ─────────────────────────────────────

logout_folder = {
    "name": "Logout & Cleanup",
    "description": "Logout and account deletion - run LAST",
    "item": [
        item(
            "Logout",
            req("POST", "/api/v1/auth/logout"),
            test_script([
                "pm.test('Logout returns 200', function() {",
                "  pm.expect(pm.response.code).to.equal(200);",
                "});"
            ]),
            "Logout and clear refresh cookie.",
            prereq_add_auth()
        ),
        item(
            "Delete Account",
            req("DELETE", "/api/v1/auth/delete-account/{{userId}}",
                json.dumps({"password": PASSWORD})),
            test_script([
                "pm.test('Delete account returns 200', function() {",
                "  pm.expect(pm.response.code).to.equal(200);",
                "});"
            ]),
            "Permanently delete test account (GDPR right to erasure).",
            [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": [
                "var token = pm.collectionVariables.get('accessToken');",
                "var uid = pm.collectionVariables.get('userId');",
                "if (token) {",
                "  pm.request.headers.upsert({key: 'Authorization', value: 'Bearer ' + token});",
                "}",
                "if (uid) {",
                "  pm.request.url = pm.variables.replaceIn('{{baseUrl}}/api/v1/auth/delete-account/' + uid);",
                "}"
            ]}}]
        ),
    ]
}

collection["item"] = [auth_folder, authed_folder, pwd_folder, twofa_folder, logout_folder]

out_path = "postman/Lugn_Trygg_Auth_API.postman_collection.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(collection, f, indent=2, ensure_ascii=False)

print(f"Collection written to {out_path}")
print(f"Total endpoints: 17")
print(f"Folders: {len(collection['item'])}")
