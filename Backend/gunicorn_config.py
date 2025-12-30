import os
import multiprocessing

# Gunicorn PRODUCTION configuration optimized for 10k concurrent users
bind = f"0.0.0.0:{os.environ.get('PORT', 5001)}"

# Worker configuration - optimized for 10k users with performance improvements
# Formula: (2 x $num_cores) + 1 for balanced performance (reduced from 4x for stability)
workers = max(2, multiprocessing.cpu_count() * 2 + 1)  # Usually 9-17 workers for stability
worker_class = "gevent"  # Async worker for high concurrency
threads = 2  # Reduced threads per worker for better memory management
worker_connections = 5000  # Reduced from 10k for stability, still supports high concurrency

# Timeout settings - optimized for performance
timeout = 60  # Reduced from 120s for faster failure recovery
graceful_timeout = 30
keepalive = 10  # Increased keepalive for better connection reuse

# Request handling - prevent memory leaks and optimize performance
max_requests = 1000  # Restart worker after 1000 requests (more frequent for stability)
max_requests_jitter = 50  # Add randomness to avoid all workers restarting at once

# Performance optimizations
preload_app = True  # Load app before forking workers (faster startup)
reuse_port = True  # Enable SO_REUSEPORT for better load distribution
backlog = 2048  # Increased backlog for high concurrency

# Server optimization
preload_app = True  # Load app before forking workers (faster startup)

# Logging configuration
accesslog = "-"  # Log to stdout
errorlog = "-"  # Log to stderr
loglevel = "info"  # 'debug' for development, 'info' for production
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "lugn-trygg-production"

# Security
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190

# Server mechanics
daemon = False  # Don't daemonize (let Docker/systemd handle it)
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# Server hooks for monitoring
def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("🚀 Lugn & Trygg backend starting for 10k concurrent users...")

def when_ready(server):
    """Called just after the server is started."""
    server.log.info(f"✅ Server ready! Workers: {workers}, Bind: {bind}")

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info(f"Worker {worker.pid} spawned")

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    pass

def pre_exec(server):
    """Called just before a new master process is forked."""
    server.log.info("Forking new master process")

def child_exit(server, worker):
    """Called just after a worker has been exited."""
    server.log.info(f"Worker {worker.pid} exited")

def worker_abort(worker):
    """Called when a worker times out."""
    worker.log.warning(f"⚠️ Worker {worker.pid} timeout - aborting")

# Production optimizations
raw_env = [
    "FLASK_ENV=production",
    "FLASK_DEBUG=False",
]
