"""
Tests for Health Analytics Service
Tests health-mood correlation analysis and personalized recommendations
"""
import pytest
from datetime import datetime, timedelta
from src.services.health_analytics_service import HealthAnalyticsService, health_analytics_service


class TestHealthAnalyticsServiceInit:
    """Test HealthAnalyticsService initialization"""
    
    def test_init_creates_instance(self):
        """Test that instance is created with default values"""
        service = HealthAnalyticsService()
        
        assert service.RECOMMENDED_STEPS_PER_DAY == 8000
        assert service.RECOMMENDED_SLEEP_HOURS == 7.5
        assert service.RECOMMENDED_AVG_HR == 70
        assert service.MOOD_SCALE == 10


class TestAnalyzeHealthMoodCorrelation:
    """Test analyze_health_mood_correlation method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthAnalyticsService instance"""
        return HealthAnalyticsService()
    
    @pytest.fixture
    def sample_health_data(self):
        """Create sample health data"""
        return [
            {'date': '2025-01-01', 'steps': 10000, 'sleep_hours': 8.0, 'heart_rate': 68, 'calories': 2500},
            {'date': '2025-01-02', 'steps': 5000, 'sleep_hours': 5.5, 'heart_rate': 75, 'calories': 2000},
            {'date': '2025-01-03', 'steps': 12000, 'sleep_hours': 7.5, 'heart_rate': 65, 'calories': 2800},
            {'date': '2025-01-04', 'steps': 3000, 'sleep_hours': 6.0, 'heart_rate': 80, 'calories': 1800},
            {'date': '2025-01-05', 'steps': 9000, 'sleep_hours': 8.5, 'heart_rate': 67, 'calories': 2600}
        ]
    
    @pytest.fixture
    def sample_mood_data(self):
        """Create sample mood data"""
        return [
            {'date': '2025-01-01', 'mood_score': 8},
            {'date': '2025-01-02', 'mood_score': 4},
            {'date': '2025-01-03', 'mood_score': 9},
            {'date': '2025-01-04', 'mood_score': 3},
            {'date': '2025-01-05', 'mood_score': 7}
        ]
    
    def test_analyze_health_mood_correlation_success(self, service, sample_health_data, sample_mood_data):
        """Test successful correlation analysis"""
        result = service.analyze_health_mood_correlation(sample_health_data, sample_mood_data)
        
        assert result['status'] == 'success'
        assert result['days_analyzed'] == 5
        assert 'patterns' in result
        assert 'recommendations' in result
        assert 'mood_average' in result
        assert 'mood_trend' in result
        assert 'health_summary' in result
        assert result['mood_average'] == pytest.approx(6.2, 0.1)
    
    def test_analyze_with_empty_health_data(self, service, sample_mood_data):
        """Test with empty health data"""
        result = service.analyze_health_mood_correlation([], sample_mood_data)
        
        assert result['status'] == 'insufficient_data'
        assert 'Need at least 3 days' in result['message']
        assert result['patterns'] == []
        assert len(result['recommendations']) > 0
    
    def test_analyze_with_empty_mood_data(self, service, sample_health_data):
        """Test with empty mood data"""
        result = service.analyze_health_mood_correlation(sample_health_data, [])
        
        assert result['status'] == 'insufficient_data'
        assert result['patterns'] == []
    
    def test_analyze_with_no_matching_dates(self, service):
        """Test when health and mood data have no matching dates"""
        health_data = [
            {'date': '2025-01-01', 'steps': 5000, 'sleep_hours': 7.0, 'heart_rate': 70}
        ]
        mood_data = [
            {'date': '2025-01-10', 'mood_score': 5}
        ]
        
        result = service.analyze_health_mood_correlation(health_data, mood_data)
        
        assert result['status'] == 'insufficient_data'
        assert 'No matching dates' in result['message']
    
    def test_analyze_finds_activity_mood_correlation(self, service):
        """Test detection of activity-mood correlation"""
        health_data = [
            {'date': '2025-01-01', 'steps': 12000, 'sleep_hours': 7.0, 'heart_rate': 70},
            {'date': '2025-01-02', 'steps': 13000, 'sleep_hours': 7.0, 'heart_rate': 70},
            {'date': '2025-01-03', 'steps': 2000, 'sleep_hours': 7.0, 'heart_rate': 70},
            {'date': '2025-01-04', 'steps': 2500, 'sleep_hours': 7.0, 'heart_rate': 70}
        ]
        mood_data = [
            {'date': '2025-01-01', 'mood_score': 8},
            {'date': '2025-01-02', 'mood_score': 9},
            {'date': '2025-01-03', 'mood_score': 4},
            {'date': '2025-01-04', 'mood_score': 3}
        ]
        
        result = service.analyze_health_mood_correlation(health_data, mood_data)
        
        assert result['status'] == 'success'
        pattern_types = [p['type'] for p in result['patterns']]
        assert 'activity_mood_correlation' in pattern_types
    
    def test_analyze_finds_sleep_mood_correlation(self, service):
        """Test detection of sleep-mood correlation"""
        health_data = [
            {'date': '2025-01-01', 'steps': 5000, 'sleep_hours': 8.5, 'heart_rate': 70},
            {'date': '2025-01-02', 'steps': 5000, 'sleep_hours': 9.0, 'heart_rate': 70},
            {'date': '2025-01-03', 'steps': 5000, 'sleep_hours': 5.0, 'heart_rate': 70},
            {'date': '2025-01-04', 'steps': 5000, 'sleep_hours': 5.5, 'heart_rate': 70}
        ]
        mood_data = [
            {'date': '2025-01-01', 'mood_score': 8},
            {'date': '2025-01-02', 'mood_score': 9},
            {'date': '2025-01-03', 'mood_score': 4},
            {'date': '2025-01-04', 'mood_score': 3}
        ]
        
        result = service.analyze_health_mood_correlation(health_data, mood_data)
        
        pattern_types = [p['type'] for p in result['patterns']]
        assert 'sleep_mood_correlation' in pattern_types
    
    def test_analyze_finds_hr_stress_correlation(self, service):
        """Test detection of heart rate-stress correlation"""
        health_data = [
            {'date': '2025-01-01', 'steps': 5000, 'sleep_hours': 7.0, 'heart_rate': 65},
            {'date': '2025-01-02', 'steps': 5000, 'sleep_hours': 7.0, 'heart_rate': 68},
            {'date': '2025-01-03', 'steps': 5000, 'sleep_hours': 7.0, 'heart_rate': 85},
            {'date': '2025-01-04', 'steps': 5000, 'sleep_hours': 7.0, 'heart_rate': 88}
        ]
        mood_data = [
            {'date': '2025-01-01', 'mood_score': 8},
            {'date': '2025-01-02', 'mood_score': 7},
            {'date': '2025-01-03', 'mood_score': 4},
            {'date': '2025-01-04', 'mood_score': 3}
        ]
        
        result = service.analyze_health_mood_correlation(health_data, mood_data)
        
        pattern_types = [p['type'] for p in result['patterns']]
        assert 'hr_stress_correlation' in pattern_types
    
    def test_analyze_finds_sedentary_pattern(self, service):
        """Test detection of sedentary pattern"""
        health_data = [
            {'date': f'2025-01-0{i}', 'steps': 2000, 'sleep_hours': 7.0, 'heart_rate': 70}
            for i in range(1, 6)
        ]
        mood_data = [
            {'date': f'2025-01-0{i}', 'mood_score': 5}
            for i in range(1, 6)
        ]
        
        result = service.analyze_health_mood_correlation(health_data, mood_data)
        
        pattern_types = [p['type'] for p in result['patterns']]
        assert 'sedentary_pattern' in pattern_types
    
    def test_analyze_finds_sleep_deprivation(self, service):
        """Test detection of sleep deprivation pattern"""
        health_data = [
            {'date': f'2025-01-0{i}', 'steps': 5000, 'sleep_hours': 5.0, 'heart_rate': 70}
            for i in range(1, 6)
        ]
        mood_data = [
            {'date': f'2025-01-0{i}', 'mood_score': 5}
            for i in range(1, 6)
        ]
        
        result = service.analyze_health_mood_correlation(health_data, mood_data)
        
        pattern_types = [p['type'] for p in result['patterns']]
        assert 'sleep_deprivation' in pattern_types


