"""
Timestamp utilities for consistent, robust timestamp handling throughout the backend.

This module provides standardized functions for parsing, validating, and formatting
timestamps to ensure consistent behavior across all services and routes.
"""

import logging
from datetime import UTC, datetime

logger = logging.getLogger(__name__)


def parse_iso_timestamp(timestamp_str: str | None, default_to_now: bool = True) -> datetime:
    """
    Parse an ISO format timestamp string into a timezone-aware datetime object.

    This function provides robust parsing of ISO timestamps with proper error handling
    and validation. It handles various ISO formats including those with 'Z' suffix.

    Args:
        timestamp_str: The timestamp string to parse (ISO format)
        default_to_now: If True, return current UTC time on parsing failure.
                       If False, raise ValueError on parsing failure.

    Returns:
        A timezone-aware datetime object in UTC

    Raises:
        ValueError: If parsing fails and default_to_now is False

    Examples:
        >>> parse_iso_timestamp("2024-01-15T10:30:00Z")
        datetime.datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc)

        >>> parse_iso_timestamp("2024-01-15T10:30:00+02:00")
        datetime.datetime(2024, 1, 15, 8, 30, tzinfo=timezone.utc)

        >>> parse_iso_timestamp(None)
        datetime.datetime(2024, 11, 24, 22, 19, 16, tzinfo=timezone.utc)  # current time
    """
    if not timestamp_str:
        if default_to_now:
            return datetime.now(UTC)
        else:
            raise ValueError("Timestamp string cannot be None or empty")

    try:
        # Strip whitespace and handle common variations
        timestamp_str = timestamp_str.strip()

        # Handle 'Z' suffix (UTC) - datetime.fromisoformat() supports this in Python 3.7+
        # But some older formats might need normalization
        if timestamp_str.endswith('Z'):
            # 'Z' is valid, but ensure it's properly formatted
            timestamp_str = timestamp_str[:-1] + '+00:00'

        # Parse the timestamp
        parsed_dt = datetime.fromisoformat(timestamp_str)

        # Ensure timezone awareness - if naive, assume UTC
        if parsed_dt.tzinfo is None:
            parsed_dt = parsed_dt.replace(tzinfo=UTC)
        else:
            # Convert to UTC if it's timezone-aware
            parsed_dt = parsed_dt.astimezone(UTC)

        # Validate the parsed timestamp is reasonable (not in far future/past)
        now = datetime.now(UTC)
        if abs((parsed_dt - now).total_seconds()) > 315360000:  # 10 years in seconds
            logger.warning(f"Parsed timestamp seems unreasonable: {parsed_dt} (more than 10 years from now)")
            if default_to_now:
                logger.warning("Using current time as fallback for unreasonable timestamp")
                return now

        return parsed_dt

    except (ValueError, AttributeError, TypeError) as e:
        logger.warning(f"Failed to parse timestamp '{timestamp_str}': {str(e)}")
        if default_to_now:
            logger.info("Using current UTC time as fallback")
            return datetime.now(UTC)
        else:
            raise ValueError(f"Invalid timestamp format: {timestamp_str}") from e


def format_iso_timestamp(dt: datetime | str, include_timezone: bool = True) -> str:
    """
    Format a datetime object as an ISO timestamp string.

    Args:
        dt: The datetime object to format, or ISO string (returned as-is)
        include_timezone: Whether to include timezone info ('Z' suffix)

    Returns:
        ISO formatted timestamp string

    Examples:
        >>> dt = datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc)
        >>> format_iso_timestamp(dt)
        '2024-01-15T10:30:00+00:00'

        >>> format_iso_timestamp(dt, include_timezone=False)
        '2024-01-15T10:30:00'
    """
    if isinstance(dt, str):
        # If it's already a string, validate and return
        try:
            parsed = parse_iso_timestamp(dt, default_to_now=False)
            return format_iso_timestamp(parsed, include_timezone)
        except ValueError:
            # If invalid, return current time
            dt = datetime.now(UTC)

    if not isinstance(dt, datetime):
        raise ValueError("Input must be a datetime object or valid ISO string")

    # Ensure timezone awareness
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)

    # Format as ISO string
    iso_str = dt.isoformat()

    if include_timezone:
        # Ensure it ends with timezone info
        if not iso_str.endswith(('+00:00', 'Z')):
            iso_str = dt.astimezone(UTC).isoformat()
    else:
        # Remove timezone info if not wanted
        if '+' in iso_str:
            iso_str = iso_str.split('+')[0]
        elif iso_str.endswith('Z'):
            iso_str = iso_str[:-1]

    return iso_str


def validate_timestamp_range(start_dt: datetime, end_dt: datetime, max_days: int = 365) -> bool:
    """
    Validate that a timestamp range is reasonable.

    Args:
        start_dt: Start datetime
        end_dt: End datetime
        max_days: Maximum allowed days between start and end

    Returns:
        True if range is valid, False otherwise

    Raises:
        ValueError: If start is after end
    """
    if start_dt > end_dt:
        raise ValueError("Start timestamp cannot be after end timestamp")

    delta = end_dt - start_dt
    if delta.days > max_days:
        logger.warning(f"Timestamp range too large: {delta.days} days (max allowed: {max_days})")
        return False

    return True
