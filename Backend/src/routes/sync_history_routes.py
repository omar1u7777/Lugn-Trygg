"""
Sync History Routes - Real sync tracking for health integrations
Tracks sync operations with Firebase Firestore
"""
import logging
from datetime import UTC, datetime, timedelta

from flask import Blueprint, g, request

from ..firebase_config import db
from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..utils.input_sanitization import sanitize_text
from ..utils.response_utils import APIResponse

sync_history_bp = Blueprint('sync_history', __name__)
logger = logging.getLogger(__name__)


# CORS OPTIONS handler for all endpoints
@sync_history_bp.route("/list", methods=["OPTIONS"])
@sync_history_bp.route("/log", methods=["OPTIONS"])
@sync_history_bp.route("/stats", methods=["OPTIONS"])
@sync_history_bp.route("/retry/<sync_id>", methods=["OPTIONS"])
def handle_options(sync_id: str = ""):
    """Handle CORS preflight requests"""
    return APIResponse.success()


@sync_history_bp.route('/list', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_sync_history():
    """
    Get sync history for user's health integrations

    Query params:
        provider: Filter by provider (google_fit, fitbit, samsung_health, withings)
        days: Number of days to look back (default: 7)
        limit: Max entries to return (default: 50)

    Returns:
        history: List of sync entries with status, timestamp, data types
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")
        provider = request.args.get('provider', 'all')
        days = int(request.args.get('days', 7))
        limit = min(int(request.args.get('limit', 50)), 100)

        # Calculate date cutoff
        cutoff_date = datetime.now(UTC) - timedelta(days=days)

        # Query sync history from Firestore — filter by user_id at query level
        sync_ref = db.collection('sync_history')  # type: ignore

        # Proper Firestore query filtering by user_id
        user_docs = list(
            sync_ref.where('user_id', '==', user_id)
            .order_by('timestamp', direction='DESCENDING')
            .limit(limit)
            .stream()
        )

        history = []
        for doc in user_docs:
            data = doc.to_dict()

            # Manual filtering for timestamp and provider
            ts = data.get('timestamp')
            if ts and hasattr(ts, 'timestamp'):
                # Skip if before cutoff
                if ts.timestamp() < cutoff_date.timestamp():
                    continue

            # Filter by provider if specified
            if provider != 'all' and data.get('provider') != provider:
                continue

            history.append({
                'id': doc.id,
                'provider': data.get('provider'),
                'providerName': get_provider_name(data.get('provider')),
                'providerIcon': get_provider_icon(data.get('provider')),
                'timestamp': ts.isoformat() if ts and hasattr(ts, 'isoformat') else str(ts) if ts else None,
                'status': data.get('status', 'unknown'),
                'dataTypes': data.get('data_types', []),
                'recordCount': data.get('record_count'),
                'duration': data.get('duration_seconds'),
                'error': data.get('error_message')
            })

            if len(history) >= limit:
                break

        # Sort by timestamp descending
        history.sort(key=lambda x: x.get('timestamp') or '', reverse=True)

        audit_log("SYNC_HISTORY_VIEWED", user_id, {"provider": provider, "days": days, "count": len(history)})
        logger.info(f"📊 Returned {len(history)} sync history entries for user {user_id}")

        return APIResponse.success({
            'history': history,
            'total': len(history),
            'days': days,
            'providerFilter': provider
        }, "Sync history retrieved")

    except Exception as e:
        logger.exception(f"❌ Failed to get sync history: {e}")
        return APIResponse.error("An internal error occurred", "INTERNAL_ERROR", 500)


@sync_history_bp.route('/log', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def log_sync_operation():
    """
    Log a sync operation (called after health data sync)

    Request body:
        provider: Provider ID (google_fit, fitbit, etc.)
        status: 'success' | 'failed' | 'partial'
        data_types: List of synced data types ['steps', 'heart_rate', etc.]
        record_count: Number of records synced (optional)
        duration_seconds: How long the sync took (optional)
        error_message: Error message if failed (optional)
    """
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")
        data = request.get_json(force=True, silent=True) or {}

        if not data:
            return APIResponse.bad_request("No data provided")

        provider = sanitize_text(data.get('provider', ''), max_length=50)
        status = sanitize_text(data.get('status', ''), max_length=20)

        if not provider or not status:
            return APIResponse.bad_request("provider and status are required")

        if status not in ['success', 'failed', 'partial']:
            return APIResponse.bad_request("status must be success, failed, or partial")

        # Sanitize optional fields
        data_types = data.get('data_types', [])
        if not isinstance(data_types, list):
            data_types = []
        data_types = [sanitize_text(str(dt), max_length=50) for dt in data_types[:20]]  # Max 20 types

        error_message = sanitize_text(data.get('error_message', ''), max_length=500) if data.get('error_message') else None

        # Create sync history entry
        sync_entry = {
            'user_id': user_id,
            'provider': provider,
            'status': status,
            'timestamp': datetime.now(UTC),
            'data_types': data_types,
            'record_count': data.get('record_count'),
            'duration_seconds': data.get('duration_seconds'),
            'error_message': error_message,
            'metadata': data.get('metadata', {})
        }

        # Save to Firestore
        doc_ref = db.collection('sync_history').add(sync_entry)  # type: ignore
        sync_id = doc_ref[1].id

        audit_log("SYNC_OPERATION_LOGGED", user_id, {"provider": provider, "status": status, "syncId": sync_id})
        logger.info(f"✅ Logged sync operation for user {user_id}: {provider} - {status}")

        return APIResponse.success({
            'syncId': sync_id
        }, "Sync operation logged successfully")

    except Exception as e:
        logger.exception(f"❌ Failed to log sync operation: {e}")
        return APIResponse.error("An internal error occurred", "INTERNAL_ERROR", 500)


@sync_history_bp.route('/stats', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_sync_stats():
    """
    Get sync statistics for the user

    Returns:
        totalSyncs: Total number of sync operations
        successRate: Percentage of successful syncs
        lastSync: Timestamp of last sync
        byProvider: Stats broken down by provider
    """
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        # Get last 30 days of syncs
        cutoff = datetime.now(UTC) - timedelta(days=30)

        sync_ref = db.collection('sync_history')  # type: ignore
        user_docs = list(
            sync_ref.where('user_id', '==', user_id)
            .order_by('timestamp', direction='DESCENDING')
            .stream()
        )

        # Aggregate stats
        total = 0
        success = 0
        failed = 0
        partial = 0
        by_provider = {}
        last_sync = None

        for doc in user_docs:
            data = doc.to_dict()

            # Filter by timestamp manually
            ts = data.get('timestamp')
            if ts and hasattr(ts, 'timestamp'):
                if ts.timestamp() < cutoff.timestamp():
                    continue

            total += 1

            status = data.get('status', 'unknown')
            if status == 'success':
                success += 1
            elif status == 'failed':
                failed += 1
            elif status == 'partial':
                partial += 1

            # Track by provider
            provider = data.get('provider', 'unknown')
            if provider not in by_provider:
                by_provider[provider] = {
                    'name': get_provider_name(provider),
                    'icon': get_provider_icon(provider),
                    'total': 0,
                    'success': 0,
                    'failed': 0,
                    'lastSync': None
                }

            by_provider[provider]['total'] += 1
            if status == 'success':
                by_provider[provider]['success'] += 1
            elif status == 'failed':
                by_provider[provider]['failed'] += 1

            # Track last sync
            if ts:
                if last_sync is None or (hasattr(ts, 'timestamp') and ts.timestamp() > last_sync.timestamp()):
                    last_sync = ts
                if by_provider[provider]['lastSync'] is None or (hasattr(ts, 'timestamp') and ts.timestamp() > by_provider[provider]['lastSync'].timestamp()):
                    by_provider[provider]['lastSync'] = ts

        # Format timestamps
        if last_sync and hasattr(last_sync, 'isoformat'):
            last_sync = last_sync.isoformat()
        elif last_sync:
            last_sync = str(last_sync)

        for p in by_provider.values():
            if p['lastSync'] and hasattr(p['lastSync'], 'isoformat'):
                p['lastSync'] = p['lastSync'].isoformat()
            elif p['lastSync']:
                p['lastSync'] = str(p['lastSync'])

        success_rate = (success / total * 100) if total > 0 else 0

        audit_log("SYNC_STATS_VIEWED", user_id, {"totalSyncs": total})

        return APIResponse.success({
            'totalSyncs': total,
            'successCount': success,
            'failedCount': failed,
            'partialCount': partial,
            'successRate': round(success_rate, 1),
            'lastSync': last_sync,
            'byProvider': by_provider
        }, "Sync stats retrieved")

    except Exception as e:
        logger.exception(f"❌ Failed to get sync stats: {e}")
        return APIResponse.error("An internal error occurred", "INTERNAL_ERROR", 500)


@sync_history_bp.route('/retry/<sync_id>', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def retry_failed_sync(sync_id: str):
    """
    Retry a failed sync operation

    This creates a new sync job for the same provider/data types
    """
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")
        sync_id = sanitize_text(sync_id, max_length=128)

        if not sync_id:
            return APIResponse.bad_request("Sync ID is required")

        # Get the original sync entry
        doc_ref = db.collection('sync_history').document(sync_id)  # type: ignore
        doc = doc_ref.get()

        if not doc.exists:
            return APIResponse.not_found("Sync entry not found")

        data = doc.to_dict()

        if data.get('user_id') != user_id:
            return APIResponse.forbidden("Cannot retry another user's sync")

        if data.get('status') != 'failed':
            return APIResponse.bad_request("Can only retry failed syncs")

        # Create a retry job (in a real system, this would trigger actual sync)
        retry_entry = {
            'user_id': user_id,
            'provider': data.get('provider'),
            'status': 'pending',
            'timestamp': datetime.now(UTC),
            'data_types': data.get('data_types', []),
            'retry_of': sync_id,
            'metadata': {'retry': True}
        }

        new_doc = db.collection('sync_history').add(retry_entry)  # type: ignore
        retry_id = new_doc[1].id

        audit_log("SYNC_RETRY_CREATED", user_id, {"originalSyncId": sync_id, "retryId": retry_id})
        logger.info(f"🔄 Created retry job for sync {sync_id}")

        return APIResponse.success({
            'retryId': retry_id,
            'message': 'Retry job created. Sync will start shortly.'
        }, "Retry job created")

    except Exception as e:
        logger.exception(f"❌ Failed to retry sync: {e}")
        return APIResponse.error("An internal error occurred", "INTERNAL_ERROR", 500)


def get_provider_name(provider: str) -> str:
    """Get display name for provider"""
    names = {
        'google_fit': 'Google Fit',
        'fitbit': 'Fitbit',
        'samsung_health': 'Samsung Health',
        'withings': 'Withings',
        'apple_health': 'Apple Health',
        'garmin': 'Garmin Connect',
        'strava': 'Strava'
    }
    return names.get(provider, provider.replace('_', ' ').title())


def get_provider_icon(provider: str) -> str:
    """Get icon for provider"""
    icons = {
        'google_fit': '🏃',
        'fitbit': '⌚',
        'samsung_health': '💪',
        'withings': '🩺',
        'apple_health': '🍎',
        'garmin': '🏔️',
        'strava': '🚴'
    }
    return icons.get(provider, '📊')