class TestMatchHealthToMood:
    """Test _match_health_to_mood helper method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthAnalyticsService instance"""
        return HealthAnalyticsService()
    
    def test_match_health_to_mood_success(self, service):
        """Test successful matching"""
        health_data = [
            {'date': '2025-01-01', 'steps': 10000, 'sleep_hours': 8.0, 'heart_rate': 68},
            {'date': '2025-01-02', 'steps': 5000, 'sleep_hours': 6.0, 'heart_rate': 75}
        ]
        mood_data = [
            {'date': '2025-01-01', 'mood_score': 8},
            {'date': '2025-01-02', 'mood_score': 5}
        ]
        
        result = service._match_health_to_mood(health_data, mood_data)
        
        assert len(result) == 2
        assert result[0]['date'] == '2025-01-01'
        assert result[0]['mood_score'] == 8
        assert result[0]['steps'] == 10000
    
    def test_match_with_missing_mood_date(self, service):
        """Test matching when mood entry has no date"""
        health_data = [{'date': '2025-01-01', 'steps': 5000, 'sleep_hours': 7.0}]
        mood_data = [{'mood_score': 5}]  # No date
        
        result = service._match_health_to_mood(health_data, mood_data)
        
        assert len(result) == 0
    
    def test_match_with_datetime_objects(self, service):
        """Test matching with datetime objects"""
        health_data = [
            {'date': datetime(2025, 1, 1), 'steps': 5000, 'sleep_hours': 7.0, 'heart_rate': 70}
        ]
        mood_data = [
            {'date': datetime(2025, 1, 1), 'mood_score': 7}
        ]
        
        result = service._match_health_to_mood(health_data, mood_data)
        
        assert len(result) == 1


