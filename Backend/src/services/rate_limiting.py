"""
Advanced Rate Limiting Service for Lugn & Trygg API
Intelligent rate limiting with Redis, user-based limits, and adaptive throttling
"""

import time
import hashlib
from typing import Dict, Optional, Tuple, List
from functools import wraps
from flask import request, g, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from redis import Redis
import os
import logging

logger = logging.getLogger(__name__)

class AdvancedRateLimiter:
    """
    Advanced rate limiting with multiple strategies and Redis backend
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_client = None
        if redis_url:
            try:
                self.redis_client = Redis.from_url(redis_url, decode_responses=True)
                self.redis_client.ping()
                logger.info("✅ Redis connected for rate limiting")
            except Exception as e:
                logger.warning(f"⚠️ Redis connection failed: {e}, using in-memory storage")
                self.redis_client = None

        # Rate limit configurations by endpoint type
        self.rate_limits = {
            # Authentication endpoints - strict limits
            'auth': {
                'login': '5 per minute',
                'register': '3 per hour',
                'reset_password': '2 per hour',
                'verify_email': '10 per hour',
                'google_oauth': '10 per hour'
            },

            # Mood endpoints - CRITICAL FIX: Scaled for 10k users
            'mood': {
                'log': '1000 per hour',  # Scaled for 10k users (100 requests/user/hour)
                'get': '2000 per hour',  # Scaled for 10k users (200 requests/user/hour)
                'analyze': '500 per hour',  # Scaled for 10k users (50 requests/user/hour)
                'weekly_analysis': '200 per hour'  # Scaled for 10k users (20 requests/user/hour)
            },

            # AI endpoints - CRITICAL FIX: Scaled for 10k users (resource intensive)
            'ai': {
                'story': '500 per hour',  # Scaled for 10k users (50 requests/user/hour)
                'forecast': '300 per hour',  # Scaled for 10k users (30 requests/user/hour)
                'chat': '2000 per hour',  # Scaled for 10k users (200 requests/user/hour for chatbot)
                'analyze': '1000 per hour',  # Scaled for 10k users (100 requests/user/hour)
                'history': '2000 per hour'  # Scaled for 10k users (200 requests/user/hour for chat history)
            },

            # File upload endpoints - bandwidth limits
            'memory': {
                'upload': '10 per hour',  # File uploads
                'get': '200 per hour',
                'list': '100 per hour'
            },

            # Integration endpoints - external API limits
            'integration': {
                'sync': '20 per hour',  # Health data sync
                'webhook': '1000 per hour',  # Webhook endpoints
                'callback': '500 per hour'
            },

            # Subscription endpoints - payment related
            'subscription': {
                'create_session': '20 per hour',
                'webhook': '10000 per hour',  # Stripe webhooks
                'status': '60 per hour'
            },

            # Admin endpoints - very strict
            'admin': {
                'all': '50 per hour'
            },

            # Documentation - generous limits
            'docs': {
                'all': '1000 per hour'
            }
        }

        # User-based limits (premium users get higher limits)
        self.user_limits = {
            'free': {
                'multiplier': 1.0,
                'burst_limit': 10
            },
            'premium': {
                'multiplier': 2.0,
                'burst_limit': 20
            },
            'enterprise': {
                'multiplier': 3.0,
                'burst_limit': 50
            }
        }

        # Adaptive throttling - increase limits during low traffic
        self.adaptive_mode = True
        self.last_adjustment = time.time()

    def get_user_tier(self, user_id: Optional[str] = None) -> str:
        """Determine user tier for rate limiting"""
        if not user_id:
            return 'free'

        try:
            # Check user's subscription status
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()

            if user_doc.exists:
                user_data = user_doc.to_dict()
                subscription = user_data.get('subscription', {})

                if subscription.get('active'):
                    plan = subscription.get('plan', 'free')
                    if plan in ['premium', 'pro', 'enterprise']:
                        return plan
                    elif plan == 'basic':
                        return 'free'

            return 'free'
        except Exception as e:
            logger.warning(f"Could not determine user tier: {e}")
            return 'free'

    def get_endpoint_category(self, endpoint: str) -> str:
        """Categorize endpoint for rate limiting"""
        endpoint = endpoint.lower()

        if any(keyword in endpoint for keyword in ['auth', 'login', 'register', 'password']):
            return 'auth'
        elif any(keyword in endpoint for keyword in ['mood', 'emotion', 'feeling']):
            return 'mood'
        elif any(keyword in endpoint for keyword in ['ai', 'story', 'forecast', 'chatbot']):
            return 'ai'
        elif any(keyword in endpoint for keyword in ['memory', 'upload', 'file']):
            return 'memory'
        elif any(keyword in endpoint for keyword in ['integration', 'sync', 'webhook']):
            return 'integration'
        elif any(keyword in endpoint for keyword in ['subscription', 'billing', 'payment']):
            return 'subscription'
        elif 'admin' in endpoint:
            return 'admin'
        elif 'docs' in endpoint:
            return 'docs'

        return 'default'

    def get_rate_limit(self, endpoint: str, user_id: Optional[str] = None) -> str:
        """Get appropriate rate limit for endpoint and user"""
        category = self.get_endpoint_category(endpoint)
        user_tier = self.get_user_tier(user_id) if user_id else 'free'

        # Get base limit for endpoint
        category_limits = self.rate_limits.get(category, {})
        endpoint_key = endpoint.split('/')[-1]  # Get last part of endpoint

        base_limit = category_limits.get(endpoint_key) or category_limits.get('all') or '100 per hour'

        # Apply user tier multiplier
        if user_tier != 'free':
            tier_config = self.user_limits.get(user_tier, self.user_limits['free'])
            multiplier = tier_config['multiplier']

            # Parse and multiply the limit
            try:
                parts = base_limit.split()
                if len(parts) == 3:  # "X per Y"
                    count = int(parts[0])
                    new_count = int(count * multiplier)
                    base_limit = f"{new_count} per {parts[2]}"
            except (ValueError, IndexError):
                pass  # Keep original limit if parsing fails

        # Apply adaptive throttling if enabled
        if self.adaptive_mode:
            base_limit = self.apply_adaptive_throttling(base_limit)

        return base_limit

    def apply_adaptive_throttling(self, base_limit: str) -> str:
        """Apply adaptive throttling based on system load"""
        try:
            current_hour = time.time() // 3600

            # Check system load (simplified - in production use actual metrics)
            if self.redis_client:
                # Count recent requests in the last hour
                recent_requests = self.redis_client.zcount('api_requests', current_hour * 3600, (current_hour + 1) * 3600)

                # If low traffic (< 1000 requests/hour), increase limits by 50%
                if recent_requests < 1000:
                    try:
                        parts = base_limit.split()
                        if len(parts) == 3:
                            count = int(parts[0])
                            new_count = int(count * 1.5)
                            return f"{new_count} per {parts[2]}"
                    except (ValueError, IndexError):
                        pass
        except Exception as e:
            logger.debug(f"Adaptive throttling error: {e}")

        return base_limit

    def check_rate_limit(self, endpoint: str, user_id: Optional[str] = None) -> Tuple[bool, Dict]:
        """Check if request should be rate limited"""
        if not self.redis_client:
            return True, {}  # Allow if no Redis

        try:
            # Create unique key for this endpoint and user/IP
            client_id = user_id or get_remote_address()
            key = f"ratelimit:{endpoint}:{client_id}"

            # Get current usage
            current_usage = self.redis_client.get(key) or 0
            current_usage = int(current_usage)

            # Get limit for this endpoint
            limit_str = self.get_rate_limit(endpoint, user_id)

            # Parse limit (simplified - assumes "X per Y" format)
            try:
                parts = limit_str.split()
                if len(parts) == 3:
                    max_requests = int(parts[0])
                    time_window = parts[2]

                    # Convert time window to seconds
                    if time_window == 'minute':
                        window_seconds = 60
                    elif time_window == 'hour':
                        window_seconds = 3600
                    elif time_window == 'day':
                        window_seconds = 86400
                    else:
                        window_seconds = 3600  # Default to hour

                    # Check if limit exceeded
                    if current_usage >= max_requests:
                        return False, {
                            'retry_after': window_seconds,
                            'limit': max_requests,
                            'remaining': 0,
                            'reset': int(time.time() + window_seconds)
                        }

                    # Increment usage
                    self.redis_client.incr(key)
                    self.redis_client.expire(key, window_seconds)

                    remaining = max_requests - current_usage - 1

                    return True, {
                        'limit': max_requests,
                        'remaining': max(0, remaining),
                        'reset': int(time.time() + window_seconds)
                    }
            except (ValueError, IndexError):
                pass

        except Exception as e:
            logger.warning(f"Rate limit check error: {e}")

        # Allow request if rate limiting fails
        return True, {}

    def record_request(self, endpoint: str, user_id: Optional[str] = None):
        """Record a successful request for analytics"""
        if not self.redis_client:
            return

        try:
            # Record in time series for adaptive throttling
            timestamp = time.time()
            self.redis_client.zadd('api_requests', {str(timestamp): timestamp})

            # Clean old entries (keep last 24 hours)
            cutoff = timestamp - 86400
            self.redis_client.zremrangebyscore('api_requests', '-inf', cutoff)

            # Record per-endpoint usage
            endpoint_key = f"endpoint_usage:{endpoint}"
            self.redis_client.incr(endpoint_key)
            self.redis_client.expire(endpoint_key, 86400)  # Expire after 24h

        except Exception as e:
            logger.debug(f"Request recording error: {e}")

# Global rate limiter instance
rate_limiter = AdvancedRateLimiter(redis_url=os.getenv('REDIS_URL'))

def rate_limit_by_endpoint(f):
    """Decorator to apply rate limiting based on endpoint and user"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Get current endpoint
            endpoint = request.endpoint or request.path

            # Get user ID from JWT if available
            user_id = getattr(g, 'user_id', None)

            # Check rate limit
            allowed, limit_info = rate_limiter.check_rate_limit(endpoint, user_id)

            if not allowed:
                # Return rate limit exceeded response
                response = jsonify({
                    'error': 'Rate limit exceeded',
                    'message': 'Too many requests. Please try again later.',
                    'retry_after': limit_info.get('retry_after', 3600),
                    'limit': limit_info.get('limit', 100),
                    'remaining': limit_info.get('remaining', 0),
                    'reset': limit_info.get('reset')
                })
                response.status_code = 429
                response.headers['X-RateLimit-Limit'] = str(limit_info.get('limit', 100))
                response.headers['X-RateLimit-Remaining'] = str(limit_info.get('remaining', 0))
                response.headers['X-RateLimit-Reset'] = str(limit_info.get('reset', 0))
                response.headers['Retry-After'] = str(limit_info.get('retry_after', 3600))

                return response

            # Record successful request
            rate_limiter.record_request(endpoint, user_id)

            # Add rate limit headers to successful response
            response = f(*args, **kwargs)
            if hasattr(response, 'headers'):
                response.headers['X-RateLimit-Limit'] = str(limit_info.get('limit', 100))
                response.headers['X-RateLimit-Remaining'] = str(limit_info.get('remaining', 0))
                response.headers['X-RateLimit-Reset'] = str(limit_info.get('reset', 0))

            return response

        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # Allow request if rate limiting fails
            return f(*args, **kwargs)

    return decorated_function

