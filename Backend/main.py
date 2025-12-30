"""
Lugn & Trygg - Mental Health Platform Backend
Production-ready Flask application with comprehensive security and monitoring
"""

import os
import sys
from flask import Flask, request, jsonify, g
# NOTE: flask_cors removed - we handle CORS manually for full control over allowed headers
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import logging
from datetime import datetime, UTC

from src.utils.hf_cache import configure_hf_cache

# Add Backend directory to sys.path to enable imports from src
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load environment variables
load_dotenv()
configure_hf_cache()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log') if os.getenv('LOG_TO_FILE', 'false').lower() == 'true' else logging.NullHandler()
    ]
)

logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# CRITICAL: Disable automatic OPTIONS handling so we can set CORS headers manually
app.config['CORS_AUTOMATIC_OPTIONS'] = False

# Configuration
# Ensure JWT_SECRET_KEY is set for security
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

# Initialize Flask-JWT-Extended
jwt = JWTManager(app)

# Flask-WTF removed from requirements - CSRF protection disabled

# CORS Headers configuration - ALL supported headers including CSRF variants
# This is a constant and doesn't depend on environment variables
CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, X-CSRFToken, x-csrftoken, x-csrf-token'

def _get_cors_origins_list():
    """Get CORS origins list - called at runtime to ensure .env is loaded"""
    cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:8081,http://localhost:19000,http://localhost:19001')
    return [origin.strip() for origin in cors_origins.split(',') if origin.strip()]

def is_origin_allowed(origin: str) -> bool:
    """Check if the origin is allowed"""
    cors_origins_list = _get_cors_origins_list()
    return (
        origin in cors_origins_list or 
        any(origin.endswith('.vercel.app') for o in cors_origins_list if '*' in o) or
        origin.startswith('http://localhost:') or
        origin.startswith('http://127.0.0.1:') or
        origin.startswith('http://192.168.')  # Local network
    )

# CORS handlers defined here but will be registered AFTER security_headers middleware
# to ensure CORS headers are set LAST and not overwritten

def _handle_cors_preflight():
    """Handle OPTIONS preflight requests - MUST run first"""
    print(f"[CORS-DEBUG] _handle_cors_preflight called, method={request.method}, path={request.path}")
    if request.method == 'OPTIONS':
        print(f"[CORS-DEBUG] OPTIONS detected for {request.path}")
        logger.info(f"🔥 CORS preflight intercepted for {request.path}")
        from flask import Response
        response = Response('', status=204)
        origin = request.headers.get('Origin', '')
        print(f"[CORS-DEBUG] Origin={origin}")
        
        if is_origin_allowed(origin):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = CORS_ALLOWED_HEADERS
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Max-Age'] = '86400'
            print(f"[CORS-DEBUG] Headers set: Allow-Headers={CORS_ALLOWED_HEADERS}")
            logger.info(f"✅ CORS preflight headers set: {CORS_ALLOWED_HEADERS}")
        else:
            print(f"[CORS-DEBUG] Origin NOT allowed: {origin}")
        
        return response
    return None

def _add_cors_to_response(response):
    """Add CORS headers to ALL responses (runs LAST in after_request chain)"""
    origin = request.headers.get('Origin', '')
    print(f"[CORS-DEBUG] _add_cors_to_response called, method={request.method}, path={request.path}, origin={origin}")
    
    # Check if origin is allowed (more permissive for localhost)
    origin_allowed = (
        origin.startswith('http://localhost:') or 
        origin.startswith('http://127.0.0.1:') or 
        origin.startswith('http://192.168.') or
        is_origin_allowed(origin)
    )
    
    if origin_allowed:
        # ALWAYS set these headers, OVERWRITING any previous values
        # This is critical to ensure X-CSRF-Token is included
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = CORS_ALLOWED_HEADERS
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Max-Age'] = '86400'
        print(f"[CORS-DEBUG] after_request headers set: Allow-Headers={CORS_ALLOWED_HEADERS}")
        logger.debug(f"✅ CORS headers set for {request.method} {request.path}: {CORS_ALLOWED_HEADERS}")
    else:
        print(f"[CORS-DEBUG] after_request - origin NOT allowed: {origin}")
    
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
    default_limits=["100000 per day", "10000 per hour", "1000 per minute"],
    storage_uri="memory://"
)

