"""
Lugn & Trygg - Mental Health Platform Backend
Production-ready Flask application with comprehensive security and monitoring
"""

import logging
import os
import re
import sys
import time
from datetime import UTC, datetime
from typing import Any

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request

# NOTE: flask_cors removed - we handle CORS manually for full control over allowed headers
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

# Initialize Sentry for production error tracking (must be before Flask app creation)
from src.monitoring.sentry_config import init_sentry
from src.utils.hf_cache import configure_hf_cache

# Add Backend directory to sys.path to enable imports from src
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load environment variables (backward compatibility)
load_dotenv()
configure_hf_cache()

# Pydantic-settings is the SOLE source of configuration truth. There is no
# legacy os.getenv fallback: a missing dependency or invalid environment is a
# fatal bootstrap error in every environment, so config drift cannot occur.
try:
    from src.config.settings import get_settings
    settings = get_settings()
except ImportError as e:
    print(f'FATAL [B7]: pydantic-settings is required but not importable: {e}', file=sys.stderr)
    sys.exit(1)
except (ValueError, TypeError) as e:
    # Pydantic ValidationError surfaces as ValueError — missing/invalid env var
    print(f'FATAL [B7]: Configuration validation failed: {e}', file=sys.stderr)
    sys.exit(1)

# Configure structured logging (2026 standard)
USE_STRUCTURED_LOGGING = os.getenv('USE_STRUCTURED_LOGGING', 'true').lower() == 'true'

if USE_STRUCTURED_LOGGING:
    try:
        import logging

        from src.utils.structured_logging import JSONFormatter, get_logger
        root_logger = logging.getLogger()
        root_logger.handlers.clear()
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        root_logger.addHandler(handler)
        root_logger.setLevel(logging.INFO)
        logger = get_logger(__name__)
    except (ImportError, AttributeError) as e:
        # Structured logging module missing or misconfigured — standard logging is safe fallback
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler('app.log') if os.getenv('LOG_TO_FILE', 'false').lower() == 'true' else logging.NullHandler()
            ]
        )
        logger = logging.getLogger(__name__)
        logger.warning('[B7] Structured logging unavailable; using standard logging: %s', e)
else:
    # Standard logging (backward compatibility)
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('app.log') if os.getenv('LOG_TO_FILE', 'false').lower() == 'true' else logging.NullHandler()
        ]
    )
    logger = logging.getLogger(__name__)

# Initialize Sentry early (before app creation for best error capture)
sentry_initialized = init_sentry()
if sentry_initialized:
    logger.info("✅ Sentry error tracking enabled")
else:
    logger.warning("⚠️ Sentry not configured - set SENTRY_DSN for production monitoring")

# Initialize Flask app
app = Flask(__name__)
if os.getenv('FLASK_ENV', '').lower() == 'production':
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)  # type: ignore[assignment]

# CRITICAL: Disable automatic OPTIONS handling so we can set CORS headers manually
app.config['CORS_AUTOMATIC_OPTIONS'] = False

# Configuration — pydantic-settings only (single source of truth)
app.config['SECRET_KEY'] = settings.jwt_secret_key
app.config['JWT_SECRET_KEY'] = settings.jwt_secret_key
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'
app.config['DEBUG'] = settings.flask_debug
app.config['TESTING'] = os.getenv('FLASK_TESTING', 'False').lower() == 'true'
# Request body size cap — previously only set on the legacy config path,
# leaving production (pydantic path) with NO cap. Validated in Settings.
app.config['MAX_CONTENT_LENGTH'] = settings.max_content_length
logger.info("✅ Configuration loaded from pydantic-settings (single source of truth)")

# Flask-JWT-Extended: JWTManager not initialized here — we use custom AuthService.jwt_required
# The flask-jwt-extended package is kept for test mocking compatibility only

# CSRF protection is provided by src/middleware/csrf_middleware.py (double-submit cookie pattern)

# CORS Headers configuration - ALL supported headers including CSRF variants
# This is a constant and doesn't depend on environment variables
# X-Request-ID and X-Trace-ID are read by src/middleware/correlation.py — the
# server asks for them and its own CORS policy rejected them. A browser that
# sent either got a failed preflight and the request died before any response,
# surfacing as ERR_NETWORK rather than anything nameable. That is what left
# /analytics stuck on its loading state.
CORS_ALLOWED_HEADERS = (
    'Content-Type, Authorization, X-Requested-With, Accept, Origin, '
    'X-CSRF-Token, X-CSRFToken, x-csrftoken, x-csrf-token, '
    'X-Request-ID, X-Trace-ID'
)


def _anonymize_ip(ip_address: str) -> str:
    """Return anonymized IP for logs (GDPR-safe)."""
    if not ip_address:
        return "unknown"

    if ":" in ip_address:
        # IPv6: keep only first block for coarse diagnostics
        return ip_address.split(":")[0] + "::"

    parts = ip_address.split('.')
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.x.x"

    return "masked"

def _get_cors_origins_list():
    """Get CORS origins list from validated settings (single source of truth)."""
    return settings.cors_allowed_origins_list

