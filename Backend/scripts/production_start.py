#!/usr/bin/env python3
"""
Production-ready startup script for Lugn & Trygg Backend
Optimized for 1000+ concurrent users
"""
import os
import sys
import logging
from pathlib import Path
from gunicorn.app.base import BaseApplication

# Add Backend directory to path (one level up from scripts/)
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set production environment variables
os.environ['FLASK_ENV'] = 'production'
os.environ['FLASK_DEBUG'] = 'False'

# Configure production logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('logs/production.log')
    ]
)

logger = logging.getLogger(__name__)


class ProductionApplication(BaseApplication):
    """Custom Gunicorn application for production deployment"""
    
    def __init__(self, app, options=None):
        self.options = options or {}
        self.application = app
        super().__init__()
    
    def load_config(self):
        """Load Gunicorn configuration"""
        config = {
            # Server Socket
            'bind': f"{self.options.get('bind', '0.0.0.0:5001')}",
            
            # Worker Processes (2-4 x num_cores for I/O bound apps)
            'workers': self.options.get('workers', 4),
            'worker_class': 'sync',  # or 'gevent' for async
            'threads': self.options.get('threads', 4),
            
            # Worker Lifecycle
            'max_requests': 1000,  # Restart worker after N requests
            'max_requests_jitter': 50,
            'timeout': 60,  # Worker timeout
            'graceful_timeout': 30,
            'keepalive': 5,
            
            # Security
            'limit_request_line': 4096,
            'limit_request_fields': 100,
            'limit_request_field_size': 8190,
            
            # Logging
            'accesslog': 'logs/access.log',
            'errorlog': 'logs/error.log',
            'loglevel': 'info',
            'access_log_format': '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s',
            
            # Process Naming
            'proc_name': 'lugn_trygg_backend',
            
            # Server Mechanics
            'daemon': False,
            'pidfile': 'logs/gunicorn.pid',
            'preload_app': True,  # Load app before forking workers
        }
        
        for key, value in config.items():
            self.cfg.set(key.lower(), value)
    
    def load(self):
        """Return the application"""
        return self.application


def main():
    """Start production server with Gunicorn"""
    try:
        # Create logs directory
        os.makedirs('logs', exist_ok=True)
        
        # Import Flask app
        from main import app
        
        # Production configuration
        options = {
            'bind': os.getenv('HOST', '0.0.0.0') + ':' + os.getenv('PORT', '5001'),
            'workers': int(os.getenv('WORKERS', 4)),
            'threads': int(os.getenv('THREADS', 4)),
        }
        
        logger.info("🚀 Starting Lugn & Trygg Backend in PRODUCTION mode")
        logger.info(f"📍 Bind: {options['bind']}")
        logger.info(f"👷 Workers: {options['workers']} x {options['threads']} threads")
        logger.info(f"⚡ Max concurrent connections: ~{options['workers'] * options['threads'] * 100}")
        logger.info("=" * 60)
        
        # Start Gunicorn
        ProductionApplication(app, options).run()
        
    except KeyboardInterrupt:
        logger.info("\n👋 Shutting down gracefully...")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Failed to start production server: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
