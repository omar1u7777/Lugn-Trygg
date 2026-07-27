"""Firestore-backed distributed lock / lease engine.

Under multi-worker Gunicorn every process bootstraps the same background
schedulers. Without cross-process coordination each worker runs its own
scheduler instance → duplicate key rotations, duplicate backups, N× memory.

This module provides two primitives, both implemented as atomic Firestore
transactions on a single metadata document per lock
(collection `_distributed_locks`):

- `FirestoreLeaseLock.acquire()` — classic TTL lease (leader election).
  Exactly one owner at a time; calling acquire() as the current owner renews
  the lease. Siblings get False and must yield. If the leader dies, the lease
  expires after `ttl_seconds` and another worker takes over automatically.

- `FirestoreLeaseLock.try_claim_period(seconds)` — run-once-per-period claim
  for cron-style jobs (hourly rotation check, daily insight generation).
  The transaction refuses the claim if ANY worker already ran the job within
  the period, closing the "lease expired between cycles" duplicate window
  that plain leases have for periodic work.

Degraded mode: when Firestore is unavailable (local dev, unit tests) the lock
grants acquisition — a single-process environment needs no coordination — and
reports the degraded state through telemetry exactly once per lock.
"""

import logging
import os
import socket
import threading
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from src.utils.telemetry import telemetry

logger = logging.getLogger(__name__)

LOCK_COLLECTION = "_distributed_locks"


def _get_db():
    """Late-bound Firestore client lookup (survives late initialization)."""
    try:
        from src import firebase_config
        return firebase_config.db
    except Exception:
        return None


def _worker_identity() -> str:
    return f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"


class FirestoreLeaseLock:
    """TTL lease + periodic-claim primitives on one Firestore document."""

    def __init__(self, lock_name: str, ttl_seconds: int = 120):
        self.lock_name = lock_name
        self.ttl_seconds = ttl_seconds
        self.owner_id = _worker_identity()
        self._degraded_reported = False
        self._local_guard = threading.Lock()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _doc_ref(self, db):
        return db.collection(LOCK_COLLECTION).document(self.lock_name)

    def _report_degraded_once(self) -> None:
        if not self._degraded_reported:
            self._degraded_reported = True
            telemetry.degraded(
                feature="distributed_lock",
                reason="firestore_unavailable",
                lock=self.lock_name,
                consequence="single-process mode; no cross-worker coordination",
            )

    # ------------------------------------------------------------------
    # Lease API
    # ------------------------------------------------------------------

    def acquire(self) -> bool:
        """Atomically acquire (or renew, if already owner) the TTL lease.

        Returns True when this worker holds the lease after the call.
        """
        db = _get_db()
        if db is None:
            self._report_degraded_once()
            return True

        try:
            from google.cloud import firestore as gcf

            doc_ref = self._doc_ref(db)
            transaction = db.transaction()
            owner_id = self.owner_id
            ttl = self.ttl_seconds
            lock_name = self.lock_name

            @gcf.transactional
            def _txn_acquire(txn) -> bool:
                snapshot = doc_ref.get(transaction=txn)
                now = datetime.now(UTC)
                if snapshot.exists:
                    data = snapshot.to_dict() or {}
                    holder = data.get("owner")
                    expires_at = data.get("expires_at")
                    still_valid = expires_at is not None and expires_at > now
                    if holder != owner_id and still_valid:
                        return False  # sibling holds a live lease — yield
                txn.set(doc_ref, {
                    "owner": owner_id,
                    "lock_name": lock_name,
                    "acquired_at": now,
                    "expires_at": now + timedelta(seconds=ttl),
                    "heartbeat_at": now,
                }, merge=True)
                return True

            with self._local_guard:
                acquired = _txn_acquire(transaction)
            if acquired:
                logger.debug("Lease '%s' held by %s (ttl=%ss)", self.lock_name, self.owner_id, ttl)
            return acquired
        except Exception as lock_err:
            # Fail-safe policy: a broken lock service must not silently start
            # N schedulers. Log loudly and DENY, except when we've never seen
            # Firestore at all (degraded single-process mode handled above).
            telemetry.critical(
                "distributed_lock_error",
                f"Lease acquisition for '{self.lock_name}' failed; yielding this cycle",
                error=str(lock_err),
                owner=self.owner_id,
            )
            return False

    def release(self) -> None:
        """Release the lease if — and only if — this worker owns it."""
        db = _get_db()
        if db is None:
            return
        try:
            from google.cloud import firestore as gcf

            doc_ref = self._doc_ref(db)
            transaction = db.transaction()
            owner_id = self.owner_id

            @gcf.transactional
            def _txn_release(txn) -> None:
                snapshot = doc_ref.get(transaction=txn)
                if snapshot.exists and (snapshot.to_dict() or {}).get("owner") == owner_id:
                    txn.delete(doc_ref)

            with self._local_guard:
                _txn_release(transaction)
        except Exception as release_err:
            logger.warning("Lease release for '%s' failed: %s", self.lock_name, release_err)

    # ------------------------------------------------------------------
    # Periodic-claim API
    # ------------------------------------------------------------------

    def try_claim_period(self, period_seconds: int) -> bool:
        """Atomically claim the right to run a periodic job.

        Returns True for exactly one worker per `period_seconds` window,
        regardless of how many workers ask or when their cycles drift.
        """
        db = _get_db()
        if db is None:
            self._report_degraded_once()
            return True

        try:
            from google.cloud import firestore as gcf

            doc_ref = self._doc_ref(db)
            transaction = db.transaction()
            owner_id = self.owner_id
            lock_name = self.lock_name

            @gcf.transactional
            def _txn_claim(txn) -> bool:
                snapshot = doc_ref.get(transaction=txn)
                now = datetime.now(UTC)
                if snapshot.exists:
                    data = snapshot.to_dict() or {}
                    last_run_at = data.get("last_run_at")
                    if last_run_at is not None and (now - last_run_at).total_seconds() < period_seconds:
                        return False  # someone already ran this period
                txn.set(doc_ref, {
                    "owner": owner_id,
                    "lock_name": lock_name,
                    "last_run_at": now,
                    "period_seconds": period_seconds,
                }, merge=True)
                return True

            with self._local_guard:
                claimed = _txn_claim(transaction)
            if claimed:
                telemetry.event(
                    "periodic_claim",
                    f"Worker claimed periodic job '{self.lock_name}'",
                    owner=self.owner_id,
                    period_seconds=period_seconds,
                )
            return claimed
        except Exception as claim_err:
            telemetry.critical(
                "distributed_lock_error",
                f"Periodic claim for '{self.lock_name}' failed; yielding this cycle",
                error=str(claim_err),
                owner=self.owner_id,
            )
            return False

    def status(self) -> dict[str, Any]:
        """Read the current lock document (diagnostics)."""
        db = _get_db()
        if db is None:
            return {"available": False, "mode": "single-process"}
        try:
            snapshot = self._doc_ref(db).get()
            return {
                "available": True,
                "exists": snapshot.exists,
                "data": snapshot.to_dict() if snapshot.exists else None,
            }
        except Exception as status_err:
            return {"available": False, "error": str(status_err)}
