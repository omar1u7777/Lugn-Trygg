"""Verify cookie security flags precisely."""
import os
import sys

import requests

BASE = os.getenv("VERIFY_BASE_URL", "https://lugn-trygg-backend.onrender.com")
# Credentials from environment — never hardcode live credentials in the repo.
TEST_EMAIL = os.getenv("E2E_TEST_EMAIL")
TEST_PASSWORD = os.getenv("E2E_TEST_PASSWORD")
if not TEST_EMAIL or not TEST_PASSWORD:
    print("ERROR: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars before running.")
    sys.exit(2)

r = requests.post(
    f"{BASE}/api/v1/auth/login",
    json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
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
