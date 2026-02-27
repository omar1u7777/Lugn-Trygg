"""
Lugn & Trygg - Mental Health Platform Backend
Production-ready Flask application with comprehensive security and monitoring
"""

import os
import sys
from typing import Any, Dict
from flask import Flask, request, jsonify, g
# NOTE: flask_cors removed - we handle CORS manually for full control over allowed headers
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_jwt_extended import JWTManager  # kept for test compatibility (not used at runtime)
from dotenv import load_dotenv
import logging
from datetime import datetime, UTC

from src.utils.hf_cache import configure_hf_cache

# Initialize Sentry for production error tracking (must be before Flask app creation)
from src.monitoring.sentry_config import init_sentry

# Add Backend directory to sys.path to enable imports from src
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load environment variables (backward compatibility)
load_dotenv()
configure_hf_cache()

# Try to use new pydantic-settings, fallback to old config
try:
    from src.config.settings import get_settings
    settings = get_settings()
    USE_PYDANTIC_SETTINGS = True
except Exception as e:
    # Fallback to old config if pydantic-settings fails
    USE_PYDANTIC_SETTINGS = False
    from src.config import config as old_config
    logger = logging.getLogger(__name__)

# Configure structured logging (2026 standard)
USE_STRUCTURED_LOGGING = os.getenv('USE_STRUCTURED_LOGGING', 'true').lower() == 'true'

if USE_STRUCTURED_LOGGING:
    try:
        from src.utils.structured_logging import JSONFormatter, get_logger
        import logging
        root_logger = logging.getLogger()
        root_logger.handlers.clear()
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        root_logger.addHandler(handler)
        root_logger.setLevel(logging.INFO)
        logger = get_logger(__name__)
    except Exception as e:
        # Fallback to standard logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler('app.log') if os.getenv('LOG_TO_FILE', 'false').lower() == 'true' else logging.NullHandler()
            ]
        )
        logger = logging.getLogger(__name__)
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

# CRITICAL: Disable automatic OPTIONS handling so we can set CORS headers manually
app.config['CORS_AUTOMATIC_OPTIONS'] = False

# Configuration - 2026 compliant with pydantic-settings
if USE_PYDANTIC_SETTINGS:
    # Use new pydantic-settings (2026 standard)
    app.config['SECRET_KEY'] = settings.jwt_secret_key
    app.config['JWT_SECRET_KEY'] = settings.jwt_secret_key
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'
    app.config['DEBUG'] = settings.flask_debug
    app.config['TESTING'] = os.getenv('FLASK_TESTING', 'False').lower() == 'true'
    logger.info("✅ Using pydantic-settings for configuration (2026 standard)")
else:
    # Fallback to old config (backward compatibility)
    jwt_secret = os.getenv('JWT_SECRET_KEY')
    if not jwt_secret:
        logger.error("JWT_SECRET_KEY environment variable is not set. Application cannot start securely.")
        sys.exit(1)
    app.config['SECRET_KEY'] = jwt_secret
    app.config['JWT_SECRET_KEY'] = jwt_secret
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'
    app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    app.config['TESTING'] = os.getenv('FLASK_TESTING', 'False').lower() == 'true'
    app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', str(16 * 1024 * 1024)))  # 16MB default
    logger.warning("⚠️ Using legacy configuration (consider migrating to pydantic-settings)")

# Flask-JWT-Extended: JWTManager not initialized here — we use custom AuthService.jwt_required
# The flask-jwt-extended package is kept for test mocking compatibility only

# Flask-WTF removed from requirements - CSRF protection disabled

# CORS Headers configuration - ALL supported headers including CSRF variants
# This is a constant and doesn't depend on environment variables
CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, X-CSRFToken, x-csrftoken, x-csrf-token'

def _get_cors_origins_list():
    """Get CORS origins list - called at runtime to ensure .env is loaded"""
    if USE_PYDANTIC_SETTINGS:
        return settings.cors_allowed_origins_list
    else:
        cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:8081,http://localhost:19000,http://localhost:19001')
        return [origin.strip() for origin in cors_origins.split(',') if origin.strip()]

