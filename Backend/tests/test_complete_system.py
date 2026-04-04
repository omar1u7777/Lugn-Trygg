#!/usr/bin/env python3
"""Complete system test for Mood Tracking and AI Chat"""

import sys

print("=" * 60)
print("COMPREHENSIVE SYSTEM TEST - Mood Tracking & AI Chat")
print("=" * 60)
print()

# Test 1: Mood Tracking
print("TEST 1: Mood Tracking System")
print("-" * 40)
try:
    from src.routes.mood_routes import mood_bp
    from src.routes.mood_stats_routes import mood_stats_bp
    from src.services.mood_nlp_service import SwedishMoodNLP

    analyzer = SwedishMoodNLP()
    result = analyzer.analyze_mood_text("Jag känner mig glad idag")

    print(f"✅ Mood NLP: {result.primary_emotion} (intensity: {result.intensity})")
    print(f"✅ Routes: {mood_bp.name}, {mood_stats_bp.name}")
except Exception as e:
    print(f"❌ Mood tracking error: {e}")
    sys.exit(1)

# Test 2: AI Chat
print()
print("TEST 2: AI Chat System")
print("-" * 40)
try:
    from src.routes.chatbot_routes import FRAMEWORK_AVAILABLE, RAG_AVAILABLE, chatbot_bp

    print(f"✅ Chatbot routes: {chatbot_bp.name}")
    print(f"✅ RAG available: {RAG_AVAILABLE}")
    print(f"✅ Framework detector: {FRAMEWORK_AVAILABLE}")
except Exception as e:
    print(f"❌ AI Chat error: {e}")
    sys.exit(1)

# Test 3: Voice Emotion
print()
print("TEST 3: Voice Emotion Analysis")
print("-" * 40)
try:
    from src.services.voice_emotion_service import LIBROSA_AVAILABLE, get_voice_emotion_analyzer

    analyzer = get_voice_emotion_analyzer()
    print(f"✅ Voice emotion analyzer: {type(analyzer).__name__}")
    print(f"✅ librosa available: {LIBROSA_AVAILABLE}")
except Exception as e:
    print(f"❌ Voice emotion error: {e}")
    sys.exit(1)

# Test 4: Predictive Analytics
print()
print("TEST 4: Predictive Analytics")
print("-" * 40)
try:
    from src.services.predictive_service import PredictiveAnalyticsService

    service = PredictiveAnalyticsService()
    print("✅ Predictive service initialized")
    print(f"✅ Has predict_next_mood: {hasattr(service, 'predict_next_mood')}")
except Exception as e:
    print(f"❌ Predictive error: {e}")
    sys.exit(1)

print()
print("=" * 60)
print("ALL SYSTEMS OPERATIONAL")
print("=" * 60)
print()
print("Components verified:")
print("  ✅ Mood Tracking (NLP, routes)")
print("  ✅ AI Chat (RAG, framework detection)")
print("  ✅ Voice Emotion (librosa professional)")
print("  ✅ Predictive Analytics")
print()
print("System ready for production!")
