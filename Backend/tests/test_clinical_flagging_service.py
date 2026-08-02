"""
Regression coverage for ClinicalFlaggingService.check_mood_flags().

No test file exercised this service's real logic before (mood_analytics_routes
mocks it out entirely), so a naive/aware datetime mismatch went undetected.
Found via a live Postman run against production: GET
/api/v1/mood-analytics/impact-analysis?days=90 500'd with

    TypeError: can't compare offset-naive and offset-aware datetimes

Root cause: _parse_timestamp() returned datetime objects as-is when the
caller (mood_analytics_routes.py) had already converted string timestamps to
timezone-aware datetimes, but the cutoff values (three_days_ago,
two_weeks_ago) were built from datetime.utcnow() (naive) -- comparing an
aware timestamp against a naive cutoff raises TypeError, not a graceful
skip. Fixed by making every datetime this service produces or normalizes
timezone-aware (UTC).
"""
from datetime import UTC, datetime, timedelta

from src.services.clinical_flagging_service import ClinicalFlaggingService


def _aware_entry(days_ago: int, score: int) -> dict:
    """A mood entry shaped like mood_analytics_routes.py hands off: timestamp
    is already a timezone-aware datetime object, not a raw string."""
    return {
        'score': score,
        'timestamp': datetime.now(UTC) - timedelta(days=days_ago),
    }


def test_check_mood_flags_handles_timezone_aware_timestamps_without_crashing():
    service = ClinicalFlaggingService()
    entries = [_aware_entry(days_ago=d, score=8) for d in range(5)]

    result = service.check_mood_flags(entries, user_id='test-user-id')

    assert result['flagged'] is False
    assert result['risk_level'] == 'none'


def test_check_mood_flags_detects_rapid_decline_with_aware_timestamps():
    service = ClinicalFlaggingService()
    entries = [
        {'score': 8, 'timestamp': datetime.now(UTC) - timedelta(days=2)},
        {'score': 2, 'timestamp': datetime.now(UTC)},
    ]

    result = service.check_mood_flags(entries, user_id='test-user-id')

    assert result['flagged'] is True
    assert any(f['type'] == 'rapid_decline' for f in result['flags'])


def test_check_mood_flags_handles_string_timestamps_without_crashing():
    service = ClinicalFlaggingService()
    entries = [
        {'score': 8, 'timestamp': (datetime.now(UTC) - timedelta(days=d)).isoformat()}
        for d in range(5)
    ]

    result = service.check_mood_flags(entries, user_id='test-user-id')

    assert result['flagged'] is False


def test_parse_timestamp_normalizes_naive_datetime_to_aware():
    service = ClinicalFlaggingService()
    naive = datetime.now()  # noqa: DTZ005 - intentionally naive, testing the normalization

    parsed = service._parse_timestamp(naive)

    assert parsed.tzinfo is not None
    # Must be directly comparable to an aware cutoff without raising.
    assert (parsed >= datetime.now(UTC) - timedelta(days=1)) in (True, False)