def is_origin_allowed(origin: str) -> bool:
    """Check if the origin is allowed.

    Security: this used to accept any origin whose host merely CONTAINED the
    substring 'lugn-trygg' under a '*.vercel.app' wildcard — so an
    attacker-registrable host like 'https://evil-lugn-trygg-x.vercel.app'
    passed and could read authenticated, credentialed responses. That hole is
    closed: only EXACT allowlist entries are honored, plus (opt-in) Vercel
    preview URLs matched by an ANCHORED regex against the project's exact
    team/project slug from VERCEL_PREVIEW_PREFIX.
    """
    if not origin:
        return False

    cors_origins_list = _get_cors_origins_list()
    is_production = os.getenv('FLASK_ENV', 'production') == 'production'

    # 1. Exact allowlist match (the only production path by default).
    if origin in cors_origins_list:
        return True

    # 2. Vercel preview deployments — opt-in and precisely pinned.
    #
    #    SECURITY: matching on VERCEL_PREVIEW_PREFIX alone (e.g. 'lugn-trygg')
    #    is a prefix-only check. Vercel lets ANYONE deploy a project literally
    #    named 'lugn-trygg-evil', whose preview URL
    #    'https://lugn-trygg-evil-<hash>.vercel.app' still starts with the
    #    configured prefix and would match. Vercel TEAM SLUGS, unlike project
    #    names, are globally unique and cannot be claimed by another tenant —
    #    so requiring the exact trailing team slug as well closes that gap.
    #    Set BOTH VERCEL_PROJECT_SLUG and VERCEL_TEAM_SLUG for the hardened
    #    check (recommended). VERCEL_PREVIEW_PREFIX alone still works for
    #    backward compatibility but only anchors the prefix, not the team.
    project_slug = os.getenv('VERCEL_PROJECT_SLUG', '').strip()
    team_slug = os.getenv('VERCEL_TEAM_SLUG', '').strip()
    if project_slug and team_slug:
        pattern = re.compile(
            r'^https://' + re.escape(project_slug) + r'-[a-z0-9]+-' + re.escape(team_slug) + r'\.vercel\.app$'
        )
        if pattern.match(origin):
            return True
    else:
        preview_prefix = os.getenv('VERCEL_PREVIEW_PREFIX', '').strip()
        if preview_prefix:
            pattern = re.compile(
                r'^https://' + re.escape(preview_prefix) + r'(-[a-z0-9]+)+\.vercel\.app$'
            )
            if pattern.match(origin):
                return True

    # 3. Localhost/LAN — non-production only.
    if not is_production:
        if (origin.startswith('http://localhost:') or
                origin.startswith('http://127.0.0.1:') or
                origin.startswith('http://192.168.')):
            return True

    return False

# CORS handlers defined here but will be registered AFTER security_headers middleware
# to ensure CORS headers are set LAST and not overwritten

def _handle_cors_preflight():
    """Handle OPTIONS preflight requests - MUST run first"""
    if request.method == 'OPTIONS':
        logger.debug(f"CORS preflight intercepted for {request.path}")
        from flask import Response
        response = Response('', status=204)
        origin = request.headers.get('Origin', '')

        # Preflights are cached for Access-Control-Max-Age; they must vary on
        # the request headers the decision depends on.
        response.headers.add('Vary', 'Origin')
        response.headers.add('Vary', 'Access-Control-Request-Method')
        response.headers.add('Vary', 'Access-Control-Request-Headers')

        if is_origin_allowed(origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = CORS_ALLOWED_HEADERS
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Max-Age'] = '86400'
        else:
            logger.warning(f"CORS preflight rejected - Origin not allowed: {origin}")

        return response
    return None

def _add_cors_to_response(response):
    """Add CORS headers to ALL responses (runs LAST in after_request chain)"""
    origin = request.headers.get('Origin', '')

    # Vary: Origin on EVERY response, allowed or not — the response body and
    # headers genuinely depend on the request Origin, so any shared cache (a
    # CDN, a reverse proxy, the browser's own HTTP cache) must key on it.
    # Without this, a response cached for one allowed origin gets replayed to
    # another with the wrong Access-Control-Allow-Origin; combined with
    # Allow-Credentials: true that is a cache-poisoning hazard. Set
    # unconditionally so it is also present on the negative (no-ACAO) response,
    # which is exactly the one that must not be reused for a different origin.
    response.headers.add('Vary', 'Origin')

    if is_origin_allowed(origin):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = CORS_ALLOWED_HEADERS
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Max-Age'] = '86400'

    return response

# NOTE: Removed CORS(app, ...) - we handle CORS manually above to ensure X-CSRF-Token is allowed


def _block_invalid_paths():
    """Convert path traversal attempts and malformed double slashes into 404 responses."""
    normalized_path = (request.path or '').replace('\\', '/')
    segments = [segment for segment in normalized_path.split('/') if segment]

    has_traversal = '..' in segments
    has_double_slash = '//' in normalized_path

    if has_traversal or has_double_slash:
        logger.warning(f"🚫 Blocked suspicious path: {request.path}")
        return jsonify({"error": "Ogiltig sökväg"}), 404

    return None

# Rate limiting - optimized for 10k concurrent users during load testing
_testing_mode = os.getenv("TESTING", "").lower() == "true"
_redis_url = os.getenv("REDIS_URL", "memory://")
_storage_uri = _redis_url

# Verify Redis is actually reachable; fall back to memory if not
if _redis_url and _redis_url != "memory://":
    try:
        import redis as _redis_check
        _rc = _redis_check.from_url(_redis_url, socket_connect_timeout=2, socket_timeout=2)
        _rc.ping()
        _rc.close()
        logger.info("✅ Flask-Limiter Redis storage verified")
    except Exception as _redis_err:
        logger.warning(f"⚠️ Redis unreachable for Flask-Limiter ({_redis_err}), falling back to in-memory")
        _storage_uri = "memory://"

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=[] if _testing_mode else ["5000 per day", "1000 per hour", "300 per minute"],
    storage_uri=_storage_uri
)

