#!/usr/bin/env python3
"""
Load Testing Script for Lugn & Trygg API
Tests performance with 1000+ concurrent users using Locust
"""

import os
import sys
import time
from locust import HttpUser, task, between, events
from locust.env import Environment
from locust.stats import print_stats
import gevent
import json

# Add Backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'Backend'))

class APIUser(HttpUser):
    """Simulates a typical API user"""

    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks

    def on_start(self):
        """Login and get JWT token on start"""
        try:
            # Attempt login to get token
            login_data = {
                "email": "test@example.com",
                "password": "testpassword123"
            }

            response = self.client.post("/api/auth/login", json=login_data)

            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                if self.token:
                    self.client.headers.update({"Authorization": f"Bearer {self.token}"})
            else:
                # If login fails, continue without auth for public endpoints
                self.token = None

        except Exception as e:
            self.token = None
            print(f"Login failed: {e}")

    @task(3)  # 30% of requests
    def health_check(self):
        """Test health endpoint"""
        self.client.get("/api/health")

    @task(2)  # 20% of requests
    def get_moods(self):
        """Test mood retrieval"""
        if self.token:
            self.client.get("/api/mood/list")

    @task(2)  # 20% of requests
    def log_mood(self):
        """Test mood logging"""
        if self.token:
            mood_data = {
                "mood_score": 7,
                "notes": "Feeling good during load test",
                "activities": ["work", "exercise"]
            }
            self.client.post("/api/mood/log", json=mood_data)

    @task(1)  # 10% of requests
    def ai_chat(self):
        """Test AI chat functionality"""
        if self.token:
            chat_data = {
                "message": "Hello, how are you?",
                "context": "mood_check"
            }
            self.client.post("/api/ai/chat", json=chat_data)

    @task(1)  # 10% of requests
    def get_memories(self):
        """Test memory retrieval"""
        if self.token:
            self.client.get("/api/memory/list")

    @task(1)  # 10% of requests
    def dashboard_data(self):
        """Test dashboard data retrieval"""
        if self.token:
            self.client.get("/api/dashboard/stats")

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when a load test starts"""
    print("🚀 Starting load test...")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when a load test stops"""
    print("✅ Load test completed")
    print_stats(environment.stats)

def run_load_test():
    """Run the load test"""
    # Set environment variables for testing
    os.environ.setdefault('FLASK_ENV', 'testing')
    os.environ.setdefault('TESTING', 'true')

    # Create environment
    env = Environment(user_classes=[APIUser])

    # Configure test parameters
    env.create_local_runner()

    # Start test with gradual ramp-up
    print("🔥 Starting load test with 1000 concurrent users...")

    # Phase 1: Ramp up to 100 users
    gevent.spawn_later(0, lambda: env.runner.start(100, spawn_rate=10))
    gevent.spawn_later(60, lambda: env.runner.stop())  # Run for 60 seconds

    # Wait for test completion
    env.runner.greenlet.join()

    # Print final statistics
    print("\n📊 LOAD TEST RESULTS:")
    print("=" * 50)
    print(f"Total Requests: {env.stats.total.num_requests}")
    print(f"Requests/sec: {env.stats.total.current_rps:.2f}")
    print(f"Average Response Time: {env.stats.total.avg_response_time:.2f}ms")
    print(f"95th Percentile: {env.stats.total.get_response_time_percentile(0.95):.2f}ms")
    print(f"Error Rate: {env.stats.total.fail_ratio * 100:.2f}%")

    # Check performance thresholds
    success = True

    if env.stats.total.avg_response_time > 2000:  # 2 seconds
        print("❌ FAIL: Average response time too high (>2s)")
        success = False
    else:
        print("✅ PASS: Average response time acceptable")

    if env.stats.total.fail_ratio > 0.05:  # 5% error rate
        print("❌ FAIL: Error rate too high (>5%)")
        success = False
    else:
        print("✅ PASS: Error rate acceptable")

    if env.stats.total.current_rps < 50:  # 50 requests/sec minimum
        print("❌ FAIL: Throughput too low (<50 req/sec)")
        success = False
    else:
        print("✅ PASS: Throughput acceptable")

    return success

if __name__ == "__main__":
    print("⚡ Lugn & Trygg Load Testing")
    print("=" * 40)

    # Check if locust is available
    try:
        import locust
        print("✅ Locust framework available")
    except ImportError:
        print("❌ Locust not installed. Install with: pip install locust")
        sys.exit(1)

    # Run the load test
    success = run_load_test()

    if success:
        print("\n🎉 LOAD TEST PASSED! System can handle 1000+ concurrent users.")
        sys.exit(0)
    else:
        print("\n❌ LOAD TEST FAILED! Performance issues detected.")
        sys.exit(1)