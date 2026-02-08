"""
Security Headers Middleware for Lugn & Trygg
Comprehensive security headers implementation with CSP, HSTS, and protection against common attacks
"""

import os
from typing import Dict, List, Optional, Any, Callable
from flask import request, Response, current_app, g
import logging
from datetime import datetime, timedelta, timezone
import hashlib
import base64

logger = logging.getLogger(__name__)

class SecurityHeadersMiddleware:
    """Middleware for comprehensive security headers"""

    def __init__(self, app=None):
        self.app = app
        self.nonce = None  # Will be set per request in _generate_nonce
        self.csp_violations: List[Dict] = []
        self.csp_directives = {}  # Will be initialized in init_app

        # Security configurations
        self.config = {
            'csp_enabled': True,
            'hsts_enabled': True,
            'hsts_max_age': 31536000,  # 1 year
            'hsts_include_subdomains': True,
            'hsts_preload': False,
            'x_frame_options': 'DENY',
            'x_content_type_options': 'nosniff',
            'referrer_policy': 'strict-origin-when-cross-origin',
            'permissions_policy': self._get_permissions_policy(),
            'cross_origin_embedder_policy': 'require-corp',
            'cross_origin_opener_policy': 'same-origin',
            'cross_origin_resource_policy': 'same-origin',
            'origin_trial_tokens': [],
        }

        # CSP directives
        self.csp_directives = self._get_csp_directives()

        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        """Initialize middleware with Flask app"""
        self.app = app

        # Register CSP violation endpoint
        app.add_url_rule('/api/security/csp-violation', 'csp_violation', self._handle_csp_violation, methods=['POST'])

        # Register security headers
        app.after_request(self._add_security_headers)

        # CRITICAL FIX: Generate nonce for each request (must be before CSP header building)
        app.before_request(self._generate_nonce)
        
        # Initialize CSP directives with nonce
        self.csp_directives = self._get_csp_directives()

        logger.info("🛡️ Security headers middleware initialized")

    def _generate_nonce(self):
        """Generate CSP nonce for each request"""
        self.nonce = base64.b64encode(os.urandom(16)).decode('utf-8')
        g.csp_nonce = self.nonce

    def _get_csp_directives(self) -> Dict[str, str]:
        """Get Content Security Policy directives"""
        # CRITICAL FIX: Build CSP directives dynamically based on nonce and environment
        is_production = os.getenv('FLASK_ENV') == 'production'
        nonce_value = self.nonce or ''
        
        directives = {
            'default-src': "'self'",
            'script-src': f"'self' 'nonce-{nonce_value}' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdn.redoc.ly",
            'style-src': f"'self' 'nonce-{nonce_value}' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com",
            'font-src': "'self' https://fonts.gstatic.com",
            'img-src': "'self' data: https: blob:",
            # CRITICAL FIX: Allow API connections for frontend (including backend API)
            'connect-src': "'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://*.vercel.app https://lugn-trygg-backend.onrender.com https://api.lugntrygg.se http://localhost:5001 https://unpkg.com",
            'frame-src': "'self' https://www.google.com https://accounts.google.com",  # Allow Google OAuth iframes
            'object-src': "'none'",
            'base-uri': "'self'",
            'form-action': "'self'",
            'frame-ancestors': "'none'",
            'report-uri': "/api/security/csp-violation",
            'report-to': "'csp-endpoint'",
        }
        
        # CRITICAL FIX: Only enforce HTTPS in production
        if is_production:
            directives['upgrade-insecure-requests'] = ""
            directives['block-all-mixed-content'] = ""
        
        return directives

    def _get_permissions_policy(self) -> str:
        """Get Permissions Policy directives"""
        return (
            "camera=(), microphone=(), geolocation=(), gyroscope=(), "
            "accelerometer=(), magnetometer=(), payment=(), usb=(), "
            "autoplay=(), encrypted-media=(), fullscreen=(self), "
            "picture-in-picture=()"
        )

    def _add_security_headers(self, response: Response) -> Response:
        """Add security headers to response"""
        if response is None:
            logger.warning("Received None response in security headers middleware")
            response = Response('', status=500)
        try:
            # Content Security Policy
            if self.config['csp_enabled']:
                csp_header = self._build_csp_header()
                response.headers['Content-Security-Policy'] = csp_header

                # CSP Report-Only for monitoring (optional)
                if os.getenv('CSP_REPORT_ONLY', 'false').lower() == 'true':
                    response.headers['Content-Security-Policy-Report-Only'] = csp_header

            # HTTP Strict Transport Security
            if self.config['hsts_enabled'] and request.is_secure:
                hsts_value = f"max-age={self.config['hsts_max_age']}"
                if self.config['hsts_include_subdomains']:
                    hsts_value += "; includeSubDomains"
                if self.config['hsts_preload']:
                    hsts_value += "; preload"
                response.headers['Strict-Transport-Security'] = hsts_value

            # X-Frame-Options
            if self.config['x_frame_options']:
                response.headers['X-Frame-Options'] = self.config['x_frame_options']

            # X-Content-Type-Options
            if self.config['x_content_type_options']:
                response.headers['X-Content-Type-Options'] = self.config['x_content_type_options']

            # Referrer-Policy
            if self.config['referrer_policy']:
                response.headers['Referrer-Policy'] = self.config['referrer_policy']

            # Permissions-Policy
            if self.config['permissions_policy']:
                response.headers['Permissions-Policy'] = self.config['permissions_policy']

            # Cross-Origin policies
            if self.config['cross_origin_embedder_policy']:
                response.headers['Cross-Origin-Embedder-Policy'] = self.config['cross_origin_embedder_policy']

            if self.config['cross_origin_opener_policy']:
                response.headers['Cross-Origin-Opener-Policy'] = self.config['cross_origin_opener_policy']

            if self.config['cross_origin_resource_policy']:
                response.headers['Cross-Origin-Resource-Policy'] = self.config['cross_origin_resource_policy']

            # Additional security headers
            response.headers['X-XSS-Protection'] = '1; mode=block'
            response.headers['X-Permitted-Cross-Domain-Policies'] = 'none'

            # Remove server information
            response.headers.pop('Server', None)
            response.headers.pop('X-Powered-By', None)

            # Add security-related headers for API responses
            if request.path.startswith('/api/'):
                response.headers['X-API-Version'] = os.getenv('API_VERSION', '1.0.0')
                response.headers['X-Request-ID'] = getattr(g, 'request_id', 'unknown')

            logger.debug(f"🛡️ Security headers added to {request.path}")

        except Exception as e:
            logger.error(f"Failed to add security headers: {e}")

        return response

    def _build_csp_header(self) -> str:
        """Build CSP header string"""
        # CRITICAL FIX: Rebuild directives with current nonce
        directives_dict = self._get_csp_directives()
        directives = []

        for directive, value in directives_dict.items():
            # Skip empty directives
            if not value:
                continue
                
            # CRITICAL FIX: Ensure nonce is properly included in script-src and style-src
            if directive == 'script-src' or directive == 'style-src':
                # Nonce should already be in the value from _get_csp_directives, but verify
                if self.nonce and f"'nonce-{self.nonce}'" not in value:
                    value = f"{value} 'nonce-{self.nonce}'"
            
            directives.append(f"{directive} {value}")

        return '; '.join(directives)

    def _handle_csp_violation(self):
        """Handle CSP violation reports"""
        try:
            violation_data = request.get_json()

            if violation_data:
                violation = {
                    'timestamp': datetime.now(timezone.utc),
                    'user_agent': request.headers.get('User-Agent'),
                    'ip_address': request.remote_addr,
                    'document_uri': violation_data.get('document-uri'),
                    'violated_directive': violation_data.get('violated-directive'),
                    'effective_directive': violation_data.get('effective-directive'),
                    'original_policy': violation_data.get('original-policy'),
                    'blocked_uri': violation_data.get('blocked-uri'),
                    'status_code': violation_data.get('status-code'),
                    'source_file': violation_data.get('source-file'),
                    'line_number': violation_data.get('line-number'),
                    'column_number': violation_data.get('column-number'),
                }

                self.csp_violations.append(violation)

                # Keep only last 1000 violations
                if len(self.csp_violations) > 1000:
                    self.csp_violations = self.csp_violations[-1000:]

                logger.warning(f"🚨 CSP Violation: {violation['violated_directive']} - {violation['blocked_uri']}")

                # In production, you might want to store these in a database
                # or send alerts for critical violations

            return {'status': 'reported'}, 200

        except Exception as e:
            logger.error(f"CSP violation handling failed: {e}")
            return {'error': 'Failed to process violation report'}, 500

    def get_security_status(self) -> Dict[str, Any]:
        """Get comprehensive security status"""
        return {
            'headers_enabled': {
                'csp': self.config['csp_enabled'],
                'hsts': self.config['hsts_enabled'],
                'x_frame_options': bool(self.config['x_frame_options']),
                'x_content_type_options': bool(self.config['x_content_type_options']),
                'referrer_policy': bool(self.config['referrer_policy']),
                'permissions_policy': bool(self.config['permissions_policy']),
            },
            'csp_violations': {
                'total': len(self.csp_violations),
                'recent': len([
                    v for v in self.csp_violations
                    if v['timestamp'] > datetime.now(timezone.utc) - timedelta(hours=24)
                ])
            },
            'current_nonce': self.nonce,
            'configuration': self.config
        }

    def update_csp_directives(self, updates: Dict[str, str]):
        """Update CSP directives dynamically"""
        self.csp_directives.update(updates)
        logger.info(f"🔄 CSP directives updated: {updates}")

    def enable_csp_report_only(self):
        """Enable CSP report-only mode for testing"""
        os.environ['CSP_REPORT_ONLY'] = 'true'
        logger.info("📊 CSP report-only mode enabled")

    def disable_csp_report_only(self):
        """Disable CSP report-only mode"""
        os.environ.pop('CSP_REPORT_ONLY', None)
        logger.info("🚫 CSP report-only mode disabled")

