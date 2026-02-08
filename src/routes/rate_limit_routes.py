"""
Rate Limiting Management Routes
API endpoints for monitoring and managing rate limits
"""

from flask import Blueprint, jsonify, request, g
from src.services.rate_limiting import rate_limiter, get_rate_limit_status
from src.services.audit_service import log_admin_action
import logging

logger = logging.getLogger(__name__)

rate_limit_bp = Blueprint('rate_limit', __name__)

@rate_limit_bp.route('/status', methods=['GET'])
def get_rate_limit_status_endpoint():
    """
    Get current rate limit status for user
    ---
    tags:
      - Rate Limiting
    summary: Get rate limit status
    description: Get current rate limit status for the authenticated user
    security:
      - BearerAuth: []
    responses:
      200:
        description: Rate limit status
        content:
          application/json:
            schema:
              type: object
              properties:
                user_limits:
                  type: object
                  description: User's rate limit status
                endpoint_limits:
                  type: object
                  description: Rate limits by endpoint category
    """
    try:
        user_id = getattr(g, 'user_id', None)

        # Get user's subscription tier
        user_tier = rate_limiter.get_user_tier(user_id)

        # Get rate limits for different categories
        categories = ['auth', 'mood', 'ai', 'memory', 'integration', 'subscription']
        endpoint_limits = {}

        for category in categories:
            sample_endpoint = f'/api/{category}/test'
            status = get_rate_limit_status(sample_endpoint, user_id)
            endpoint_limits[category] = status

        return jsonify({
            'user_tier': user_tier,
            'endpoint_limits': endpoint_limits,
            'user_id': user_id
        })

    except Exception as e:
        logger.error(f"Error getting rate limit status: {e}")
        return jsonify({'error': 'Failed to get rate limit status'}), 500

@rate_limit_bp.route('/config', methods=['GET'])
def get_rate_limit_config():
    """
    Get rate limiting configuration (admin only)
    ---
    tags:
      - Rate Limiting
    summary: Get rate limit configuration
    description: Get the current rate limiting configuration
    security:
      - BearerAuth: []
    responses:
      200:
        description: Rate limit configuration
        content:
          application/json:
            schema:
              type: object
    """
    try:
        # Check if user is admin (implement proper admin check)
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401

        # Log admin action
        log_admin_action(user_id, 'rate_limit_config_view', {'action': 'viewed_rate_limit_config'})

        return jsonify({
            'rate_limits': rate_limiter.rate_limits,
            'user_limits': rate_limiter.user_limits,
            'adaptive_mode': rate_limiter.adaptive_mode,
            'redis_connected': rate_limiter.redis_client is not None
        })

    except Exception as e:
        logger.error(f"Error getting rate limit config: {e}")
        return jsonify({'error': 'Failed to get rate limit configuration'}), 500

@rate_limit_bp.route('/test/<category>', methods=['POST'])
def test_rate_limit(category: str):
    """
    Test rate limiting for a specific category
    ---
    tags:
      - Rate Limiting
    summary: Test rate limit
    description: Test rate limiting for a specific endpoint category
    parameters:
      - name: category
        in: path
        required: true
        schema:
          type: string
          enum: [auth, mood, ai, memory, integration, subscription]
    security:
      - BearerAuth: []
    responses:
      200:
        description: Rate limit test successful
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                remaining:
                  type: integer
                limit:
                  type: integer
    """
    try:
        user_id = getattr(g, 'user_id', None)

        # Validate category
        valid_categories = ['auth', 'mood', 'ai', 'memory', 'integration', 'subscription']
        if category not in valid_categories:
            return jsonify({'error': 'Invalid category'}), 400

        # Test endpoint for this category
        test_endpoint = f'/api/{category}/test'

        # Check rate limit status
        allowed, limit_info = rate_limiter.check_rate_limit(test_endpoint, user_id)

        if not allowed:
            return jsonify({
                'error': 'Rate limit exceeded',
                'retry_after': limit_info.get('retry_after', 3600),
                'limit': limit_info.get('limit', 100),
                'remaining': limit_info.get('remaining', 0)
            }), 429

        # Record the test request
        rate_limiter.record_request(test_endpoint, user_id)

        return jsonify({
            'message': f'Rate limit test successful for {category}',
            'remaining': limit_info.get('remaining', 0),
            'limit': limit_info.get('limit', 100),
            'category': category
        })

    except Exception as e:
        logger.error(f"Error testing rate limit: {e}")
        return jsonify({'error': 'Rate limit test failed'}), 500

