"""
Sync History Routes - Real sync tracking for health integrations
Tracks sync operations with Firebase Firestore
"""
from flask import Blueprint, request, jsonify, g
import logging
from datetime import datetime, timedelta, timezone
from ..services.auth_service import AuthService
from ..firebase_config import db

sync_history_bp = Blueprint('sync_history', __name__)
logger = logging.getLogger(__name__)


@sync_history_bp.route('/list', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
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
        user_id = g.user_id
        provider = request.args.get('provider', 'all')
        days = int(request.args.get('days', 7))
        limit = min(int(request.args.get('limit', 50)), 100)
        
        # Calculate date cutoff
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Query sync history from Firestore - use simple query without ordering or limit
        # to avoid index requirements. We'll filter/limit in Python.
        sync_ref = db.collection('sync_history')
        
        # Simple query - just filter by user_id (single field = no index needed)
        # Get all docs and filter in Python to avoid compound index requirements
        all_docs = list(sync_ref.stream())
        
        # Filter for this user
        user_docs = [doc for doc in all_docs if doc.to_dict().get('user_id') == user_id]
        
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
        
        logger.info(f"📊 Returned {len(history)} sync history entries for user {user_id}")
        
        return jsonify({
            'success': True,
            'history': history,
            'total': len(history),
            'days': days,
            'provider_filter': provider
        }), 200
        
    except Exception as e:
        logger.exception(f"❌ Failed to get sync history: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get sync history',
            'message': str(e)
        }), 500


@sync_history_bp.route('/log', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
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
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        user_id = g.user_id
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        provider = data.get('provider')
        status = data.get('status')
        
        if not provider or not status:
            return jsonify({'error': 'provider and status are required'}), 400
        
        if status not in ['success', 'failed', 'partial']:
            return jsonify({'error': 'status must be success, failed, or partial'}), 400
        
        # Create sync history entry
        sync_entry = {
            'user_id': user_id,
            'provider': provider,
            'status': status,
            'timestamp': datetime.now(timezone.utc),
            'data_types': data.get('data_types', []),
            'record_count': data.get('record_count'),
            'duration_seconds': data.get('duration_seconds'),
            'error_message': data.get('error_message'),
            'metadata': data.get('metadata', {})
        }
        
        # Save to Firestore
        doc_ref = db.collection('sync_history').add(sync_entry)
        
        logger.info(f"✅ Logged sync operation for user {user_id}: {provider} - {status}")
        
        return jsonify({
            'success': True,
            'sync_id': doc_ref[1].id,
            'message': 'Sync operation logged successfully'
        }), 201
        
    except Exception as e:
        logger.exception(f"❌ Failed to log sync operation: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to log sync operation',
            'message': str(e)
        }), 500


@sync_history_bp.route('/stats', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
def get_sync_stats():
    """
    Get sync statistics for the user
    
    Returns:
        total_syncs: Total number of sync operations
        success_rate: Percentage of successful syncs
        last_sync: Timestamp of last sync
        by_provider: Stats broken down by provider
    """
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        user_id = g.user_id
        
        # Get last 30 days of syncs - simplified query
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        
        sync_ref = db.collection('sync_history')
        
        # Get all docs and filter by user in Python to avoid index requirements
        all_docs = list(sync_ref.stream())
        user_docs = [doc for doc in all_docs if doc.to_dict().get('user_id') == user_id]
        
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
                    'last_sync': None
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
                if by_provider[provider]['last_sync'] is None or (hasattr(ts, 'timestamp') and ts.timestamp() > by_provider[provider]['last_sync'].timestamp()):
                    by_provider[provider]['last_sync'] = ts
        
        # Format timestamps
        if last_sync and hasattr(last_sync, 'isoformat'):
            last_sync = last_sync.isoformat()
        elif last_sync:
            last_sync = str(last_sync)
            
        for p in by_provider.values():
            if p['last_sync'] and hasattr(p['last_sync'], 'isoformat'):
                p['last_sync'] = p['last_sync'].isoformat()
            elif p['last_sync']:
                p['last_sync'] = str(p['last_sync'])
        
        success_rate = (success / total * 100) if total > 0 else 0
        
        return jsonify({
            'success': True,
            'stats': {
                'total_syncs': total,
                'success_count': success,
                'failed_count': failed,
                'partial_count': partial,
                'success_rate': round(success_rate, 1),
                'last_sync': last_sync,
                'by_provider': by_provider
            }
        }), 200
        
    except Exception as e:
        logger.exception(f"❌ Failed to get sync stats: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get sync stats',
            'message': str(e)
        }), 500


@sync_history_bp.route('/retry/<sync_id>', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
def retry_failed_sync(sync_id):
    """
    Retry a failed sync operation
    
    This creates a new sync job for the same provider/data types
    """
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        user_id = g.user_id
        
        # Get the original sync entry
        doc_ref = db.collection('sync_history').document(sync_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({'error': 'Sync entry not found'}), 404
        
        data = doc.to_dict()
        
        if data.get('user_id') != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        if data.get('status') != 'failed':
            return jsonify({'error': 'Can only retry failed syncs'}), 400
        
        # Create a retry job (in a real system, this would trigger actual sync)
        retry_entry = {
            'user_id': user_id,
            'provider': data.get('provider'),
            'status': 'pending',
            'timestamp': datetime.now(timezone.utc),
            'data_types': data.get('data_types', []),
            'retry_of': sync_id,
            'metadata': {'retry': True}
        }
        
        new_doc = db.collection('sync_history').add(retry_entry)
        
        # In production, this would trigger actual sync via queue/worker
        logger.info(f"🔄 Created retry job for sync {sync_id}")
        
        return jsonify({
            'success': True,
            'retry_id': new_doc[1].id,
            'message': 'Retry job created. Sync will start shortly.'
        }), 200
        
    except Exception as e:
        logger.exception(f"❌ Failed to retry sync: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to retry sync',
            'message': str(e)
        }), 500


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
