"""Regression tests for rewards_helper XP persistence compatibility."""

from unittest.mock import MagicMock


def test_award_xp_writes_canonical_and_legacy_docs(mocker, mock_db):
    mocker.patch('src.firebase_config.db', mock_db)

    # Existing canonical rewards doc.
    canonical_doc = MagicMock()
    canonical_doc.exists = True
    canonical_doc.to_dict.return_value = {'xp': 100, 'level': 2}

    user_rewards_collection = mock_db.collection('user_rewards')
    user_rewards_ref = user_rewards_collection.document.return_value
    user_rewards_ref.get.return_value = canonical_doc

    from src.services.rewards_helper import award_xp

    result = award_xp('testuser1234567890ab', 'mood_logged')

    assert result['xp_gained'] > 0
    assert result['total_xp'] == 110
    assert result['level'] >= 2

    # Canonical rewards store updated.
    user_rewards_ref.set.assert_called()

    # Legacy mirror and users aggregate mirrors are also updated.
    users_collection = mock_db.collection('users')
    users_doc_ref = users_collection.document.return_value
    users_doc_ref.collection.assert_called_with('rewards')
    users_doc_ref.set.assert_called()


def test_award_xp_falls_back_to_legacy_when_canonical_missing(mocker, mock_db):
    mocker.patch('src.firebase_config.db', mock_db)

    # Canonical missing.
    canonical_doc = MagicMock()
    canonical_doc.exists = False

    # Legacy exists.
    legacy_doc = MagicMock()
    legacy_doc.exists = True
    legacy_doc.to_dict.return_value = {'total_xp': 250, 'level': 3}

    user_rewards_collection = mock_db.collection('user_rewards')
    user_rewards_ref = user_rewards_collection.document.return_value
    user_rewards_ref.get.return_value = canonical_doc

    users_collection = mock_db.collection('users')
    users_doc_ref = users_collection.document.return_value
    rewards_subcollection = users_doc_ref.collection.return_value
    rewards_progress_ref = rewards_subcollection.document.return_value
    rewards_progress_ref.get.return_value = legacy_doc

    from src.services.rewards_helper import award_xp

    result = award_xp('testuser1234567890ab', 'journal_entry')

    assert result['total_xp'] == 265
    # With sqrt formula: level = floor(sqrt(265/100)) + 1 = floor(1.628) + 1 = 2
    assert result['level'] == 2
    user_rewards_ref.set.assert_called()
    rewards_progress_ref.set.assert_called()
