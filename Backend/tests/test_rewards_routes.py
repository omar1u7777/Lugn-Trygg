"""Rewards blueprint regression tests covering catalog, XP, and claims."""

from unittest.mock import MagicMock


def test_get_reward_catalog_filters_purchasable(client):
    response = client.get('/api/rewards/catalog')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True
    assert all(item['cost'] > 0 for item in payload['rewards'])


def test_get_user_rewards_computes_level(client, mocker):
    mocker.patch(
        'src.routes.rewards_routes._get_user_rewards',
        return_value={'xp': 450, 'badges': [], 'achievements': [], 'claimed_rewards': []},
    )

    response = client.get('/api/rewards/user/tester')

    assert response.status_code == 200
    rewards = response.get_json()['rewards']
    assert rewards['level'] >= 2
    assert rewards['needed_xp'] > 0


def test_add_user_xp_updates_store(client, mocker, mock_db):
    mocker.patch('src.routes.rewards_routes._get_db', return_value=mock_db)
    mocker.patch('src.routes.rewards_routes._get_user_rewards', return_value={'xp': 100})

    response = client.post(
        '/api/rewards/user/user-1/add-xp',
        json={'amount': 50, 'reason': 'test'},
    )

    assert response.status_code == 200
    mock_db.collection('user_rewards').document('user-1').update.assert_called_once()
    payload = response.get_json()
    assert payload['new_xp'] == 150


def test_claim_reward_requires_enough_xp(client, mocker):
    mocker.patch('src.routes.rewards_routes._get_db', return_value=MagicMock())
    mocker.patch(
        'src.routes.rewards_routes._get_user_rewards',
        return_value={'xp': 10, 'claimed_rewards': []},
    )

    response = client.post(
        '/api/rewards/user/user-1/claim',
        json={'reward_id': 'premium_week'},
    )

    assert response.status_code == 400
    assert 'Not enough XP' in response.get_json()['error']


def test_claim_reward_success_updates_badges(client, mocker, mock_db):
    mocker.patch('src.routes.rewards_routes._get_db', return_value=mock_db)
    mocker.patch(
        'src.routes.rewards_routes._get_user_rewards',
        return_value={'xp': 1000, 'claimed_rewards': [], 'badges': []},
    )

    response = client.post(
        '/api/rewards/user/user-1/claim',
        json={'reward_id': 'custom_theme'},
    )

    assert response.status_code == 200
    assert response.get_json()['success'] is True
    mock_db.collection('user_rewards').document('user-1').update.assert_called_once()
