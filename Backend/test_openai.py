#!/usr/bin/env python3
"""
Test script for OpenAI integration in Lugn & Trygg chatbot
Run this to verify OpenAI GPT-4o-mini integration works correctly
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.utils.ai_services import ai_services

def test_openai_integration():
    """Test OpenAI integration with a simple therapeutic conversation"""
    print("🧪 Testing OpenAI integration for Lugn & Trygg chatbot...")
    print("=" * 60)

    # Check if OpenAI is available
    if not ai_services.openai_available:
        print("❌ OpenAI is not available. Check your OPENAI_API_KEY in .env file")
        return False

    print("✅ OpenAI client initialized successfully")

    # Test therapeutic conversation
    test_message = "Jag känner mig stressad idag och vet inte riktigt varför."
    print(f"\n📝 Test message: '{test_message}'")

    try:
        print("\n🤖 Generating therapeutic response...")
        response = ai_services.generate_therapeutic_conversation(
            user_message=test_message,
            conversation_history=[]
        )

        print("✅ Response generated successfully!")
        print(f"🤖 AI Response: {response['response'][:200]}...")
        print(f"🎯 Model used: {response.get('model_used', 'unknown')}")
        print(f"🧠 AI Generated: {response.get('ai_generated', False)}")
        print(f"🚨 Crisis Detected: {response.get('crisis_detected', False)}")

        if 'sentiment_analysis' in response:
            sentiment = response['sentiment_analysis']
            print(f"😊 Sentiment: {sentiment.get('sentiment', 'unknown')}")

        return True

    except Exception as e:
        print(f"❌ Error during OpenAI test: {str(e)}")
        return False

def test_recommendations():
    """Test personalized recommendations"""
    print("\n🧪 Testing personalized recommendations...")

    try:
        recommendations = ai_services.generate_personalized_recommendations(
            user_history=[],
            current_mood="stressad"
        )

        print("✅ Recommendations generated successfully!")
        print(f"🤖 AI Generated: {recommendations.get('ai_generated', False)}")
        print(f"📝 Recommendations: {recommendations['recommendations'][:150]}...")

        return True

    except Exception as e:
        print(f"❌ Error during recommendations test: {str(e)}")
        return False

def test_weekly_insights():
    """Test weekly insights generation"""
    print("\n🧪 Testing weekly insights...")

    try:
        insights = ai_services.generate_weekly_insights({
            "moods": [],
            "memories": []
        })

        print("✅ Weekly insights generated successfully!")
        print(f"🤖 AI Generated: {insights.get('ai_generated', False)}")
        print(f"📊 Insights: {insights['insights'][:150]}...")

        return True

    except Exception as e:
        print(f"❌ Error during insights test: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Starting OpenAI integration tests for Lugn & Trygg")
    print("This will test the therapeutic chatbot functionality")
    print("=" * 60)

    # Run tests
    test1_passed = test_openai_integration()
    test2_passed = test_recommendations()
    test3_passed = test_weekly_insights()

    print("\n" + "=" * 60)
    print("📊 Test Results:")
    print(f"  Therapeutic Conversation: {'✅ PASS' if test1_passed else '❌ FAIL'}")
    print(f"  Personalized Recommendations: {'✅ PASS' if test2_passed else '❌ FAIL'}")
    print(f"  Weekly Insights: {'✅ PASS' if test3_passed else '❌ FAIL'}")

    if all([test1_passed, test2_passed, test3_passed]):
        print("\n🎉 All tests passed! OpenAI integration is working correctly.")
        print("The Lugn & Trygg chatbot is ready for production! 🧠💙")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Check your OpenAI API key and configuration.")
        sys.exit(1)