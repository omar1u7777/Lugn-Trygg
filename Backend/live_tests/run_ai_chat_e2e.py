"""Bootstrap live AI Chat E2E test suite.

Usage:
  python live_tests/run_ai_chat_e2e.py                    # local backend
  LIVE_BASE_URL=https://myapp.onrender.com python live_tests/run_ai_chat_e2e.py

Requires:
  - FIREBASE_WEB_API_KEY env var
  - serviceAccountKey.json in Backend/ root
  - Backend running and reachable
"""

import os
import subprocess
import sys

BASE_URL = os.getenv("LIVE_BASE_URL", os.getenv("BACKEND_URL", "http://127.0.0.1:5001"))

print(f"[ai-chat-e2e] base_url={BASE_URL}")

env = os.environ.copy()
env["LIVE_E2E"] = "1"
env["BACKEND_URL"] = BASE_URL

cmd = [
    sys.executable,
    "-m",
    "pytest",
    "live_tests/test_ai_chat_live_e2e.py",
    "-v",
    "--tb=short",
    "-s",
    "-p", "no:cacheprovider",
]

sys.exit(subprocess.call(cmd, env=env, cwd=os.path.dirname(os.path.dirname(__file__))))