class TestSameDay:
    """Test _same_day helper method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthAnalyticsService instance"""
        return HealthAnalyticsService()
    
    def test_same_day_with_strings(self, service):
        """Test same day comparison with string dates"""
        assert service._same_day('2025-01-01', '2025-01-01') is True
        assert service._same_day('2025-01-01', '2025-01-02') is False
    
    def test_same_day_with_datetime(self, service):
        """Test same day comparison with datetime objects"""
        date1 = datetime(2025, 1, 1, 10, 0, 0)
        date2 = datetime(2025, 1, 1, 20, 0, 0)
        date3 = datetime(2025, 1, 2, 10, 0, 0)
        
        assert service._same_day(date1, date2) is True
        assert service._same_day(date1, date3) is False
    
    def test_same_day_with_mixed_types(self, service):
        """Test same day comparison with mixed types"""
        date_str = '2025-01-01'
        date_obj = datetime(2025, 1, 1, 15, 0, 0)
        
        assert service._same_day(date_str, date_obj) is True
    
    def test_same_day_with_invalid_data(self, service):
        """Test same day with invalid data"""
        assert service._same_day('invalid', '2025-01-01') is False
        assert service._same_day(None, '2025-01-01') is False


class TestFindPatterns:
    """Test _find_patterns method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthAnalyticsService instance"""
        return HealthAnalyticsService()
    
    def test_find_patterns_with_insufficient_data(self, service):
        """Test with less than 2 correlations"""
        correlations = [
            {'date': '2025-01-01', 'mood_score': 5, 'steps': 5000, 'sleep_hours': 7.0, 'heart_rate': 70}
        ]
        
        result = service._find_patterns(correlations)
        
        assert result == []
    
    def test_find_patterns_with_all_zeros(self, service):
        """Test with all zero health data"""
        correlations = [
            {'date': '2025-01-01', 'mood_score': 5, 'steps': 0, 'sleep_hours': 0, 'heart_rate': 0},
            {'date': '2025-01-02', 'mood_score': 6, 'steps': 0, 'sleep_hours': 0, 'heart_rate': 0}
        ]
        
        result = service._find_patterns(correlations)
        
        # Should still return some patterns based on mood
        assert isinstance(result, list)


