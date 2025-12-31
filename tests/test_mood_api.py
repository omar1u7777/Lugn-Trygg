import requests
import sys


BASE_URL = "http://localhost:54112"


def _check_health() -> bool:
    """Perform the health check and return True/False for reuse."""
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"✅ Health check: {response.status_code}")
        return response.status_code == 200
    except Exception as e:  # pragma: no cover - network failure path is logged
        print(f"❌ Health check failed: {e}")
        return False
Simple test script for Mood API endpoints
"""

import requests
    assert _check_health(), "Health endpoint should respond with HTTP 200"


def _check_mood_endpoints() -> bool:
    """Probe protected mood endpoints and ensure they reject anonymous calls."""
    endpoints = [
        "/api/mood",
        "/api/mood/recent",
        "/api/mood/today",
        "/api/mood/streaks",
        "/api/mood-stats/statistics",
    ]

    success_count = 0
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}")
            if response.status_code == 401:
                print(f"✅ {endpoint}: Protected (401 Unauthorized) - Expected")
                success_count += 1
            elif response.status_code == 404:
                print(f"❌ {endpoint}: Not found (404)")
            else:
                print(f"⚠️  {endpoint}: Unexpected status {response.status_code}")
        except Exception as e:  # pragma: no cover - network failure path is logged
            print(f"❌ {endpoint}: Connection failed - {e}")

    return success_count == len(endpoints)
        response = requests.get(f"{BASE_URL}/health")
        print(f"✅ Health check: {response.status_code}")
        return response.status_code == 200
    except Exception as e:
    assert _check_mood_endpoints(), "All mood endpoints should reject anonymous calls with 401"


def _check_docs() -> bool:
    """Verify docs endpoint is live."""
    try:
        response = requests.get(f"{BASE_URL}/api/docs")
        if response.status_code == 200:
            print("✅ API docs: Available")
            return True
        print(f"⚠️  API docs: Status {response.status_code}")
        return False
    except Exception as e:  # pragma: no cover - network failure path is logged
        print(f"❌ API docs failed: {e}")
        return False
                print(f"⚠️  {endpoint}: Unexpected status {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint}: Connection failed - {e}")

    assert _check_docs(), "API docs endpoint should return HTTP 200"
            return False
    except Exception as e:
        print(f"❌ API docs failed: {e}")
        return False

def main():
    print("🧪 Testing Lugn & Trygg Mood API")
    print("=" * 40)

    tests = [
        ("Health Check", _check_health),
        ("API Documentation", _check_docs),
        ("Mood Endpoints", _check_mood_endpoints)
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n🔍 Testing {test_name}...")
        if test_func():
            passed += 1
        else:
            print(f"❌ {test_name} failed")

    print("\n" + "=" * 40)
    print(f"📊 Test Results: {passed}/{total} passed")

    if passed == total:
        print("🎉 All tests passed! Mood API is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
