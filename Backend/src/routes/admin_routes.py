"""
Admin Routes - Real admin dashboard and management endpoints
Requires admin role for all endpoints
"""
from flask import Blueprint, jsonify, request, g
import logging
from datetime import datetime, timedelta, timezone
from src.utils.performance_monitor import performance_monitor
from src.services.auth_service import AuthService
from src.firebase_config import db

admin_bp = Blueprint('admin', __name__)
logger = logging.getLogger(__name__)


def require_admin(f):
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Check if user is admin
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
            
            user_data = user_doc.to_dict()
            if user_data.get('role') != 'admin':
                logger.warning(f"Non-admin user {user_id} attempted admin access")
                return jsonify({'error': 'Admin access required'}), 403
            
        except Exception as e:
            logger.error(f"Admin check failed: {e}")
            return jsonify({'error': 'Access denied'}), 403
        
        return f(*args, **kwargs)
    return decorated


@admin_bp.route('/performance-metrics', methods=['GET', 'OPTIONS'])
def get_performance_metrics():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        metrics = performance_monitor.get_metrics() if hasattr(performance_monitor, 'get_metrics') else {
            "endpoints": {},
            "total_requests": 0,
            "error_counts": {},
            "slow_requests_count": 0
        }
        return jsonify(metrics), 200
    except Exception as e:
        logger.exception(f"Failed to get performance metrics: {e}")
        return jsonify({"error": "Failed to get performance metrics"}), 500


@admin_bp.route('/stats', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@require_admin
def get_admin_stats():
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
        now = datetime.now(timezone.utc)
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)
        last_30d = now - timedelta(days=30)
        
        # User statistics
        users_ref = db.collection('users')
        total_users = len(list(users_ref.stream()))
        
        # Active users (logged mood in last 7 days)
        moods_ref = db.collection('moods')
        recent_moods = moods_ref.where('timestamp', '>=', last_7d).stream()
        active_user_ids = set(doc.to_dict().get('user_id') for doc in recent_moods)
        
        # New users (last 30 days)
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
        memories = len(list(db.collection('memories').stream()))
        journals = len(list(db.collection('journal_entries').stream()))
        chat_sessions = len(list(db.collection('chat_sessions').stream()))
        
        # Premium users
        premium_users = users_ref.where('subscription.status', '==', 'active').stream()
        premium_count = len(list(premium_users))
        
        stats = {
            'users': {
                'total': total_users,
                'active_7d': len(active_user_ids),
                'new_30d': new_user_count,
                'premium': premium_count
            },
            'moods': {
                'total': total_moods,
                'today': moods_today,
                'average_score': round(avg_mood, 1)
            },
            'content': {
                'memories': memories,
                'journals': journals,
                'chat_sessions': chat_sessions
            },
            'engagement': {
                'active_rate': round(len(active_user_ids) / total_users * 100, 1) if total_users > 0 else 0,
                'premium_rate': round(premium_count / total_users * 100, 1) if total_users > 0 else 0
            },
            'generated_at': now.isoformat()
        }
        
        logger.info("📊 Admin stats generated successfully")
        return jsonify(stats), 200
        
    except Exception as e:
        logger.exception(f"Failed to get admin stats: {e}")
        return jsonify({'error': 'Failed to get statistics'}), 500


@admin_bp.route('/users', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@require_admin
def get_admin_users():
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
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 20)), 100)
        search = request.args.get('search', '').lower()
        status = request.args.get('status')
        
        users_ref = db.collection('users')
        
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
                'display_name': data.get('display_name'),
                'status': data.get('status', 'active'),
                'role': data.get('role', 'user'),
                'xp': data.get('xp', 0),
                'streak': data.get('streak', 0),
                'premium': data.get('subscription', {}).get('status') == 'active',
                'created_at': data.get('created_at').isoformat() if data.get('created_at') else None,
                'last_active': data.get('last_active').isoformat() if data.get('last_active') else None
            })
        
        return jsonify({
            'users': users,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }), 200
        
    except Exception as e:
        logger.exception(f"Failed to get admin users: {e}")
        return jsonify({'error': 'Failed to get users'}), 500