class SecurityHeaders:
    """Utility class for security header management"""

    @staticmethod
    def generate_csp_nonce() -> str:
        """Generate a CSP nonce"""
        return base64.b64encode(os.urandom(16)).decode('utf-8')

    @staticmethod
    def validate_csp_policy(policy: str) -> bool:
        """Validate CSP policy syntax"""
        # Basic validation - check for common required directives
        required_directives = ['default-src', 'script-src', 'style-src']
        return all(directive in policy for directive in required_directives)

    @staticmethod
    def get_recommended_security_headers() -> Dict[str, str]:
        """Get recommended security headers for different environments"""
        return {
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'",
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
            'X-XSS-Protection': '1; mode=block',
        }

    @staticmethod
    def check_security_headers(headers: Dict[str, str]) -> Dict[str, bool]:
        """Check if security headers are properly configured"""
        required_headers = [
            'Content-Security-Policy',
            'Strict-Transport-Security',
            'X-Frame-Options',
            'X-Content-Type-Options',
        ]

        results = {}
        for header in required_headers:
            results[header] = header in headers

        return results

# Global middleware instance
security_headers_middleware = SecurityHeadersMiddleware()

def init_security_headers(app):
    """Initialize security headers for Flask app"""
    security_headers_middleware.init_app(app)

