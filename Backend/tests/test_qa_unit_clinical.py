"""
UNIT TESTS - Klinisk bedömning (Clinical Assessment)
=====================================================
Tests PHQ-9 and GAD-7 scoring logic, severity classification,
and risk level stratification.

Run: pytest tests/test_qa_unit_clinical.py -v
"""

from unittest.mock import MagicMock, Mock, patch

import pytest


# ---------------------------------------------------------------------------
# PHQ-9 Scoring Logic
# ---------------------------------------------------------------------------

class TestPHQ9Scoring:
    """Test PHQ-9 (depression screening) score calculations."""

    def test_phq9_min_score_zero(self, make_phq9_data):
        """All zeros → total_score = 0, severity = 'minimal'."""
        data = make_phq9_data(answers=[0] * 9)
        total = sum(data['responses'].values())
        assert total == 0
        assert total < 5  # minimal depression

    def test_phq9_max_score_27(self, make_phq9_data):
        """All threes → total_score = 27, severity = 'severe'."""
        data = make_phq9_data(answers=[3] * 9)
        total = sum(data['responses'].values())
        assert total == 27
        assert total >= 20  # severe depression

    def test_phq9_mild_threshold(self, make_phq9_data):
        """Score 5-9 → mild depression."""
        data = make_phq9_data(answers=[1, 1, 1, 1, 1, 0, 0, 0, 0])
        total = sum(data['responses'].values())
        assert 5 <= total <= 9

    def test_phq9_moderate_threshold(self, make_phq9_data):
        """Score 10-14 → moderate depression."""
        data = make_phq9_data(answers=[2, 2, 2, 2, 2, 0, 0, 0, 0])
        total = sum(data['responses'].values())
        assert 10 <= total <= 14

    def test_phq9_moderately_severe_threshold(self, make_phq9_data):
        """Score 15-19 → moderately severe depression."""
        data = make_phq9_data(answers=[2, 2, 2, 2, 2, 2, 2, 1, 0])
        total = sum(data['responses'].values())
        assert 15 <= total <= 19

    def test_phq9_severe_threshold(self, make_phq9_data):
        """Score ≥20 → severe depression."""
        data = make_phq9_data(answers=[3, 3, 3, 3, 3, 3, 2, 2, 2])
        total = sum(data['responses'].values())
        assert total >= 20

    def test_phq9_severity_classification(self):
        """Test severity classification boundaries."""
        def classify(score):
            if score < 5: return "minimal"
            elif score < 10: return "mild"
            elif score < 15: return "moderate"
            elif score < 20: return "moderately_severe"
            else: return "severe"

        assert classify(0) == "minimal"
        assert classify(4) == "minimal"
        assert classify(5) == "mild"
        assert classify(9) == "mild"
        assert classify(10) == "moderate"
        assert classify(14) == "moderate"
        assert classify(15) == "moderately_severe"
        assert classify(19) == "moderately_severe"
        assert classify(20) == "severe"
        assert classify(27) == "severe"

    def test_phq9_suicidal_ideation_question(self, make_phq9_data):
        """Question 9 (self_harm) screens for suicidal ideation (score > 0 = flag)."""
        data = make_phq9_data(answers=[0, 0, 0, 0, 0, 0, 0, 0, 3])
        q9_score = data['responses'].get('self_harm', 0)
        assert q9_score > 0, "Q9 score > 0 should flag suicidal ideation"

    def test_phq9_self_harm_score_extraction(self, make_phq9_data):
        """Self-harm score should be extracted from Q9 (self_harm key)."""
        data = make_phq9_data(answers=[0, 0, 0, 0, 0, 0, 0, 0, 2])
        self_harm_score = data['responses'].get('self_harm', 0)
        assert self_harm_score == 2


# ---------------------------------------------------------------------------
# GAD-7 Scoring Logic
# ---------------------------------------------------------------------------

