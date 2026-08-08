"""Mood-analytics timestamps must always come out timezone-aware.

Production hit "TypeError: can't compare offset-naive and offset-aware
datetimes" in get_impact_analysis and get_clinical_flags: rows whose stored
timestamp carries no offset parse to a naive datetime, which then explodes the
moment the analytics engines compare it against an aware one.
"""

from datetime import UTC, datetime

from src.routes.mood_analytics_routes import _parse_mood_timestamp


class TestParseMoodTimestamp:
    def test_naive_timestamp_is_normalised_to_utc(self):
        parsed = _parse_mood_timestamp("2026-08-01T10:00:00")
        assert parsed.tzinfo is not None
        assert parsed.utcoffset().total_seconds() == 0

    def test_z_suffixed_timestamp_stays_aware(self):
        parsed = _parse_mood_timestamp("2026-08-01T10:00:00Z")
        assert parsed.tzinfo is not None
        assert parsed.hour == 10

    def test_explicit_offset_is_preserved_not_overwritten(self):
        parsed = _parse_mood_timestamp("2026-08-01T10:00:00+02:00")
        assert parsed.tzinfo is not None
        assert parsed.utcoffset().total_seconds() == 2 * 3600

    def test_unparseable_timestamp_falls_back_to_aware_now(self):
        parsed = _parse_mood_timestamp("not-a-timestamp")
        assert parsed.tzinfo is not None

    def test_every_shape_is_mutually_comparable(self):
        """The actual failure mode: mixing shapes in one comparison."""
        shapes = [
            _parse_mood_timestamp("2026-08-01T10:00:00"),
            _parse_mood_timestamp("2026-08-01T10:00:00Z"),
            _parse_mood_timestamp("2026-08-01T10:00:00+02:00"),
            _parse_mood_timestamp("garbage"),
            datetime.now(UTC),
        ]
        for a in shapes:
            for b in shapes:
                assert isinstance(a < b, bool)  # must not raise
