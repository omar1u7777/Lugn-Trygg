"""
UNIT TESTS - Dagliga insikter (Daily Insights)
================================================
Tests insight generation logic: trend detection, behavioral activation,
onboarding fallback, timestamp handling, and Firestore queries.
Uses mocks to isolate from Firestore.

Run: pytest tests/test_qa_unit_insights.py -v
"""

from datetime import timedelta, timezone, datetime as dt_class
from unittest.mock import MagicMock, Mock, patch

import pytest

from src.services.daily_insight_service_v2 import (
    DailyInsightGeneratorV2,
    InsightType,
    TherapeuticDomain,
    TherapeuticInsight,
)


# ---------------------------------------------------------------------------
# Generator Configuration
# ---------------------------------------------------------------------------

class TestGeneratorConfiguration:
    """Test DailyInsightGeneratorV2 initialization and config."""

    def test_min_memories_is_three(self):
        """Generator should require minimum 3 mood logs."""
        gen = DailyInsightGeneratorV2()
        assert gen.min_memories == 3

    def test_analysis_window_is_14_days(self):
        """Analysis window should be 14 days."""
        gen = DailyInsightGeneratorV2()
        assert gen.analysis_window == 14

    def test_statistical_threshold(self):
        """Statistical significance threshold should be 0.05."""
        gen = DailyInsightGeneratorV2()
        assert gen.statistical_threshold == 0.05

    def test_min_effect_size(self):
        """Minimum effect size (Cohen's d) should be 0.3."""
        gen = DailyInsightGeneratorV2()
        assert gen.min_effect_size == 0.3

    def test_templates_populated(self):
        """Generator should have evidence-based templates."""
        gen = DailyInsightGeneratorV2()
        assert len(gen.TEMPLATES) > 0
        assert 'declining_trend' in gen.TEMPLATES


# ---------------------------------------------------------------------------
# Onboarding Fallback
# ---------------------------------------------------------------------------

class TestOnboardingFallback:
    """Test fallback insight generation for users with < 3 mood logs."""

    def test_onboarding_insight_generated_for_zero_moods(self):
        """0 mood logs → onboarding insight with welcome message."""
        gen = DailyInsightGeneratorV2()
        with patch('src.services.daily_insight_service_v2.db') as mock_db:
            mock_doc = Mock()
            mock_doc.exists = False
            mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

            insight = gen._generate_onboarding_insight('user123', 0)
            assert insight is not None
            assert insight.insight_type == InsightType.CHECKIN_NEEDED
            assert 'Välkommen' in insight.message

    def test_onboarding_insight_generated_for_two_moods(self):
        """2 mood logs → onboarding insight with 'almost there' message."""
        gen = DailyInsightGeneratorV2()
        with patch('src.services.daily_insight_service_v2.db') as mock_db:
            mock_doc = Mock()
            mock_doc.exists = False
            mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

            insight = gen._generate_onboarding_insight('user123', 2)
            assert insight is not None
            assert 'nära' in insight.message.lower() or 'en gång till' in insight.message.lower()

    def test_onboarding_insight_not_duplicated_same_day(self):
        """Should not create duplicate onboarding insight for same day."""
        gen = DailyInsightGeneratorV2()
        with patch('src.services.daily_insight_service_v2.db') as mock_db:
            mock_doc = Mock()
            mock_doc.exists = True  # Already exists today
            mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

            insight = gen._generate_onboarding_insight('user123', 0)
            assert insight is None, "Should not create duplicate onboarding insight"

    def test_onboarding_insight_has_correct_domain(self):
        """Onboarding insight should be in BEHAVIORAL_ACTIVATION domain."""
        gen = DailyInsightGeneratorV2()
        with patch('src.services.daily_insight_service_v2.db') as mock_db:
            mock_doc = Mock()
            mock_doc.exists = False
            mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

            insight = gen._generate_onboarding_insight('user123', 1)
            assert insight.domain == TherapeuticDomain.BEHAVIORAL_ACTIVATION


# ---------------------------------------------------------------------------
# Timestamp Handling (critical fix for timezone-aware comparison)
# ---------------------------------------------------------------------------

