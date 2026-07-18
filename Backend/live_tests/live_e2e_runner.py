"""Bootstrap live Firebase E2E test by creating a fresh user and running pytest."""
import os
import subprocess
import sys
import time

import requests

BASE_URL = os.getenv('LIVE_BASE_URL', 'https://lugn-trygg-backend.onrender.com').rstrip('/')
EMAIL = os.getenv('LIVE_FIREBASE_EMAIL')
PASSWORD = os.getenv('LIVE_FIREBASE_PASSWORD', 'SecureP@ss123!')

if not EMAIL:
    EMAIL = f"e2e-test-{int(time.time())}@example.com"

print(f"[live-e2e] base_url={BASE_URL}")
print(f"[live-e2e] email={EMAIL}")

# Ensure a test user exists before running the login/refresh/logout flow.
reg = requests.post(
    f"{BASE_URL}/api/v1/auth/register",
    json={
        'email': EMAIL,
        'password': PASSWORD,
        'name': 'E2E Tester',
        'accept_terms': True,
        'accept_privacy': True,
    },
    headers={'Content-Type': 'application/json'},
    timeout=20,
)
if reg.status_code == 201:
    print(f"[live-e2e] registered user {EMAIL}")
elif reg.status_code == 409:
    print("[live-e2e] user already exists, verifying password with login")
    login = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={'email': EMAIL, 'password': PASSWORD},
        headers={'Content-Type': 'application/json'},
        timeout=20,
    )
    if login.status_code != 200:
        print(f"[live-e2e] login failed: {login.status_code} {login.text[:200]}")
        sys.exit(1)
else:
    print(f"[live-e2e] registration failed: {reg.status_code} {reg.text[:200]}")
    sys.exit(1)

env = os.environ.copy()
env['LIVE_FIREBASE_E2E'] = '1'
env['LIVE_BASE_URL'] = BASE_URL
env['LIVE_FIREBASE_EMAIL'] = EMAIL
env['LIVE_FIREBASE_PASSWORD'] = PASSWORD

# Run the existing live E2E test.
cmd = [sys.executable, '-m', 'pytest', 'live_tests/test_auth_live_firebase_e2e.py', '-v']
sys.exit(subprocess.call(cmd, env=env, cwd=os.path.dirname(os.path.dirname(__file__))))
