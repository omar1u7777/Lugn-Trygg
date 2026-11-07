"""The admin-only health endpoints refuse anyone not shown to be an admin."""

from unittest.mock import MagicMock

import pytest

ADMIN_ONLY = ['/api/health/metrics', '/api/health/advanced']


def _users_collection_returns(mocker, user_doc):
    db = mocker.patch('src.routes.health_routes.db')
    db.collection.return_value.document.return_value.get.return_value = user_doc


@pytest.mark.parametrize('path', ADMIN_ONLY)
def test_user_without_a_profile_is_refused(client, auth_csrf_headers, mock_auth_service, mocker, path):
    # A missing users document proves nothing about being an admin.
    _users_collection_returns(mocker, MagicMock(exists=False))

    response = client.get(path, headers=auth_csrf_headers)

    assert response.status_code == 403


@pytest.mark.parametrize('path', ADMIN_ONLY)
def test_ordinary_user_is_refused(client, auth_csrf_headers, mock_auth_service, mocker, path):
    _users_collection_returns(mocker, MagicMock(exists=True, to_dict=lambda: {'role': 'user'}))

    response = client.get(path, headers=auth_csrf_headers)

    assert response.status_code == 403


def test_admin_gets_metrics(client, auth_csrf_headers, mock_auth_service, mocker):
    _users_collection_returns(mocker, MagicMock(exists=True, to_dict=lambda: {'role': 'admin'}))
    mocker.patch('src.routes.health_routes.get_monitoring_service', return_value=None)

    response = client.get('/api/health/metrics', headers=auth_csrf_headers)

    assert response.status_code == 200