def get_rate_limit_status(endpoint: str, user_id: Optional[str] = None) -> Dict:
    """Get current rate limit status for an endpoint"""
    allowed, limit_info = rate_limiter.check_rate_limit(endpoint, user_id)
    return {
        'allowed': allowed,
        'limit': limit_info.get('limit', 100),
        'remaining': limit_info.get('remaining', 0),
        'reset': limit_info.get('reset', 0),
        'retry_after': limit_info.get('retry_after', 0)
    }

# Export the decorator for use in routes
class RateLimiter:
    """Simple rate limiter for testing purposes"""

    def __init__(self):
        self.requests = {}
        self.limits = {}

    def is_allowed(self, client_id: str, endpoint: str, max_requests: int = 100) -> bool:
        """Check if request is allowed"""
        key = f"{client_id}:{endpoint}"
        current = self.requests.get(key, 0)
        allowed = current < max_requests
        if allowed:
            self.requests[key] = current + 1
        return allowed

    def increment_request_counter(self, client_id: str, endpoint: str) -> int:
        """Increment request counter and return new count"""
        key = f"{client_id}:{endpoint}"
        if key not in self.requests:
            self.requests[key] = 0
        self.requests[key] += 1
        return self.requests[key]

    def reset_rate_limits(self, client_id: Optional[str] = None, endpoint: Optional[str] = None) -> None:
        """Reset rate limits for client/endpoint or all"""
        if client_id and endpoint:
            key = f"{client_id}:{endpoint}"
            self.requests.pop(key, None)
        elif client_id:
            # Reset all for client
            keys_to_remove = [k for k in self.requests.keys() if k.startswith(f"{client_id}:")]
            for key in keys_to_remove:
                self.requests.pop(key, None)
        else:
            # Reset all
            self.requests.clear()
__all__ = ['rate_limiter', 'rate_limit_by_endpoint', 'get_rate_limit_status']