def get_security_status() -> Dict[str, Any]:
    """Get security middleware status"""
    return security_headers_middleware.get_security_status()

def update_csp_directives(updates: Dict[str, str]):
    """Update CSP directives"""
    security_headers_middleware.update_csp_directives(updates)

# Flask decorator for additional security
def require_https(f):
    """Decorator to require HTTPS for a route"""
    def decorated_function(*args, **kwargs):
        if not request.is_secure and not current_app.debug:
            return {
                'error': 'HTTPS required',
                'message': 'This endpoint requires a secure connection'
            }, 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

def security_headers_required(f):
    """Decorator to ensure security headers are present"""
    def decorated_function(*args, **kwargs):
        response = f(*args, **kwargs)

        # Check if response has security headers
        if isinstance(response, tuple):
            response_data, status_code = response
            response_obj = current_app.response_class(response_data, status_code)
        else:
            response_obj = response

        # Add security headers if missing
        security_headers_middleware._add_security_headers(response_obj)

        return response_obj
    decorated_function.__name__ = f.__name__
    return decorated_function

__all__ = [
    'SecurityHeadersMiddleware',
    'SecurityHeaders',
    'security_headers_middleware',
    'init_security_headers',
    'get_security_status',
    'update_csp_directives',
    'require_https',
    'security_headers_required'
]