def is_origin_allowed(origin: str) -> bool:
    """Check if the origin is allowed"""
    cors_origins_list = _get_cors_origins_list()
    is_production = os.getenv('FLASK_ENV', 'production') == 'production'

    if origin in cors_origins_list:
        return True

    # Only allow specific Vercel preview deployments matching our project
    for allowed in cors_origins_list:
        if '*' in allowed:
            # Convert wildcard pattern to suffix match (e.g. https://*.vercel.app)
            suffix = allowed.split('*')[-1]  # e.g. '.vercel.app'
            prefix = allowed.split('*')[0]   # e.g. 'https://'
            if origin.startswith(prefix) and origin.endswith(suffix):
                # Extra safety: only allow lugn-trygg project deployments
                domain = origin.replace(prefix, '').replace(suffix, '')
                if 'lugn-trygg' in domain.lower() or 'lugntrygg' in domain.lower():
                    return True

    # Only allow localhost/LAN origins in non-production environments
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
    
    origin_allowed = is_origin_allowed(origin)
    
    if origin_allowed:
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
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["5000 per day", "1000 per hour", "300 per minute"],
    storage_uri=os.getenv("REDIS_URL", "memory://")
)

# Import and initialize services
try:
    # Core services
    from src.config import config
    from src.firebase_config import initialize_firebase
    from src.services.rate_limiting import rate_limit_by_endpoint
    from src.services.api_key_rotation import start_key_rotation
    from src.services.backup_service import backup_service
    from src.services.monitoring_service import monitoring_service

    # Middleware
    from src.middleware.security_headers import init_security_headers
    from src.middleware.validation import init_validation_middleware
    from src.utils.input_sanitization import sanitize_request
    # sql_injection_protection removed - not used in main.py (Firestore is NoSQL)

    # Routes
    from src.routes.admin_routes import admin_bp
    from src.routes.auth_routes import auth_bp
    from src.routes.mood_routes import mood_bp
    from src.routes.mood_stats_routes import mood_stats_bp
    from src.routes.memory_routes import memory_bp
    from src.routes.ai_routes import ai_bp
    from src.routes.ai_helpers_routes import ai_helpers_bp
    from src.routes.chatbot_routes import chatbot_bp
    from src.routes.feedback_routes import feedback_bp
    from src.routes.notifications_routes import notifications_bp
    from src.routes.referral_routes import referral_bp
    from src.routes.users_routes import users_bp
    from src.routes.integration_routes import integration_bp
    from src.routes.subscription_routes import subscription_bp
    from src.routes.docs_routes import docs_bp
    from src.routes.metrics_routes import metrics_bp
    from src.routes.security_routes import security_bp
    from src.routes.predictive_routes import predictive_bp
    from src.routes.rate_limit_routes import rate_limit_bp
    from src.routes.dashboard_routes import dashboard_bp
    from src.routes.onboarding_routes import onboarding_bp
    from src.routes.privacy_routes import privacy_bp
    from src.routes.health_routes import health_bp
    from src.routes.journal_routes import journal_bp
    from src.routes.challenges_routes import challenges_bp, init_challenges_defaults
    from src.routes.rewards_routes import rewards_bp
    from src.routes.audio_routes import audio_bp
    from src.routes.peer_chat_routes import peer_chat_bp
    from src.routes.leaderboard_routes import leaderboard_bp
    from src.routes.voice_routes import voice_bp
    from src.routes.sync_history_routes import sync_history_bp
    from src.routes.cbt_routes import cbt_bp
    from src.routes.consent_routes import consent_bp
    from src.routes.crisis_routes import crisis_bp

    # Initialize Firebase
    initialize_firebase()
    
    # Initialize monitoring service
    try:
        from src.services.monitoring_service import init_monitoring_service
        # 2026-Compliant: Use new settings or fallback to old config
        if USE_PYDANTIC_SETTINGS:
            monitoring_service_instance = init_monitoring_service(settings)
        else:
            from src.config import config
            monitoring_service_instance = init_monitoring_service(config)
        logger.info("✅ Monitoring service initialized")
    except Exception as e:
        logger.warning(f"⚠️ Monitoring service initialization failed (non-critical): {e}")

    # Initialize middleware (MUST be before CORS handlers so CORS runs LAST)
    init_security_headers(app)
    init_validation_middleware(app)
    
    # 2026-Compliant: Setup correlation IDs for distributed tracing
    try:
        from src.middleware.correlation import setup_correlation_ids, add_correlation_headers
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
            'auth', 'admin', 'mood', 'mood-stats', 'memory', 'ai', 'ai-helpers',
            'chatbot', 'feedback', 'notifications', 'referral', 'users',
            'subscription', 'metrics', 'predictive', 'rate-limit', 'dashboard',
            'onboarding', 'privacy', 'journal', 'challenges', 'rewards', 'audio',
            'peer-chat', 'leaderboard', 'voice', 'sync-history', 'cbt', 'consent',
            'crisis', 'security', 'integration',
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
        app.register_blueprint(mood_bp, url_prefix='/api/v1/mood')
        logger.info("✅ Registered mood_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register mood_bp: {e}")

    try:
        app.register_blueprint(mood_stats_bp, url_prefix='/api/v1/mood-stats')
        logger.info("✅ Registered mood_stats_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register mood_stats_bp: {e}")

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
        app.register_blueprint(ai_helpers_bp, url_prefix='/api/v1/ai-helpers')
        logger.info("✅ Registered ai_helpers_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register ai_helpers_bp: {e}")

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
        logger.info("✅ Registered voice_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register voice_bp: {e}")

    try:
        app.register_blueprint(sync_history_bp, url_prefix='/api/v1/sync-history')
        logger.info("✅ Registered sync_history_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register sync_history_bp: {e}")

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
                    remote_addr=get_remote_address(),
                )
            except Exception:
                # Fallback to standard logging
                logger.info(f"Request: {request.method} {request.path} from {get_remote_address()}")

        # Sanitize request data only for POST/PUT/PATCH with body
        if request.method in ['POST', 'PUT', 'PATCH'] and request.content_length:
            try:
                from src.utils.input_sanitization import sanitize_request
                sanitize_request()
            except Exception as e:
                logger.error(f"Request sanitization failed: {e}")

    # Health check endpoint (2026 compliant)
    @app.route('/health')
    def health_check():
        """Health check endpoint - no versioning for compatibility"""
        health_data: Dict[str, Any] = {
            'status': 'healthy',
            'timestamp': datetime.now(UTC).isoformat(),
            'version': '2.0.0',
            'api_version': 'v1',
            'environment': settings.flask_env if USE_PYDANTIC_SETTINGS else os.getenv('FLASK_ENV', 'development'),
        }

        # Check Firebase connectivity
        try:
            from src.firebase_config import db as health_db
            if health_db:
                # Quick collection list to verify connectivity
                health_db.collection('users').limit(1).get()
                health_data['firebase'] = 'connected'
            else:
                health_data['firebase'] = 'unavailable'
                health_data['status'] = 'degraded'
        except Exception:
            health_data['firebase'] = 'error'
            health_data['status'] = 'degraded'

        # Check Redis connectivity
        try:
            from src.redis_config import redis_client
            if redis_client:
                redis_client.ping()
                health_data['redis'] = 'connected'
            else:
                health_data['redis'] = 'unavailable'
        except Exception:
            health_data['redis'] = 'unavailable'
        
        # Add correlation IDs if available
        if hasattr(g, 'request_id'):
            health_data['request_id'] = g.request_id
        if hasattr(g, 'trace_id'):
            health_data['trace_id'] = g.trace_id
        
        return jsonify(health_data)

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
            'error': 'Not Found',
            'message': 'The requested resource was not found',
            'path': request.path
        }), 404

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred'
        }), 500

    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        return jsonify({
            'error': 'Rate Limit Exceeded',
            'message': 'Too many requests. Please try again later.',
            'retry_after': error.description
        }), 429

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'error': 'Bad Request',
            'message': 'The request was invalid or malformed'
        }), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            'error': 'Unauthorized',
            'message': 'Authentication is required'
        }), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            'error': 'Forbidden',
            'message': 'You do not have permission to access this resource'
        }), 403

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            'error': 'Method Not Allowed',
            'message': f'The {request.method} method is not allowed for this endpoint'
        }), 405

    @app.errorhandler(413)
    def payload_too_large(error):
        return jsonify({
            'error': 'Payload Too Large',
            'message': 'The request body exceeds the maximum allowed size'
        }), 413

    @app.errorhandler(Exception)
    def handle_unhandled_exception(error):
        """Catch-all for unhandled exceptions — always return JSON, never HTML."""
        logger.exception(f"Unhandled exception: {type(error).__name__}")
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred'
        }), 500

    # Start background services
    if not app.config['TESTING']:
        try:
            # Temporarily disabled - services need proper initialization
            # start_key_rotation()
            # backup_service.start_scheduler()
            # monitoring_service.start_monitoring()
            logger.info("✅ Background services initialization skipped (FAS 0)")
        except Exception as e:
            logger.error(f"Failed to start background services: {e}")

    logger.info("🚀 Lugn & Trygg backend started successfully")
    logger.info(f"📊 Environment: {os.getenv('FLASK_ENV', 'development')}")
    logger.info(f"🔗 CORS Origins: {_get_cors_origins_list()}")
    logger.info(f"📚 API Documentation: /api/docs")

except Exception as e:
    logger.error(f"❌ Failed to initialize application: {e}")
    raise

# Export the Flask app for Gunicorn
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    host = os.getenv('HOST', '127.0.0.1')

    logger.info(f"Starting development server on {host}:{port}")
    app.run(
        host=host,
        port=port,
        debug=app.config['DEBUG'],
        threaded=True
    )