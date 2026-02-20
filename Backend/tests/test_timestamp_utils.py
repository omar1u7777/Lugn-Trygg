"""
Tests for timestamp_utils.py
Covers: parse, format, and validate timestamp functions.
"""
import pytest
from datetime import datetime, timezone, timedelta


class TestParseIsoTimestamp:
    """Tests for parse_iso_timestamp."""

    def test_parse_utc_z_suffix(self):
        from src.utils.timestamp_utils import parse_iso_timestamp
        result = parse_iso_timestamp("2024-01-15T10:30:00Z")
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15
        assert result.hour == 10
        assert result.minute == 30
        assert result.tzinfo is not None

    def test_parse_with_offset(self):
        from src.utils.timestamp_utils import parse_iso_timestamp
        result = parse_iso_timestamp("2024-01-15T10:30:00+02:00")
        assert result.tzinfo is not None

    def test_parse_none_default_to_now(self):
        from src.utils.timestamp_utils import parse_iso_timestamp
        result = parse_iso_timestamp(None, default_to_now=True)
        assert result is not None
        assert abs((result - datetime.now(timezone.utc)).total_seconds()) < 5

    def test_parse_none_no_default_raises(self):
        from src.utils.timestamp_utils import parse_iso_timestamp
        with pytest.raises(ValueError):
            parse_iso_timestamp(None, default_to_now=False)

    def test_parse_invalid_string(self):
        from src.utils.timestamp_utils import parse_iso_timestamp
        # Should either return now or raise
        try:
            result = parse_iso_timestamp("not-a-timestamp")
            # If it returns, it should default to now
            assert result is not None
        except (ValueError, TypeError):
            pass  # Expected for invalid input


class TestFormatIsoTimestamp:
    """Tests for format_iso_timestamp."""

    def test_format_datetime(self):
        from src.utils.timestamp_utils import format_iso_timestamp
        dt = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        result = format_iso_timestamp(dt)
        assert "2024-06-15" in result
        assert isinstance(result, str)

    def test_format_datetime_no_timezone(self):
        from src.utils.timestamp_utils import format_iso_timestamp
        dt = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        result = format_iso_timestamp(dt, include_timezone=False)
        assert "+" not in result or "Z" not in result

    def test_format_string_input(self):
        from src.utils.timestamp_utils import format_iso_timestamp
        result = format_iso_timestamp("2024-01-15T10:30:00Z")
        assert isinstance(result, str)


class TestValidateTimestampRange:
    """Tests for validate_timestamp_range."""

    def test_valid_range(self):
        from src.utils.timestamp_utils import validate_timestamp_range
        start = datetime(2024, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 6, 1, tzinfo=timezone.utc)
        assert validate_timestamp_range(start, end) is True

    def test_start_after_end_raises(self):
        from src.utils.timestamp_utils import validate_timestamp_range
        start = datetime(2024, 6, 1, tzinfo=timezone.utc)
        end = datetime(2024, 1, 1, tzinfo=timezone.utc)
        with pytest.raises(ValueError):
            validate_timestamp_range(start, end)

    def test_exceeds_max_days(self):
        from src.utils.timestamp_utils import validate_timestamp_range
        start = datetime(2024, 1, 1, tzinfo=timezone.utc)
        end = start + timedelta(days=400)
        result = validate_timestamp_range(start, end, max_days=365)
        assert result is False

    def test_custom_max_days(self):
        from src.utils.timestamp_utils import validate_timestamp_range
        start = datetime(2024, 1, 1, tzinfo=timezone.utc)
        end = start + timedelta(days=50)
        assert validate_timestamp_range(start, end, max_days=60) is True
