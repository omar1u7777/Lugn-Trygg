"""
Mood Analytics Routes
Advanced analytics endpoints for mood tracking including correlation analysis and clinical flagging
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from flask import Blueprint, Response, g, request

from src.firebase_config import db
from src.services.auth_service import AuthService
from src.services.clinical_flagging_service import clinical_flagging_service
from src.services.mood_correlation_engine import mood_correlation_engine
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

# Blueprint definition
mood_analytics_bp = Blueprint('mood_analytics', __name__)


def _parse_mood_timestamp(ts: str) -> datetime:
    """Parse a stored mood timestamp into a timezone-AWARE UTC datetime.

    datetime.fromisoformat() returns a naive datetime whenever the stored
    string carries no offset (e.g. "2026-08-01T10:00:00"). Those naive values
    then blew up downstream with "can't compare offset-naive and offset-aware
    datetimes" as soon as the analytics engines compared them against aware
    ones. Older rows predate the timezone-suffixed writes, so both shapes are
    present -- normalise every parsed value to UTC here.
    """
    try:
        parsed = datetime.fromisoformat(ts.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return datetime.now(UTC)
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


@mood_analytics_bp.route('/correlation-analysis', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_correlation_analysis() -> Response | tuple[Response, int]:
    """
    Analyze correlation between tags and mood scores.

    Query params:
        - days: Number of days to analyze (default: 30)
        - min_occurrences: Minimum tag occurrences (default: 3)
    """
    if request.method == 'OPTIONS':
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        # Get query parameters
        try:
            days = int(request.args.get('days', 30))
            min_occurrences = int(request.args.get('min_occurrences', 3))
        except (TypeError, ValueError):
            return APIResponse.bad_request("days and min_occurrences must be integers")

        # Validate parameters
        if days < 7 or days > 365:
            return APIResponse.bad_request('Days must be between 7 and 365')
        if min_occurrences < 2 or min_occurrences > 10:
            return APIResponse.bad_request('min_occurrences must be between 2 and 10')

        # Fetch mood entries from Firestore
        cutoff_date = datetime.now(UTC) - timedelta(days=days)
        mood_ref = db.collection('users').document(user_id).collection('moods')

        # Query moods within date range
        query = mood_ref.where('timestamp', '>=', cutoff_date.isoformat()).order_by('timestamp', direction='DESCENDING')
        mood_docs = query.stream()

        # Convert to list of dicts
        mood_entries = []
        for doc in mood_docs:
            data = doc.to_dict()
            if data:
                # Parse timestamp
                ts = data.get('timestamp')
                if isinstance(ts, str):
                    data['timestamp'] = _parse_mood_timestamp(ts)

                mood_entries.append(data)

        logger.info(f"📊 Analyzing {len(mood_entries)} mood entries for correlation analysis")

        # Run correlation analysis
        analysis_result = mood_correlation_engine.analyze_tag_correlations(
            mood_entries=mood_entries,
            min_occurrences=min_occurrences
        )

        return APIResponse.success(
            data=analysis_result,
            message='Correlation analysis completed'
        )

    except Exception as e:
        logger.exception(f"Error in correlation analysis: {e}")
        return APIResponse.error('Internal server error during correlation analysis')


@mood_analytics_bp.route('/clinical-flags', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_clinical_flags() -> Response | tuple[Response, int]:
    """
    Check for clinical flags in user's mood data.

    Returns flags for:
    - Consecutive low mood days (< 3 for 5+ days)
    - Rapid mood decline
    - Persistent negative patterns
    """
    if request.method == 'OPTIONS':
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        # Fetch recent mood entries (last 30 days)
        cutoff_date = datetime.now(UTC) - timedelta(days=30)
        mood_ref = db.collection('users').document(user_id).collection('moods')

        query = mood_ref.where('timestamp', '>=', cutoff_date.isoformat()).order_by('timestamp', direction='DESCENDING')
        mood_docs = query.stream()

        # Convert to list of dicts
        mood_entries = []
        for doc in mood_docs:
            data = doc.to_dict()
            if data:
                # Parse timestamp
                ts = data.get('timestamp')
                if isinstance(ts, str):
                    data['timestamp'] = _parse_mood_timestamp(ts)

                mood_entries.append(data)

        logger.info(f"🏥 Checking clinical flags for {len(mood_entries)} mood entries")

        # Run clinical flagging
        flag_result = clinical_flagging_service.check_mood_flags(
            mood_entries=mood_entries,
            user_id=user_id
        )

        return APIResponse.success(
            data=flag_result,
            message='Clinical flags checked'
        )

    except Exception as e:
        logger.exception(f"Error checking clinical flags: {e}")
        return APIResponse.error('Internal server error during clinical flag check')


@mood_analytics_bp.route('/impact-analysis', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_impact_analysis() -> Response | tuple[Response, int]:
    """
    Get comprehensive impact analysis combining correlation and clinical data.

    Returns:
    - Tag correlations
    - Clinical flags
    - Actionable insights
    """
    if request.method == 'OPTIONS':
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('User ID missing from context')

        try:
            days = int(request.args.get('days', 30))
        except (TypeError, ValueError):
            return APIResponse.bad_request("days must be an integer")
        if days < 1 or days > 365:
            return APIResponse.bad_request('days must be between 1 and 365')

        # Fetch mood entries
        cutoff_date = datetime.now(UTC) - timedelta(days=days)
        mood_ref = db.collection('users').document(user_id).collection('moods')

        query = mood_ref.where('timestamp', '>=', cutoff_date.isoformat()).order_by('timestamp', direction='DESCENDING')
        mood_docs = query.stream()

        mood_entries = []
        for doc in mood_docs:
            data = doc.to_dict()
            if data:
                ts = data.get('timestamp')
                if isinstance(ts, str):
                    data['timestamp'] = _parse_mood_timestamp(ts)
                mood_entries.append(data)

        # Run both analyses
        correlation_result = mood_correlation_engine.analyze_tag_correlations(
            mood_entries=mood_entries,
            min_occurrences=3
        )

        flag_result = clinical_flagging_service.check_mood_flags(
            mood_entries=mood_entries,
            user_id=user_id
        )

        # Combine results
        combined_result = {
            'correlation_analysis': correlation_result,
            'clinical_flags': flag_result,
            'summary': {
                'total_entries': len(mood_entries),
                'analysis_period_days': days,
                'has_correlations': correlation_result.get('status') == 'success',
                'is_flagged': flag_result.get('flagged', False),
                'risk_level': flag_result.get('risk_level', 'none')
            }
        }

        return APIResponse.success(
            data=combined_result,
            message='Impact analysis completed'
        )

    except Exception as e:
        logger.exception(f"Error in impact analysis: {e}")
        return APIResponse.error('Internal server error during impact analysis')
