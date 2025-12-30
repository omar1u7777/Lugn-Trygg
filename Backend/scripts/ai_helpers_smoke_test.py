import json
import requests

"""Simple manual smoke test for the AI Helpers analyze-text endpoint."""

URL = "http://127.0.0.1:5001/api/ai-helpers/analyze-text"
HEADERS = {"Content-Type": "application/json"}
PAYLOAD = {"text": "Jag känner mig glad idag"}


def run_smoke_test() -> None:
    try:
        response = requests.post(URL, headers=HEADERS, data=json.dumps(PAYLOAD))
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("✅ Endpoint working!")
            print("Response:", response.json())
        else:
            print("❌ Endpoint failed")
            print("Response:", response.text)
    except Exception as exc:
        print(f"❌ Request failed: {exc}")


if __name__ == "__main__":
    run_smoke_test()
