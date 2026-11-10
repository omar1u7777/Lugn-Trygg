"""The chat sees a new journal entry, assessment or goal in its next reply.

The chat prompt is built from two per-user blocks kept in Redis for five
minutes: the profile (name, latest PHQ-9 and GAD-7) and the cross-source block
(recent journal entries, goals). invalidate_user_context() existed to drop them
when one of those changes, and nothing called it: someone who wrote in the
journal and then opened the chat was answered from the journal as it was up to
five minutes earlier.

The goals were never in the prompt at all. The block read users/{uid}/goals, a
collection nothing writes; the goals a person picks are the wellnessGoals list
on their user document.
"""

from unittest.mock import MagicMock

import pytest

from src.services.ai.conversation_engine import ConversationEngine
from tests.test_journal_routes import ENTRY_ID, mock_journal_db  # noqa: F401  (fixture)
from tests.test_onboarding_routes import mock_onboarding_db  # noqa: F401  (fixture)

USER_ID = 'testuser1234567890ab'


def _spy(mocker, module):
    return mocker.patch(f'src.routes.{module}.invalidate_user_context')


# ── Writes drop the cached context ──────────────────────────────────────────

def test_a_new_journal_entry_drops_the_cached_context(client, auth_csrf_headers, mock_journal_db, mocker):  # noqa: F811
    invalidate = _spy(mocker, 'journal_routes')

    response = client.post(f'/api/v1/journal/{USER_ID}/journal',
                           json={'content': 'Idag pratade jag med min chef om schemat', 'mood': 6},
                           headers=auth_csrf_headers)

    assert response.status_code == 201
    invalidate.assert_called_once_with(USER_ID)


def test_an_edited_journal_entry_drops_the_cached_context(client, auth_csrf_headers, mock_journal_db, mocker):  # noqa: F811
    invalidate = _spy(mocker, 'journal_routes')

    response = client.put(f'/api/v1/journal/{USER_ID}/journal/{ENTRY_ID}',
                          json={'content': 'Ändrad text om hur dagen blev'}, headers=auth_csrf_headers)

    assert response.status_code == 200
    invalidate.assert_called_once_with(USER_ID)


def test_a_deleted_journal_entry_drops_the_cached_context(client, auth_csrf_headers, mock_journal_db, mocker):  # noqa: F811
    invalidate = _spy(mocker, 'journal_routes')

    response = client.delete(f'/api/v1/journal/{USER_ID}/journal/{ENTRY_ID}', headers=auth_csrf_headers)

    assert response.status_code == 200
    invalidate.assert_called_once_with(USER_ID)


def test_a_refused_journal_entry_leaves_the_cache_alone(client, auth_csrf_headers, mock_journal_db, mocker):  # noqa: F811
    invalidate = _spy(mocker, 'journal_routes')

    response = client.post(f'/api/v1/journal/{USER_ID}/journal', json={'content': ''}, headers=auth_csrf_headers)

    assert response.status_code == 400
    invalidate.assert_not_called()


@pytest.mark.parametrize(('path', 'factory'), [('phq9', 'make_phq9_data'), ('gad7', 'make_gad7_data')])
def test_a_new_assessment_drops_the_cached_context(client, auth_csrf_headers, mock_db, mocker, request, path, factory):
    mocker.patch('src.routes.advanced_mood_routes.db', mock_db)
    invalidate = _spy(mocker, 'advanced_mood_routes')
    payload = request.getfixturevalue(factory)()

    response = client.post(f'/api/v1/advanced-mood/assess/{path}', json=payload, headers=auth_csrf_headers)

    assert response.status_code == 200, response.get_json()
    invalidate.assert_called_once_with(USER_ID)


def test_new_wellness_goals_drop_the_cached_context(client, auth_csrf_headers, mock_db, mocker):
    invalidate = _spy(mocker, 'users_routes')

    response = client.post('/api/v1/users/wellness-goals',
                           json={'wellnessGoals': ['Bättre sömn', 'Hantera stress']}, headers=auth_csrf_headers)

    assert response.status_code == 200, response.get_json()
    invalidate.assert_called_once_with(USER_ID)


@pytest.mark.parametrize('method', ['post', 'put'])
def test_onboarding_goals_drop_the_cached_context(client, auth_csrf_headers, mock_onboarding_db, mocker, method):  # noqa: F811
    invalidate = _spy(mocker, 'onboarding_routes')

    response = getattr(client, method)(f'/api/v1/onboarding/goals/{USER_ID}',
                                       json={'goals': ['Bättre sömn']}, headers=auth_csrf_headers)

    assert response.status_code == 200, response.get_json()
    invalidate.assert_called_once_with(USER_ID)


# ── The goals reach the prompt ──────────────────────────────────────────────

def _db_for_user(user_data):
    db = MagicMock()
    user_doc = MagicMock()
    user_doc.exists = True
    user_doc.to_dict.return_value = user_data

    def collection(name):
        col = MagicMock()
        if name == 'users':
            col.document.return_value.get.return_value = user_doc
            # The collection the block used to read: empty, as in production.
            col.document.return_value.collection.return_value.limit.return_value.stream.return_value = []
        else:
            col.where.return_value.order_by.return_value.limit.return_value.stream.return_value = []
            col.where.return_value.limit.return_value.stream.return_value = []
        return col

    db.collection.side_effect = collection
    return db


def test_the_goals_a_person_chose_are_in_the_chat_prompt(mocker):
    mocker.patch('src.firebase_config.db', _db_for_user({'wellnessGoals': ['Bättre sömn', 'Hantera stress']}))

    context = ConversationEngine(MagicMock())._compute_cross_source_context(USER_ID)

    assert 'AKTUELLA MÅL' in context
    assert '- Bättre sömn' in context
    assert '- Hantera stress' in context


def test_no_goals_means_no_goals_section(mocker):
    mocker.patch('src.firebase_config.db', _db_for_user({'wellnessGoals': []}))

    assert 'AKTUELLA MÅL' not in ConversationEngine(MagicMock())._compute_cross_source_context(USER_ID)