# Import and initialize services
try:
    # Core services
    from src.config import config
    from src.firebase_config import initialize_firebase
    from src.services.rate_limiting import rate_limiter, rate_limit_by_endpoint
    from src.services.api_key_rotation import start_key_rotation
    from src.services.backup_service import backup_service
    from src.services.monitoring_service import monitoring_service
    from src.services.query_monitor import query_monitor

    # Middleware
    from src.middleware.security_headers import init_security_headers
    from src.middleware.validation import init_validation_middleware
    from src.utils.input_sanitization import sanitize_request
    from src.utils.sql_injection_protection import protect_sql_injection

    # Routes
    from src.routes.admin_routes import admin_bp
    from src.routes.auth_routes import auth_bp
    from src.routes.mood_routes import mood_bp
    from src.routes.mood_stats_routes import mood_stats_bp
    from src.routes.memory_routes import memory_bp
    from src.routes.ai_routes import ai_bp
    from src.routes.ai_helpers_routes import ai_helpers_bp
    from src.routes.ai_stories_routes import ai_stories_bp
    from src.routes.chatbot_routes import chatbot_bp
    from src.routes.feedback_routes import feedback_bp
    from src.routes.notifications_routes import notifications_bp
    from src.routes.referral_routes import referral_bp
    from src.routes.sync_routes import sync_bp
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
    from src.routes.challenges_routes import challenges_bp
    from src.routes.rewards_routes import rewards_bp
    from src.routes.audio_routes import audio_bp
    from src.routes.peer_chat_routes import peer_chat_bp
    from src.routes.leaderboard_routes import leaderboard_bp
    from src.routes.voice_routes import voice_bp
    from src.routes.sync_history_routes import sync_history_bp
    from src.routes.chat_alias_routes import chat_alias_bp

    # Initialize Firebase
    initialize_firebase()

    # Initialize middleware (MUST be before CORS handlers so CORS runs LAST)
    init_security_headers(app)
    init_validation_middleware(app)

    # Block malformed paths before any other middleware runs
    app.before_request(_block_invalid_paths)
    
    # CRITICAL: Register CORS handlers AFTER all other middleware
    # This ensures CORS headers are the LAST thing set on responses
    app.before_request(_handle_cors_preflight)
    app.after_request(_add_cors_to_response)
    logger.info("✅ CORS handlers registered (will run last in after_request chain)")

    # Register blueprints
    try:
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        logger.info("✅ Registered auth_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register auth_bp: {e}")

    try:
        app.register_blueprint(integration_bp, url_prefix='/api/integration')
        logger.info("✅ Registered integration_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register integration_bp: {e}")

    try:
        app.register_blueprint(admin_bp, url_prefix='/api/admin')
        logger.info("✅ Registered admin_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register admin_bp: {e}")

    try:
        app.register_blueprint(security_bp, url_prefix='/api/security')
        logger.info("✅ Registered security_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register security_bp: {e}")

    try:
        app.register_blueprint(mood_bp, url_prefix='/api/mood')
        logger.info("✅ Registered mood_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register mood_bp: {e}")

    try:
        app.register_blueprint(mood_stats_bp, url_prefix='/api/mood-stats')
        logger.info("✅ Registered mood_stats_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register mood_stats_bp: {e}")

    try:
        app.register_blueprint(memory_bp, url_prefix='/api/memory')
        logger.info("✅ Registered memory_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register memory_bp: {e}")

    try:
        app.register_blueprint(ai_bp, url_prefix='/api/ai')
        logger.info("✅ Registered ai_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register ai_bp: {e}")

    try:
        app.register_blueprint(ai_stories_bp, url_prefix='/api/ai')
        logger.info("✅ Registered ai_stories_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register ai_stories_bp: {e}")

    try:
        app.register_blueprint(ai_helpers_bp, url_prefix='/api/ai-helpers')
        logger.info("✅ Registered ai_helpers_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register ai_helpers_bp: {e}")

    try:
        app.register_blueprint(chatbot_bp, url_prefix='/api/chatbot')
        logger.info("✅ Registered chatbot_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register chatbot_bp: {e}")

    try:
        app.register_blueprint(chat_alias_bp, url_prefix='/api/chat')
        logger.info("✅ Registered chat_alias_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register chat_alias_bp: {e}")

    try:
        app.register_blueprint(feedback_bp, url_prefix='/api/feedback')
        logger.info("✅ Registered feedback_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register feedback_bp: {e}")

    try:
        app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
        logger.info("✅ Registered notifications_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register notifications_bp: {e}")

    try:
        app.register_blueprint(referral_bp, url_prefix='/api/referral')
        logger.info("✅ Registered referral_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register referral_bp: {e}")

    try:
        app.register_blueprint(sync_bp, url_prefix='/api/sync')
        logger.info("✅ Registered sync_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register sync_bp: {e}")

    try:
        app.register_blueprint(users_bp, url_prefix='/api/users')
        logger.info("✅ Registered users_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register users_bp: {e}")

    try:
        app.register_blueprint(subscription_bp, url_prefix='/api/subscription')
        logger.info("✅ Registered subscription_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register subscription_bp: {e}")

    try:
        app.register_blueprint(docs_bp, url_prefix='/api/docs')
        logger.info("✅ Registered docs_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register docs_bp: {e}")

    try:
        app.register_blueprint(metrics_bp, url_prefix='/api/metrics')
        logger.info("✅ Registered metrics_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register metrics_bp: {e}")

    try:
        app.register_blueprint(predictive_bp, url_prefix='/api/predictive')
        logger.info("✅ Registered predictive_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register predictive_bp: {e}")

    try:
        app.register_blueprint(rate_limit_bp, url_prefix='/api/rate-limit')
        logger.info("✅ Registered rate_limit_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register rate_limit_bp: {e}")

    try:
        app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
        logger.info("✅ Registered dashboard_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register dashboard_bp: {e}")

    try:
        app.register_blueprint(onboarding_bp, url_prefix='/api/onboarding')
        logger.info("✅ Registered onboarding_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register onboarding_bp: {e}")

    try:
        app.register_blueprint(privacy_bp, url_prefix='/api/privacy')
        logger.info("✅ Registered privacy_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register privacy_bp: {e}")

    try:
        app.register_blueprint(health_bp, url_prefix='/api/health')
        logger.info("✅ Registered health_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register health_bp: {e}")

    try:
        app.register_blueprint(journal_bp, url_prefix='/api/journal')
        logger.info("✅ Registered journal_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register journal_bp: {e}")

    try:
        app.register_blueprint(challenges_bp, url_prefix='/api/challenges')
        logger.info("✅ Registered challenges_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register challenges_bp: {e}")

    try:
        app.register_blueprint(rewards_bp, url_prefix='/api/rewards')
        logger.info("✅ Registered rewards_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register rewards_bp: {e}")

    try:
        app.register_blueprint(audio_bp, url_prefix='/api/audio')
        logger.info("✅ Registered audio_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register audio_bp: {e}")

    try:
        app.register_blueprint(peer_chat_bp, url_prefix='/api/peer-chat')
        logger.info("✅ Registered peer_chat_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register peer_chat_bp: {e}")

    try:
        app.register_blueprint(leaderboard_bp, url_prefix='/api/leaderboard')
        logger.info("✅ Registered leaderboard_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register leaderboard_bp: {e}")

    try:
        app.register_blueprint(voice_bp, url_prefix='/api/voice')
        logger.info("✅ Registered voice_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register voice_bp: {e}")

    try:
        app.register_blueprint(sync_history_bp, url_prefix='/api/sync-history')
        logger.info("✅ Registered sync_history_bp")
    except Exception as e:
        logger.error(f"❌ Failed to register sync_history_bp: {e}")

    # Debug: Print URL map
    logger.info("🔍 DEBUG: URL Map after blueprint registration:")
    for rule in app.url_map.iter_rules():
        logger.info(f"  {rule.rule} -> {rule.endpoint}")

    # Global request middleware - OPTIMIZED
    @app.before_request
    def before_request():
        """Global request preprocessing - skip for OPTIONS and static files"""
        # Skip processing for OPTIONS (handled by handle_preflight) and static files
        if request.method == 'OPTIONS':
            return  # Already handled by handle_preflight
        
        if request.path.startswith('/static/') or request.path in ['/health', '/favicon.ico']:
            return  # Skip logging for static/health endpoints
        
        g.request_start_time = datetime.now(UTC)
        g.request_id = os.urandom(8).hex()

        # Only log non-health requests to reduce noise
        if not request.path.startswith('/health'):
            logger.info(f"Request: {request.method} {request.path} from {get_remote_address()}")

        # Sanitize request data only for POST/PUT/PATCH with body
        if request.method in ['POST', 'PUT', 'PATCH'] and request.content_length:
            try:
                from src.utils.input_sanitization import sanitize_request
                sanitize_request()
            except Exception as e:
                logger.error(f"Request sanitization failed: {e}")

    # Health check endpoint
    @app.route('/health')
    def health_check():
        """Health check endpoint"""
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now(UTC).isoformat(),
            'version': os.getenv('API_VERSION', '1.0.0'),
            'environment': os.getenv('FLASK_ENV', 'development')
        })

    # Root endpoint
    @app.route('/')
    def root():
        """Root endpoint"""
        return jsonify({
            'message': 'Lugn & Trygg API',
            'version': os.getenv('API_VERSION', '1.0.0'),
            'documentation': '/api/docs',
            'health': '/health'
        })

    # Test integration endpoint
    @app.route('/api/integration/test-direct')
    def test_integration_direct():
        """Direct test endpoint"""
        return jsonify({'message': 'Direct integration test works!'}), 200

    # CRITICAL: Explicit catch-all OPTIONS handler for CORS preflight
    # This ensures X-CSRF-Token is ALWAYS in Access-Control-Allow-Headers
    @app.route('/api/<path:path>', methods=['OPTIONS'])
    @app.route('/api', methods=['OPTIONS'], defaults={'path': ''})
    def handle_options_preflight(path):
        """Handle ALL OPTIONS preflight requests with proper CORS headers"""
        from flask import Response
        response = Response('', status=204)
        origin = request.headers.get('Origin', '')
        
        # Allow all localhost origins + configured production origins
        if origin.startswith('http://localhost:') or origin.startswith('http://127.0.0.1:') or origin.startswith('http://192.168.') or is_origin_allowed(origin):
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