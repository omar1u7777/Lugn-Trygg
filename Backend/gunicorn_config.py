import multiprocessing
import os

# Signal to the app (imported AFTER this config file) that Gunicorn manages
# the process lifecycle: import-time side effects that touch Firestore or
# spawn threads must be suppressed in the arbiter and run per-worker via the
# post_worker_init hook instead. See src/services/background_services.py.
os.environ.setdefault("GUNICORN_MANAGED", "true")

# PROMETHEUS_MULTIPROC_DIR (render.yaml) tells prometheus_client where to put
# its per-worker mmap files, but nothing creates that directory — Render
# containers are ephemeral, so it never pre-exists on a fresh deploy. Without
# it, the FIRST label-less Prometheus metric constructed at import time in
# src/routes/metrics_routes.py raises FileNotFoundError, main.py's top-level
# import re-raises, and the whole process dies before Gunicorn can bind a
# socket — a total outage. Must run here (before Gunicorn imports main:app),
# not inside the app itself, since preload_app=True means the arbiter's
# import happens immediately after this file is loaded.
_prometheus_dir = os.environ.get("PROMETHEUS_MULTIPROC_DIR")
if _prometheus_dir:
    os.makedirs(_prometheus_dir, exist_ok=True)

# Gunicorn PRODUCTION configuration
bind = f"0.0.0.0:{os.environ.get('PORT', 5001)}"

# Worker configuration.
# GUNICORN_WORKERS env var takes precedence so each deployment tier can tune this:
#   Render Starter (512 MB)  → GUNICORN_WORKERS=1 (render.yaml's current value —
#     chosen because 2 workers' combined RSS on this tier was never
#     load-tested and preload_app's copy-on-write sharing degrades quickly
#     under CPython refcounting; an OOM kill is a worse failure mode for a
#     crisis-support service than 1 worker's brief, graceful capacity dip
#     during a max_requests recycle. Raise to 2 only after confirming real
#     memory headroom on this plan.)
#   Render Standard (2 GB)   → GUNICORN_WORKERS=3
#   Large / self-hosted      → GUNICORN_WORKERS=<(2×cores)+1>
# Fallback formula: (2×cores)+1 capped at 9 (used when the env var is not set).
_default_workers = min(max(2, multiprocessing.cpu_count() * 2 + 1), 9)
workers = int(os.environ.get("GUNICORN_WORKERS", _default_workers))
# Switched from gevent to gthread — gevent's monkey.patch_all() cannot
# properly patch ssl when aiohttp/urllib3/jwt already imported it in the
# arbiter before forking.  gthread uses native threads with no patching.
worker_class = "gthread"
# gthread threads are cheap for I/O-bound work (SSE streams, OpenAI calls,
# Firestore RPCs all park the thread on I/O). The old default of 2 threads
# meant 2 workers × 2 threads = 4 concurrent requests for the whole service —
# a handful of 120s chat streams starved /health and triggered restart loops.
threads = int(os.environ.get("GUNICORN_THREADS", 8))  # Threads per worker

# Timeout settings — 120s matches the backend SSE streaming timeout.
# With timeout=60, gunicorn would kill streaming workers before the
# backend's own 120s timeout fires, causing "Step is still running" hangs.
timeout = 120
# graceful_timeout must cover the full SSE stream budget (120s): with the old
# 30s, every max_requests worker recycle killed in-flight streams mid-response.
graceful_timeout = 120
keepalive = 10  # Increased keepalive for better connection reuse

