"""
Admin Routes - Real admin dashboard and management endpoints
Requires admin role for all endpoints
"""
from __future__ import annotations

import logging
import re
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from flask import Blueprint, Response, g, jsonify, request
from google.cloud.firestore import FieldFilter

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.input_sanitization import input_sanitizer
from src.utils.performance_monitor import performance_monitor
from src.utils.response_utils import APIResponse

admin_bp = Blueprint('admin', __name__)
logger = logging.getLogger(__name__)

# Validate ID format: Firebase UID/document ID
ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,128}$')


def _get_db() -> Any:
    """Safely return Firestore db or None."""
    try:
        return db
    except Exception:
        return None


def require_admin(f: Callable) -> Callable:
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Response | tuple[Response, int]:
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        db_handle = _get_db()
        if db_handle is None:
            return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

        # Check if user is admin
        try:
            user_doc = db_handle.collection('users').document(user_id).get()
            if not user_doc.exists:
                return APIResponse.not_found('User not found')

            user_data = user_doc.to_dict() or {}
            if user_data.get('role') != 'admin':
                logger.warning(f"Non-admin user {user_id} attempted admin access")
                return APIResponse.forbidden('Admin access required')

        except Exception as e:
            logger.error(f"Admin check failed: {e}")
            return APIResponse.forbidden('Access denied')

        return f(*args, **kwargs)
    return decorated


@admin_bp.route('/performance-metrics', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
@require_admin
def get_performance_metrics() -> Response | tuple[Response, int]:
    if request.method == 'OPTIONS':
        return '', 204
    try:
        metrics = performance_monitor.get_metrics() if hasattr(performance_monitor, 'get_metrics') else {
            "endpoints": {},
            "totalRequests": 0,
            "errorCounts": {},
            "slowRequestsCount": 0
        }
        return APIResponse.success(metrics, "Performance metrics retrieved")
    except Exception as e:
        logger.exception(f"Failed to get performance metrics: {e}")
        return APIResponse.error("Failed to get performance metrics", "INTERNAL_ERROR", 500, str(e))


@admin_bp.route('/stats', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
@require_admin
def get_admin_stats() -> Response | tuple[Response, int]:
    """
    Get comprehensive admin statistics

    Returns:
        users: User statistics (total, active, new)
        moods: Mood logging statistics
        content: Content statistics (memories, journals)
        engagement: Engagement metrics
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        db_handle = _get_db()
        if db_handle is None:
            return jsonify({'error': 'Database unavailable'}), 503

        now = datetime.now(UTC)
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)
        last_30d = now - timedelta(days=30)

        # User statistics
        users_ref = db_handle.collection('users')
        total_users = len(list(users_ref.stream()))

        # Active users (logged mood in last 7 days)
        moods_ref = db_handle.collection('moods')
        try:
            recent_moods = moods_ref.where(filter=FieldFilter('timestamp', '>=', last_7d)).stream()
        except TypeError:
            # Fallback for test environments
            recent_moods = moods_ref.where('timestamp', '>=', last_7d).stream()
        active_user_ids = {doc.to_dict().get('user_id') for doc in recent_moods}

        # New users (last 30 days)
        try:
            new_users = users_ref.where(filter=FieldFilter('created_at', '>=', last_30d)).stream()
        except TypeError:
            new_users = users_ref.where('created_at', '>=', last_30d).stream()
        new_user_count = len(list(new_users))

        # Mood statistics
        all_moods = list(moods_ref.stream())
        total_moods = len(all_moods)
        moods_today = len([m for m in all_moods if m.to_dict().get('timestamp') and m.to_dict()['timestamp'] >= last_24h])

        # Average mood score
        mood_scores = [m.to_dict().get('score', 5) for m in all_moods if m.to_dict().get('score')]
        avg_mood = sum(mood_scores) / len(mood_scores) if mood_scores else 5.0

        # Content statistics
        memories = len(list(db_handle.collection('memories').stream()))
        journals = len(list(db_handle.collection('journal_entries').stream()))
        chat_sessions = len(list(db_handle.collection('chat_sessions').stream()))

        # Premium users - count from in-memory filter due to nested field
        try:
            premium_users = users_ref.where(filter=FieldFilter('subscription.status', '==', 'active')).stream()
        except TypeError:
            premium_users = users_ref.where('subscription.status', '==', 'active').stream()
        premium_count = len(list(premium_users))

        stats = {
            'users': {
                'total': total_users,
                'active7d': len(active_user_ids),
                'new30d': new_user_count,
                'premium': premium_count
            },
            'moods': {
                'total': total_moods,
                'today': moods_today,
                'averageScore': round(avg_mood, 1)
            },
            'content': {
                'memories': memories,
                'journals': journals,
                'chatSessions': chat_sessions
            },
            'engagement': {
                'activeRate': round(len(active_user_ids) / total_users * 100, 1) if total_users > 0 else 0,
                'premiumRate': round(premium_count / total_users * 100, 1) if total_users > 0 else 0
            },
            'generatedAt': now.isoformat()
        }

        logger.info("📊 Admin stats generated successfully")
        return APIResponse.success(stats, "Admin statistics retrieved")

    except Exception as e:
        logger.exception(f"Failed to get admin stats: {e}")
        return APIResponse.error('Failed to get statistics', 'INTERNAL_ERROR', 500, str(e))


@admin_bp.route('/users', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
@require_admin
def get_admin_users() -> Response | tuple[Response, int]:
    """
    Get user list for admin management

    Query params:
        page: Page number (default: 1)
        limit: Users per page (default: 20)
        search: Search by email or name
        status: Filter by status (active, inactive, suspended)
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        db_handle = _get_db()
        if db_handle is None:
            return jsonify({'error': 'Database unavailable'}), 503

        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 20)), 100)
        raw_search = request.args.get('search', '')
        # Sanitize search input to prevent XSS
        search = input_sanitizer.sanitize(raw_search, content_type='text', max_length=100).lower() if raw_search else ''
        status = request.args.get('status')

        # Validate status if provided
        if status and status not in ['active', 'inactive', 'suspended', 'banned']:
            return APIResponse.bad_request('Invalid status filter')

        users_ref = db_handle.collection('users')

        # Get all users (for filtering)
        all_users = list(users_ref.stream())

        # Filter by search term
        if search:
            all_users = [u for u in all_users if
                        search in u.to_dict().get('email', '').lower() or
                        search in u.to_dict().get('display_name', '').lower()]

        # Filter by status
        if status:
            all_users = [u for u in all_users if u.to_dict().get('status') == status]

        # Pagination
        total = len(all_users)
        start = (page - 1) * limit
        end = start + limit
        page_users = all_users[start:end]

        users = []
        for doc in page_users:
            data = doc.to_dict()
            users.append({
                'id': doc.id,
                'email': data.get('email'),
                'displayName': data.get('display_name'),
                'status': data.get('status', 'active'),
                'role': data.get('role', 'user'),
                'xp': data.get('xp', 0),
                'streak': data.get('streak', 0),
                'premium': data.get('subscription', {}).get('status') == 'active',
                'createdAt': data.get('created_at').isoformat() if data.get('created_at') else None,
                'lastActive': data.get('last_active').isoformat() if data.get('last_active') else None
            })

        return APIResponse.success({
            'users': users,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }, f"Retrieved {len(users)} users")

    except Exception as e:
        logger.exception(f"Failed to get admin users: {e}")
        return APIResponse.error('Failed to get users', 'INTERNAL_ERROR', 500, str(e))


