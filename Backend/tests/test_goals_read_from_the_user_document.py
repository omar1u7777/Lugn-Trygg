"""Everything that reads a person's goals reads the goals they picked.

The goals picked in onboarding and on /wellness are the wellnessGoals list on
the user document. The chat's retrieval step and the conversation-quality
measure both read users/{uid}/goals instead, a collection nothing writes: the
retrieval never found a goal to bring into a reply, and the quality measure
scored "goal alignment" against no goals, which is a flat 0.5 for everyone.
"""

from unittest.mock import MagicMock, Mock, patch

import numpy as np
import pytest

from src.services.chat_rag_service import ChatRAGService
from src.utils.wellness_goals import read_wellness_goals

USER_ID = 'testuser1234567890ab'


def _db(user_fields, exists=True):
    """A user document with these fields, and a goals collection that must stay unread."""
    db = MagicMock()
    user = db.collection.return_value.document.return_value
    user.get.return_value.exists = exists
    user.get.return_value.to_dict.return_value = user_fields
    user.collection.side_effect = AssertionError('read a subcollection for goals')
    return db


# ── the list itself ─────────────────────────────────────────────────────────

def test_the_goals_are_the_wellness_goals_on_the_user_document():
    assert read_wellness_goals(_db({'wellnessGoals': ['Hantera stress', 'Bättre sömn']}), USER_ID) \
        == ['Hantera stress', 'Bättre sömn']


@pytest.mark.parametrize('stored', [None, 'Hantera stress', {'a': 1}, []])
def test_anything_but_a_list_of_goals_is_no_goals(stored):
    assert read_wellness_goals(_db({'wellnessGoals': stored}), USER_ID) == []


def test_blank_and_non_text_goals_are_left_out_and_the_rest_trimmed():
    stored = ['  Hantera stress ', '', None, 7, '   ', 'x' * 300]

    assert read_wellness_goals(_db({'wellnessGoals': stored}), USER_ID) == ['Hantera stress', 'x' * 100]


def test_no_more_than_three_goals_are_read():
    assert len(read_wellness_goals(_db({'wellnessGoals': ['a', 'b', 'c', 'd', 'e']}), USER_ID)) == 3


def test_someone_without_a_user_document_has_no_goals():
    assert read_wellness_goals(_db({}, exists=False), USER_ID) == []


# ── the chat's retrieval step ───────────────────────────────────────────────

@pytest.fixture
def rag():
    service = ChatRAGService(USER_ID)
    # Texts about stress point one way, everything else another.
    service.embed_text = lambda text: np.array([1.0, 0.0]) if 'stress' in text.lower() else np.array([0.0, 1.0])
    service.prewarm_embeddings = lambda texts: None
    return service


def test_a_goal_that_matches_the_message_is_retrieved(rag):
    db = _db({'wellnessGoals': ['Hantera stress', 'Bättre sömn']})

    contexts = rag._retrieve_goals_contexts(db, np.array([1.0, 0.0]), 3)

    assert [(c.source, c.content) for c in contexts] == [('goals', 'Mål: Hantera stress')]


def test_someone_with_no_goals_gets_none(rag):
    assert rag._retrieve_goals_contexts(_db({}), np.array([1.0, 0.0]), 3) == []


# ── the conversation-quality measure ────────────────────────────────────────

def test_goal_alignment_is_measured_against_the_goals_the_person_picked(client):
    db = _db({'wellnessGoals': ['Hantera stress', 'Bättre sömn']})
    user = db.collection.return_value.document.return_value
    message = Mock()
    message.to_dict.return_value = {'role': 'assistant', 'content': 'Hej'}
    conversations = MagicMock()
    conversations.order_by.return_value.limit.return_value.get.return_value = [message]
    user.collection.side_effect = lambda name: conversations if name == 'conversations' else pytest.fail(name)

    detector = Mock()
    detector.analyze_conversation_quality.return_value = Mock(
        empathy_score=8, specificity_score=7, collaboration_score=9, structure_score=8,
        overall_quality=8, safety_assessment='safe', goal_alignment=0.8, technique_usage={},
    )
    detector.generate_therapeutic_recommendations.return_value = []

    with patch('src.routes.chatbot_routes.FRAMEWORK_AVAILABLE', True), \
            patch('src.routes.chatbot_routes.get_framework_detector', return_value=detector), \
            patch('src.routes.chatbot_routes.db', db):
        response = client.get('/api/v1/chatbot/analysis/quality')

    assert response.status_code == 200
    assert detector.analyze_conversation_quality.call_args.args[1] == ['Hantera stress', 'Bättre sömn']