# Request handling - prevent memory leaks and optimize performance
#
# MEASURED, 2026-08-15, production, one instance, zero user traffic:
# the worker recycles every 71:55–74:54, eleven times across the day. That
# regularity is the answer to "is this an OOM kill?" — it is not. An OOM kill
# tracks memory growth and lands irregularly; this tracks a request counter.
# 1000 requests over ~73 min is one every 4.4 s, which is Render's health
# check, and the ±1.5 min spread is exactly what max_requests_jitter=50 buys
# at that rate.
#
# So the recycle is working as designed. What it also does is hide something:
# RSS climbs from ~270 MB to ~385 MB between recycles, against a 512 MB limit,
# with nobody using the app. Roughly 115 MB per 1000 health checks.
#
# Do NOT raise max_requests to "reduce restart churn" without first learning
# whether that growth plateaus. If it is linear, the recycle is the only thing
# standing between this instance and an OOM kill, and raising the number
# converts a graceful 5-second restart into an abrupt one that drops in-flight
# SSE streams. Find the growth first; the counter is the symptom's dressing,
# not the cure.
max_requests = 1000  # Restart worker after 1000 requests (more frequent for stability)
max_requests_jitter = 50  # Add randomness to avoid all workers restarting at once

# Performance optimizations
preload_app = True  # Master loads app once, workers share via copy-on-write (saves ~150MB on Starter)
reuse_port = True  # Enable SO_REUSEPORT for better load distribution
backlog = 2048  # Increased backlog for high concurrency

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

def post_worker_init(worker):
    """Called in the WORKER process after it has initialized the application.

    This is where all background services actually start: with
    preload_app=True the arbiter imports the app but must stay passive
    (no threads, no Firestore RPCs — threads don't survive fork() and a
    pre-fork gRPC channel is fork-unsafe). Each worker bootstraps its own
    Firestore warmup, one-off seeding (distributed-lock guarded) and the
    insight/crisis background consumers here.
    """
    try:
        from src.services.background_services import run_worker_bootstrap
        run_worker_bootstrap(worker_pid=worker.pid)
    except Exception as e:
        worker.log.error(f"Worker {worker.pid} background bootstrap failed: {e}")

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    pass

def pre_exec(server):
    """Called just before a new master process is forked."""
    server.log.info("Forking new master process")

def child_exit(server, worker):
    """Called just after a worker has been exited.

    Also does Prometheus multiprocess cleanup: marks the exited worker's
    metric files dead so aggregated /metrics stops counting it (only active
    when PROMETHEUS_MULTIPROC_DIR is configured). NOTE: this function name is
    a fixed Gunicorn hook — do not add a second def child_exit anywhere in
    this file, Python silently keeps only the last definition.
    """
    server.log.info(f"Worker {worker.pid} exited")
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        try:
            from prometheus_client import multiprocess
            multiprocess.mark_process_dead(worker.pid)
        except Exception:
            pass

# How long worker_exit waits for a running retention sweep to checkpoint. One
# user takes ~0.8 s and every Firestore call in it runs on a 30 s deadline, so
# 45 s covers the worst single user. It must stay well under `timeout`: once
# the serving loop has returned the worker no longer heartbeats, and the
# arbiter SIGKILLs it after `timeout` seconds of silence.
RETENTION_STOP_GRACE_SECONDS = 45


def worker_exit(server, worker):
    """Called in the worker just before it exits — max_requests recycle,
    SIGTERM from a deploy, or SIGQUIT.

    Lets the retention sweep stop at a user boundary instead of dying with the
    process. Without this every recycle that landed during the 3 AM sweep
    surfaced in Sentry as data_retention_interrupted at level=fatal.
    """
    import sys
    # Looked up rather than imported: if this worker never loaded the module,
    # no sweep can be running in it, and importing it here would pull in the
    # Firestore client on the way out.
    retention = sys.modules.get("src.services.data_retention_service")
    if retention is None:
        return
    try:
        if not retention.request_sweep_stop(RETENTION_STOP_GRACE_SECONDS):
            worker.log.warning(
                f"Worker {worker.pid}: retention sweep still running after "
                f"{RETENTION_STOP_GRACE_SECONDS}s; exiting anyway"
            )
    except Exception as e:
        worker.log.error(f"Worker {worker.pid}: retention stop request failed: {e}")


def worker_abort(worker):
    """Called when a worker times out."""
    worker.log.warning(f"⚠️ Worker {worker.pid} timeout - aborting")

# Production optimizations
raw_env = [
    "FLASK_ENV=production",
    "FLASK_DEBUG=False",
]
