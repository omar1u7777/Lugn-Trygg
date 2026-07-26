"""Process-lifecycle management for background services.

WHY THIS MODULE EXISTS
----------------------
Under Gunicorn with preload_app=True, main.py's module-level code executes in
the ARBITER (master) before fork. Threads started there never exist in the
forked workers, and any Firestore gRPC traffic issued pre-fork makes the
inherited channel fork-unsafe (random worker hangs on first RPC).

The correct topology, implemented here:

- The ARBITER stays completely passive: no background threads, no Firestore
  RPCs. gunicorn_config.py sets GUNICORN_MANAGED=true at config load, and
  every import-time side effect (warmup, seeding, schedulers) checks it.
- Each WORKER bootstraps itself via the post_worker_init hook →
  run_worker_bootstrap(): per-process Firestore warmup, one-off seeding
  guarded by a distributed periodic claim, then the background services.
- Non-Gunicorn entrypoints (python main.py, waitress) call
  start_background_services("inline") directly — same behavior as before.

Every start is idempotent and suppressed in test environments so the 5s
crisis-queue poll loop can never leak into a pytest session.
"""

import logging
import os
import sys

logger = logging.getLogger(__name__)

_services_started = False


def is_test_environment() -> bool:
    """True in any pytest/CI-test context — background threads must not start."""
    return (
        os.getenv("TESTING", "").lower() == "true"
        or os.getenv("FLASK_TESTING", "").lower() == "true"
        or "PYTEST_CURRENT_TEST" in os.environ
        or "pytest" in sys.modules
    )


def is_gunicorn_managed() -> bool:
    """True when running under the Gunicorn config (gunicorn_config.py sets it)."""
    return os.getenv("GUNICORN_MANAGED", "").lower() == "true"


def start_background_services(context: str) -> list[str]:
    """Start all long-running background services for THIS process.

    Idempotent per process. Returns the list of services started.
    """
    global _services_started
    if is_test_environment():
        logger.info("Background services suppressed in test environment (context=%s)", context)
        return []
    if _services_started:
        return []
    _services_started = True

    started: list[str] = []

    try:
        from src.services.insight_scheduler import start_proactive_insights
        start_proactive_insights()
        started.append("insight_scheduler")
    except Exception as e:
        logger.error("Failed to start insight scheduler (%s): %s", context, e)

    try:
        from src.services.crisis_task_queue import start_crisis_task_worker
        start_crisis_task_worker()
        started.append("crisis_task_worker")
    except Exception as e:
        # Crisis consumer failing to start is operator-actionable: tasks would
        # queue with nobody consuming them.
        try:
            from src.utils.telemetry import telemetry
            telemetry.critical(
                "crisis_worker_start_failed",
                "Crisis task worker failed to start in this process",
                context=context,
                error=str(e),
            )
        except Exception:
            logger.critical("Crisis task worker failed to start (%s): %s", context, e)

    logger.info("✅ Background services started (context=%s): %s", context, started)
    return started


def run_worker_bootstrap(worker_pid: int | None = None) -> None:
    """Per-worker bootstrap, called from Gunicorn's post_worker_init hook.

    Runs INSIDE the forked worker process, after the (preloaded) app has been
    inherited. Everything Firestore-touching that used to run at import time
    in the arbiter happens here instead, per process.
    """
    if is_test_environment():
        return

    # 1. Per-process Firestore warmup — first RPC creates THIS process's own
    #    gRPC channel (the arbiter never issued one, so nothing fork-tainted
    #    is inherited).
    try:
        from src.firebase_config import warmup_firestore
        warmup_firestore()
    except Exception as e:
        logger.warning("Worker %s Firestore warmup failed: %s", worker_pid, e)

    # 2. One-off data seeding, claimed by exactly one worker per 6h window so
    #    N workers don't all replay it on every deploy.
    try:
        from src.services.distributed_lock import FirestoreLeaseLock
        if FirestoreLeaseLock("challenges_seed").try_claim_period(6 * 3600):
            from src.routes.challenges_routes import init_challenges_defaults
            init_challenges_defaults()
            logger.info("Worker %s seeded challenge defaults", worker_pid)
    except Exception as e:
        logger.warning("Worker %s challenge seeding failed (non-critical): %s", worker_pid, e)

    # 3. Long-running consumers — every worker runs them; the crisis queue's
    #    transactional claims and the schedulers' distributed locks make N
    #    concurrent instances safe, and worker recycling gets automatic
    #    replacement consumers.
    start_background_services(context=f"gunicorn-worker-{worker_pid}")
