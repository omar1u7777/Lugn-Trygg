"""
TDD Tests for daily_insight_service_v2 fixes
Covers: #4 Firestore index fallback, #5 dedup onboarding, #6 activity patterns, #7 None sentiment
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch


@pytest.fixture
def generator():
    from src.services.daily_insight_service_v2 import DailyInsightGeneratorV2
    return DailyInsightGeneratorV2()


@pytest.fixture
def sample_moods():
    """7 mood entries with timestamps within last 14 days."""
    now = datetime.now()
    return [
        {
            'id': f'mood_{i}',
            'score': 5 + i,
            'valence': 0.1 * i,
            'arousal': 0.05 * i,
            'timestamp': (now - timedelta(days=6 - i)).isoformat(),
            'note': f'Mood entry {i}',
            'tags': ['work', 'nature'] if i % 2 == 0 else ['social'],
        }
        for i in range(7)
    ]


class TestOnboardingDedup:
    """#5: Onboarding insight should not be duplicated in Firestore."""

    @patch('src.services.daily_insight_service_v2.db')
    def test_onboarding_not_saved_if_already_exists(self, mock_db, generator):
        """Should not save a new onboarding insight if one already exists today."""
        # Mock: db.collection('insights').document(expected_id).get().exists = True
        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value.exists = True
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db.collection.return_value = mock_collection

        result = generator._generate_onboarding_insight('user123', 1)

        # Should return None since onboarding already exists
        assert result is None

    @patch('src.services.daily_insight_service_v2.db')
    def test_onboarding_saved_if_not_exists(self, mock_db, generator):
        """Should create onboarding insight if none exists today."""
        # Mock: db.collection('insights').document(expected_id).get().exists = False
        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value.exists = False
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db.collection.return_value = mock_collection

        result = generator._generate_onboarding_insight('user123', 1)

        # Should return a TherapeuticInsight
        assert result is not None
        assert result.insight_type.value == 'checkin'
        assert '2' in result.recommendation  # "2 gång(er) till"


class TestNoneSentimentCoercion:
    """#7: sentiment_score=None should be coerced to 0."""

    def test_categorize_activity_with_none_sentiment(self, generator):
        """_detect_behavioral_activation_targets should not crash on None sentiment."""
        memories = [
            {
                'id': 'm1',
                'score': 5,
                'note': 'Promenad i skogen',
                'ai_analysis': {'sentiment_score': None},
                'timestamp': datetime.now().isoformat(),
            },
            {
                'id': 'm2',
                'score': 6,
                'note': 'Promenad i parken',
                'ai_analysis': {'sentiment_score': None},
                'timestamp': datetime.now().isoformat(),
            },
            {
                'id': 'm3',
                'score': 7,
                'note': 'Vandra i naturen',
                'ai_analysis': {'sentiment_score': None},
                'timestamp': datetime.now().isoformat(),
            },
        ]

        # Should not raise TypeError
        insights = generator._detect_behavioral_activation_targets(memories, 'user123')
        assert isinstance(insights, list)

    def test_categorize_activity_with_missing_ai_analysis(self, generator):
        """Should handle missing ai_analysis key entirely."""
        memories = [
            {'id': 'm1', 'score': 5, 'note': 'Skogspromenad', 'timestamp': datetime.now().isoformat()},
            {'id': 'm2', 'score': 6, 'note': 'Parkpromenad', 'timestamp': datetime.now().isoformat()},
            {'id': 'm3', 'score': 7, 'note': 'Naturvandra', 'timestamp': datetime.now().isoformat()},
        ]

        insights = generator._detect_behavioral_activation_targets(memories, 'user123')
        assert isinstance(insights, list)


class TestActivityPatterns:
    """BUG 4: _extract_activity_patterns should return real data from mood tags."""

    def test_extract_activity_patterns_returns_tag_data(self, generator):
        """Should return activity data from memories' tags field."""
        now = datetime.now()
        memories = [
            {
                'tags': ['nature', 'exercise'] if i % 2 == 0 else ['social'],
                'score': 5 + i,
                'timestamp': (now - timedelta(days=i)).isoformat(),
            }
            for i in range(5)
        ]

        result = generator._extract_activity_patterns(memories)

        # Should not be empty dict anymore
        assert isinstance(result, dict)
        assert len(result) > 0
        # Should contain tag-based activity counts
        assert 'nature' in result or 'social' in result