# [B5] Production guard — warn if rate limiting falls back to in-memory.
# In-memory limits are per-process and reset on every container restart/redeploy.
# With multiple Gunicorn workers each worker tracks its own counters independently,
# making per-IP limits trivially bypassable by sending requests across workers.
if os.getenv('FLASK_ENV', 'development').lower() == 'production' and _storage_uri == 'memory://':
    raise RuntimeError(
        "REDIS_URL must reference a reachable shared Redis instance in production; "
        "in-memory rate limiting is unsafe with multiple workers."
    )

# [B2] Initialize SocketIO for WebSocket biofeedback (gevent async mode matches Dockerfile CMD)
# flask-socketio is listed in requirements.txt; this will only fail if the container image
# was built without it (missing line in requirements.txt or failed pip install).
try:
    from flask_socketio import SocketIO as _SocketIO
    # No '*.vercel.app' wildcard: Socket.IO must not trust arbitrary
    # attacker-registrable *.vercel.app hosts. Exact origins only.
    _socketio_cors = os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://localhost:5173,https://lugn-trygg.vercel.app'
    ).split(',')
    socketio = _SocketIO(
        app,
        async_mode='threading',
        cors_allowed_origins=_socketio_cors,
        logger=False,
        engineio_logger=False,
        ping_timeout=60,
        ping_interval=25,
    )
    _SOCKETIO_INITIALIZED = True
    logger.info("✅ [B2] SocketIO initialized (threading, biofeedback WebSocket ready)")
except ImportError:
    socketio = None
    _SOCKETIO_INITIALIZED = False
    _b2_env = os.getenv('FLASK_ENV', 'development')
    if _b2_env == 'production':
        logger.critical(
            "[B2] flask-socketio NOT installed — WebSocket biofeedback is DISABLED in production. "
            "Rebuild the Docker image to include flask-socketio==5.3.7."
        )
    else:
        logger.warning(
            "[B2] flask-socketio not installed — biofeedback WebSocket disabled (dev mode). "
            "Run: pip install flask-socketio==5.3.7"
        )