class TestGenerateRecommendations:
    """Test _generate_recommendations method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthAnalyticsService instance"""
        return HealthAnalyticsService()
    
    def test_generate_recommendations_with_patterns(self, service):
        """Test generating recommendations from patterns"""
        patterns = [
            {
                'type': 'activity_mood_correlation',
                'title': 'Exercise Boosts Mood',
                'description': 'Test',
                'impact': 'high'
            }
        ]
        health_data = []
        mood_data = []
        
        result = service._generate_recommendations(patterns, health_data, mood_data)
        
        assert len(result) > 0
        assert result[0]['title'] == '🏃 Increase Daily Activity'
    
    def test_generate_recommendations_without_patterns(self, service):
        """Test generating generic recommendations"""
        patterns = []
        health_data = []
        mood_data = []
        
        result = service._generate_recommendations(patterns, health_data, mood_data)
        
        assert len(result) == 3
        assert result[0]['title'] == '🏃 Start Moving'


class TestPatternToRecommendation:
    """Test _pattern_to_recommendation method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthAnalyticsService instance"""
        return HealthAnalyticsService()
    
    def test_activity_pattern_recommendation(self, service):
        """Test recommendation for activity pattern"""
        pattern = {'type': 'activity_mood_correlation'}
        
        result = service._pattern_to_recommendation(pattern)
        
        assert result is not None
        assert result['title'] == '🏃 Increase Daily Activity'
        assert result['priority'] == 'high'
    
    def test_sleep_pattern_recommendation(self, service):
        """Test recommendation for sleep pattern"""
        pattern = {'type': 'sleep_mood_correlation'}
        
        result = service._pattern_to_recommendation(pattern)
        
        assert result is not None
        assert result['title'] == '😴 Prioritize Sleep Quality'
    
    def test_hr_pattern_recommendation(self, service):
        """Test recommendation for heart rate pattern"""
        pattern = {'type': 'hr_stress_correlation'}
        
        result = service._pattern_to_recommendation(pattern)
        
        assert result is not None
        assert '🧘' in result['title']
    
    def test_sedentary_pattern_recommendation(self, service):
        """Test recommendation for sedentary pattern"""
        pattern = {'type': 'sedentary_pattern'}
        
        result = service._pattern_to_recommendation(pattern)
        
        assert result is not None
        assert 'Move More' in result['title']
    
    def test_sleep_deprivation_recommendation(self, service):
        """Test recommendation for sleep deprivation"""
        pattern = {'type': 'sleep_deprivation'}
        
        result = service._pattern_to_recommendation(pattern)
        
        assert result is not None
        assert 'Sleep' in result['title']
    
    def test_unknown_pattern_recommendation(self, service):
        """Test recommendation for unknown pattern"""
        pattern = {'type': 'unknown_pattern'}
        
        result = service._pattern_to_recommendation(pattern)
        
        assert result is None


class TestGetGenericRecommendations:
    """Test _get_generic_recommendations method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthAnalyticsService instance"""
        return HealthAnalyticsService()
    
    def test_get_generic_recommendations(self, service):
        """Test getting generic recommendations"""
        result = service._get_generic_recommendations()
        
        assert len(result) == 3
        assert result[0]['title'] == '🏃 Start Moving'
        assert result[1]['title'] == '😴 Prioritize Sleep'
        assert result[2]['title'] == '🧘 Practice Mindfulness'
        
        for rec in result:
            assert 'description' in rec
            assert 'priority' in rec
            assert 'action' in rec
            assert 'expected_benefit' in rec


