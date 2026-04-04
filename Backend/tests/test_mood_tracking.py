#!/usr/bin/env python3
"""Test script for Mood Tracking functionality"""

print("=== Mood Tracking Tests ===")
print()

# Test 1: Import mood services
print("Test 1: Import mood services")
try:
    from src.services.mood_nlp_service import SwedishMoodNLP
    print("✅ SwedishMoodNLP imported")
except Exception as e:
    print(f"❌ Import failed: {e}")

# Test 2: Initialize analyzer
print()
print("Test 2: Initialize analyzer")
try:
    analyzer = SwedishMoodNLP()
    print("✅ Analyzer initialized")
except Exception as e:
    print(f"❌ Initialization failed: {e}")

# Test 3: Analyze mood texts
print()
print("Test 3: Analyze mood texts")
test_cases = [
    ("Jag känner mig glad och energisk idag", "positive"),
    ("Jag är stressad och orolig", "negative"),
    ("Jag känner mig lugn och tillfreds", "neutral/positive"),
]

for text, expected in test_cases:
    try:
        result = analyzer.analyze_mood_text(text)
        print(f"  '{text[:40]}...'")
        print(f"    -> valence: {result['valence']:.2f}, intensity: {result['intensity']}, emotion: {result['primary_emotion']}")
    except Exception as e:
        print(f"  ❌ Analysis failed: {e}")

# Test 4: Check mood routes
print()
print("Test 4: Check mood routes")
try:
    from src.routes.advanced_mood_routes import advanced_mood_bp
    from src.routes.mood_routes import mood_bp
    from src.routes.mood_stats_routes import mood_stats_bp
    print(f"✅ mood_bp: {mood_bp.name}")
    print(f"✅ mood_stats_bp: {mood_stats_bp.name}")
    print(f"✅ advanced_mood_bp: {advanced_mood_bp.name}")
except Exception as e:
    print(f"❌ Route import failed: {e}")

print()
print("=== All tests completed ===")