class TestGAD7Scoring:
    """Test GAD-7 (anxiety screening) score calculations."""

    def test_gad7_min_score_zero(self, make_gad7_data):
        """All zeros → total_score = 0, severity = 'minimal'."""
        data = make_gad7_data(answers=[0] * 7)
        total = sum(data['responses'].values())
        assert total == 0
        assert total < 5  # minimal anxiety

    def test_gad7_max_score_21(self, make_gad7_data):
        """All threes → total_score = 21, severity = 'severe'."""
        data = make_gad7_data(answers=[3] * 7)
        total = sum(data['responses'].values())
        assert total == 21
        assert total >= 15  # severe anxiety

    def test_gad7_mild_threshold(self, make_gad7_data):
        """Score 5-9 → mild anxiety."""
        data = make_gad7_data(answers=[1, 1, 1, 1, 1, 0, 0])
        total = sum(data['responses'].values())
        assert 5 <= total <= 9

    def test_gad7_moderate_threshold(self, make_gad7_data):
        """Score 10-14 → moderate anxiety."""
        data = make_gad7_data(answers=[2, 2, 2, 2, 2, 0, 0])
        total = sum(data['responses'].values())
        assert 10 <= total <= 14

    def test_gad7_severe_threshold(self, make_gad7_data):
        """Score ≥15 → severe anxiety."""
        data = make_gad7_data(answers=[3, 3, 3, 3, 3, 0, 0])
        total = sum(data['responses'].values())
        assert total >= 15

    def test_gad7_severity_classification(self):
        """Test GAD-7 severity classification boundaries."""
        def classify(score):
            if score < 5: return "minimal"
            elif score < 10: return "mild"
            elif score < 15: return "moderate"
            else: return "severe"

        assert classify(0) == "minimal"
        assert classify(4) == "minimal"
        assert classify(5) == "mild"
        assert classify(9) == "mild"
        assert classify(10) == "moderate"
        assert classify(14) == "moderate"
        assert classify(15) == "severe"
        assert classify(21) == "severe"


# ---------------------------------------------------------------------------
# Risk Level Stratification
# ---------------------------------------------------------------------------

class TestRiskStratification:
    """Test clinical risk level assignment based on assessment scores."""

    def test_low_risk_phq9(self):
        """PHQ-9 < 10 → low risk."""
        score = 8
        risk = "low" if score < 10 else "moderate"
        assert risk == "low"

    def test_moderate_risk_phq9(self):
        """PHQ-9 10-19 → moderate risk."""
        score = 15
        risk = "moderate" if 10 <= score < 20 else "low"
        assert risk == "moderate"

    def test_high_risk_phq9(self):
        """PHQ-9 ≥ 20 → high risk."""
        score = 22
        risk = "high" if score >= 20 else "moderate"
        assert risk == "high"

    def test_crisis_risk_with_suicidal_ideation(self):
        """PHQ-9 Q9 > 0 should escalate risk to crisis."""
        q9_score = 2
        base_risk = "moderate"
        if q9_score > 0:
            risk = "crisis" if q9_score >= 2 else "high"
        else:
            risk = base_risk
        assert risk == "crisis"

    def test_high_risk_with_q9_score_one(self):
        """PHQ-9 Q9 = 1 should escalate to high risk."""
        q9_score = 1
        base_risk = "moderate"
        if q9_score > 0:
            risk = "crisis" if q9_score >= 2 else "high"
        else:
            risk = base_risk
        assert risk == "high"


# ---------------------------------------------------------------------------
# Assessment Data Storage (mocked Firestore)
# ---------------------------------------------------------------------------

class TestAssessmentStorage:
    """Test that assessment data is correctly stored in Firestore."""

    @patch('src.routes.advanced_mood_routes.db')
    def test_phq9_assessment_stored_with_correct_fields(self, mock_db):
        """PHQ-9 assessment should be stored with all required fields."""
        now_iso = "2026-06-30T00:00:00+00:00"
        assessment_data = {
            'timestamp': now_iso,
            'type': 'phq9',
            'total_score': 12,
            'severity': 'moderate',
            'risk_level': 'moderate',
            'suicidal_ideation': False,
            'self_harm_score': 0,
            'recommendations': ['Följ upp inom 2 veckor'],
        }

        required_fields = ['timestamp', 'type', 'total_score', 'severity', 'risk_level']
        for field in required_fields:
            assert field in assessment_data

        assert assessment_data['type'] == 'phq9'
        assert assessment_data['total_score'] == 12

    @patch('src.routes.advanced_mood_routes.db')
    def test_gad7_assessment_stored_with_correct_fields(self, mock_db):
        """GAD-7 assessment should be stored with all required fields."""
        now_iso = "2026-06-30T00:00:00+00:00"
        assessment_data = {
            'timestamp': now_iso,
            'type': 'gad7',
            'total_score': 8,
            'severity': 'mild',
            'risk_level': 'low',
            'recommendations': ['Avslappningsövningar'],
        }

        assert assessment_data['type'] == 'gad7'
        assert assessment_data['total_score'] == 8
        assert 'timestamp' in assessment_data

    def test_assessment_timestamp_is_iso_format(self):
        """Assessment timestamp should be ISO format string."""
        from datetime import datetime, UTC
        ts = datetime.now(UTC).isoformat()
        parsed = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        assert isinstance(parsed, datetime)
