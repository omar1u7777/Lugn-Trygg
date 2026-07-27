"""Durable crisis-escalation task queue backed by Firestore.

Why this exists
---------------
Crisis escalation used to run on a fire-and-forget daemon thread with local
time.sleep backoff. A worker recycle, OOM kill, or rolling deploy killed the
thread mid-retry and the alert was PERMANENTLY lost — while the client had
already been told `escalated: true`. For a mental-health product that is an
unacceptable failure mode.

Model
-----
- The request handler calls `enqueue_crisis_escalation(alert)`, which writes an
  atomic `status: "pending"` task document to `/crisis_tasks` INSIDE the active
  request context, before the response is sent. Once that write succeeds the
  alert survives any process death.
- `CrisisTaskWorker` runs in EVERY Gunicorn worker (deliberately: more workers
  = faster pickup and automatic failover; no leader election needed) and claims
  tasks with an atomic Firestore transaction, so exactly one worker executes a
  given task even with N concurrent consumers.
- Failed executions are re-scheduled with exponential backoff up to
  MAX_ATTEMPTS, then marked `status: "failed"` with a telemetry CRITICAL so
  operators must act. Stale `processing` tasks (worker died mid-execution) are
  reclaimed after their lease expires.

Task document schema (/crisis_tasks/{auto-id}):
    status:            pending | processing | completed | failed
    user_id, risk_level, risk_score, detected_indicators, text_snippet,
    alert_timestamp, requires_immediate_action   — CrisisAlert payload
    attempts:          int, incremented on claim
    next_attempt_at:   datetime, backoff gate for pending tasks
    lease_expires_at:  datetime, claim lease for processing tasks
    worker_id:         str, diagnostics
    last_error:        str | None
    created_at / completed_at / failed_at: datetime
    channels_used:     list[str] on success
"""

import asyncio
import logging
import os
import sys
import threading
import time
from datetime import UTC, datetime, timedelta
from typing import Any

from src.utils.telemetry import telemetry

logger = logging.getLogger(__name__)

CRISIS_TASK_COLLECTION = "crisis_tasks"
MAX_ATTEMPTS = 5
BASE_RETRY_DELAY_SECONDS = 2.0
CLAIM_LEASE_SECONDS = 120
# Must stay comfortably under CLAIM_LEASE_SECONDS: the escalation call needs
# to finish (and this worker still finalize) well before another worker's
# stale-lease reclaim kicks in, or two workers can execute the same task
# concurrently and race on finalization.
EXECUTION_TIMEOUT_SECONDS = 90
POLL_INTERVAL_SECONDS = 5.0
# Range queries return earliest-due first, so this is a throughput cap per
# cycle, not a correctness bound — the most-overdue crisis task is always in
# the batch regardless of backlog depth.
CANDIDATE_BATCH_SIZE = 50


class CrisisQueueUnavailableError(RuntimeError):
    """Raised when the durable queue cannot accept a crisis task."""


def _get_db():
    """Late-bound Firestore client lookup."""
    from src import firebase_config
    return firebase_config.db


def _worker_identity() -> str:
    import socket
    return f"{socket.gethostname()}:{os.getpid()}"


# ---------------------------------------------------------------------------
# Producer — called inside the request context
# ---------------------------------------------------------------------------