class TestPendingInsightsFallback:
    """#4: get_pending_insights should work without composite index."""

    @patch('src.services.daily_insight_service_v2.db')
    def test_fallback_to_simple_query_on_index_error(self, mock_db, generator):
        """Should use single-field query and filter status in Python."""
        # Pending doc (should be returned)
        pending_doc = MagicMock()
        pending_doc.to_dict.return_value = {
            'insight_id': 'i1',
            'user_id': 'user123',
            'status': 'pending',
            'title': 'Test',
            'created_at': datetime.now(),
        }
        # Dismissed doc (should be filtered out)
        dismissed_doc = MagicMock()
        dismissed_doc.to_dict.return_value = {
            'insight_id': 'i2',
            'user_id': 'user123',
            'status': 'dismissed',
            'title': 'Old',
            'created_at': datetime.now(),
        }

        # Mock: db.collection('insights').where(user_id).stream() → returns both docs
        mock_query = MagicMock()
        mock_query.limit.return_value = mock_query
        mock_query.stream.return_value = [pending_doc, dismissed_doc]
        mock_collection = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection

        result = generator.get_pending_insights('user123')

        # Should only return pending insights, not dismissed ones
        assert len(result) == 1
        assert result[0]['insight_id'] == 'i1'

    @patch('src.services.daily_insight_service_v2.db')
    def test_old_pending_insights_filtered_by_ttl(self, mock_db, generator):
        """BUG 8: Insights older than 7 days should not be returned."""
        from datetime import UTC as UTC_TZ
        # Recent pending doc (should be returned)
        recent_doc = MagicMock()
        recent_doc.to_dict.return_value = {
            'insight_id': 'i1',
            'user_id': 'user123',
            'status': 'pending',
            'title': 'Recent',
            'created_at': datetime.now(UTC_TZ),
        }
        # Old pending doc (should be filtered out by TTL)
        old_doc = MagicMock()
        old_doc.to_dict.return_value = {
            'insight_id': 'i2',
            'user_id': 'user123',
            'status': 'pending',
            'title': 'Old',
            'created_at': datetime.now(UTC_TZ) - timedelta(days=10),
        }

        mock_query = MagicMock()
        mock_query.limit.return_value = mock_query
        mock_query.stream.return_value = [recent_doc, old_doc]
        mock_collection = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection

        result = generator.get_pending_insights('user123')

        # Should only return the recent insight
        assert len(result) == 1
        assert result[0]['insight_id'] == 'i1'


class TestAlreadyGeneratedToday:
    """BUG 3+7: generate_insights should return existing insights if already generated today."""

    @patch('src.services.daily_insight_service_v2.db')
    def test_returns_existing_insights_if_already_generated(self, mock_db, generator):
        """Should return today's insights without regenerating."""
        from datetime import UTC as UTC_TZ
        from src.services.daily_insight_service_v2 import TherapeuticInsight, InsightType, TherapeuticDomain

        # Mock: _already_generated_today finds one pending insight from today
        today_insight_doc = MagicMock()
        today_insight_doc.to_dict.return_value = {
            'insight_id': 'user123_today_trend',
            'user_id': 'user123',
            'status': 'pending',
            'insight_type': 'opportunity',
            'domain': 'behavioral_activation',
            'title': 'Test',
            'message': 'Test message',
            'recommendation': 'Test rec',
            'evidence': {},
            'urgency': 'low',
            'suggested_action': 'Test action',
            'related_memories': [],
            'created_at': datetime.now(UTC_TZ),
        }
        mock_query = MagicMock()
        mock_query.stream.return_value = [today_insight_doc]
        mock_query.where.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_collection = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection

        result = generator._already_generated_today('user123')

        assert len(result) == 1
        assert result[0].insight_id == 'user123_today_trend'

    @patch('src.services.daily_insight_service_v2.db')
    def test_returns_empty_if_none_today(self, mock_db, generator):
        """Should return empty list if no insights generated today."""
        # Mock: no insights found
        mock_query = MagicMock()
        mock_query.stream.return_value = []
        mock_query.where.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_collection = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection

        result = generator._already_generated_today('user123')
        assert result == []


class TestSocialRhythmTimezone:
    """BUG 9: _analyze_social_rhythm should use timezone-aware datetime."""

    def test_social_rhythm_no_crash_with_timezone_aware_timestamps(self, generator):
        """Should not raise TypeError when comparing with timezone-aware timestamps."""
        from datetime import UTC as UTC_TZ
        memories = [
            {
                'id': f'm{i}',
                'score': 5,
                'note': 'Promenad med vän',
                'timestamp': (datetime.now(UTC_TZ) - timedelta(days=i)).isoformat(),
            }
            for i in range(5)
        ]

        # Should not raise TypeError
        result = generator._analyze_social_rhythm(memories, 'user123')
        assert result is None or hasattr(result, 'insight_id')


class TestActInterventionsRemoved:
    """BUG 10: _generate_act_interventions should be removed."""

    def test_method_does_not_exist(self, generator):
        """The stub method should no longer exist on the generator."""
        assert not hasattr(generator, '_generate_act_interventions')
