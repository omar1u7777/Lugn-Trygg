"""Manual smoke tester for sync-history endpoints.

This script intentionally exercises live endpoints to verify that login and sync
history APIs behave as expected. It should *not* run during pytest collection,
so the logic is wrapped inside a callable entry point.
"""

import requests

BASE = "http://localhost:5001"


def run_sync_history_smoke() -> None:
    """Hit sync-history endpoints against a running backend."""

    response = requests.post(
        f"{BASE}/api/auth/login",
        json={
            "email": "sync_test_1764467466@test.com",
            "password": "Test1234!",
        },
        timeout=10,
    )
    print(f"Login: {response.status_code}")

    if response.status_code != 200:
        print(f"Login failed: {response.text[:200]}")
        return

    data = response.json()
    token = data.get("data", {}).get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    print("\nTesting /api/sync-history/list...")
    list_response = requests.get(
        f"{BASE}/api/sync-history/list",
        headers=headers,
        timeout=10,
    )
    print(f"Status: {list_response.status_code}")
    if list_response.status_code == 200:
        result = list_response.json()
        print(f"SUCCESS! History entries: {result.get('total', 0)}")
    else:
        print(f"Error: {list_response.text[:400]}")

    print("\nTesting /api/sync-history/stats...")
    stats_response = requests.get(
        f"{BASE}/api/sync-history/stats",
        headers=headers,
        timeout=10,
    )
    print(f"Status: {stats_response.status_code}")
    if stats_response.status_code == 200:
        print("SUCCESS! Stats returned")
        print(stats_response.json())
    else:
        print(f"Error: {stats_response.text[:400]}")


if __name__ == "__main__":
    run_sync_history_smoke()
