#!/usr/bin/env python3
"""
Test script for Health Analytics Service
Tests pattern detection and recommendation generation
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from services.health_analytics_service import health_analytics_service
from datetime import datetime, timedelta

def test_health_analytics():
    """Test the health analytics service"""
    
    print("=" * 60)
    print("HEALTH ANALYTICS SERVICE TEST")
    print("=" * 60)
    
    # Test Case 1: Correlation between exercise and mood
    print("\n📊 Test Case 1: Exercise & Mood Correlation")
    print("-" * 60)
    
    health_data = [
        {'date': '2024-01-01', 'steps': 10000, 'sleep_hours': 7.5, 'heart_rate': 70, 'calories': 2200},
        {'date': '2024-01-02', 'steps': 3000, 'sleep_hours': 5.5, 'heart_rate': 85, 'calories': 1800},
        {'date': '2024-01-03', 'steps': 9500, 'sleep_hours': 7.8, 'heart_rate': 68, 'calories': 2300},
        {'date': '2024-01-04', 'steps': 2000, 'sleep_hours': 5.0, 'heart_rate': 90, 'calories': 1600},
        {'date': '2024-01-05', 'steps': 8000, 'sleep_hours': 7.2, 'heart_rate': 72, 'calories': 2100},
        {'date': '2024-01-06', 'steps': 1500, 'sleep_hours': 6.0, 'heart_rate': 88, 'calories': 1700},
        {'date': '2024-01-07', 'steps': 9000, 'sleep_hours': 7.5, 'heart_rate': 70, 'calories': 2250},
    ]
    
    mood_data = [
        {'date': '2024-01-01', 'mood_score': 8},
        {'date': '2024-01-02', 'mood_score': 4},
        {'date': '2024-01-03', 'mood_score': 9},
        {'date': '2024-01-04', 'mood_score': 3},
        {'date': '2024-01-05', 'mood_score': 7},
        {'date': '2024-01-06', 'mood_score': 3},
        {'date': '2024-01-07', 'mood_score': 8},
    ]
    
    result = health_analytics_service.analyze_health_mood_correlation(
        health_data, mood_data
    )
    
    print(f"✅ Analysis Status: {result['status']}")
    print(f"📊 Days Analyzed: {result.get('days_analyzed', 0)}")
    print(f"📈 Mood Average: {result.get('mood_average', 0):.1f}/10")
    print(f"📉 Mood Trend: {result.get('mood_trend', 'unknown')}")
    
    print(f"\n🔍 Patterns Found: {len(result.get('patterns', []))}")
    for i, pattern in enumerate(result.get('patterns', []), 1):
        print(f"  {i}. {pattern['title']}")
        print(f"     → {pattern['description']}")
        print(f"     → Impact: {pattern['impact']}")
    
    print(f"\n💡 Recommendations: {len(result.get('recommendations', []))}")
    for i, rec in enumerate(result.get('recommendations', []), 1):
        print(f"  {i}. {rec['title']}")
        print(f"     → {rec['description']}")
        print(f"     → Action: {rec['action']}")
        print(f"     → Expected: {rec['expected_benefit']}")
    
    # Test Case 2: Insufficient data
    print("\n" + "=" * 60)
    print("📊 Test Case 2: Insufficient Data Handling")
    print("-" * 60)
    
    result2 = health_analytics_service.analyze_health_mood_correlation([], [])
    print(f"✅ Status: {result2['status']}")
    print(f"ℹ️ Message: {result2['message']}")
    print(f"💡 Generic Recommendations: {len(result2.get('recommendations', []))}")
    
    # Test Case 3: Only health data (no mood)
    print("\n" + "=" * 60)
    print("📊 Test Case 3: Health Data Only (No Mood)")
    print("-" * 60)
    
    result3 = health_analytics_service.analyze_health_mood_correlation(
        health_data, []
    )
    print(f"✅ Status: {result3['status']}")
    print(f"ℹ️ Message: {result3.get('message', 'N/A')}")
    
    # Test Case 4: Only mood data (no health)
    print("\n" + "=" * 60)
    print("📊 Test Case 4: Mood Data Only (No Health)")
    print("-" * 60)
    
    result4 = health_analytics_service.analyze_health_mood_correlation(
        [], mood_data
    )
    print(f"✅ Status: {result4['status']}")
    print(f"ℹ️ Message: {result4.get('message', 'N/A')}")
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS COMPLETED SUCCESSFULLY")
    print("=" * 60)

if __name__ == '__main__':
    test_health_analytics()