def enqueue_crisis_escalation(alert: Any) -> str:
    """Persist a crisis escalation task BEFORE the HTTP response is sent.

    Args:
        alert: src.services.crisis_escalation.CrisisAlert

    Returns:
        The Firestore task document id.

    Raises:
        CrisisQueueUnavailableError: when Firestore is unavailable — callers
        MUST surface this as a non-escalated state, never claim success.
    """
    db = _get_db()
    if db is None:
        telemetry.critical(
            "crisis_queue_unavailable",
            "Firestore unavailable — crisis escalation could NOT be queued",
            user_id=getattr(alert, "user_id", "unknown"),
            risk_level=getattr(alert, "risk_level", "unknown"),
        )
        raise CrisisQueueUnavailableError("Firestore unavailable; crisis task not queued")

    now = datetime.now(UTC)
    task_doc = {
        "status": "pending",
        "user_id": alert.user_id,
        "risk_level": alert.risk_level,
        "risk_score": float(alert.risk_score),
        "detected_indicators": list(alert.detected_indicators or []),
        "text_snippet": alert.text_snippet,
        "alert_timestamp": alert.timestamp,
        "requires_immediate_action": bool(alert.requires_immediate_action),
        "attempts": 0,
        "next_attempt_at": now,
        "lease_expires_at": None,
        "worker_id": None,
        "last_error": None,
        "created_at": now,
        "completed_at": None,
        "failed_at": None,
        "channels_used": [],
    }

    doc_ref = db.collection(CRISIS_TASK_COLLECTION).document()
    doc_ref.set(task_doc)
    telemetry.event(
        "crisis_task_enqueued",
        "Crisis escalation task persisted to durable queue",
        task_id=doc_ref.id,
        user_id=alert.user_id,
        risk_level=alert.risk_level,
    )
    return doc_ref.id


# ---------------------------------------------------------------------------
# Consumer — transaction-safe claim + execute + finalize
# ---------------------------------------------------------------------------