@admin_bp.route('/users/<user_id>/status', methods=['PUT', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
@require_admin
def update_user_status(user_id: str) -> Response | tuple[Response, int]:
    """
    Update user status (suspend, activate, etc.)
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Validate user_id format
        user_id = input_sanitizer.sanitize(user_id, content_type='text', max_length=128)
        if not user_id or not ID_PATTERN.match(user_id):
            return APIResponse.bad_request('Invalid user ID format')

        db_handle = _get_db()
        if db_handle is None:
            return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

        data = request.get_json(force=True, silent=True)
        new_status = data.get('status') if data else None

        if new_status not in ['active', 'suspended', 'banned']:
            return APIResponse.bad_request('Invalid status')

        user_ref = db_handle.collection('users').document(user_id)
        user_doc = user_ref.get()

        if not user_doc.exists:
            return APIResponse.not_found('User not found')

        user_ref.update({
            'status': new_status,
            'status_updated_at': datetime.now(UTC),
            'status_updated_by': g.user_id
        })

        logger.info(f"👮 Admin {g.user_id} updated user {user_id} status to {new_status}")

        # Audit log
        audit_log('admin_update_user_status', g.user_id, {
            'target_user_id': user_id,
            'new_status': new_status
        })

        return APIResponse.success({
            'userId': user_id,
            'newStatus': new_status
        }, f"User status updated to {new_status}")

    except Exception as e:
        logger.exception(f"Failed to update user status: {e}")
        return APIResponse.error('Failed to update user', 'INTERNAL_ERROR', 500, str(e))


@admin_bp.route('/reports', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
@require_admin
def get_content_reports() -> Response | tuple[Response, int]:
    """
    Get reported content for moderation
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        db_handle = _get_db()
        if db_handle is None:
            return jsonify({'error': 'Database unavailable'}), 503

        status = request.args.get('status', 'pending')

        reports_ref = db_handle.collection('content_reports')
        try:
            query = reports_ref.where(filter=FieldFilter('status', '==', status))
        except TypeError:
            query = reports_ref.where('status', '==', status)
        query = query.order_by('created_at', direction='DESCENDING')
        query = query.limit(50)

        reports = []
        for doc in query.stream():
            data = doc.to_dict()
            reports.append({
                'id': doc.id,
                'contentType': data.get('content_type'),
                'contentId': data.get('content_id'),
                'reason': data.get('reason'),
                'reportedBy': data.get('reported_by'),
                'createdAt': data.get('created_at').isoformat() if data.get('created_at') else None,
                'status': data.get('status')
            })

        return APIResponse.success({
            'reports': reports,
            'total': len(reports)
        }, f"Retrieved {len(reports)} reports")

    except Exception as e:
        logger.exception(f"Failed to get reports: {e}")
        return APIResponse.error('Failed to get reports', 'INTERNAL_ERROR', 500, str(e))


@admin_bp.route('/reports/<report_id>/resolve', methods=['POST', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
@require_admin
def resolve_report(report_id: str) -> Response | tuple[Response, int]:
    """
    Resolve a content report
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Validate report_id format
        report_id = input_sanitizer.sanitize(report_id, content_type='text', max_length=128)
        if not report_id or not ID_PATTERN.match(report_id):
            return APIResponse.bad_request('Invalid report ID format')

        db_handle = _get_db()
        if db_handle is None:
            return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

        data = request.get_json(force=True, silent=True) or {}
        action = data.get('action')  # 'dismiss', 'remove_content', 'warn_user', 'ban_user'
        raw_notes = data.get('notes', '')
        # Sanitize notes to prevent stored XSS
        notes = input_sanitizer.sanitize(raw_notes, content_type='text', max_length=1000) if raw_notes else ''
        content_type = data.get('content_type') or None
        content_id = data.get('content_id') or None
        allowed_content_types = {'memories', 'journal_entries', 'chat_sessions', 'moods', 'comments'}

        if action not in ['dismiss', 'remove_content', 'warn_user', 'ban_user']:
            return APIResponse.bad_request('Invalid action')

        if content_type and content_type not in allowed_content_types:
            return APIResponse.bad_request('Invalid content_type')
        if content_id and not isinstance(content_id, str):
            return APIResponse.bad_request('Invalid content_id')

        report_ref = db_handle.collection('content_reports').document(report_id)
        report_doc = report_ref.get()

        if not report_doc.exists:
            return APIResponse.not_found('Report not found')

        report_ref.update({
            'status': 'resolved',
            'resolution': action,
            'resolution_notes': notes,
            'resolved_by': g.user_id,
            'resolved_at': datetime.now(UTC)
        })

        # Take action based on resolution
        report_data = report_doc.to_dict()
        if action == 'remove_content':
            # Mark content as removed
            content_ref = db_handle.collection(report_data['content_type']).document(report_data['content_id'])
            if content_ref.get().exists:
                content_ref.update({'status': 'removed', 'removed_by_admin': True})

        elif action == 'ban_user':
            # Ban the content author
            content_ref = db_handle.collection(report_data['content_type']).document(report_data['content_id'])
            content_doc = content_ref.get()
            if content_doc.exists:
                author_id = content_doc.to_dict().get('user_id')
                if author_id:
                    db_handle.collection('users').document(author_id).update({
                        'status': 'banned',
                        'banned_at': datetime.now(UTC),
                        'banned_by': g.user_id
                    })

        logger.info(f"👮 Admin {g.user_id} resolved report {report_id} with action: {action}")

        audit_log('admin_resolve_report', g.user_id, {
            'report_id': report_id,
            'action': action,
            'content_type': report_data.get('content_type'),
            'content_id': report_data.get('content_id')
        })

        return APIResponse.success({
            'reportId': report_id,
            'action': action
        }, f"Report resolved with action: {action}")

    except Exception as e:
        logger.exception(f"Failed to resolve report: {e}")
        return APIResponse.error('Failed to resolve report', 'INTERNAL_ERROR', 500, str(e))


@admin_bp.route('/system/health', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
@require_admin
def get_system_health() -> Response | tuple[Response, int]:
    """
    Get system health status (admin only)
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        db_handle = _get_db()
        # Check Firebase connection
        firebase_ok = False
        try:
            if db_handle:
                db_handle.collection('health_check').document('test').get()
                firebase_ok = True
        except Exception:
            pass

        # Get basic metrics
        metrics = performance_monitor.get_metrics() if hasattr(performance_monitor, 'get_metrics') else {}

        health_data = {
            'status': 'healthy' if firebase_ok else 'degraded',
            'firebase': 'connected' if firebase_ok else 'disconnected',
            'timestamp': datetime.now(UTC).isoformat(),
            'uptimeRequests': metrics.get('total_requests', 0),
            'errorRate': metrics.get('error_rate', 0)
        }

        return APIResponse.success(health_data, "System health check completed")

    except Exception as e:
        logger.exception(f"Health check failed: {e}")
        return APIResponse.error('System health check failed', 'HEALTH_CHECK_FAILED', 500, str(e))