@rate_limit_bp.route('/reset/<category>', methods=['POST'])
def reset_rate_limit(category: str):
    """
    Reset rate limit for a category (admin only)
    ---
    tags:
      - Rate Limiting
    summary: Reset rate limit
    description: Reset rate limiting counters for a specific category
    parameters:
      - name: category
        in: path
        required: true
        schema:
          type: string
    security:
      - BearerAuth: []
    responses:
      200:
        description: Rate limit reset successful
    """
    try:
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401

        # Check if user is admin (implement proper admin check)
        # For now, allow all authenticated users (implement proper admin check)

        # Log admin action
        log_admin_action(user_id, 'rate_limit_reset', {
            'action': 'reset_rate_limit',
            'category': category
        })

        # Reset rate limit counters (simplified - in production, implement proper reset)
        if rate_limiter.redis_client:
            # Clear all keys matching the category pattern
            pattern = f"ratelimit:*{category}*"
            keys = rate_limiter.redis_client.keys(pattern)
            if keys:
                rate_limiter.redis_client.delete(*keys)

        return jsonify({
            'message': f'Rate limit reset for category: {category}',
            'category': category
        })

    except Exception as e:
        logger.error(f"Error resetting rate limit: {e}")
        return jsonify({'error': 'Failed to reset rate limit'}), 500

@rate_limit_bp.route('/stats', methods=['GET'])
def get_rate_limit_stats():
    """
    Get rate limiting statistics (admin only)
    ---
    tags:
      - Rate Limiting
    summary: Get rate limit statistics
    description: Get comprehensive rate limiting statistics
    security:
      - BearerAuth: []
    responses:
      200:
        description: Rate limit statistics
        content:
          application/json:
            schema:
              type: object
    """
    try:
        user_id = getattr(g, 'user_id', None)
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401

        # Log admin action
        log_admin_action(user_id, 'rate_limit_stats_view', {'action': 'viewed_rate_limit_stats'})

        stats = {
            'redis_connected': rate_limiter.redis_client is not None,
            'adaptive_mode': rate_limiter.adaptive_mode,
            'total_endpoints': len(rate_limiter.rate_limits),
            'user_tiers': list(rate_limiter.user_limits.keys())
        }

        # Get Redis stats if available
        if rate_limiter.redis_client:
            try:
                # Count active rate limit keys
                rate_limit_keys = rate_limiter.redis_client.keys('ratelimit:*')
                endpoint_keys = rate_limiter.redis_client.keys('endpoint_usage:*')

                stats.update({
                    'active_rate_limits': len(rate_limit_keys),
                    'tracked_endpoints': len(endpoint_keys),
                    'total_requests_today': len(rate_limiter.redis_client.zrange('api_requests', 0, -1))
                })

                # Get top endpoints by usage
                top_endpoints = []
                for key in endpoint_keys[:10]:  # Top 10
                    usage = rate_limiter.redis_client.get(key)
                    endpoint = key.replace('endpoint_usage:', '')
                    top_endpoints.append({
                        'endpoint': endpoint,
                        'requests': int(usage or 0)
                    })

                stats['top_endpoints'] = sorted(top_endpoints, key=lambda x: x['requests'], reverse=True)

            except Exception as e:
                logger.warning(f"Error getting Redis stats: {e}")

        return jsonify(stats)

    except Exception as e:
        logger.error(f"Error getting rate limit stats: {e}")
        return jsonify({'error': 'Failed to get rate limit statistics'}), 500