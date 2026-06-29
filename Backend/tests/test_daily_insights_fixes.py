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
    """#6: _fetch_activity_patterns should return real data from mood tags."""

    @patch('src.services.daily_insight_service_v2.db')
    def test_fetch_activity_patterns_returns_tag_data(self, mock_db, generator):
        """Should return activity data from mood entries' tags field."""
        now = datetime.now()
        mock_docs = []
        for i in range(5):
            doc = MagicMock()
            doc.to_dict.return_value = {
                'tags': ['nature', 'exercise'] if i % 2 == 0 else ['social'],
                'score': 5 + i,
                'timestamp': (now - timedelta(days=i)).isoformat(),
            }
            mock_docs.append(doc)

        # Mock: db.collection('users').document(user_id).collection('moods').order_by(...).stream()
        mock_query = MagicMock()
        mock_query.stream.return_value = mock_docs
        mock_moods_collection = MagicMock()
        mock_moods_collection.order_by.return_value = mock_query
        mock_user_doc = MagicMock()
        mock_user_doc.collection.return_value = mock_moods_collection
        mock_users_collection = MagicMock()
        mock_users_collection.document.return_value = mock_user_doc
        mock_db.collection.return_value = mock_users_collection

        result = generator._fetch_activity_patterns('user123')

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
        mock_query.stream.return_value = [pending_doc, dismissed_doc]
        mock_collection = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection

        result = generator.get_pending_insights('user123')

        # Should only return pending insights, not dismissed ones
        assert len(result) == 1
        assert result[0]['insight_id'] == 'i1'