class CrisisTaskWorker:
    """Durable retry worker for crisis escalation tasks."""

    def __init__(self):
        self.worker_id = _worker_identity()
        self.is_running = False
        self._thread: threading.Thread | None = None

    # -- lifecycle ---------------------------------------------------------

    def start(self) -> None:
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(
            target=self._run_loop, name="crisis-task-worker", daemon=True
        )
        self._thread.start()
        logger.info("🚑 Crisis task worker started (worker_id=%s)", self.worker_id)

    def stop(self) -> None:
        self.is_running = False
        if self._thread:
            self._thread.join(timeout=5)

    def _run_loop(self) -> None:
        while self.is_running:
            try:
                # When Firestore is unavailable there is nothing to consume and
                # no way for tasks to arrive — back off hard instead of hot-
                # spinning a query→exception loop every POLL_INTERVAL_SECONDS.
                if _get_db() is None:
                    time.sleep(POLL_INTERVAL_SECONDS * 12)
                    continue
                processed = self.process_due_tasks()
                # Busy queue → poll again immediately; idle → back off.
                if processed == 0:
                    time.sleep(POLL_INTERVAL_SECONDS)
            except Exception as loop_err:
                logger.exception("Crisis task worker loop error: %s", loop_err)
                time.sleep(POLL_INTERVAL_SECONDS)

    # -- core --------------------------------------------------------------

    def process_due_tasks(self) -> int:
        """Claim and execute all currently due tasks. Returns count executed."""
        db = _get_db()
        if db is None:
            return 0

        executed = 0
        for doc_id in self._find_candidates(db):
            claim = self._claim_task(db, doc_id)
            if claim is None:
                continue  # another worker won the claim, or task became stale
            self._execute_task(db, doc_id, claim)
            executed += 1
        return executed

    def _find_candidates(self, db) -> list[str]:
        """Fetch claimable task ids: due pending tasks + expired processing leases.

        Uses single-field RANGE queries (auto-indexed by Firestore — no
        composite index required) so results are returned ordered by the range
        field. That ordering guarantees the MOST-OVERDUE task is always in the
        batch: an equality-filter + limit() with no ordering could otherwise
        return the same arbitrary N never-due docs every cycle and permanently
        starve an overdue crisis task — unacceptable on this path.

        Terminal tasks clear next_attempt_at / lease_expires_at to None on
        finalize, and Firestore range filters exclude null-valued fields, so
        completed/failed tasks never appear in these queries.
        """
        now = datetime.now(UTC)
        candidates: list[str] = []

        def _range_query(field: str):
            try:
                from google.cloud.firestore import FieldFilter
                return db.collection(CRISIS_TASK_COLLECTION).where(
                    filter=FieldFilter(field, "<=", now)
                ).limit(CANDIDATE_BATCH_SIZE)
            except ImportError:
                return db.collection(CRISIS_TASK_COLLECTION).where(
                    field, "<=", now
                ).limit(CANDIDATE_BATCH_SIZE)

        try:
            # Due pending tasks — ordered earliest-due first by the range field.
            for snap in _range_query("next_attempt_at").stream():
                data = snap.to_dict() or {}
                if data.get("status") == "pending":
                    candidates.append(snap.id)

            # Stale processing leases (worker died mid-execution → reclaimable).
            for snap in _range_query("lease_expires_at").stream():
                data = snap.to_dict() or {}
                if data.get("status") == "processing":
                    candidates.append(snap.id)
        except Exception as query_err:
            logger.warning("Crisis task candidate query failed: %s", query_err)

        return candidates

    def _claim_task(self, db, doc_id: str) -> dict[str, Any] | None:
        """Atomically transition a claimable task to `processing`.

        Returns the task payload when THIS worker won the claim, else None.
        """
        try:
            from google.cloud import firestore as gcf

            doc_ref = db.collection(CRISIS_TASK_COLLECTION).document(doc_id)
            transaction = db.transaction()
            worker_id = self.worker_id

            @gcf.transactional
            def _txn_claim(txn) -> dict[str, Any] | None:
                snapshot = doc_ref.get(transaction=txn)
                if not snapshot.exists:
                    return None
                data = snapshot.to_dict() or {}
                now = datetime.now(UTC)
                status = data.get("status")

                due_pending = (
                    status == "pending"
                    and (data.get("next_attempt_at") is None or data["next_attempt_at"] <= now)
                )
                stale_processing = (
                    status == "processing"
                    and data.get("lease_expires_at") is not None
                    and data["lease_expires_at"] <= now
                )
                if not (due_pending or stale_processing):
                    return None

                attempts = int(data.get("attempts", 0)) + 1
                txn.update(doc_ref, {
                    "status": "processing",
                    "attempts": attempts,
                    "lease_expires_at": now + timedelta(seconds=CLAIM_LEASE_SECONDS),
                    "worker_id": worker_id,
                })
                data["attempts"] = attempts
                return data

            return _txn_claim(transaction)
        except Exception as claim_err:
            logger.warning("Crisis task claim failed for %s: %s", doc_id, claim_err)
            return None

    def _execute_task(self, db, doc_id: str, task: dict[str, Any]) -> None:
        """Run one escalation attempt and finalize the task state."""
        from src.services.crisis_escalation import CrisisAlert, get_crisis_escalation_service

        alert = CrisisAlert(
            user_id=task["user_id"],
            risk_level=task["risk_level"],
            risk_score=task.get("risk_score", 0.0),
            detected_indicators=list(task.get("detected_indicators") or []),
            text_snippet=task.get("text_snippet", ""),
            timestamp=task.get("alert_timestamp") or datetime.now(UTC),
            requires_immediate_action=bool(task.get("requires_immediate_action")),
        )

        attempts = int(task.get("attempts", 1))

        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            escalation_service = get_crisis_escalation_service()
            # BUG FIX: previously unbounded — a stalled Twilio/SendGrid/FCM
            # HTTP call could run past CLAIM_LEASE_SECONDS, at which point a
            # second worker's stale-lease reclaim would claim and execute the
            # SAME task while this call was still in flight, risking duplicate
            # notifications and a finalize race (see the lease check below).
            result = loop.run_until_complete(
                asyncio.wait_for(escalation_service.escalate(alert), timeout=EXECUTION_TIMEOUT_SECONDS)
            )
            success = bool(getattr(result, "success", False))
            channels = [c.value for c in getattr(result, "channels_used", [])]
            failure_summary = (
                f"{len(getattr(result, 'failures', []))} channel(s) failed"
                if not success else None
            )
        except TimeoutError:
            success = False
            channels = []
            failure_summary = f"escalation timed out after {EXECUTION_TIMEOUT_SECONDS}s"
            logger.error(
                "Crisis escalation attempt %d/%d TIMED OUT for task %s after %ds",
                attempts, MAX_ATTEMPTS, doc_id, EXECUTION_TIMEOUT_SECONDS,
            )
        except Exception as exec_err:
            success = False
            channels = []
            failure_summary = str(exec_err)
            logger.exception(
                "Crisis escalation attempt %d/%d raised for task %s: %s",
                attempts, MAX_ATTEMPTS, doc_id, exec_err,
            )
        finally:
            try:
                loop.close()
            except Exception:
                pass

        now = datetime.now(UTC)
        if success:
            update_payload = {
                "status": "completed",
                "completed_at": now,
                "lease_expires_at": None,
                # Clear so the terminal task drops out of the due-tasks
                # range query (Firestore excludes null-valued fields).
                "next_attempt_at": None,
                "last_error": None,
                "channels_used": channels,
            }
        elif attempts >= MAX_ATTEMPTS:
            update_payload = {
                "status": "failed",
                "failed_at": now,
                "lease_expires_at": None,
                # Clear so the failed task drops out of the due-tasks query;
                # the crisis_escalation_exhausted CRITICAL is the ops signal.
                "next_attempt_at": None,
                "last_error": failure_summary,
            }
        else:
            backoff = BASE_RETRY_DELAY_SECONDS * (2 ** (attempts - 1))
            update_payload = {
                "status": "pending",
                "next_attempt_at": now + timedelta(seconds=backoff),
                "lease_expires_at": None,
                "last_error": failure_summary,
            }

        try:
            # BUG FIX: finalization used to be an unconditional doc_ref.update()
            # with no ownership check. If this execution ran past its lease
            # (see EXECUTION_TIMEOUT_SECONDS above — this is the backstop for
            # any remaining edge case, e.g. clock skew), a second worker's
            # stale-lease reclaim could have already claimed and finalized the
            # SAME task; this worker's late write would then silently
            # overwrite a legitimate 'completed' back to 'pending'/'failed',
            # causing duplicate notifications and/or a spurious exhaustion
            # alert for a task that actually delivered. Guard the write behind
            # a transaction that only commits if THIS worker still owns the
            # lease (worker_id + status == 'processing' unchanged).
            still_owned = self._finalize_if_still_owned(db, doc_id, self.worker_id, update_payload)
            if not still_owned:
                logger.warning(
                    "Crisis task %s was reclaimed by another worker before this "
                    "worker (%s) could finalize it — skipping write to avoid "
                    "clobbering the other worker's result.",
                    doc_id, self.worker_id,
                )
                return
        except Exception as finalize_err:
            # The claim lease will expire and another worker will re-run the
            # task — at-least-once delivery is preserved even here.
            logger.exception(
                "Failed to finalize crisis task %s state: %s", doc_id, finalize_err
            )
            return

        if success:
            telemetry.event(
                "crisis_task_completed",
                "Crisis escalation delivered",
                task_id=doc_id,
                user_id=alert.user_id,
                attempts=attempts,
                channels=channels,
            )
        elif attempts >= MAX_ATTEMPTS:
            telemetry.critical(
                "crisis_escalation_exhausted",
                "Crisis escalation FAILED after max attempts — REQUIRES MANUAL REVIEW",
                task_id=doc_id,
                user_id=alert.user_id,
                risk_level=alert.risk_level,
                attempts=attempts,
                last_error=failure_summary,
            )
        else:
            logger.warning(
                "Crisis task %s attempt %d/%d failed (%s); retrying",
                doc_id, attempts, MAX_ATTEMPTS, failure_summary,
            )

    @staticmethod
    def _finalize_if_still_owned(db, doc_id: str, worker_id: str, update_payload: dict[str, Any]) -> bool:
        """Commit `update_payload` only if this worker still owns the task's
        processing lease. Returns False (no write performed) if another
        worker has already reclaimed/finalized it in the meantime."""
        from google.cloud import firestore as gcf

        doc_ref = db.collection(CRISIS_TASK_COLLECTION).document(doc_id)
        transaction = db.transaction()

        @gcf.transactional
        def _txn_finalize(txn) -> bool:
            snapshot = doc_ref.get(transaction=txn)
            if not snapshot.exists:
                return False
            data = snapshot.to_dict() or {}
            if data.get("status") != "processing" or data.get("worker_id") != worker_id:
                return False
            txn.update(doc_ref, update_payload)
            return True

        return _txn_finalize(transaction)


