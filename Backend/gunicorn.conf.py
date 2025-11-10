"""
Gunicorn Configuration for Production
Optimized for 1000+ concurrent users
"""
import multiprocessing
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '5001')}"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 30
keepalive = 2

# Performance
preload_app = True
daemon = False

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# SSL (if needed)
# certfile = "/path/to/cert.pem"
# keyfile = "/path/to/key.pem"

def on_starting(server):
    """
    Called just before the master process is initialized.
    """
    server.log.info("🚀 Starting Lugn & Trygg production server...")

def when_ready(server):
    """
    Called just after the server is started.
    """
    server.log.info(f"✅ Server is ready. Listening on {bind}")
    server.log.info(f"👷 Workers: {workers}")

def on_reload(server):
    """
    Called to recycle workers during a reload via SIGHUP.
    """
    server.log.info("🔄 Reloading workers...")