@admin_bp.route('/users/<user_id>/status', methods=['PUT', 'OPTIONS'])
@AuthService.jwt_required
@require_admin
def update_user_status(user_id):
    """
    Update user status (suspend, activate, etc.)
    """
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        if new_status not in ['active', 'suspended', 'banned']:
            return jsonify({'error': 'Invalid status'}), 400
        
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_ref.update({
            'status': new_status,
            'status_updated_at': datetime.now(timezone.utc),
            'status_updated_by': g.user_id
        })
        
        logger.info(f"👮 Admin {g.user_id} updated user {user_id} status to {new_status}")
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'new_status': new_status
        }), 200
        
    except Exception as e:
        logger.exception(f"Failed to update user status: {e}")
        return jsonify({'error': 'Failed to update user'}), 500


@admin_bp.route('/reports', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@require_admin
def get_content_reports():
    """
    Get reported content for moderation
    """
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        status = request.args.get('status', 'pending')
        
        reports_ref = db.collection('content_reports')
        query = reports_ref.where('status', '==', status)
        query = query.order_by('created_at', direction='DESCENDING')
        query = query.limit(50)
        
        reports = []
        for doc in query.stream():
            data = doc.to_dict()
            reports.append({
                'id': doc.id,
                'content_type': data.get('content_type'),
                'content_id': data.get('content_id'),
                'reason': data.get('reason'),
                'reported_by': data.get('reported_by'),
                'created_at': data.get('created_at').isoformat() if data.get('created_at') else None,
                'status': data.get('status')
            })
        
        return jsonify({
            'reports': reports,
            'total': len(reports)
        }), 200
        
    except Exception as e:
        logger.exception(f"Failed to get reports: {e}")
        return jsonify({'error': 'Failed to get reports'}), 500


@admin_bp.route('/reports/<report_id>/resolve', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@require_admin
def resolve_report(report_id):
    """
    Resolve a content report
    """
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        data = request.get_json()
        action = data.get('action')  # 'dismiss', 'remove_content', 'warn_user', 'ban_user'
        notes = data.get('notes', '')
        
        if action not in ['dismiss', 'remove_content', 'warn_user', 'ban_user']:
            return jsonify({'error': 'Invalid action'}), 400
        
        report_ref = db.collection('content_reports').document(report_id)
        report_doc = report_ref.get()
        
        if not report_doc.exists:
            return jsonify({'error': 'Report not found'}), 404
        
        report_ref.update({
            'status': 'resolved',
            'resolution': action,
            'resolution_notes': notes,
            'resolved_by': g.user_id,
            'resolved_at': datetime.now(timezone.utc)
        })
        
        # Take action based on resolution
        report_data = report_doc.to_dict()
        if action == 'remove_content':
            # Mark content as removed
            content_ref = db.collection(report_data['content_type']).document(report_data['content_id'])
            if content_ref.get().exists:
                content_ref.update({'status': 'removed', 'removed_by_admin': True})
        
        elif action == 'ban_user':
            # Ban the content author
            content_ref = db.collection(report_data['content_type']).document(report_data['content_id'])
            content_doc = content_ref.get()
            if content_doc.exists:
                author_id = content_doc.to_dict().get('user_id')
                if author_id:
                    db.collection('users').document(author_id).update({
                        'status': 'banned',
                        'banned_at': datetime.now(timezone.utc),
                        'banned_by': g.user_id
                    })
        
        logger.info(f"👮 Admin {g.user_id} resolved report {report_id} with action: {action}")
        
        return jsonify({
            'success': True,
            'report_id': report_id,
            'action': action
        }), 200
        
    except Exception as e:
        logger.exception(f"Failed to resolve report: {e}")
        return jsonify({'error': 'Failed to resolve report'}), 500


@admin_bp.route('/system/health', methods=['GET'])
def get_system_health():
    """
    Get system health status (no auth required for monitoring)
    """
    try:
        # Check Firebase connection
        firebase_ok = False
        try:
            db.collection('health_check').document('test').get()
            firebase_ok = True
        except:
            pass
        
        # Get basic metrics
        metrics = performance_monitor.get_metrics() if hasattr(performance_monitor, 'get_metrics') else {}
        
        return jsonify({
            'status': 'healthy' if firebase_ok else 'degraded',
            'firebase': 'connected' if firebase_ok else 'disconnected',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'uptime_requests': metrics.get('total_requests', 0),
            'error_rate': metrics.get('error_rate', 0)
        }), 200
        
    except Exception as e:
        logger.exception(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500