class TestTimestampHandling:
    """Test that timestamp comparisons handle both ISO strings and datetime objects."""

    def test_iso_string_cutoff_comparison(self):
        """ISO string timestamps should be compared lexicographically."""
        cutoff_iso = "2026-06-16T00:00:00+00:00"
        recent_ts = "2026-06-25T12:00:00+00:00"
        old_ts = "2026-06-01T00:00:00+00:00"

        assert recent_ts >= cutoff_iso
        assert old_ts < cutoff_iso

    def test_timezone_aware_datetime_comparison(self):
        """Timezone-aware datetimes should compare correctly."""
        cutoff = dt_class.now(timezone.utc) - timedelta(days=14)
        recent = dt_class.now(timezone.utc) - timedelta(days=1)
        old = dt_class.now(timezone.utc) - timedelta(days=30)

        assert recent >= cutoff
        assert old < cutoff

    def test_naive_datetime_normalized_to_utc(self):
        """Naive datetime should be normalized to UTC before comparison."""
        cutoff = dt_class.now(timezone.utc) - timedelta(days=14)
        naive_recent = dt_class.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)

        # Normalize naive to UTC
        if naive_recent.tzinfo is None:
            naive_recent = naive_recent.replace(tzinfo=timezone.utc)

        assert naive_recent >= cutoff

    def test_mixed_string_and_datetime_no_error(self):
        """Should not raise when comparing ISO string cutoff with datetime ts."""
        cutoff_iso = (dt_class.now(timezone.utc) - timedelta(days=14)).isoformat()
        ts_datetime = dt_class.now(timezone.utc) - timedelta(days=1)

        # The pattern from _fetch_memories
        if isinstance(ts_datetime, str):
            result = ts_datetime >= cutoff_iso
        elif isinstance(ts_datetime, dt_class):
            if ts_datetime.tzinfo is None:
                ts_datetime = ts_datetime.replace(tzinfo=timezone.utc)
            cutoff_dt = dt_class.fromisoformat(cutoff_iso)
            result = ts_datetime >= cutoff_dt

        assert result is True


# ---------------------------------------------------------------------------
# Insight Saving
# ---------------------------------------------------------------------------

class TestInsightSaving:
    """Test that insights are correctly saved to Firestore."""

    @patch('src.services.daily_insight_service_v2.db')
    def test_save_insight_writes_to_firestore(self, mock_db):
        """_save_insight should write to insights collection."""
        gen = DailyInsightGeneratorV2()
        mock_doc_ref = Mock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        insight = TherapeuticInsight(
            insight_id='test_insight_1',
            user_id='user123',
            insight_type=InsightType.POSITIVE_PATTERN,
            domain=TherapeuticDomain.BEHAVIORAL_ACTIVATION,
            title='Test Insight',
            message='Test message',
            recommendation='Test recommendation',
            evidence={'score': 0.8},
            urgency='low',
            suggested_action='Test action',
            related_memories=['mem1'],
            created_at=dt_class.now(timezone.utc),
        )

        gen._save_insight(insight)

        mock_doc_ref.set.assert_called_once()
        saved_data = mock_doc_ref.set.call_args[0][0]
        assert saved_data['insight_id'] == 'test_insight_1'
        assert saved_data['status'] == 'pending'
        assert saved_data['version'] == '2.0'

    @patch('src.services.daily_insight_service_v2.db')
    def test_save_insight_handles_firestore_error(self, mock_db):
        """_save_insight should handle Firestore errors gracefully."""
        gen = DailyInsightGeneratorV2()
        mock_db.collection.return_value.document.return_value.set.side_effect = Exception("Firestore error")

        insight = TherapeuticInsight(
            insight_id='test_insight_2',
            user_id='user123',
            insight_type=InsightType.CHECKIN_NEEDED,
            domain=TherapeuticDomain.BEHAVIORAL_ACTIVATION,
            title='Test',
            message='Test',
            recommendation='Test',
            evidence={},
            urgency='low',
            suggested_action='Test',
            related_memories=[],
            created_at=dt_class.now(timezone.utc),
        )

        # Should not raise
        gen._save_insight(insight)


# ---------------------------------------------------------------------------
# Pending Insights Retrieval
# ---------------------------------------------------------------------------