class TestCalculateTrend:
    """Test _calculate_trend method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthAnalyticsService instance"""
        return HealthAnalyticsService()
    
    def test_calculate_trend_insufficient_data(self, service):
        """Test trend calculation with insufficient data"""
        mood_data = [{'mood_score': 5}]
        
        result = service._calculate_trend(mood_data)
        
        assert result == 'insufficient_data'
    
    def test_calculate_trend_improving(self, service):
        """Test trend calculation for improving mood"""
        mood_data = [
            {'mood_score': 4},
            {'mood_score': 4},
            {'mood_score': 5},
            {'mood_score': 5},
            {'mood_score': 5},
            {'mood_score': 6},
            {'mood_score': 6},
            {'mood_score': 7},
            {'mood_score': 7},
            {'mood_score': 8},
            {'mood_score': 8},
            {'mood_score': 8},
            {'mood_score': 9},
            {'mood_score': 9}
        ]
        
        result = service._calculate_trend(mood_data)
        
        assert result == 'improving'
    
    def test_calculate_trend_declining(self, service):
        """Test trend calculation for declining mood"""
        mood_data = [
            {'mood_score': 8},
            {'mood_score': 8},
            {'mood_score': 7},
            {'mood_score': 7},
            {'mood_score': 7},
            {'mood_score': 6},
            {'mood_score': 6},
            {'mood_score': 5},
            {'mood_score': 5},
            {'mood_score': 4},
            {'mood_score': 4},
            {'mood_score': 3},
            {'mood_score': 3},
            {'mood_score': 3}
        ]
        
        result = service._calculate_trend(mood_data)
        
        assert result == 'declining'
    
    def test_calculate_trend_stable(self, service):
        """Test trend calculation for stable mood"""
        mood_data = [
            {'mood_score': 6},
            {'mood_score': 6},
            {'mood_score': 5},
            {'mood_score': 6},
            {'mood_score': 6},
            {'mood_score': 5},
            {'mood_score': 6},
            {'mood_score': 6},
            {'mood_score': 5},
            {'mood_score': 6},
            {'mood_score': 6},
            {'mood_score': 5},
            {'mood_score': 6},
            {'mood_score': 6}
        ]
        
        result = service._calculate_trend(mood_data)
        
        assert result == 'stable'


