"""Verify cookie security flags precisely."""
import requests

r = requests.post(
    "https://lugn-trygg-backend.onrender.com/api/v1/auth/login",
    json={"email": "e2e-verify@lugntrygg.se", "password": "E2eTest123!Secure"},
    timeout=30
)

print(f"Login status: {r.status_code}")
print(f"Number of cookies: {len(r.cookies)}")

for cookie in r.cookies:
    if "token" in cookie.name.lower() or "csrf" in cookie.name.lower():
        rest = getattr(cookie, "_rest", {})
        print(f"\nCookie: {cookie.name}")
        print(f"  HttpOnly: {rest.get('HttpOnly', 'NOT SET')}")
        print(f"  Secure: {cookie.secure}")
        print(f"  SameSite: {rest.get('SameSite', 'NOT SET')}")
        print(f"  Path: {cookie.path}")
        print(f"  Max-Age: {cookie.expires}")
        print(f"  Value (first 30 chars): {cookie.value[:30]}...")

# Also check raw Set-Cookie headers
print("\n--- Raw Set-Cookie Headers ---")
for header in r.raw.headers.getlist("Set-Cookie"):
    print(f"  {header[:200]}")
