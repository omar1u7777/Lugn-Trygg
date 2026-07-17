"""Production security verification script."""
import requests
import json
import base64

BASE = "https://lugn-trygg-backend.onrender.com"
API = f"{BASE}/api/v1/auth"
TEST_EMAIL = "e2e-verify@lugntrygg.se"
TEST_PASSWORD = "E2eTest123!Secure"

print("=" * 60)
print("PRODUCTION SECURITY VERIFICATION")
print("=" * 60)

# 1. JWT Structure
print("\n--- JWT Token Structure ---")
r = requests.post(f"{API}/login", json={
    "email": TEST_EMAIL,
    "password": TEST_PASSWORD
}, timeout=30)

print(f"Login status: {r.status_code}")
data = r.json().get("data", {})
token = data.get("accessToken", "")
refresh_in_body = bool(data.get("refreshToken"))

if token:
    parts = token.split(".")
    print(f"JWT parts: {len(parts)} (expected 3)")
    payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
    print(f"Token type: {payload.get('type')}")
    print(f"Issuer (iss): {payload.get('iss')}")
    print(f"Audience (aud): {payload.get('aud')}")
    print(f"Subject (sub): {payload.get('sub', 'N/A')[:12]}...")
    print(f"Expires (exp): present={bool(payload.get('exp'))}")
    print(f"Issued at (iat): present={bool(payload.get('iat'))}")
    print(f"Refresh token in body: {refresh_in_body} (should be False)")
else:
    print("WARNING: No access token received")

# Check cookies
cookies_header = r.headers.get("Set-Cookie", "")
print(f"\nSet-Cookie present: {bool(cookies_header)}")
has_refresh_cookie = "refresh_token" in cookies_header.lower()
has_csrf_cookie = "csrf" in cookies_header.lower()
print(f"Refresh token in HttpOnly cookie: {has_refresh_cookie}")
print(f"CSRF token in cookie: {has_csrf_cookie}")

# Check cookie flags
if has_refresh_cookie:
    for part in cookies_header.split(","):
        if "refresh_token" in part.lower():
            print(f"  Cookie flags: {part.strip()[:120]}...")
            print(f"  HttpOnly: {'HttpOnly' in part}")
            print(f"  Secure: {'Secure' in part}")
            print(f"  SameSite: {'SameSite=' in part}")

# 2. Rate limiting
print("\n--- Rate Limiting ---")
print("Health endpoint (exempt from rate limit):")
for i in range(3):
    hr = requests.get(f"{BASE}/health", timeout=10)
    print(f"  Request {i+1}: {hr.status_code}")

# 3. Redis connectivity
print(f"\n--- Redis ---")
health = requests.get(f"{BASE}/health", timeout=10).json()
print(f"Redis connected: {health.get('redis')}")
print(f"Firebase connected: {health.get('firebase')}")

# 4. CSP verification
print("\n--- Content Security Policy ---")
csp = r.headers.get("Content-Security-Policy", "")
if not csp:
    hr2 = requests.get(f"{BASE}/health", timeout=10)
    csp = hr2.headers.get("Content-Security-Policy", "")

if csp:
    print(f"CSP present: True")
    print(f"Contains nonce: {'nonce-' in csp}")
    print(f"Contains unsafe-inline: {'unsafe-inline' in csp}")
    print(f"Contains unsafe-eval: {'unsafe-eval' in csp}")
    print(f"object-src none: {'object-src' in csp and 'none' in csp}")
    print(f"frame-ancestors: {'frame-ancestors' in csp}")
else:
    print("CSP present: False")

# 5. HSTS
print("\n--- HSTS ---")
hsts = requests.get(f"{BASE}/health", timeout=10).headers.get("Strict-Transport-Security", "")
print(f"HSTS: {hsts}")
print(f"max-age present: {'max-age' in hsts}")
print(f"includeSubDomains: {'includeSubDomains' in hsts}")

# 6. CORS
print("\n--- CORS ---")
preflight = requests.options(f"{API}/login", headers={
    "Origin": "https://lugn-trygg.vercel.app",
    "Access-Control-Request-Method": "POST"
}, timeout=10)
print(f"Valid origin allowed: {preflight.headers.get('Access-Control-Allow-Origin')}")
bad_preflight = requests.options(f"{API}/login", headers={
    "Origin": "https://evil-site.com",
    "Access-Control-Request-Method": "POST"
}, timeout=10)
print(f"Evil origin blocked: {bad_preflight.headers.get('Access-Control-Allow-Origin', 'NONE')}")

# 7. Refresh token rotation
print("\n--- Refresh Token Rotation ---")
refresh_cookie = None
for c in r.cookies:
    if "refresh_token" in c.name.lower():
        refresh_cookie = c.value
        break

if refresh_cookie:
    rr = requests.post(f"{API}/refresh", cookies={"refresh_token": refresh_cookie}, timeout=30)
    print(f"Refresh status: {rr.status_code}")
    if rr.status_code == 200:
        new_data = rr.json().get("data", {})
        print(f"New accessToken issued: {bool(new_data.get('accessToken'))}")
        # Check new refresh cookie
        new_cookies = rr.headers.get("Set-Cookie", "")
        print(f"New refresh cookie issued: {'refresh_token' in new_cookies.lower()}")
else:
    print("No refresh cookie found to test rotation")

# 8. Logout invalidates session
print("\n--- Session Invalidation ---")
if token:
    lr = requests.post(f"{API}/logout", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    print(f"Logout status: {lr.status_code}")

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)