class TestPendingInsightsRetrieval:
    """Test get_pending_insights query and filtering."""

    @patch('src.services.daily_insight_service_v2.db')
    def test_returns_only_pending_insights(self, mock_db):
        """Should filter out dismissed/action_taken insights."""
        gen = DailyInsightGeneratorV2()

        pending_doc = Mock()
        pending_doc.to_dict.return_value = {
            'insight_id': 'i1', 'user_id': 'u1', 'status': 'pending',
            'created_at': dt_class.now(timezone.utc),
        }
        dismissed_doc = Mock()
        dismissed_doc.to_dict.return_value = {
            'insight_id': 'i2', 'user_id': 'u1', 'status': 'dismissed',
            'created_at': dt_class.now(timezone.utc),
        }

        mock_query = Mock()
        mock_query.stream.return_value = [pending_doc, dismissed_doc]
        mock_collection = Mock()
        mock_collection.where.return_value.limit.return_value = mock_query
        mock_db.collection.return_value = mock_collection

        result = gen.get_pending_insights('u1')
        assert len(result) == 1
        assert result[0]['insight_id'] == 'i1'

    @patch('src.services.daily_insight_service_v2.db')
    def test_empty_result_when_no_insights(self, mock_db):
        """Should return empty list when no insights exist."""
        gen = DailyInsightGeneratorV2()

        mock_query = Mock()
        mock_query.stream.return_value = []
        mock_collection = Mock()
        mock_collection.where.return_value.limit.return_value = mock_query
        mock_db.collection.return_value = mock_collection

        result = gen.get_pending_insights('u1')
        assert result == []

    @patch('src.services.daily_insight_service_v2.db')
    def test_sorted_by_created_at_descending(self, mock_db):
        """Insights should be sorted by created_at descending."""
        gen = DailyInsightGeneratorV2()

        old_time = dt_class.now(timezone.utc) - timedelta(days=2)
        new_time = dt_class.now(timezone.utc)

        doc_old = Mock()
        doc_old.to_dict.return_value = {
            'insight_id': 'old', 'status': 'pending', 'created_at': old_time,
        }
        doc_new = Mock()
        doc_new.to_dict.return_value = {
            'insight_id': 'new', 'status': 'pending', 'created_at': new_time,
        }

        mock_query = Mock()
        mock_query.stream.return_value = [doc_old, doc_new]
        mock_collection = Mock()
        mock_collection.where.return_value.limit.return_value = mock_query
        mock_db.collection.return_value = mock_collection

        result = gen.get_pending_insights('u1')
        assert result[0]['insight_id'] == 'new'
        assert result[1]['insight_id'] == 'old'


# ---------------------------------------------------------------------------
# BUG 1: Ownership check in insight_action_taken route
# ---------------------------------------------------------------------------

class TestInsightActionOwnership:
    """BUG 1: insight_action_taken should verify ownership before updating."""

    @patch('src.routes.insights_routes.db')
    def test_action_denied_for_other_user_insight(self, mock_db):
        """Should return 403 when user tries to action another user's insight."""
        from src.routes.insights_routes import insight_action_taken
        from flask import Flask, g

        # Mock: insight belongs to user_b, not user_a
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {'user_id': 'user_b'}
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        app = Flask(__name__)
        with app.test_request_context('/api/v1/insights/action/insight123',
                                       json={'action': 'done'}):
            g.user_id = 'user_a'
            response = insight_action_taken('insight123')

        # APIResponse returns (body, status_code) tuple
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 403

    @patch('src.routes.insights_routes.db')
    def test_action_returns_404_for_nonexistent_insight(self, mock_db):
        """Should return 404 when insight doesn't exist."""
        from src.routes.insights_routes import insight_action_taken
        from flask import Flask, g

        mock_doc = Mock()
        mock_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        app = Flask(__name__)
        with app.test_request_context('/api/v1/insights/action/nonexistent',
                                       json={'action': 'done'}):
            g.user_id = 'user_a'
            response = insight_action_taken('nonexistent')

        # APIResponse returns (body, status_code) tuple
        status = response[1] if isinstance(response, tuple) else response.status_code
        assert status == 404
