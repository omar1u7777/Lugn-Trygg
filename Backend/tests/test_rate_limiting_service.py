"""Tests for AdvancedRateLimiter helper logic."""

from unittest.mock import MagicMock

from src.services.rate_limiting import AdvancedRateLimiter


def test_get_rate_limit_applies_premium_multiplier(mocker):
    limiter = AdvancedRateLimiter()
    mocker.patch.object(limiter, 'get_user_tier', return_value='premium')
    mocker.patch.object(limiter, 'apply_adaptive_throttling', side_effect=lambda limit: limit)

    limit = limiter.get_rate_limit('auth/login', user_id='user-123')

    assert limit.startswith('10')
    assert limit.endswith('per minute')


def test_check_rate_limit_blocks_when_limit_reached(mocker):
    limiter = AdvancedRateLimiter()
    redis_mock = MagicMock()
    redis_mock.get.return_value = '5'
    redis_mock.incr.return_value = None
    redis_mock.expire.return_value = None
    limiter.redis_client = redis_mock
    mocker.patch.object(limiter, 'get_rate_limit', return_value='5 per hour')

    allowed, info = limiter.check_rate_limit('auth/login', user_id='user-1')

    assert allowed is False
    assert info['limit'] == 5
    assert info['remaining'] == 0


def test_record_request_tracks_usage():
    limiter = AdvancedRateLimiter()
    redis_mock = MagicMock()
    limiter.redis_client = redis_mock

    limiter.record_request('auth/login', user_id='user-1')

    redis_mock.zadd.assert_called()
    redis_mock.incr.assert_called_with('endpoint_usage:auth/login')


def test_adaptive_throttling_increases_limit():
    limiter = AdvancedRateLimiter()
    redis_mock = MagicMock()
    redis_mock.zcount.return_value = 10
    limiter.redis_client = redis_mock

    boosted = limiter.apply_adaptive_throttling('100 per hour')

    assert boosted.startswith('150')
    assert boosted.endswith('per hour')


def test_get_user_tier_reads_subscription(mock_db):
    limiter = AdvancedRateLimiter()
    users_collection = mock_db.collection('users')
    user_doc = users_collection.document('premium-user')
    user_doc.get.return_value = MagicMock(
        exists=True,
        to_dict=lambda: {'subscription': {'active': True, 'plan': 'premium'}},
    )

    tier = limiter.get_user_tier('premium-user')

    assert tier == 'premium'


def test_check_rate_limit_allows_when_redis_errors(mocker):
    limiter = AdvancedRateLimiter()
    redis_mock = MagicMock()
    redis_mock.get.side_effect = RuntimeError('redis down')
    limiter.redis_client = redis_mock
    mocker.patch.object(limiter, 'get_rate_limit', return_value='5 per minute')

    allowed, info = limiter.check_rate_limit('auth/login', user_id='any')

    assert allowed is True
    assert info == {}
