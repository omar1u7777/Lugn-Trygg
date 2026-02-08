"""
Tests for Predictive Analytics Service
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from src.services.predictive_service import PredictiveAnalyticsService


class TestPredictiveAnalyticsService:
    """Test cases for PredictiveAnalyticsService"""

    @pytest.fixture
    def service(self):
        """Create a fresh service instance for each test"""
        return PredictiveAnalyticsService()

    @pytest.fixture
    def sample_mood_data(self):
        """Generate sample mood data for testing"""
        base_date = datetime.now() - timedelta(days=30)
        data = []

        for i in range(30):
            date = base_date + timedelta(days=i)
            # Create some realistic mood patterns
            mood_score = 3 + np.sin(i * 0.2) + np.random.normal(0, 0.5)
            mood_score = max(1, min(5, mood_score))  # Clamp between 1-5

            data.append({
                'timestamp': date.isoformat(),
                'mood_text': f'Mood entry {i}',
                'sentiment_score': mood_score
            })

        return data

    def test_preprocess_mood_data(self, service, sample_mood_data):
        """Test mood data preprocessing"""
        df = service.preprocess_mood_data(sample_mood_data)

        assert not df.empty
        assert 'mood_score' in df.columns
        assert 'hour' in df.columns
        assert 'day_of_week' in df.columns
        assert 'trend_3d' in df.columns
        assert 'trend_7d' in df.columns
        assert len(df) == len(sample_mood_data)

    def test_extract_mood_score(self, service):
        """Test mood score extraction from text"""
        # Test positive mood
        score = service._extract_mood_score("Jag känner mig glad och energisk idag")
        assert score >= 3

        # Test negative mood
        score = service._extract_mood_score("Jag känner mig ledsen och trött")
        assert score <= 3

        # Test neutral mood
        score = service._extract_mood_score("Idag känns det ganska normalt")
        assert score == 3

    def test_score_to_mood_category(self, service):
        """Test mood score to category conversion"""
        assert service._score_to_mood_category(4.5) == 'excellent'
        assert service._score_to_mood_category(3.5) == 'good'
        assert service._score_to_mood_category(2.5) == 'neutral'
        assert service._score_to_mood_category(1.5) == 'bad'
        assert service._score_to_mood_category(0.5) == 'terrible'

    def test_calculate_confidence(self, service):
        """Test confidence calculation"""
        # Create test data with some variance
        test_df = pd.DataFrame({
            'mood_score': [3, 3.1, 2.9, 3.2, 2.8, 3.0, 3.1]
        })

        confidence = service._calculate_confidence(3.0, test_df)
        assert 0 <= confidence <= 1

    def test_detect_crisis_risk_low(self, service, sample_mood_data):
        """Test crisis risk detection with low risk data"""
        result = service.detect_crisis_risk(sample_mood_data)

        assert 'risk_level' in result
        assert 'confidence' in result
        assert 'indicators' in result
        assert 'recommendations' in result
        assert isinstance(result['indicators'], list)
        assert isinstance(result['recommendations'], list)

    def test_detect_crisis_risk_high(self, service):
        """Test crisis risk detection with high risk patterns"""
        # Create high-risk data
        high_risk_data = []
        base_date = datetime.now() - timedelta(days=10)

        for i in range(10):
            date = base_date + timedelta(days=i)
            # Very low mood scores with negative text
            high_risk_data.append({
                'timestamp': date.isoformat(),
                'mood_text': 'Jag känner mig hopplös och vill inte leva längre',
                'sentiment_score': 1.0
            })

        result = service.detect_crisis_risk(high_risk_data)

        assert result['risk_level'] in ['high', 'medium']
        assert len(result['indicators']) > 0
        assert len(result['recommendations']) > 0

    def test_create_prediction_features(self, service):
        """Test prediction feature creation"""
        pred_date = pd.Timestamp('2024-01-15')
        last_entry = pd.Series({
            'mood_score': 3.5,
            'timestamp': '2024-01-14T12:00:00'
        })
        df = pd.DataFrame()  # Empty for this test

        features = service._create_prediction_features(pred_date, last_entry, df)

        assert 'hour' in features
        assert 'day_of_week' in features
        assert 'month' in features
        assert 'prev_mood' in features
        assert 'seasonal_factor' in features
        assert 'weekend_factor' in features

    @patch('src.services.predictive_service.joblib')
    def test_train_predictive_model_insufficient_data(self, mock_joblib, service):
        """Test model training with insufficient data"""
        insufficient_data = [{'timestamp': '2024-01-01', 'mood_text': 'test'}]

        result = service.train_predictive_model(insufficient_data)

        assert not result['success']
        assert 'Insufficient data' in result['error']

    @patch('src.services.predictive_service.joblib')
    def test_train_predictive_model_success(self, mock_joblib, service, sample_mood_data):
        """Test successful model training"""
        # Mock the joblib operations
        mock_model = MagicMock()
        mock_scaler = MagicMock()
        mock_joblib.dump = MagicMock()
        mock_joblib.load = MagicMock(return_value={
            'model': mock_model,
            'scaler': mock_scaler,
            'features': ['hour', 'day_of_week'],
            'model_type': 'random_forest'
        })

        result = service.train_predictive_model(sample_mood_data)

        # Should attempt to train (though mocked)
        assert 'success' in result
        # Note: actual success depends on mocked implementation

    def test_generate_crisis_recommendations(self, service):
        """Test crisis recommendation generation"""
        # Test high risk recommendations
        high_rec = service._generate_crisis_recommendations('high', ['Sudden drop'])
        assert len(high_rec) > 0
        assert any('kontakta' in rec.lower() for rec in high_rec)

        # Test low risk recommendations
        low_rec = service._generate_crisis_recommendations('low', [])
        assert len(low_rec) > 0
        assert any('fortsätt' in rec.lower() for rec in low_rec)

    def test_insufficient_data_handling(self, service):
        """Test handling of insufficient data scenarios"""
        # Empty data
        result = service.detect_crisis_risk([])
        assert result['risk_level'] == 'unknown'
        assert result['confidence'] == 0

        # Very small dataset
        tiny_data = [{'timestamp': '2024-01-01', 'mood_text': 'test'}]
        result = service.detect_crisis_risk(tiny_data)
        assert 'risk_level' in result

    def test_seasonal_factor_calculation(self, service):
        """Test seasonal factor calculation"""
        pred_date = pd.Timestamp('2024-06-15')  # Summer solstice-ish
        last_entry = pd.Series({'mood_score': 3})
        df = pd.DataFrame()

        features = service._create_prediction_features(pred_date, last_entry, df)

        # Seasonal factor should be between -1 and 1
        assert -1 <= features['seasonal_factor'] <= 1

    def test_weekend_factor(self, service):
        """Test weekend factor calculation"""
        # Monday
        monday = pd.Timestamp('2024-01-15')  # Monday
        # Sunday
        sunday = pd.Timestamp('2024-01-21')  # Sunday

        last_entry = pd.Series({'mood_score': 3})
        df = pd.DataFrame()

        monday_features = service._create_prediction_features(monday, last_entry, df)
        sunday_features = service._create_prediction_features(sunday, last_entry, df)

        assert monday_features['weekend_factor'] == 0  # Monday is not weekend
        assert sunday_features['weekend_factor'] == 1  # Sunday is weekend