# ---------------------------------------------------------------------------
# Singleton wiring
# ---------------------------------------------------------------------------

_worker_instance: CrisisTaskWorker | None = None
_worker_lock = threading.Lock()


def get_crisis_task_worker() -> CrisisTaskWorker:
    global _worker_instance
    with _worker_lock:
        if _worker_instance is None:
            _worker_instance = CrisisTaskWorker()
        return _worker_instance


def get_queue_health() -> dict[str, Any]:
    """Operational snapshot of the crisis task queue for monitoring.

    Returns counts by status plus the age of the oldest still-pending task.
    A large oldest-pending age means escalations are not being consumed — the
    single most important crisis-pipeline health signal. Emits a telemetry
    CRITICAL when the oldest pending task exceeds the alert threshold.
    """
    db = _get_db()
    health: dict[str, Any] = {
        "available": db is not None,
        "counts": {"pending": 0, "processing": 0, "failed": 0},
        "oldest_pending_age_seconds": 0,
    }
    if db is None:
        return health

    try:
        from google.cloud.firestore import FieldFilter

        def _count(status: str) -> int:
            try:
                q = db.collection(CRISIS_TASK_COLLECTION).where(
                    filter=FieldFilter("status", "==", status)
                ).count()
                result = q.get()
                try:
                    return int(result[0][0].value)
                except (IndexError, TypeError, AttributeError):
                    return int(result[0].value)
            except Exception:
                return 0

        for status in ("pending", "processing", "failed"):
            health["counts"][status] = _count(status)

        # Oldest pending task age query requires a composite index (status ASC,
        # created_at ASC — see firestore.indexes.json). Isolated in its own
        # try/except: if the index is missing/still building, a failure here
        # must NOT suppress the status counts above, and must be visible as
        # its own distinct warning rather than a swallowed backlog alert.
        try:
            oldest = (
                db.collection(CRISIS_TASK_COLLECTION)
                .where(filter=FieldFilter("status", "==", "pending"))
                .order_by("created_at")
                .limit(1)
                .stream()
            )
            now = datetime.now(UTC)
            for snap in oldest:
                created = (snap.to_dict() or {}).get("created_at")
                if isinstance(created, datetime):
                    health["oldest_pending_age_seconds"] = int((now - created).total_seconds())

            # Alert if the oldest pending task is older than 3x the max retry window.
            alert_threshold = MAX_ATTEMPTS * CLAIM_LEASE_SECONDS * 3
            if health["oldest_pending_age_seconds"] > alert_threshold:
                telemetry.critical(
                    "crisis_queue_backlog",
                    "Oldest pending crisis task exceeds alert threshold — consumer may be down",
                    oldest_pending_age_seconds=health["oldest_pending_age_seconds"],
                    pending=health["counts"]["pending"],
                )
        except Exception as oldest_err:
            logger.warning("Crisis queue oldest-pending query failed (composite "
                          "index missing/building?): %s", oldest_err)
            health["oldest_pending_query_error"] = str(oldest_err)
    except Exception as health_err:
        logger.warning("Crisis queue health check failed: %s", health_err)
        health["error"] = str(health_err)

    return health


def start_crisis_task_worker() -> None:
    """Start the durable crisis task consumer for this process.

    Intentionally runs in every Gunicorn worker: task claims are atomic, so
    concurrency is safe, and N consumers give faster pickup + failover.

    No-op under a test environment so the poll loop can never leak into a test
    session (defense in depth beyond main.py's own guard).
    """
    if (
        os.getenv('TESTING', '').lower() == 'true'
        or os.getenv('FLASK_TESTING', '').lower() == 'true'
        or 'PYTEST_CURRENT_TEST' in os.environ
        or 'pytest' in sys.modules
    ):
        logger.info("Crisis task worker suppressed in test environment")
        return
    get_crisis_task_worker().start()
