"""Rewards blueprint regression tests covering catalog, XP, and claims."""

from unittest.mock import MagicMock


def test_get_reward_catalog_filters_purchasable(client):
    response = client.get('/api/rewards/catalog')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True
    assert all(item['cost'] > 0 for item in payload['data']['rewards'])


def test_get_user_rewards_computes_level(client, mocker, auth_headers):
    mocker.patch(
        'src.routes.rewards_routes._get_user_rewards',
        return_value={'xp': 450, 'badges': [], 'achievements': [], 'claimed_rewards': []},
    )

    response = client.get('/api/rewards/profile', headers=auth_headers)

    assert response.status_code == 200
    rewards = response.get_json()['data']['rewards']
    assert rewards['level'] >= 2
    assert rewards['neededXp'] > 0


def test_add_user_xp_updates_store(client, mocker, mock_db, auth_headers):
    mocker.patch('src.routes.rewards_routes._get_db', return_value=mock_db)
    mocker.patch('src.routes.rewards_routes._get_user_rewards', return_value={'xp': 100})

    response = client.post(
        '/api/rewards/add-xp',
        json={'amount': 50, 'reason': 'test'},
        headers=auth_headers
    )

    assert response.status_code == 200
    mock_db.collection('user_rewards').document('test-user-id').update.assert_called_once()
    payload = response.get_json()['data']
    assert payload['newXp'] == 150


def test_claim_reward_requires_enough_xp(client, mocker, auth_headers):
    mocker.patch('src.routes.rewards_routes._get_db', return_value=MagicMock())
    mocker.patch(
        'src.routes.rewards_routes._get_user_rewards',
        return_value={'xp': 10, 'claimed_rewards': []},
    )

    response = client.post(
        '/api/rewards/claim',
        json={'reward_id': 'premium_week'},
        headers=auth_headers
    )

    assert response.status_code == 400
    assert 'Not enough XP' in response.get_json()['message']


def test_claim_reward_success_updates_badges(client, mocker, mock_db, auth_headers):
    mocker.patch('src.routes.rewards_routes._get_db', return_value=mock_db)
    mocker.patch(
        'src.routes.rewards_routes._get_user_rewards',
        return_value={'xp': 1000, 'claimed_rewards': [], 'badges': []},
    )

    response = client.post(
        '/api/rewards/claim',
        json={'reward_id': 'custom_theme'},
        headers=auth_headers
    )

    assert response.status_code == 200
    assert response.get_json()['success'] is True
    mock_db.collection('user_rewards').document('test-user-id').update.assert_called_once()
