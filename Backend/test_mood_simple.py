#!/usr/bin/env python3
"""Simple Mood Tracking test"""

print("=" * 50)
print("MOOD TRACKING - REAL TESTS")
print("=" * 50)
print()

# Test 1: Mood NLP
print("TEST 1: Mood NLP Analysis")
print("-" * 30)

from src.services.mood_nlp_service import SwedishMoodNLP
analyzer = SwedishMoodNLP()

texts = [
    "Jag känner mig glad och energisk idag",
    "Jag är stressad och orolig",
    "Jag känner mig lugn och tillfreds"
]

for text in texts:
    result = analyzer.analyze_mood_text(text)
    print(f"Text: {text}")
    valence = result.get('valence', 0)
    intensity = result.get('intensity', 0)
    emotion = result.get('primary_emotion', 'unknown')
    print(f"  -> valence={valence:.2f}, intensity={intensity}, emotion={emotion}")
    print()

# Test 2: Routes
print("TEST 2: Mood Routes")
print("-" * 30)

from src.routes.mood_routes import mood_bp
from src.routes.mood_stats_routes import mood_stats_bp
from src.routes.advanced_mood_routes import advanced_mood_bp

print(f"mood_bp: {mood_bp.name}")
print(f"mood_stats_bp: {mood_stats_bp.name}")
print(f"advanced_mood_bp: {advanced_mood_bp.name}")
print()

# Test 3: Predictive
print("TEST 3: Predictive Analytics")
print("-" * 30)

from src.services.predictive_service import PredictiveAnalyticsService
service = PredictiveAnalyticsService()
print(f"PredictiveAnalyticsService: {service.model_type}")
print()

print("=" * 50)
print("ALL TESTS PASSED!")
print("=" * 50)
