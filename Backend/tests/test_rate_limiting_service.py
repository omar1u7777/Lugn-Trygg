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
    limiter = _limiter_with(mocker, '5 per hour')
    for _ in range(5):
        assert limiter.check_rate_limit('auth/login', user_id='user-1')[0]

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
    redis_mock.incr.side_effect = RuntimeError('redis down')
    limiter.redis_client = redis_mock
    mocker.patch.object(limiter, 'get_rate_limit', return_value='5 per minute')

    allowed, info = limiter.check_rate_limit('auth/login', user_id='any')

    assert allowed is True
    assert info == {}


class FakeRedis:
    """The few Redis commands the limiter uses, with a clock the test moves."""

    def __init__(self):
        self.now = 0.0
        self._values = {}
        self._expires_at = {}

    def _alive(self, key):
        expires_at = self._expires_at.get(key)
        if expires_at is not None and self.now >= expires_at:
            self._values.pop(key, None)
            self._expires_at.pop(key, None)
        return key in self._values

    def get(self, key):
        return str(self._values[key]) if self._alive(key) else None

    def incr(self, key):
        self._alive(key)
        self._values[key] = self._values.get(key, 0) + 1
        return self._values[key]

    def expire(self, key, seconds):
        if not self._alive(key):
            return False
        self._expires_at[key] = self.now + seconds
        return True

    def ttl(self, key):
        if not self._alive(key):
            return -2
        expires_at = self._expires_at.get(key)
        return -1 if expires_at is None else int(expires_at - self.now)


def _limiter_with(mocker, limit):
    limiter = AdvancedRateLimiter()
    limiter.redis_client = FakeRedis()
    mocker.patch.object(limiter, 'get_rate_limit', return_value=limit)
    return limiter


def test_a_user_under_the_limit_is_never_blocked(mocker):
    # 1.5 requests an hour against a limit of 3. Each request used to push
    # the expiry an hour out, so the count never reset and the fourth
    # request, at two hours, was refused.
    limiter = _limiter_with(mocker, '3 per hour')

    results = []
    for minute in range(0, 400, 40):
        limiter.redis_client.now = minute * 60
        results.append(limiter.check_rate_limit('/api/v1/mood/weekly-analysis', user_id='u1')[0])

    assert all(results)


def test_a_block_ends_when_its_window_does(mocker):
    limiter = _limiter_with(mocker, '2 per hour')
    redis = limiter.redis_client

    for second in (0, 60):
        redis.now = second
        assert limiter.check_rate_limit('/api/v1/mood/weekly-analysis', user_id='u1')[0]

    # Refused requests neither lengthen the block nor misstate when it ends.
    for second in (120, 1800):
        redis.now = second
        allowed, info = limiter.check_rate_limit('/api/v1/mood/weekly-analysis', user_id='u1')
        assert allowed is False
    assert info['retry_after'] == 3600 - 1800

    redis.now = 3600
    assert limiter.check_rate_limit('/api/v1/mood/weekly-analysis', user_id='u1')[0]


def test_a_count_left_without_an_expiry_still_expires(mocker):
    limiter = _limiter_with(mocker, '2 per hour')
    redis = limiter.redis_client
    redis._values['ratelimit:/api/v1/mood/weekly-analysis:u1'] = 5  # no expiry set

    assert limiter.check_rate_limit('/api/v1/mood/weekly-analysis', user_id='u1')[0] is False

    redis.now = 3600
    assert limiter.check_rate_limit('/api/v1/mood/weekly-analysis', user_id='u1')[0]
