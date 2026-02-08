"""
Rate Limiting Management Routes
API endpoints for monitoring and managing rate limits
"""

from flask import Blueprint, jsonify, request, g
from typing import Optional
from src.services.rate_limiting import rate_limiter, get_rate_limit_status, rate_limit_by_endpoint
from src.services.auth_service import AuthService
from src.services.audit_service import log_admin_action, audit_log
from src.utils.response_utils import APIResponse
from src.utils.input_sanitization import sanitize_text
from .admin_routes import require_admin
import logging

logger = logging.getLogger(__name__)

rate_limit_bp = Blueprint('rate_limit', __name__)


# CORS OPTIONS handler for all endpoints
@rate_limit_bp.route('/status', methods=['OPTIONS'])
@rate_limit_bp.route('/config', methods=['OPTIONS'])
@rate_limit_bp.route('/test/<category>', methods=['OPTIONS'])
@rate_limit_bp.route('/reset/<category>', methods=['OPTIONS'])
@rate_limit_bp.route('/stats', methods=['OPTIONS'])
def handle_options(category: Optional[str] = None):
    """Handle CORS preflight requests"""
    return APIResponse.success()


@rate_limit_bp.route('/status', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
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
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        # Get user's subscription tier
        user_tier = rate_limiter.get_user_tier(user_id)

        # Get rate limits for different categories
        categories = ['auth', 'mood', 'ai', 'memory', 'integration', 'subscription']
        endpoint_limits = {}

        for category in categories:
            sample_endpoint = f'/api/{category}/test'
            status = get_rate_limit_status(sample_endpoint, user_id)
            endpoint_limits[category] = status

        return APIResponse.success({
            'userTier': user_tier,
            'endpointLimits': endpoint_limits,
            'userId': user_id
        }, "Rate limit status retrieved")

    except Exception as e:
        logger.error(f"Error getting rate limit status: {e}")
        return APIResponse.error("Failed to get rate limit status", "RATE_LIMIT_ERROR", 500, str(e))


@rate_limit_bp.route('/config', methods=['GET'])
@AuthService.jwt_required
@require_admin
@rate_limit_by_endpoint
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
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        # Log admin action
        log_admin_action(user_id, 'rate_limit_config_view', {'action': 'viewed_rate_limit_config'})
        audit_log('ADMIN_RATE_LIMIT_CONFIG_VIEW', user_id, {'action': 'viewed_rate_limit_config'})

        return APIResponse.success({
            'rateLimits': rate_limiter.rate_limits,
            'userLimits': rate_limiter.user_limits,
            'adaptiveMode': rate_limiter.adaptive_mode,
            'redisConnected': rate_limiter.redis_client is not None
        }, "Rate limit configuration retrieved")

    except Exception as e:
        logger.error(f"Error getting rate limit config: {e}")
        return APIResponse.error("Failed to get rate limit configuration", "CONFIG_ERROR", 500, str(e))


@rate_limit_bp.route('/test/<category>', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
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
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        # Sanitize and validate category
        category = sanitize_text(category, max_length=50)
        valid_categories = ['auth', 'mood', 'ai', 'memory', 'integration', 'subscription']
        if category not in valid_categories:
            return APIResponse.bad_request(f"Invalid category. Must be one of: {', '.join(valid_categories)}")

        # Test endpoint for this category
        test_endpoint = f'/api/{category}/test'

        # Check rate limit status
        allowed, limit_info = rate_limiter.check_rate_limit(test_endpoint, user_id)

        if not allowed:
            return APIResponse.error(
                "Rate limit exceeded",
                "RATE_LIMIT_EXCEEDED",
                429,
                {
                    'retryAfter': limit_info.get('retry_after', 3600),
                    'limit': limit_info.get('limit', 100),
                    'remaining': limit_info.get('remaining', 0)
                }
            )

        # Record the test request
        rate_limiter.record_request(test_endpoint, user_id)

        return APIResponse.success({
            'message': f'Rate limit test successful for {category}',
            'remaining': limit_info.get('remaining', 0),
            'limit': limit_info.get('limit', 100),
            'category': category
        }, "Rate limit test completed")

    except Exception as e:
        logger.error(f"Error testing rate limit: {e}")
        return APIResponse.error("Rate limit test failed", "TEST_ERROR", 500, str(e))


@rate_limit_bp.route('/reset/<category>', methods=['POST'])
@AuthService.jwt_required
@require_admin
@rate_limit_by_endpoint
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
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        # Sanitize category
        category = sanitize_text(category, max_length=50)

        # Log admin action with audit trail
        log_admin_action(user_id, 'rate_limit_reset', {
            'action': 'reset_rate_limit',
            'category': category
        })
        audit_log('ADMIN_RATE_LIMIT_RESET', user_id, {'category': category})

        keys_deleted = 0
        # Reset rate limit counters
        if rate_limiter.redis_client:
            # Clear all keys matching the category pattern
            pattern = f"ratelimit:*{category}*"
            keys = list(rate_limiter.redis_client.keys(pattern))  # type: ignore
            if keys:
                keys_deleted = rate_limiter.redis_client.delete(*keys)  # type: ignore

        logger.info(f"🔄 Admin {user_id} reset rate limits for category: {category}, keys deleted: {keys_deleted}")

        return APIResponse.success({
            'message': f'Rate limit reset for category: {category}',
            'category': category,
            'keysDeleted': keys_deleted
        }, "Rate limit reset successful")

    except Exception as e:
        logger.error(f"Error resetting rate limit: {e}")
        return APIResponse.error("Failed to reset rate limit", "RESET_ERROR", 500, str(e))


@rate_limit_bp.route('/stats', methods=['GET'])
@AuthService.jwt_required
@require_admin
@rate_limit_by_endpoint
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
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        # Log admin action
        log_admin_action(user_id, 'rate_limit_stats_view', {'action': 'viewed_rate_limit_stats'})
        audit_log('ADMIN_RATE_LIMIT_STATS_VIEW', user_id, {})

        stats = {
            'redisConnected': rate_limiter.redis_client is not None,
            'adaptiveMode': rate_limiter.adaptive_mode,
            'totalEndpoints': len(rate_limiter.rate_limits),
            'userTiers': list(rate_limiter.user_limits.keys())
        }

        # Get Redis stats if available
        if rate_limiter.redis_client:
            try:
                # Count active rate limit keys
                rate_limit_keys = list(rate_limiter.redis_client.keys('ratelimit:*'))  # type: ignore
                endpoint_keys = list(rate_limiter.redis_client.keys('endpoint_usage:*'))  # type: ignore
                api_requests = list(rate_limiter.redis_client.zrange('api_requests', 0, -1))  # type: ignore

                stats.update({
                    'activeRateLimits': len(rate_limit_keys),
                    'trackedEndpoints': len(endpoint_keys),
                    'totalRequestsToday': len(api_requests)
                })

                # Get top endpoints by usage
                top_endpoints = []
                for key in endpoint_keys[:10]:  # Top 10
                    usage = rate_limiter.redis_client.get(key)  # type: ignore
                    endpoint_name = key.decode('utf-8').replace('endpoint_usage:', '') if isinstance(key, bytes) else str(key).replace('endpoint_usage:', '')
                    request_count: int = int(usage) if usage else 0  # type: ignore
                    top_endpoints.append({
                        'endpoint': endpoint_name,
                        'requests': request_count
                    })

                stats['topEndpoints'] = sorted(top_endpoints, key=lambda x: x['requests'], reverse=True)

            except Exception as e:
                logger.warning(f"Error getting Redis stats: {e}")
                stats['redisError'] = str(e)

        return APIResponse.success(stats, "Rate limit statistics retrieved")

    except Exception as e:
        logger.error(f"Error getting rate limit stats: {e}")
        return APIResponse.error("Failed to get rate limit statistics", "STATS_ERROR", 500, str(e))