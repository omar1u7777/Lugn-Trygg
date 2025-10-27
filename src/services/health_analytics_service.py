"""
Health Analytics Service
Analyzes patterns between health data and mood tracking
Provides AI-powered recommendations for stress reduction and better sleep
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from statistics import mean, stdev

logger = logging.getLogger(__name__)

class HealthAnalyticsService:
    """Service for analyzing health data patterns and providing recommendations"""
    
    def __init__(self):
        # Recommended ranges for healthy living
        self.RECOMMENDED_STEPS_PER_DAY = 8000
        self.RECOMMENDED_SLEEP_HOURS = 7.5
        self.RECOMMENDED_AVG_HR = 70  # Resting heart rate
        self.MOOD_SCALE = 10  # 0-10 scale
    
    def analyze_health_mood_correlation(
        self,
        health_data: List[Dict[str, Any]],
        mood_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze correlation between health metrics and mood scores
        
        Args:
            health_data: List of health data entries with date, steps, sleep, hr, etc
            mood_data: List of mood entries with date and mood_score (0-10)
            
        Returns:
            Dict with patterns and correlations found
        """
        
        try:
            if not health_data or not mood_data:
                return {
                    'status': 'insufficient_data',
                    'message': 'Need at least 3 days of health data and mood entries',
                    'patterns': [],
                    'recommendations': self._get_generic_recommendations()
                }
            
            # Match health data with mood data by date
            correlations = self._match_health_to_mood(health_data, mood_data)
            
            if not correlations:
                return {
                    'status': 'insufficient_data',
                    'message': 'No matching dates between health and mood data',
                    'patterns': [],
                    'recommendations': self._get_generic_recommendations()
                }
            
            # Analyze patterns
            patterns = self._find_patterns(correlations)
            
            # Generate personalized recommendations
            recommendations = self._generate_recommendations(patterns, health_data, mood_data)
            
            return {
                'status': 'success',
                'days_analyzed': len(correlations),
                'patterns': patterns,
                'recommendations': recommendations,
                'mood_average': mean([m['mood_score'] for m in mood_data]),
                'mood_trend': self._calculate_trend(mood_data),
                'health_summary': self._summarize_health(health_data)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing health-mood correlation: {str(e)}")
            return {
                'status': 'error',
                'message': str(e),
                'patterns': [],
                'recommendations': self._get_generic_recommendations()
            }
    
    def _match_health_to_mood(
        self,
        health_data: List[Dict],
        mood_data: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Match health data with mood data by date"""
        
        correlations = []
        
        for mood_entry in mood_data:
            mood_date = mood_entry.get('date')
            if not mood_date:
                continue
                
            # Find corresponding health data
            for health_entry in health_data:
                health_date = health_entry.get('date')
                if health_date == mood_date or self._same_day(health_date, mood_date):
                    correlations.append({
                        'date': mood_date,
                        'mood_score': mood_entry.get('mood_score', 5),
                        'steps': health_entry.get('steps', 0),
                        'sleep_hours': health_entry.get('sleep_hours', 0),
                        'heart_rate': health_entry.get('heart_rate', 0),
                        'calories': health_entry.get('calories', 0)
                    })
                    break
        
        return correlations
    
    def _same_day(self, date1: Any, date2: Any) -> bool:
        """Check if two dates are the same day"""
        try:
            if isinstance(date1, str):
                date1 = datetime.fromisoformat(date1).date()
            elif isinstance(date1, datetime):
                date1 = date1.date()
                
            if isinstance(date2, str):
                date2 = datetime.fromisoformat(date2).date()
            elif isinstance(date2, datetime):
                date2 = date2.date()
                
            return date1 == date2
        except:
            return False
    
    def _find_patterns(self, correlations: List[Dict]) -> List[Dict[str, str]]:
        """Identify patterns between health and mood"""
        
        patterns = []
        
        if len(correlations) < 2:
            return patterns
        
        # Extract values
        moods = [c['mood_score'] for c in correlations]
        steps_list = [c['steps'] for c in correlations if c['steps'] > 0]
        sleep_list = [c['sleep_hours'] for c in correlations if c['sleep_hours'] > 0]
        hr_list = [c['heart_rate'] for c in correlations if c['heart_rate'] > 0]
        
        # Pattern 1: Steps and Mood Correlation
        if len(steps_list) > 1 and len(moods) > 1:
            high_mood_days = [c for c in correlations if c['mood_score'] >= 6]
            low_mood_days = [c for c in correlations if c['mood_score'] < 6]
            
            if high_mood_days and low_mood_days:
                avg_steps_high = mean([d['steps'] for d in high_mood_days if d['steps'] > 0]) if any(d['steps'] > 0 for d in high_mood_days) else 0
                avg_steps_low = mean([d['steps'] for d in low_mood_days if d['steps'] > 0]) if any(d['steps'] > 0 for d in low_mood_days) else 0
                
                if avg_steps_high > avg_steps_low * 1.1:
                    patterns.append({
                        'type': 'activity_mood_correlation',
                        'title': '🏃 Exercise Boosts Mood',
                        'description': f'On days you walk more (~{int(avg_steps_high)} steps), your mood is notably better',
                        'impact': 'high',
                        'actionable': True
                    })
        
        # Pattern 2: Sleep and Mood Correlation
        if len(sleep_list) > 1:
            high_mood_days = [c for c in correlations if c['mood_score'] >= 6]
            low_mood_days = [c for c in correlations if c['mood_score'] < 6]
            
            if high_mood_days and low_mood_days:
                avg_sleep_high = mean([d['sleep_hours'] for d in high_mood_days if d['sleep_hours'] > 0]) if any(d['sleep_hours'] > 0 for d in high_mood_days) else 0
                avg_sleep_low = mean([d['sleep_hours'] for d in low_mood_days if d['sleep_hours'] > 0]) if any(d['sleep_hours'] > 0 for d in low_mood_days) else 0
                
                if avg_sleep_high > avg_sleep_low + 0.5:  # 30min+ difference
                    patterns.append({
                        'type': 'sleep_mood_correlation',
                        'title': '😴 Sleep Quality Impacts Mood',
                        'description': f'You sleep better ({avg_sleep_high:.1f}h) on good mood days vs bad mood days ({avg_sleep_low:.1f}h)',
                        'impact': 'high',
                        'actionable': True
                    })
        
        # Pattern 3: Heart Rate and Stress
        if len(hr_list) > 1:
            high_mood_days = [c for c in correlations if c['mood_score'] >= 6]
            low_mood_days = [c for c in correlations if c['mood_score'] < 6]
            
            if high_mood_days and low_mood_days:
                avg_hr_high = mean([d['heart_rate'] for d in high_mood_days if d['heart_rate'] > 0]) if any(d['heart_rate'] > 0 for d in high_mood_days) else 0
                avg_hr_low = mean([d['heart_rate'] for d in low_mood_days if d['heart_rate'] > 0]) if any(d['heart_rate'] > 0 for d in low_mood_days) else 0
                
                if avg_hr_low > avg_hr_high + 5:  # 5bpm+ higher on low mood
                    patterns.append({
                        'type': 'hr_stress_correlation',
                        'title': '❤️ Heart Rate Indicates Stress',
                        'description': f'Your resting heart rate increases (~{int(avg_hr_low)}bpm) on stressful days',
                        'impact': 'medium',
                        'actionable': True
                    })
        
        # Pattern 4: Sedentary Days
        low_activity_days = [c for c in correlations if c['steps'] < 3000]
        if low_activity_days and len(low_activity_days) > len(correlations) * 0.3:
            patterns.append({
                'type': 'sedentary_pattern',
                'title': '🪑 Low Activity Days',
                'description': f'You have {len(low_activity_days)} days with less than 3000 steps. Try increasing activity.',
                'impact': 'medium',
                'actionable': True
            })
        
        # Pattern 5: Sleep Deprivation
        insufficient_sleep = [c for c in correlations if 0 < c['sleep_hours'] < 6]
        if insufficient_sleep and len(insufficient_sleep) > len(correlations) * 0.2:
            patterns.append({
                'type': 'sleep_deprivation',
                'title': '😴 Insufficient Sleep',
                'description': f'You got less than 6 hours sleep on {len(insufficient_sleep)} days. Aim for 7-9 hours.',
                'impact': 'high',
                'actionable': True
            })
        
        return patterns
    
    def _generate_recommendations(
        self,
        patterns: List[Dict],
        health_data: List[Dict],
        mood_data: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Generate personalized recommendations based on patterns"""
        
        recommendations = []
        
        # If patterns found, base recommendations on those
        if patterns:
            for pattern in patterns:
                rec = self._pattern_to_recommendation(pattern)
                if rec:
                    recommendations.append(rec)
        
        # Generic recommendations if not enough data
        if not recommendations:
            recommendations = self._get_generic_recommendations()
        
        return recommendations
    
    def _pattern_to_recommendation(self, pattern: Dict) -> Optional[Dict[str, Any]]:
        """Convert a pattern to an actionable recommendation"""
        
        pattern_type = pattern.get('type')
        
        if pattern_type == 'activity_mood_correlation':
            return {
                'title': '🏃 Increase Daily Activity',
                'description': 'Since exercise correlates with better mood, try to get 8000+ steps daily',
                'priority': 'high',
                'action': 'Take a 30-minute walk or do light exercise',
                'expected_benefit': 'Improved mood and energy levels'
            }
        
        elif pattern_type == 'sleep_mood_correlation':
            return {
                'title': '😴 Prioritize Sleep Quality',
                'description': 'Better sleep directly correlates with better mood',
                'priority': 'high',
                'action': 'Set a consistent bedtime and aim for 7-9 hours',
                'expected_benefit': 'Improved emotional resilience'
            }
        
        elif pattern_type == 'hr_stress_correlation':
            return {
                'title': '🧘 Practice Stress Management',
                'description': 'Your elevated heart rate indicates stress',
                'priority': 'high',
                'action': 'Try meditation or breathing exercises',
                'expected_benefit': 'Lower stress and better heart health'
            }
        
        elif pattern_type == 'sedentary_pattern':
            return {
                'title': '🚶 Move More Throughout the Day',
                'description': 'Increase physical activity to boost mood and energy',
                'priority': 'medium',
                'action': 'Take short breaks to walk or stretch',
                'expected_benefit': 'Better mood and physical fitness'
            }
        
        elif pattern_type == 'sleep_deprivation':
            return {
                'title': '😴 Improve Sleep Consistency',
                'description': 'You\'re not getting enough sleep regularly',
                'priority': 'high',
                'action': 'Create a bedtime routine and stick to it',
                'expected_benefit': 'Better health and mood stability'
            }
        
        return None
    
    def _get_generic_recommendations(self) -> List[Dict[str, Any]]:
        """Return generic recommendations when data is insufficient"""
        
        return [
            {
                'title': '🏃 Start Moving',
                'description': 'Physical activity is proven to improve mood and sleep quality',
                'priority': 'high',
                'action': 'Aim for 8000+ steps daily',
                'expected_benefit': 'Better mood and energy'
            },
            {
                'title': '😴 Prioritize Sleep',
                'description': 'Good sleep is fundamental for mental health',
                'priority': 'high',
                'action': 'Try to sleep 7-9 hours each night',
                'expected_benefit': 'Improved emotional resilience'
            },
            {
                'title': '🧘 Practice Mindfulness',
                'description': 'Mindfulness reduces stress and anxiety',
                'priority': 'medium',
                'action': 'Try 5-10 minutes of meditation daily',
                'expected_benefit': 'Better stress management'
            }
        ]
    
    def _calculate_trend(self, mood_data: List[Dict]) -> str:
        """Calculate mood trend (improving, stable, declining)"""
        
        if len(mood_data) < 2:
            return 'insufficient_data'
        
        recent = mood_data[-7:]  # Last week
        older = mood_data[-14:-7]  # Week before
        
        recent_avg = mean([m['mood_score'] for m in recent]) if recent else 5
        older_avg = mean([m['mood_score'] for m in older]) if older else 5
        
        if recent_avg > older_avg + 0.5:
            return 'improving'
        elif recent_avg < older_avg - 0.5:
            return 'declining'
        else:
            return 'stable'
    
    def _summarize_health(self, health_data: List[Dict]) -> Dict[str, Any]:
        """Summarize health metrics"""
        
        if not health_data:
            return {}
        
        steps_list = [h['steps'] for h in health_data if h.get('steps', 0) > 0]
        sleep_list = [h['sleep_hours'] for h in health_data if h.get('sleep_hours', 0) > 0]
        hr_list = [h['heart_rate'] for h in health_data if h.get('heart_rate', 0) > 0]
        
        summary = {}
        
        if steps_list:
            avg_steps = mean(steps_list)
            summary['avg_steps'] = int(avg_steps)
            summary['steps_status'] = 'good' if avg_steps >= self.RECOMMENDED_STEPS_PER_DAY else 'low'
        
        if sleep_list:
            avg_sleep = mean(sleep_list)
            summary['avg_sleep'] = round(avg_sleep, 1)
            summary['sleep_status'] = 'good' if 7 <= avg_sleep <= 9 else ('too_much' if avg_sleep > 9 else 'too_little')
        
        if hr_list:
            avg_hr = mean(hr_list)
            summary['avg_hr'] = int(avg_hr)
            summary['hr_status'] = 'good' if avg_hr <= self.RECOMMENDED_AVG_HR else 'elevated'
        
        return summary


# Singleton instance
health_analytics_service = HealthAnalyticsService()

