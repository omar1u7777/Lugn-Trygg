"""Rewards blueprint regression tests covering catalog, XP, and claims."""

from unittest.mock import MagicMock


def _mock_doc(exists=True, data=None):
    """Return a mock Firestore document snapshot."""
    doc = MagicMock()
    doc.exists = exists
    doc.to_dict = MagicMock(return_value=data or {})
    return doc


def test_get_reward_catalog_filters_purchasable(client):
    response = client.get('/api/rewards/catalog')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True
    assert all(item['cost'] > 0 for item in payload['data']['rewards'])


def test_get_user_rewards_computes_level(client, mocker, auth_csrf_headers):
    mocker.patch(
        'src.routes.rewards_routes._get_user_rewards',
        return_value={'xp': 450, 'badges': [], 'achievements': [], 'claimed_rewards': []},
    )

    response = client.get('/api/rewards/profile', headers=auth_csrf_headers)

    assert response.status_code == 200
    rewards = response.get_json()['data']['rewards']
    assert rewards['level'] >= 2
    assert rewards['neededXp'] > 0


def test_clients_cannot_grant_themselves_xp(client, auth_csrf_headers):
    """/add-xp let a client award itself up to 100 XP per call, and XP buys
    premium_time. Nothing in the app called it."""
    response = client.post(
        '/api/rewards/add-xp',
        json={'amount': 100, 'reason': 'test'},
        headers=auth_csrf_headers
    )

    assert response.status_code in (404, 405)


def test_claim_reward_requires_enough_xp(client, mocker, mock_db, auth_csrf_headers):
    mocker.patch('src.routes.rewards_routes._get_db', return_value=mock_db)
    col = mock_db.collection('user_rewards')
    col.document.return_value.get.return_value = _mock_doc(
        exists=True, data={'xp': 10, 'claimed_rewards': []}
    )

    response = client.post(
        '/api/rewards/claim',
        json={'reward_id': 'premium_week'},
        headers=auth_csrf_headers
    )

    assert response.status_code == 400
    assert 'Not enough XP' in response.get_json()['message']


def test_claim_reward_success_updates_badges(client, mocker, mock_db, auth_csrf_headers):
    from tests.conftest import _FakeFirestoreTransaction

    mocker.patch('src.routes.rewards_routes._get_db', return_value=mock_db)
    col = mock_db.collection('user_rewards')
    col.document.return_value.get.return_value = _mock_doc(
        exists=True, data={'xp': 1000, 'claimed_rewards': [], 'badges': []}
    )
    txn = _FakeFirestoreTransaction()
    mock_db.transaction = MagicMock(return_value=txn)

    response = client.post(
        '/api/rewards/claim',
        json={'reward_id': 'custom_theme'},
        headers=auth_csrf_headers
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body['success'] is True
    assert body['data']['newXp'] == 700  # 1000 - 300 (custom_theme cost)
    assert len(txn.writes) == 1
    assert txn.writes[0][1]['xp'] == 700