# Import and initialize services
try:
    # Core services
    from src.config import config
    from src.firebase_config import initialize_firebase
    from src.middleware.csrf_middleware import init_csrf_middleware

    # Middleware
    from src.middleware.security_headers import init_security_headers
    from src.middleware.validation import init_validation_middleware

    # sql_injection_protection removed - not used in main.py (Firestore is NoSQL)
    # Routes
    from src.routes.admin_routes import admin_bp
    from src.routes.ai_helpers_routes import ai_helpers_bp
    from src.routes.ai_music_routes import ai_music_bp
    from src.routes.ai_routes import ai_bp
    from src.routes.audio_routes import audio_bp
    from src.routes.auth_routes import auth_bp
    from src.routes.biofeedback_ws_routes import biofeedback_ws_bp
    from src.routes.cbt_routes import cbt_bp
    from src.routes.challenges_routes import challenges_bp, init_challenges_defaults
    from src.routes.chatbot_routes import chatbot_bp
    from src.routes.consent_routes import consent_bp
    from src.routes.crisis_routes import crisis_bp
    from src.routes.dashboard_routes import dashboard_bp
    from src.routes.docs_routes import docs_bp
    from src.routes.feedback_routes import feedback_bp
    from src.routes.health_routes import health_bp
    from src.routes.insights_routes import insights_bp
    from src.routes.integration_routes import integration_bp
    from src.routes.journal_routes import journal_bp
    from src.routes.leaderboard_routes import leaderboard_bp
    from src.routes.memory_routes import memory_bp
    from src.routes.metrics_routes import metrics_bp
    from src.routes.mood_gateway import register_mood_gateway
    from src.routes.multimedia_memory_routes import multimedia_memory_bp
    from src.routes.notifications_routes import notifications_bp
    from src.routes.onboarding_routes import onboarding_bp
    from src.routes.peer_chat_routes import peer_chat_bp
    from src.routes.predictive_routes import predictive_bp
    from src.routes.privacy_routes import privacy_bp
    from src.routes.rate_limit_routes import rate_limit_bp
    from src.routes.referral_routes import referral_bp
    from src.routes.rewards_routes import rewards_bp
    from src.routes.security_routes import security_bp
    from src.routes.subscription_routes import subscription_bp
    from src.routes.sync_history_routes import sync_history_bp
    from src.routes.usage_routes import usage_bp
    from src.routes.users_routes import users_bp
    from src.routes.voice_routes import voice_bp

    # Initialize Firebase
    initialize_firebase()

    # Eagerly construct the audit service so a missing/invalid
    # HIPAA_ENCRYPTION_KEY in production aborts BOOT, not just the first audit
    # call. AuditService.__init__ raises RuntimeError in production without a
    # valid key; get_audit_service() lazily constructs it on first use, and
    # every existing call site (audit_log()) catches ALL exceptions as
    # non-fatal — so without this eager call the app previously started fine
    # and only silently stopped auditing (login/crisis/breach events) on the
    # first log attempt. This call is intentionally NOT wrapped in try/except:
    # the whole app-init block already fails startup on any exception here.
    from src.services.audit_service import get_audit_service
    get_audit_service()

    # Initialize monitoring service
    try:
        from src.services.monitoring_service import init_monitoring_service
        monitoring_service_instance = init_monitoring_service(settings)
        logger.info("✅ Monitoring service initialized")
    except Exception as e:
        logger.warning(f"⚠️ Monitoring service initialization failed (non-critical): {e}")

    # Initialize middleware (MUST be before CORS handlers so CORS runs LAST)
    init_security_headers(app)
    init_validation_middleware(app)

    csrf_secret = settings.jwt_secret_key
    if not csrf_secret:
        logger.critical("CSRF secret source missing (JWT secret unavailable). Refusing startup.")
        raise RuntimeError("Missing CSRF secret source")

    csrf_exempt_paths = {
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/api/v1/auth/google-login',
        '/api/v1/auth/refresh',
        '/api/v1/auth/logout',
        '/api/v1/auth/reset-password',
        '/api/v1/auth/confirm-password-reset',
        '/api/v1/dashboard/csrf-token',
        # Idempotent fire-and-forget endpoint called when the chat dialog closes.
        # JWT-protected and only summarises the caller's own data — CSRF exemption
        # here cannot be used to escalate privileges or modify others' state.
        '/api/v1/chatbot/session/close',
        # Server-to-server Stripe webhook: never carries a browser session or
        # CSRF cookie (Stripe's servers call this directly), so the global CSRF
        # gate rejected every real webhook event with 403 before the route's
        # own stripe-signature verification ever ran — subscription
        # activations/cancellations/payment failures never actually applied.
        # The signature check IS the auth for this endpoint, not CSRF.
        '/api/v1/subscription/webhook',
        # Browser-generated CSP violation reports. The browser POSTs these
        # itself with no CSRF cookie and no CSRF header, so the global gate
        # answered 403 to EVERY report and CSP monitoring produced nothing.
        # The endpoint stores a bounded, IP-anonymised record and grants no
        # privileges, so exempting it cannot be used to change state.
        #
        # The v1 path is the one that matters: LegacyAPIRewriter below rewrites
        # /api/security/... to /api/v1/security/... before Flask sees it, so
        # request.path here is always the rewritten form. Exempting only the
        # legacy spelling silently did nothing — verified against production.
        # Both are listed so a future change to the rewriter cannot re-break it.
        '/api/v1/security/csp-violation',
        '/api/security/csp-violation',
    }
    csrf_middleware = init_csrf_middleware(app, secret=csrf_secret, exempt_paths=csrf_exempt_paths)
    app.extensions['csrf_middleware'] = csrf_middleware
    logger.info("✅ CSRF middleware registered with strict double-submit validation")

    # 2026-Compliant: Setup correlation IDs for distributed tracing
    try:
        from src.middleware.correlation import add_correlation_headers, setup_correlation_ids
        app.before_request(setup_correlation_ids)
        logger.info("✅ Correlation ID middleware registered (2026 standard)")
    except Exception as e:
        logger.warning(f"⚠️ Failed to setup correlation middleware: {e}")

    # Block malformed paths before any other middleware runs
    app.before_request(_block_invalid_paths)

    # Guard: Return 503 early if Firestore db is None for data endpoints
    def _check_db_available():
        """Return 503 if Firebase Firestore is not initialized for data-dependent routes."""
        if request.method == 'OPTIONS':
            return None  # Always allow preflight
        if request.path.startswith('/api/') and not request.path.startswith('/api/docs') and request.path != '/api/health':
            try:
                from src.firebase_config import db as _check_db
                if _check_db is None:
                    logger.error("Database unavailable — Firestore not initialized")
                    return jsonify({"success": False, "error": "SERVICE_UNAVAILABLE", "message": "Database temporarily unavailable"}), 503
            except Exception:
                return jsonify({"success": False, "error": "SERVICE_UNAVAILABLE", "message": "Database temporarily unavailable"}), 503
        return None

    app.before_request(_check_db_available)

    # CRITICAL: Register CORS handlers AFTER all other middleware
    # This ensures CORS headers are the LAST thing set on responses
    app.before_request(_handle_cors_preflight)
    app.after_request(_add_cors_to_response)

    # 2026-Compliant: Add correlation headers to responses
    try:
        from src.middleware.correlation import add_correlation_headers
        app.after_request(add_correlation_headers)
    except Exception:
        pass

    logger.info("✅ CORS handlers registered (will run last in after_request chain)")

    # 2026-Compliant: Register blueprints with API versioning
    # All existing routes registered under /api/v1/* for backward compatibility
    # Future breaking changes will go under /api/v2/*

    # Backward-compatible URL rewriting via WSGI middleware:
    # /api/<resource> → /api/v1/<resource>
    # This allows legacy clients and tests to use /api/ without v1/ prefix.
    # Applied at WSGI level BEFORE Flask routing so dispatch works correctly.
    class LegacyAPIRewriter:
        """WSGI middleware that rewrites /api/<resource> to /api/v1/<resource>."""

        _V1_SEGMENTS = frozenset([
            'auth', 'admin', 'mood', 'mood-stats', 'mood-analytics', 'memory', 'ai',
            'chatbot', 'feedback', 'notifications', 'referral', 'users',
            'subscription', 'metrics', 'predictive', 'rate-limit', 'dashboard',
            'onboarding', 'privacy', 'journal', 'challenges', 'rewards', 'audio',
            'peer-chat', 'leaderboard', 'voice', 'sync-history', 'cbt', 'consent',
            'crisis', 'security', 'integration', 'advanced-mood', 'biofeedback',
            'ai-music', 'memory-unified', 'insights',
        ])

        def __init__(self, wsgi_app):
            self.wsgi_app = wsgi_app

        def __call__(self, environ, start_response):
            path = environ.get('PATH_INFO', '')
            # Match /api/<segment>/... where <segment> is a known v1 resource
            if path.startswith('/api/') and not path.startswith('/api/v1/'):
                parts = path.split('/')
                # parts: ['', 'api', '<segment>', ...]
                if len(parts) >= 3 and parts[2] in self._V1_SEGMENTS:
                    environ['PATH_INFO'] = '/api/v1/' + '/'.join(parts[2:])
            return self.wsgi_app(environ, start_response)

    app.wsgi_app = LegacyAPIRewriter(app.wsgi_app)

    # Register blueprints
    try:
        app.register_blueprint(auth_bp, url_prefix='/api/v1/auth')  # v1 for backward compatibility
        logger.info("✅ Registered auth_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register auth_bp: {e}")

    try:
        app.register_blueprint(integration_bp, url_prefix='/api/v1/integration')
        logger.info("✅ Registered integration_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register integration_bp: {e}")

    try:
        app.register_blueprint(admin_bp, url_prefix='/api/v1/admin')
        logger.info("✅ Registered admin_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register admin_bp: {e}")

    try:
        app.register_blueprint(security_bp, url_prefix='/api/v1/security')
        logger.info("✅ Registered security_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register security_bp: {e}")

    try:
        # Entire mood domain (mood, mood-stats, mood-analytics, advanced-mood)
        # registers through the gateway — single source of prefix + auth policy.
        register_mood_gateway(app)
    except Exception as e:
        logger.error(f"❌ Failed to register mood gateway: {e}")

    try:
        app.register_blueprint(memory_bp, url_prefix='/api/v1/memory')
        logger.info("✅ Registered memory_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register memory_bp: {e}")

    try:
        app.register_blueprint(ai_bp, url_prefix='/api/v1/ai')
        logger.info("✅ Registered ai_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register ai_bp: {e}")

    try:
        app.register_blueprint(chatbot_bp, url_prefix='/api/v1/chatbot')
        logger.info("✅ Registered chatbot_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register chatbot_bp: {e}")

    try:
        app.register_blueprint(feedback_bp, url_prefix='/api/v1/feedback')
        logger.info("✅ Registered feedback_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register feedback_bp: {e}")

    try:
        app.register_blueprint(notifications_bp, url_prefix='/api/v1/notifications')
        logger.info("✅ Registered notifications_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register notifications_bp: {e}")

    try:
        app.register_blueprint(referral_bp, url_prefix='/api/v1/referral')
        logger.info("✅ Registered referral_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register referral_bp: {e}")

    try:
        app.register_blueprint(users_bp, url_prefix='/api/v1/users')
        logger.info("✅ Registered users_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register users_bp: {e}")

    try:
        app.register_blueprint(subscription_bp, url_prefix='/api/v1/subscription')
        logger.info("✅ Registered subscription_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register subscription_bp: {e}")

    try:
        app.register_blueprint(docs_bp, url_prefix='/api/docs')
        logger.info("✅ Registered docs_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register docs_bp: {e}")

    try:
        app.register_blueprint(metrics_bp, url_prefix='/api/v1/metrics')
        logger.info("✅ Registered metrics_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register metrics_bp: {e}")

    try:
        app.register_blueprint(predictive_bp, url_prefix='/api/v1/predictive')
        logger.info("✅ Registered predictive_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register predictive_bp: {e}")

    try:
        app.register_blueprint(rate_limit_bp, url_prefix='/api/v1/rate-limit')
        logger.info("✅ Registered rate_limit_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register rate_limit_bp: {e}")

    try:
        app.register_blueprint(dashboard_bp, url_prefix='/api/v1/dashboard')
        logger.info("✅ Registered dashboard_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register dashboard_bp: {e}")

    try:
        app.register_blueprint(onboarding_bp, url_prefix='/api/v1/onboarding')
        logger.info("✅ Registered onboarding_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register onboarding_bp: {e}")

    try:
        app.register_blueprint(privacy_bp, url_prefix='/api/v1/privacy')
        logger.info("✅ Registered privacy_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register privacy_bp: {e}")

    try:
        app.register_blueprint(health_bp, url_prefix='/api/health')
        logger.info("✅ Registered health_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register health_bp: {e}")

    try:
        app.register_blueprint(journal_bp, url_prefix='/api/v1/journal')
        logger.info("✅ Registered journal_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register journal_bp: {e}")

    try:
        app.register_blueprint(challenges_bp, url_prefix='/api/v1/challenges')
        # Seeding does Firestore RPCs — must NOT run in the Gunicorn arbiter
        # (fork-safety). Workers seed via post_worker_init under a distributed
        # periodic claim; only dev/waitress entrypoints seed inline here.
        if os.getenv('GUNICORN_MANAGED', '').lower() != 'true':
            init_challenges_defaults()
        logger.info("✅ Registered challenges_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register challenges_bp: {e}")

    try:
        app.register_blueprint(rewards_bp, url_prefix='/api/v1/rewards')
        logger.info("✅ Registered rewards_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register rewards_bp: {e}")

    try:
        app.register_blueprint(audio_bp, url_prefix='/api/v1/audio')
        logger.info("✅ Registered audio_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register audio_bp: {e}")

    try:
        app.register_blueprint(peer_chat_bp)
        logger.info("✅ Registered peer_chat_bp (url_prefix defined in blueprint)")
    except Exception as e:
        logger.error(f"❌ Failed to register peer_chat_bp: {e}")

    try:
        app.register_blueprint(leaderboard_bp, url_prefix='/api/v1/leaderboard')
        logger.info("✅ Registered leaderboard_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register leaderboard_bp: {e}")

    try:
        app.register_blueprint(voice_bp, url_prefix='/api/v1/voice')
        # [F1] Read the credential check result from voice_routes (already ran at import time).
        from src.routes.voice_routes import _GOOGLE_SPEECH_READY as _speech_ready
        if _speech_ready:
            logger.info("✅ Registered voice_bp (Google Speech-to-Text: READY)")
        else:
            logger.warning(
                "⚠️  Registered voice_bp (Google Speech-to-Text: DEGRADED — "
                "server-side transcription disabled, frontend falls back to Web Speech API)"
            )
    except Exception as e:
        logger.error(f"❌ Failed to register voice_bp: {e}")

    try:
        app.register_blueprint(sync_history_bp, url_prefix='/api/v1/sync-history')
        logger.info("✅ Registered sync_history_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register sync_history_bp: {e}")

    try:
        app.register_blueprint(usage_bp, url_prefix='/api/v1/usage')
        logger.info("✅ Registered usage_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register usage_bp: {e}")

    try:
        app.register_blueprint(cbt_bp, url_prefix='/api/v1/cbt')
        logger.info("✅ Registered cbt_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register cbt_bp: {e}")

    try:
        app.register_blueprint(consent_bp, url_prefix='/api/v1/consent')
        logger.info("✅ Registered consent_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register consent_bp: {e}")

    try:
        app.register_blueprint(crisis_bp, url_prefix='/api/v1/crisis')
        logger.info("✅ Registered crisis_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register crisis_bp: {e}")

    try:
        app.register_blueprint(multimedia_memory_bp, url_prefix='/api/v1/memory-unified')
        # [F2] Surface PIL status in startup log so operators know if thumbnails work.
        from src.routes.multimedia_memory_routes import PIL_AVAILABLE as _pil_ok
        if _pil_ok:
            logger.info("✅ Registered multimedia_memory_bp (Pillow/PIL: READY — image resize + thumbnails enabled)")
        else:
            logger.warning(
                "⚠️  Registered multimedia_memory_bp (Pillow/PIL: DEGRADED — "
                "photos stored at original size, thumbnails disabled)"
            )
    except Exception as e:
        logger.error(f"❌ Failed to register multimedia_memory_bp: {e}")

    try:
        app.register_blueprint(biofeedback_ws_bp, url_prefix='/api/v1/biofeedback')
        logger.info("✅ Registered biofeedback_ws_bp")
        # [B2] Wire up Socket.IO event handlers now that both the blueprint and
        # SocketIO are initialised. This is the single registration point —
        # biofeedback_ws_routes.py only defines the handlers, never calls them.
        if _SOCKETIO_INITIALIZED and socketio is not None:
            from src.routes.biofeedback_ws_routes import register_biofeedback_websocket_handlers
            register_biofeedback_websocket_handlers(socketio)
            logger.info("✅ [B2] WebSocket biofeedback handlers registered on /biofeedback namespace")
        else:
            logger.warning("⚠️ [B2] SocketIO not available — biofeedback WebSocket handlers NOT registered")
    except Exception as e:
        logger.error(f"❌ Failed to register biofeedback_ws_bp: {e}")

    try:
        # The real-time crisis monitor (src/services/crisis_monitor.py) defines
        # its handlers via register_handlers() but nothing ever called it, so
        # the /crisis-monitor namespace was unreachable dead code. Wire it up
        # the same way as the biofeedback namespace above.
        if _SOCKETIO_INITIALIZED and socketio is not None:
            from src.services.crisis_monitor import get_crisis_monitor
            get_crisis_monitor(socketio).register_handlers()
            logger.info("✅ WebSocket crisis monitor handlers registered on /crisis-monitor namespace")
        else:
            logger.warning("⚠️ SocketIO not available — crisis monitor WebSocket handlers NOT registered")
    except Exception as e:
        logger.error(f"❌ Failed to register crisis monitor WebSocket handlers: {e}")

    try:
        app.register_blueprint(ai_helpers_bp, url_prefix='/api/v1/ai-helpers')
        logger.info("✅ Registered ai_helpers_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register ai_helpers_bp: {e}")

    try:
        app.register_blueprint(ai_music_bp, url_prefix='/api/v1/ai-music')
        logger.info("✅ Registered ai_music_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register ai_music_bp: {e}")

    try:
        app.register_blueprint(insights_bp, url_prefix='/api/v1/insights')
        logger.info("✅ Registered insights_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register insights_bp: {e}")

    # Debug: Print URL map
    logger.info("🔍 DEBUG: URL Map after blueprint registration:")
    for rule in app.url_map.iter_rules():
        logger.info(f"  {rule.rule} -> {rule.endpoint}")

    # Global request middleware - 2026 Compliant
    @app.before_request
    def before_request():
        """Global request preprocessing - skip for OPTIONS and static files"""
        # Skip processing for OPTIONS (handled by handle_preflight) and static files
        if request.method == 'OPTIONS':
            return  # Already handled by handle_preflight

        if request.path.startswith('/static/') or request.path in ['/health', '/favicon.ico']:
            return  # Skip logging for static/health endpoints

        # 2026-Compliant: Use correlation IDs from middleware
        g.request_start_time = datetime.now(UTC)
        if not hasattr(g, 'request_id'):
            # Fallback if correlation middleware didn't set it
            g.request_id = os.urandom(8).hex()

        # 2026-Compliant: Structured logging with correlation IDs
        if not request.path.startswith('/health'):
            try:
                from src.utils.structured_logging import get_logger
                struct_logger = get_logger(__name__)
                struct_logger.info(
                    "request_received",
                    method=request.method,
                    path=request.path,
                    remote_addr=_anonymize_ip(get_remote_address()),
                )
            except Exception:
                # Fallback to standard logging
                logger.info(
                    "Request: %s %s from %s",
                    request.method,
                    request.path,
                    _anonymize_ip(get_remote_address()),
                )

        # Sanitize request data only for POST/PUT/PATCH with body
        if request.method in ['POST', 'PUT', 'PATCH'] and request.content_length:
            try:
                from src.utils.input_sanitization import sanitize_request
                sanitize_request()
            except Exception as e:
                logger.error(f"Request sanitization failed: {e}")

    # Health check endpoint (2026 compliant)
    @app.route('/health')
    @limiter.exempt
    def health_check():
        """Health check endpoint - no versioning for compatibility.

        Contract (Render probes this path):
        - Dependency probes are CACHED for 30s so health checks never add
          per-probe Firestore/Redis load.
        - Returns HTTP 503 when Firestore is unreachable — the service cannot
          serve any meaningful request without its datastore, and a 200 here
          previously made the health check unable to ever fail.
        - Redis-down is reported as status 'degraded' in the payload but still
          returns 200: restarting the instance cannot fix an external Redis
          outage, so it must not trigger a restart loop.
        """
        now_ts = time.time()
        cache = app.extensions.setdefault('_health_probe_cache', {})
        if cache.get('expires', 0) <= now_ts:
            probe: dict[str, str] = {}
            # Check Firebase connectivity
            try:
                from src.firebase_config import db as health_db
                if health_db:
                    # Quick collection list to verify connectivity
                    health_db.collection('users').limit(1).get()
                    probe['firebase'] = 'connected'
                else:
                    probe['firebase'] = 'unavailable'
            except Exception:
                probe['firebase'] = 'error'

            # Check Redis connectivity
            try:
                from src.redis_config import redis_client
                if redis_client:
                    redis_client.ping()
                    probe['redis'] = 'connected'
                else:
                    probe['redis'] = 'unavailable'
            except Exception:
                probe['redis'] = 'unavailable'

            cache['probe'] = probe
            cache['expires'] = now_ts + 30

        probe = cache['probe']
        firebase_down = probe.get('firebase') != 'connected'
        redis_down = probe.get('redis') != 'connected'

        health_data: dict[str, Any] = {
            'status': 'degraded' if (firebase_down or redis_down) else 'healthy',
            'timestamp': datetime.now(UTC).isoformat(),
            'version': '2.0.0',
            # Deployed commit SHA so the running version is verifiable at a
            # glance (Render sets RENDER_GIT_COMMIT; other platforms via
            # GIT_COMMIT / SOURCE_VERSION).
            'commit': (os.getenv('RENDER_GIT_COMMIT')
                       or os.getenv('GIT_COMMIT')
                       or os.getenv('SOURCE_VERSION')
                       or 'unknown')[:12],
            'api_version': 'v1',
            'environment': settings.flask_env,
            'firebase': probe.get('firebase'),
            'redis': probe.get('redis'),
        }

        # Add correlation IDs if available
        if hasattr(g, 'request_id'):
            health_data['request_id'] = g.request_id
        if hasattr(g, 'trace_id'):
            health_data['trace_id'] = g.trace_id

        return jsonify(health_data), (503 if firebase_down else 200)

    # Root endpoint (2026 compliant)
    @app.route('/')
    def root():
        """Root endpoint - API information"""
        return jsonify({
            'message': 'Lugn & Trygg API - 2026 Compliant',
            'version': '2.0.0',
            'api_version': 'v1',
            'documentation': '/api/docs',
            'health': '/health',
            'endpoints': {
                'v1': '/api/v1/*',
                'health': '/health',
                'docs': '/api/docs',
            }
        })

    # Test integration endpoint (v1 for backward compatibility)
    @app.route('/api/v1/integration/test-direct')
    def test_integration_direct():
        """Direct test endpoint - v1"""
        return jsonify({'message': 'Direct integration test works!', 'version': 'v1'}), 200

    # CRITICAL: Explicit catch-all OPTIONS handler for CORS preflight
    # This ensures X-CSRF-Token is ALWAYS in Access-Control-Allow-Headers
    @app.route('/api/v1/<path:path>', methods=['OPTIONS'])
    @app.route('/api/<path:path>', methods=['OPTIONS'])
    @app.route('/api/v1', methods=['OPTIONS'], defaults={'path': ''})
    @app.route('/api', methods=['OPTIONS'], defaults={'path': ''})
    def handle_options_preflight(path: str = ''):
        """
        2026-Compliant: Handle ALL OPTIONS preflight requests with proper CORS headers
        Supports both /api/* and /api/v1/* for backward compatibility
        """
        from flask import Response
        response = Response('', status=204)
        origin = request.headers.get('Origin', '')

        # Allow origins based on environment (localhost only in non-production)
        if is_origin_allowed(origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = CORS_ALLOWED_HEADERS
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Max-Age'] = '86400'
            logger.info(f"✅ OPTIONS preflight handled for {request.path} - Headers: {CORS_ALLOWED_HEADERS}")
        else:
            logger.warning(f"⚠️ OPTIONS preflight rejected - Origin not allowed: {origin}")

        return response

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'error': 'Hittades inte',
            'message': 'Resursen kunde inte hittas',
            'path': request.path
        }), 404

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return jsonify({
            'error': 'Internt serverfel',
            'message': 'Ett oväntat fel inträffade'
        }), 500

    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        retry_after = error.description if isinstance(error.description, (int, float)) else 60
        response = jsonify({
            'error': 'För många anrop',
            'message': 'För många förfrågningar. Försök igen senare.',
            'retry_after': retry_after
        })
        response.status_code = 429
        response.headers['Retry-After'] = str(retry_after)
        # Explicitly add CORS headers so a legitimate frontend can read 429
        # responses — but only for an allow-listed origin. Reflecting Origin
        # unconditionally here (as this used to) let ANY site do a
        # credentialed fetch() and read this response once it tripped the
        # rate limit, bypassing the allow-list every other CORS path in this
        # file enforces.
        origin = request.headers.get('Origin', '')
        if origin and is_origin_allowed(origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'error': 'Ogiltig begäran',
            'message': 'Begäran var ogiltig eller felaktigt formaterad'
        }), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            'error': 'Obehörig',
            'message': 'Autentisering krävs'
        }), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            'error': 'Förbjuden',
            'message': 'Du saknar behörighet för denna resurs'
        }), 403

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            'error': 'Metod ej tillåten',
            'message': f'Metoden {request.method} är inte tillåten för denna endpoint'
        }), 405

    @app.errorhandler(413)
    def payload_too_large(error):
        return jsonify({
            'error': 'För stor begäran',
            'message': 'Begäran överskrider tillåten storlek'
        }), 413

    @app.errorhandler(Exception)
    def handle_unhandled_exception(error):
        """Catch-all for unhandled exceptions — always return JSON, never HTML."""
        logger.error(f"Unhandled exception: {type(error).__name__}: {error}", exc_info=True)
        return jsonify({
            'error': 'Internt serverfel',
            'message': 'Ett oväntat fel inträffade'
        }), 500

    # Start background services — but ONLY for non-Gunicorn entrypoints
    # (python main.py dev server, waitress). Under Gunicorn this module is
    # imported in the ARBITER (preload_app=True); threads started here would
    # never exist in the forked workers, so each worker starts its own
    # services via the post_worker_init hook → run_worker_bootstrap().
    # Test environments are suppressed inside start_background_services().
    from src.services.background_services import is_gunicorn_managed, start_background_services
    if not is_gunicorn_managed():
        start_background_services(context='inline')

    logger.info("🚀 Lugn & Trygg backend started successfully")
    logger.info(f"📊 Environment: {os.getenv('FLASK_ENV', 'development')}")
    logger.info(f"🔗 CORS Origins: {_get_cors_origins_list()}")
    logger.info("📚 API Documentation: /api/docs")

except Exception as e:
    logger.error(f"❌ Failed to initialize application: {e}")
    raise

# Export both the Flask app and the SocketIO instance for Gunicorn / tests
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    host = os.getenv('HOST', '127.0.0.1')

    logger.info(f"Starting development server on {host}:{port}")
    if _SOCKETIO_INITIALIZED and socketio is not None:
        # Use socketio.run() so WebSocket connections are accepted in dev mode
        socketio.run(
            app,
            host=host,
            port=port,
            debug=app.config['DEBUG'],
        )
    else:
        app.run(
            host=host,
            port=port,
            debug=app.config['DEBUG'],
            threaded=True,
        )
