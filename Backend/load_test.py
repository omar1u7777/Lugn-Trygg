#!/usr/bin/env python3
"""
⚡ Load Testing Script for Lugn & Trygg Backend
Tests API performance under 1000 concurrent users

Requirements:
    pip install locust requests

Usage:
    # Start load test web UI
    locust -f load_test.py --host=http://localhost:5001
    
    # Then open http://localhost:8089
    # Set: 1000 users, spawn rate 100/sec
    
    # Or run headless:
    locust -f load_test.py --host=http://localhost:5001 \\
           --users 1000 --spawn-rate 100 --run-time 5m --headless
"""

from locust import HttpUser, task, between
import random
import json
from datetime import datetime

class LugnTryggUser(HttpUser):
    """
    Simulates a real user of Lugn & Trygg
    """
    wait_time = between(1, 5)  # Wait 1-5 seconds between requests
    
    def on_start(self):
        """Called when a user starts - simulate login"""
        self.user_id = f"test_user_{random.randint(1, 10000)}"
        self.token = None
        
        # Try to login (mock for now)
        # In real test, you'd call actual auth endpoint
        self.token = "mock_jwt_token"
    
    @task(10)
    def health_check(self):
        """
        Test health endpoint - most frequent
        Weight: 10 (10% of requests)
        """
        self.client.get("/api/health")
    
    @task(8)
    def get_moods(self):
        """
        Fetch mood logs - common operation
        Weight: 8 (8% of requests)
        """
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        self.client.post(
            "/api/mood/get",
            json={"user_id": self.user_id},
            headers=headers
        )
    
    @task(5)
    def log_mood(self):
        """
        Log a new mood - frequent user action
        Weight: 5 (5% of requests)
        """
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        mood_data = {
            "user_id": self.user_id,
            "mood": random.choice(["happy", "sad", "anxious", "calm", "energetic"]),
            "score": random.randint(1, 10),
            "note": "Load test mood log",
            "timestamp": datetime.utcnow().isoformat()
        }
        self.client.post(
            "/api/mood/log",
            json=mood_data,
            headers=headers
        )
    
    @task(5)
    def get_weekly_analysis(self):
        """
        Get weekly mood analysis
        Weight: 5 (5% of requests)
        """
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        self.client.post(
            "/api/mood/weekly-analysis",
            json={"user_id": self.user_id},
            headers=headers
        )
    
    @task(3)
    def ai_chat(self):
        """
        Chat with AI - moderate frequency
        Weight: 3 (3% of requests)
        """
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        self.client.post(
            "/api/ai/chat",
            json={
                "user_id": self.user_id,
                "message": "How can I improve my mood today?",
                "session_id": f"session_{self.user_id}"
            },
            headers=headers
        )
    
    @task(3)
    def get_chat_history(self):
        """
        Fetch chat history
        Weight: 3 (3% of requests)
        """
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        self.client.post(
            "/api/ai/history",
            json={"user_id": self.user_id},
            headers=headers
        )
    
    @task(2)
    def get_memories(self):
        """
        Fetch memory list
        Weight: 2 (2% of requests)
        """
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        self.client.post(
            "/api/memory/list",
            json={"user_id": self.user_id},
            headers=headers
        )
    
    @task(2)
    def get_leaderboard(self):
        """
        Get referral leaderboard
        Weight: 2 (2% of requests)
        """
        self.client.get("/api/referral/leaderboard?limit=100")
    
    @task(1)
    def predictive_analytics(self):
        """
        Get mood predictions - CPU intensive
        Weight: 1 (1% of requests)
        """
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        self.client.post(
            "/api/predictive/mood-forecast",
            json={"user_id": self.user_id, "days": 7},
            headers=headers
        )
    
    @task(1)
    def metrics_check(self):
        """
        Check system metrics
        Weight: 1 (1% of requests)
        """
        self.client.get("/api/metrics")

# Performance targets for 1000 users
"""
Target Metrics:
- Response Time (95th percentile): < 500ms
- Error Rate: < 1%
- Requests/sec: > 200
- Failed Requests: < 10

Success Criteria:
✅ Health endpoint: < 50ms
✅ Mood log: < 200ms
✅ AI chat: < 2000ms (AI is slow)
✅ Database queries: < 100ms
"""
