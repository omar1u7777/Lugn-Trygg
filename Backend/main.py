"""
Lugn & Trygg - Mental Health Platform Backend
Production-ready Flask application with comprehensive security and monitoring
"""

import os
import sys
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
import logging
from datetime import datetime

# Load environment variables
load_dotenv()

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

# Configuration
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
app.config['TESTING'] = os.getenv('FLASK_TESTING', 'False').lower() == 'true'

# CORS configuration
cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', 
    'http://localhost:3000,http://localhost:8081,http://localhost:19000,http://localhost:19001,'
    'https://lugn-trygg.vercel.app,https://lugn-trygg-cicqazfhh-omaralhaeks-projects.vercel.app,'
    'https://*.vercel.app'
)
cors_origins_list = [origin.strip() for origin in cors_origins.split(',') if origin.strip()]

# Support wildcard domains for Vercel preview deployments
if any('*' in origin for origin in cors_origins_list):
    # Flask-CORS doesn't support wildcards in list, use regex
    from flask_cors import CORS
    CORS(app, origins='*', supports_credentials=True)
    logger.warning("⚠️ CORS configured with wildcard - use specific origins in production!")
else:
    CORS(app, origins=cors_origins_list, supports_credentials=True)

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
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
    from src.routes.auth_routes import auth_bp
    from src.routes.mood_routes import mood_bp
    from src.routes.memory_routes import memory_bp
    from src.routes.ai_routes import ai_bp
    from src.routes.integration_routes import integration_bp
    from src.routes.subscription_routes import subscription_bp
    from src.routes.docs_routes import docs_bp
    from src.routes.metrics_routes import metrics_bp
    from src.routes.predictive_routes import predictive_bp
    from src.routes.rate_limit_routes import rate_limit_bp
    from src.routes.referral_routes import referral_bp
    from src.routes.chatbot_routes import chatbot_bp
    from src.routes.feedback_routes import feedback_bp

    # Initialize Firebase
    initialize_firebase()

    # Initialize middleware
    init_security_headers(app)
    init_validation_middleware(app)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(mood_bp, url_prefix='/api/mood')
    app.register_blueprint(memory_bp, url_prefix='/api/memory')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(integration_bp, url_prefix='/api/integration')
    app.register_blueprint(subscription_bp, url_prefix='/api/subscription')
    app.register_blueprint(docs_bp, url_prefix='/api/docs')
    app.register_blueprint(metrics_bp, url_prefix='/api/metrics')
    app.register_blueprint(predictive_bp, url_prefix='/api/predictive')
    app.register_blueprint(rate_limit_bp, url_prefix='/api/rate-limit')
    app.register_blueprint(referral_bp, url_prefix='/api/referral')
    app.register_blueprint(chatbot_bp, url_prefix='/api/chatbot')
    app.register_blueprint(feedback_bp, url_prefix='/api/feedback')

    # Global request middleware
    @app.before_request
    def before_request():
        """Global request preprocessing"""
        g.request_start_time = datetime.utcnow()
        g.request_id = os.urandom(8).hex()

        # Sanitize request data
        try:
            sanitize_request()
        except Exception as e:
            logger.warning(f"Request sanitization failed: {e}")

        # Log request
        logger.info(f"Request: {request.method} {request.path} from {get_remote_address()}")

    @app.after_request
    def after_request(response):
        """Global response postprocessing"""
        # Calculate request duration
        if hasattr(g, 'request_start_time'):
            duration = (datetime.utcnow() - g.request_start_time).total_seconds() * 1000
            response.headers['X-Response-Time'] = f"{duration:.2f}ms"

        # Add request ID
        if hasattr(g, 'request_id'):
            response.headers['X-Request-ID'] = g.request_id

        # Log response
        logger.info(f"Response: {response.status_code} in {response.headers.get('X-Response-Time', 'unknown')}")

        return response

    # Health check endpoint
    @app.route('/health')
    def health_check():
        """Health check endpoint"""
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
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
            start_key_rotation()
            backup_service.start_scheduler()
            monitoring_service.start_monitoring()
            logger.info("✅ All background services started")
        except Exception as e:
            logger.error(f"Failed to start background services: {e}")

    logger.info("🚀 Lugn & Trygg backend started successfully")
    logger.info(f"📊 Environment: {os.getenv('FLASK_ENV', 'development')}")
    logger.info(f"🔗 CORS Origins: {cors_origins_list}")
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