class TestSummarizeHealth:
    """Test _summarize_health method"""
    
    @pytest.fixture
    def service(self):
        """Create HealthAnalyticsService instance"""
        return HealthAnalyticsService()
    
    def test_summarize_health_empty_data(self, service):
        """Test summary with empty data"""
        result = service._summarize_health([])
        
        assert result == {}
    
    def test_summarize_health_with_steps(self, service):
        """Test summary with steps data"""
        health_data = [
            {'steps': 10000, 'sleep_hours': 0, 'heart_rate': 0},
            {'steps': 8000, 'sleep_hours': 0, 'heart_rate': 0}
        ]
        
        result = service._summarize_health(health_data)
        
        assert 'avg_steps' in result
        assert result['avg_steps'] == 9000
        assert result['steps_status'] == 'good'
    
    def test_summarize_health_low_steps(self, service):
        """Test summary with low steps"""
        health_data = [
            {'steps': 3000, 'sleep_hours': 0, 'heart_rate': 0},
            {'steps': 4000, 'sleep_hours': 0, 'heart_rate': 0}
        ]
        
        result = service._summarize_health(health_data)
        
        assert result['steps_status'] == 'low'
    
    def test_summarize_health_with_sleep(self, service):
        """Test summary with sleep data"""
        health_data = [
            {'steps': 0, 'sleep_hours': 7.5, 'heart_rate': 0},
            {'steps': 0, 'sleep_hours': 8.0, 'heart_rate': 0}
        ]
        
        result = service._summarize_health(health_data)
        
        assert 'avg_sleep' in result
        assert result['avg_sleep'] == pytest.approx(7.75, 0.1)
        assert result['sleep_status'] == 'good'
    
    def test_summarize_health_too_little_sleep(self, service):
        """Test summary with insufficient sleep"""
        health_data = [
            {'steps': 0, 'sleep_hours': 5.0, 'heart_rate': 0},
            {'steps': 0, 'sleep_hours': 6.0, 'heart_rate': 0}
        ]
        
        result = service._summarize_health(health_data)
        
        assert result['sleep_status'] == 'too_little'
    
    def test_summarize_health_too_much_sleep(self, service):
        """Test summary with excessive sleep"""
        health_data = [
            {'steps': 0, 'sleep_hours': 10.0, 'heart_rate': 0},
            {'steps': 0, 'sleep_hours': 11.0, 'heart_rate': 0}
        ]
        
        result = service._summarize_health(health_data)
        
        assert result['sleep_status'] == 'too_much'
    
    def test_summarize_health_with_heart_rate(self, service):
        """Test summary with heart rate data"""
        health_data = [
            {'steps': 0, 'sleep_hours': 0, 'heart_rate': 68},
            {'steps': 0, 'sleep_hours': 0, 'heart_rate': 72}
        ]
        
        result = service._summarize_health(health_data)
        
        assert 'avg_hr' in result
        assert result['avg_hr'] == 70
        assert result['hr_status'] == 'good'
    
    def test_summarize_health_elevated_hr(self, service):
        """Test summary with elevated heart rate"""
        health_data = [
            {'steps': 0, 'sleep_hours': 0, 'heart_rate': 85},
            {'steps': 0, 'sleep_hours': 0, 'heart_rate': 90}
        ]
        
        result = service._summarize_health(health_data)
        
        assert result['hr_status'] == 'elevated'
    
    def test_summarize_health_complete_data(self, service):
        """Test summary with all metrics"""
        health_data = [
            {'steps': 10000, 'sleep_hours': 8.0, 'heart_rate': 68},
            {'steps': 12000, 'sleep_hours': 7.5, 'heart_rate': 65}
        ]
        
        result = service._summarize_health(health_data)
        
        assert 'avg_steps' in result
        assert 'avg_sleep' in result
        assert 'avg_hr' in result
        assert result['steps_status'] == 'good'
        assert result['sleep_status'] == 'good'
        assert result['hr_status'] == 'good'


class TestSingletonInstance:
    """Test health_analytics_service singleton"""
    
    def test_singleton_instance_exists(self):
        """Test that singleton instance is created"""
        assert health_analytics_service is not None
        assert isinstance(health_analytics_service, HealthAnalyticsService)


class TestEdgeCases:
    """Test edge cases and error scenarios"""
    
    @pytest.fixture
    def service(self):
        """Create HealthAnalyticsService instance"""
        return HealthAnalyticsService()
    
    def test_analyze_with_exception_in_processing(self, service):
        """Test error handling when processing fails"""
        # Create data that might cause issues
        health_data = [{'date': '2025-01-01', 'steps': 'invalid'}]  # Invalid steps
        mood_data = [{'date': '2025-01-01', 'mood_score': 5}]
        
        result = service.analyze_health_mood_correlation(health_data, mood_data)
        
        # Should handle error gracefully
        assert result['status'] == 'error'
        assert 'error' in result['message'] or 'Error' in result['message'] or result['message']
    
    def test_match_with_partial_mood_scores(self, service):
        """Test matching when mood_score is missing"""
        health_data = [{'date': '2025-01-01', 'steps': 5000, 'sleep_hours': 7.0}]
        mood_data = [{'date': '2025-01-01'}]  # No mood_score
        
        result = service._match_health_to_mood(health_data, mood_data)
        
        # Should still match and use default mood
        assert len(result) == 1
        assert result[0]['mood_score'] == 5  # Default
    
    def test_summarize_health_with_zero_values(self, service):
        """Test summary ignores zero values"""
        health_data = [
            {'steps': 0, 'sleep_hours': 0, 'heart_rate': 0},
            {'steps': 10000, 'sleep_hours': 8.0, 'heart_rate': 70}
        ]
        
        result = service._summarize_health(health_data)
        
        # Should only use non-zero values
        assert result['avg_steps'] == 10000
        assert result['avg_sleep'] == 8.0
        assert result['avg_hr'] == 70
