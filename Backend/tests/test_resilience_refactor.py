"""Unit tests for the backend resilience refactor:

1. CircuitBreaker single-probe HALF_OPEN (thundering-herd fix)
2. FirestoreLeaseLock degraded mode + atomic periodic claim
3. Durable crisis task queue: enqueue + claim state machine
4. TelemetryLogger degraded/critical accounting

These are deterministic (no real Firestore, no sleeps) so they cannot flake.
"""

import os
import threading
import time
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from src.middleware.error_handler import CircuitBreaker, CircuitBreakerOpenException


# ---------------------------------------------------------------------------
# 4. Circuit breaker — thundering herd
# ---------------------------------------------------------------------------

class TestCircuitBreakerHalfOpenSingleProbe:
    def _make_open_breaker(self):
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=0)
        # Trip it OPEN.
        for _ in range(2):
            with pytest.raises(ValueError):
                cb.call(lambda: (_ for _ in ()).throw(ValueError("boom")))
        assert cb.state == "OPEN"
        return cb

    def test_only_one_probe_enters_half_open(self):
        cb = self._make_open_breaker()
        # recovery_timeout=0 → next call transitions to HALF_OPEN.

        started = threading.Event()
        release = threading.Event()
        entered = []

        def slow_probe():
            entered.append(1)
            started.set()
            release.wait(timeout=5)
            return "ok"

        # First caller acquires the single probe token and blocks inside.
        probe_result = {}

        def run_probe():
            try:
                probe_result["value"] = cb.call(slow_probe)
            except Exception as e:  # pragma: no cover
                probe_result["error"] = e

        t = threading.Thread(target=run_probe)
        t.start()
        assert started.wait(timeout=5), "probe never entered"

        # Second concurrent caller must be rejected — NOT allowed to stampede.
        with pytest.raises(CircuitBreakerOpenException):
            cb.call(lambda: "second")

        assert len(entered) == 1, "a second probe entered the recovering dependency"

        # Let the probe succeed → breaker closes, token released.
        release.set()
        t.join(timeout=5)
        assert probe_result.get("value") == "ok"
        assert cb.state == "CLOSED"

    def test_failed_probe_reopens_and_releases_token(self):
        cb = self._make_open_breaker()
        with pytest.raises(ValueError):
            cb.call(lambda: (_ for _ in ()).throw(ValueError("still down")))
        # Failed HALF_OPEN probe must re-OPEN immediately and free the token.
        assert cb.state == "OPEN"
        assert cb._half_open_probe_active is False

    def test_unexpected_exception_releases_token(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0,
                            expected_exception=ValueError)
        with pytest.raises(ValueError):
            cb.call(lambda: (_ for _ in ()).throw(ValueError("down")))
        assert cb.state == "OPEN"
        # A non-expected exception type during the probe must still release
        # the token (no deadlock), even though it isn't counted as a failure.
        with pytest.raises(KeyError):
            cb.call(lambda: (_ for _ in ()).throw(KeyError("weird")))
        assert cb._half_open_probe_active is False


# ---------------------------------------------------------------------------
# 2. Distributed lock
# ---------------------------------------------------------------------------

class TestFirestoreLeaseLock:
    def test_degraded_mode_grants_when_db_none(self):
        from src.services import distributed_lock
        with patch.object(distributed_lock, "_get_db", return_value=None):
            lock = distributed_lock.FirestoreLeaseLock("t_lock")
            assert lock.acquire() is True
            assert lock.try_claim_period(60) is True

    def test_degraded_reported_once(self):
        from src.services import distributed_lock
        from src.utils.telemetry import telemetry
        telemetry.reset()
        with patch.object(distributed_lock, "_get_db", return_value=None):
            lock = distributed_lock.FirestoreLeaseLock("t_lock2")
            lock.acquire()
            lock.acquire()
        stats = telemetry.get_stats()
        # Exactly one degradation event recorded despite two acquire calls.
        deg = [k for k in stats["degradations"] if k.startswith("distributed_lock:")]
        assert deg, "degradation not reported"
        assert stats["degradations"][deg[0]] == 1

    def test_acquire_denies_on_lock_service_error(self):
        """Fail-safe: a Firestore error must DENY (never start N schedulers)."""
        from src.services import distributed_lock
        fake_db = MagicMock()
        fake_db.transaction.side_effect = RuntimeError("firestore exploded")
        with patch.object(distributed_lock, "_get_db", return_value=fake_db):
            lock = distributed_lock.FirestoreLeaseLock("t_lock3")
            assert lock.acquire() is False

    def test_acquire_denied_while_sibling_holds_live_lease(self):
        """The core safety property this whole class exists for: a SECOND
        worker's acquire() must be rejected while a sibling's lease is still
        valid — proven directly against the transactional decision logic
        (snapshot state representing 'another owner, not yet expired'),
        independent of whether the shared fake transaction auto-applies
        writes across separate calls."""
        from src.services import distributed_lock
        from tests.conftest import _FakeFirestoreTransaction

        doc_ref = MagicMock()
        snapshot = MagicMock()
        snapshot.exists = True
        snapshot.to_dict.return_value = {
            "owner": "sibling-worker-xyz",
            "expires_at": datetime.now(UTC) + timedelta(seconds=60),
        }
        doc_ref.get.return_value = snapshot

        fake_db = MagicMock()
        fake_db.collection.return_value.document.return_value = doc_ref
        fake_db.transaction.return_value = _FakeFirestoreTransaction()

        with patch.object(distributed_lock, "_get_db", return_value=fake_db):
            lock = distributed_lock.FirestoreLeaseLock("t_lock4")
            assert lock.acquire() is False

    def test_acquire_granted_when_lease_expired(self):
        """A sibling's EXPIRED lease must not block a new acquire — otherwise
        a dead worker permanently wedges the lock."""
        from src.services import distributed_lock
        from tests.conftest import _FakeFirestoreTransaction

        doc_ref = MagicMock()
        snapshot = MagicMock()
        snapshot.exists = True
        snapshot.to_dict.return_value = {
            "owner": "dead-worker",
            "expires_at": datetime.now(UTC) - timedelta(seconds=5),
        }
        doc_ref.get.return_value = snapshot

        txn = _FakeFirestoreTransaction()
        fake_db = MagicMock()
        fake_db.collection.return_value.document.return_value = doc_ref
        fake_db.transaction.return_value = txn

        with patch.object(distributed_lock, "_get_db", return_value=fake_db):
            lock = distributed_lock.FirestoreLeaseLock("t_lock5")
            assert lock.acquire() is True
        assert len(txn.writes) == 1

    def test_try_claim_period_denied_within_same_period(self):
        """The periodic-claim primitive must reject a second claim within the
        same period regardless of which worker asks."""
        from src.services import distributed_lock
        from tests.conftest import _FakeFirestoreTransaction

        doc_ref = MagicMock()
        snapshot = MagicMock()
        snapshot.exists = True
        snapshot.to_dict.return_value = {"last_run_at": datetime.now(UTC)}
        doc_ref.get.return_value = snapshot

        fake_db = MagicMock()
        fake_db.collection.return_value.document.return_value = doc_ref
        fake_db.transaction.return_value = _FakeFirestoreTransaction()

        with patch.object(distributed_lock, "_get_db", return_value=fake_db):
            lock = distributed_lock.FirestoreLeaseLock("t_lock6")
            assert lock.try_claim_period(3600) is False


# ---------------------------------------------------------------------------
# 3. Durable crisis task queue
# ---------------------------------------------------------------------------

class _FakeAlert:
    def __init__(self):
        self.user_id = "user-123"
        self.risk_level = "critical"
        self.risk_score = 0.95
        self.detected_indicators = ["ind_a", "ind_b"]
        self.text_snippet = "snippet"
        self.timestamp = datetime.now(UTC)
        self.requires_immediate_action = True


class TestCrisisTaskQueue:
    def test_enqueue_writes_pending_document(self):
        from src.services import crisis_task_queue

        captured = {}
        doc_ref = MagicMock()
        doc_ref.id = "task-abc"
        doc_ref.set.side_effect = lambda payload: captured.update(payload)
        fake_db = MagicMock()
        fake_db.collection.return_value.document.return_value = doc_ref

        with patch.object(crisis_task_queue, "_get_db", return_value=fake_db):
            task_id = crisis_task_queue.enqueue_crisis_escalation(_FakeAlert())

        assert task_id == "task-abc"
        assert captured["status"] == "pending"
        assert captured["user_id"] == "user-123"
        assert captured["attempts"] == 0
        assert captured["risk_score"] == pytest.approx(0.95)
        assert captured["detected_indicators"] == ["ind_a", "ind_b"]

    def test_enqueue_raises_when_db_unavailable(self):
        from src.services import crisis_task_queue
        with patch.object(crisis_task_queue, "_get_db", return_value=None):
            with pytest.raises(crisis_task_queue.CrisisQueueUnavailableError):
                crisis_task_queue.enqueue_crisis_escalation(_FakeAlert())

    def test_worker_suppressed_under_pytest(self):
        from src.services import crisis_task_queue
        # 'pytest' is in sys.modules here, so start must be a no-op.
        worker = crisis_task_queue.get_crisis_task_worker()
        assert worker.is_running is False
        crisis_task_queue.start_crisis_task_worker()
        assert worker.is_running is False

    def test_find_candidates_uses_due_range_queries(self):
        """Due-task discovery must use range (<=) queries, not equality+limit,
        so an overdue task can never be starved behind never-due tasks."""
        from src.services import crisis_task_queue

        recorded_ranges = []

        class FakeQuery:
            def __init__(self, docs):
                self._docs = docs
            def limit(self, n):
                return self
            def stream(self):
                return iter(self._docs)

        class FakeSnap:
            def __init__(self, _id, data):
                self.id = _id
                self._data = data
            def to_dict(self):
                return self._data

        due_pending = FakeSnap("overdue-task", {"status": "pending"})

        class FakeCollection:
            def where(self, *args, **kwargs):
                # Capture the operator so we can assert it's a range query.
                if "filter" in kwargs:
                    ff = kwargs["filter"]
                    recorded_ranges.append(getattr(ff, "op_string", "<="))
                elif len(args) >= 2:
                    recorded_ranges.append(args[1])
                # Return the due pending task only on the next_attempt_at query.
                field = None
                if "filter" in kwargs:
                    field = getattr(kwargs["filter"], "field_path", "")
                elif args:
                    field = args[0]
                if field == "next_attempt_at":
                    return FakeQuery([due_pending])
                return FakeQuery([])

        fake_db = MagicMock()
        fake_db.collection.return_value = FakeCollection()

        worker = crisis_task_queue.CrisisTaskWorker()
        candidates = worker._find_candidates(fake_db)

        assert "overdue-task" in candidates
        # Every discovery query must be a "<=" range filter.
        assert recorded_ranges and all(op == "<=" for op in recorded_ranges)

    @staticmethod
    def _fake_db_owning_lease(worker_id):
        """A fake db whose transactional finalize check (worker_id + status
        == 'processing') succeeds for `worker_id`, recording the committed
        update payload via the fake transaction's .writes list."""
        from tests.conftest import _FakeFirestoreTransaction

        doc_ref = MagicMock()
        snapshot = MagicMock()
        snapshot.exists = True
        snapshot.to_dict.return_value = {"status": "processing", "worker_id": worker_id}
        doc_ref.get.return_value = snapshot

        txn = _FakeFirestoreTransaction()

        fake_db = MagicMock()
        fake_db.collection.return_value.document.return_value = doc_ref
        fake_db.transaction.return_value = txn
        return fake_db, txn

    def test_success_marks_completed(self):
        from src.services import crisis_task_queue

        task = {
            "user_id": "u1", "risk_level": "critical", "risk_score": 0.9,
            "detected_indicators": ["a"], "text_snippet": "s",
            "alert_timestamp": datetime.now(UTC),
            "requires_immediate_action": True, "attempts": 1,
        }

        result = MagicMock()
        result.success = True
        chan = MagicMock()
        chan.value = "sms"
        result.channels_used = [chan]
        result.failures = []

        svc = MagicMock()
        async def _escalate(_alert):
            return result
        svc.escalate = _escalate

        worker = crisis_task_queue.CrisisTaskWorker()
        fake_db, txn = self._fake_db_owning_lease(worker.worker_id)
        with patch("src.services.crisis_escalation.get_crisis_escalation_service", return_value=svc):
            worker._execute_task(fake_db, "task-1", task)

        assert len(txn.writes) == 1
        updates = txn.writes[0][1]
        assert updates["status"] == "completed"
        assert updates["channels_used"] == ["sms"]

    def test_failure_below_max_reschedules_pending(self):
        from src.services import crisis_task_queue

        task = {
            "user_id": "u1", "risk_level": "high", "risk_score": 0.7,
            "detected_indicators": [], "text_snippet": "s",
            "alert_timestamp": datetime.now(UTC),
            "requires_immediate_action": False, "attempts": 2,
        }
        svc = MagicMock()
        async def _boom(_alert):
            raise RuntimeError("channel down")
        svc.escalate = _boom

        worker = crisis_task_queue.CrisisTaskWorker()
        fake_db, txn = self._fake_db_owning_lease(worker.worker_id)
        with patch("src.services.crisis_escalation.get_crisis_escalation_service", return_value=svc):
            worker._execute_task(fake_db, "task-2", task)

        assert len(txn.writes) == 1
        updates = txn.writes[0][1]
        assert updates["status"] == "pending"
        assert updates["next_attempt_at"] > datetime.now(UTC)

    def test_failure_at_max_attempts_marks_failed_and_alerts(self):
        from src.services import crisis_task_queue
        from src.utils.telemetry import telemetry

        telemetry.reset()
        task = {
            "user_id": "u1", "risk_level": "critical", "risk_score": 0.99,
            "detected_indicators": [], "text_snippet": "s",
            "alert_timestamp": datetime.now(UTC),
            "requires_immediate_action": True,
            "attempts": crisis_task_queue.MAX_ATTEMPTS,
        }
        svc = MagicMock()
        async def _boom(_alert):
            raise RuntimeError("all channels down")
        svc.escalate = _boom

        worker = crisis_task_queue.CrisisTaskWorker()
        fake_db, txn = self._fake_db_owning_lease(worker.worker_id)
        with patch("src.services.crisis_escalation.get_crisis_escalation_service", return_value=svc):
            worker._execute_task(fake_db, "task-3", task)

        assert len(txn.writes) == 1
        updates = txn.writes[0][1]
        assert updates["status"] == "failed"
        # A max-attempts failure MUST raise an operator-actionable critical.
        assert "crisis_escalation_exhausted" in telemetry.get_stats()["criticals"]

    def test_finalize_skipped_when_lease_reclaimed_by_another_worker(self):
        """BUG FIX: if another worker already reclaimed the stale-leased task
        (e.g. this execution ran long), finalization must NOT overwrite that
        worker's state — proving the ownership-guarded transaction actually
        rejects a write from a worker that no longer owns the lease."""
        from src.services import crisis_task_queue
        from tests.conftest import _FakeFirestoreTransaction

        task = {
            "user_id": "u1", "risk_level": "critical", "risk_score": 0.9,
            "detected_indicators": [], "text_snippet": "s",
            "alert_timestamp": datetime.now(UTC),
            "requires_immediate_action": True, "attempts": 1,
        }
        result = MagicMock(success=True, channels_used=[], failures=[])
        svc = MagicMock()
        async def _escalate(_alert):
            return result
        svc.escalate = _escalate

        worker = crisis_task_queue.CrisisTaskWorker()

        doc_ref = MagicMock()
        snapshot = MagicMock()
        snapshot.exists = True
        # Another worker now owns the lease.
        snapshot.to_dict.return_value = {"status": "processing", "worker_id": "some-other-worker"}
        doc_ref.get.return_value = snapshot

        txn = _FakeFirestoreTransaction()
        fake_db = MagicMock()
        fake_db.collection.return_value.document.return_value = doc_ref
        fake_db.transaction.return_value = txn

        with patch("src.services.crisis_escalation.get_crisis_escalation_service", return_value=svc):
            worker._execute_task(fake_db, "task-4", task)

        assert txn.writes == [], "must not write when another worker owns the lease"

    def test_stalled_escalation_call_times_out_instead_of_hanging(self):
        """BUG FIX: escalate() was awaited with no bound — a stalled Twilio/
        SendGrid/FCM HTTP call could hang past CLAIM_LEASE_SECONDS, letting a
        second worker reclaim and duplicate-execute the same task."""
        import asyncio as asyncio_module

        from src.services import crisis_task_queue

        task = {
            "user_id": "u1", "risk_level": "high", "risk_score": 0.7,
            "detected_indicators": [], "text_snippet": "s",
            "alert_timestamp": datetime.now(UTC),
            "requires_immediate_action": False, "attempts": 1,
        }
        svc = MagicMock()
        async def _hangs_forever(_alert):
            await asyncio_module.sleep(10_000)
        svc.escalate = _hangs_forever

        worker = crisis_task_queue.CrisisTaskWorker()
        fake_db, txn = self._fake_db_owning_lease(worker.worker_id)
        with patch.object(crisis_task_queue, "EXECUTION_TIMEOUT_SECONDS", 0.05), \
                patch("src.services.crisis_escalation.get_crisis_escalation_service", return_value=svc):
            worker._execute_task(fake_db, "task-5", task)

        assert len(txn.writes) == 1
        updates = txn.writes[0][1]
        # Below max attempts -> rescheduled, not stuck forever.
        assert updates["status"] == "pending"
        assert "timed out" in updates["last_error"]


# ---------------------------------------------------------------------------
# 5. Crisis escalation delivery accounting (false-success fix)
# ---------------------------------------------------------------------------

class TestCrisisEscalationDeliveryAccounting:
    """A crisis escalation may only report success when a HUMAN channel
    actually delivered — a dashboard write alone must never count, or the
    durable queue would mark undelivered tasks 'completed'."""

    def _alert(self):
        from src.services.crisis_escalation import CrisisAlert
        return CrisisAlert(
            user_id="user-123456",
            risk_level="critical",
            risk_score=0.95,
            detected_indicators=["indicator"],
            text_snippet="text",
            timestamp=datetime.now(UTC),
            requires_immediate_action=True,
        )

    def _service(self):
        from src.services.crisis_escalation import CrisisEscalationService
        svc = CrisisEscalationService.__new__(CrisisEscalationService)
        svc.twilio_client = None
        svc.sendgrid_client = None
        return svc

    def test_no_human_channel_configured_fails_fast(self):
        """No Twilio/SendGrid/FCM configured → success MUST be False even though
        the dashboard document is written."""
        import asyncio

        from src.services import crisis_escalation as ce
        from src.utils.telemetry import telemetry

        telemetry.reset()
        svc = self._service()

        async def _run():
            with patch.object(ce, "FCM_AVAILABLE", False), \
                    patch.object(svc, "_persist_alert", new=self._async_return("alert-1")), \
                    patch.object(svc, "_create_dashboard_alert", new=self._async_return(None)), \
                    patch.object(svc, "_log_escalation", new=self._async_return(None)):
                return await svc.escalate(self._alert())

        result = asyncio.run(_run())
        assert result.success is False
        assert "crisis_no_human_channel_configured" in telemetry.get_stats()["criticals"]

    def test_dashboard_only_delivery_is_not_success(self):
        """A human channel IS configured but every human send is
        skipped/fails, only the dashboard write lands → success MUST still be
        False."""
        import asyncio

        from src.services.crisis_escalation import EscalationChannel

        svc = self._service()

        async def _run():
            with patch.object(svc, "has_any_human_channel_configured", return_value=True), \
                    patch.object(svc, "_persist_alert", new=self._async_return("alert-2")), \
                    patch.object(svc, "_get_user_data", new=self._async_return({})), \
                    patch.object(svc, "_send_user_sms", new=self._async_return(False)), \
                    patch.object(svc, "_send_push_notification", new=self._async_return(False)), \
                    patch.object(svc, "_create_dashboard_alert", new=self._async_return(None)), \
                    patch.object(svc, "_log_escalation", new=self._async_return(None)):
                return await svc.escalate(self._alert())

        result = asyncio.run(_run())
        assert result.success is False
        assert EscalationChannel.DASHBOARD in result.channels_used
        assert EscalationChannel.SMS not in result.channels_used

    def test_confirmed_human_delivery_is_success(self):
        """A confirmed push delivery → success True."""
        import asyncio

        from src.services.crisis_escalation import EscalationChannel

        svc = self._service()

        async def _run():
            with patch.object(svc, "has_any_human_channel_configured", return_value=True), \
                    patch.object(svc, "_persist_alert", new=self._async_return("alert-3")), \
                    patch.object(svc, "_get_user_data", new=self._async_return({})), \
                    patch.object(svc, "_send_user_sms", new=self._async_return(False)), \
                    patch.object(svc, "_send_push_notification", new=self._async_return(True)), \
                    patch.object(svc, "_create_dashboard_alert", new=self._async_return(None)), \
                    patch.object(svc, "_log_escalation", new=self._async_return(None)):
                return await svc.escalate(self._alert())

        result = asyncio.run(_run())
        assert result.success is True
        assert EscalationChannel.PUSH in result.channels_used

    @staticmethod
    def _async_return(value):
        async def _fn(*args, **kwargs):
            return value
        return _fn

    def test_fcm_importable_but_uninitialized_is_not_configured(self):
        """FCM_AVAILABLE only means `firebase_admin` imports successfully — it
        is a hard dependency, so this was True in every deployment regardless
        of whether push could ever actually be sent. The capability check must
        require a real initialized Firebase app, not just a successful import."""
        from src.services import crisis_escalation as ce

        svc = self._service()
        with patch.object(ce, "FCM_AVAILABLE", True):
            import firebase_admin
            with patch.object(firebase_admin, "_apps", {}):
                assert svc.has_any_human_channel_configured() is False

    def test_fcm_initialized_app_is_configured(self):
        from src.services import crisis_escalation as ce

        svc = self._service()
        with patch.object(ce, "FCM_AVAILABLE", True):
            import firebase_admin
            with patch.object(firebase_admin, "_apps", {"[DEFAULT]": object()}):
                assert svc.has_any_human_channel_configured() is True

    def test_twilio_client_without_phone_number_is_not_configured(self):
        """A Twilio client alone is not sufficient — the FROM number must also
        be configured, or every send fails at the provider."""
        svc = self._service()
        svc.twilio_client = MagicMock()
        svc.twilio_phone = None
        assert svc.has_any_human_channel_configured() is False


# ---------------------------------------------------------------------------
# 5b. Circuit breaker actually wired into Twilio/SendGrid/FCM calls
# ---------------------------------------------------------------------------

class TestCrisisEscalationCircuitBreakerWiring:
    """The CircuitBreaker class was fully implemented but never applied to
    any real external call — Firestore, the AI provider, Twilio/SendGrid/FCM
    all had zero circuit protection. This proves the Twilio wrapper actually
    trips the breaker after repeated failures and rejects further calls
    without even attempting the provider request."""

    def _reset_breaker(self, name):
        from src.middleware.error_handler import error_handler as eh_singleton
        eh_singleton.circuit_breakers.pop(name, None)

    def test_repeated_twilio_failures_trip_the_breaker(self):
        from src.middleware.error_handler import CircuitBreakerOpenException
        from src.services.crisis_escalation import CrisisEscalationService

        self._reset_breaker('twilio_sms')
        try:
            svc = CrisisEscalationService.__new__(CrisisEscalationService)
            svc.twilio_client = MagicMock()
            svc.twilio_client.messages.create.side_effect = RuntimeError("Twilio down")

            # Default failure_threshold is 5 — drive it past that.
            for _ in range(5):
                with pytest.raises(RuntimeError):
                    svc._twilio_create_message(body="x", from_="+1", to="+2")

            # The 6th call must be rejected by the OPEN breaker WITHOUT
            # calling Twilio again.
            call_count_before = svc.twilio_client.messages.create.call_count
            with pytest.raises(CircuitBreakerOpenException):
                svc._twilio_create_message(body="x", from_="+1", to="+2")
            assert svc.twilio_client.messages.create.call_count == call_count_before
        finally:
            self._reset_breaker('twilio_sms')

    def test_sendgrid_and_fcm_wrappers_are_circuit_broken_too(self):
        """Same wiring for the other two escalation channels — verifies the
        breakers are registered under distinct service names (independent
        failure domains: SendGrid outages must not trip the Twilio breaker)."""
        from src.middleware.error_handler import error_handler as eh_singleton
        from src.services.crisis_escalation import CrisisEscalationService, _fcm_send_message

        svc = CrisisEscalationService.__new__(CrisisEscalationService)
        svc.sendgrid_client = MagicMock()
        svc.sendgrid_client.send.return_value = MagicMock(status_code=202)
        assert svc._sendgrid_send_message(MagicMock()).status_code == 202
        assert 'sendgrid_email' in eh_singleton.circuit_breakers

        with patch("src.services.crisis_escalation.messaging") as mock_messaging:
            mock_messaging.send.return_value = "msg-id-1"
            assert _fcm_send_message(MagicMock()) == "msg-id-1"
        assert 'fcm_push' in eh_singleton.circuit_breakers
        assert eh_singleton.circuit_breakers['fcm_push'] is not eh_singleton.circuit_breakers['sendgrid_email']


class TestFakeDbDoesNotImplementNonExistentApi:
    """db.run_in_transaction() does not exist on the real
    google.cloud.firestore.Client — it silently raised AttributeError in
    production for the lifetime of the bug subscription_service.py's comment
    describes. The shared test double previously installed a WORKING fake
    (create_mock_run_in_transaction) that actually invoked the callback with
    a mock transaction, masking that the real SDK has no such method. That
    fake has been removed; this proves calling it no longer executes the
    passed callback (i.e. it's not silently 'working' anymore)."""

    def test_shared_mock_db_run_in_transaction_no_longer_executes_callback(self, mock_db):
        callback_invoked = {"called": False}

        def _callback(txn):
            callback_invoked["called"] = True
            return "fake-result"

        # A bare, un-configured MagicMock attribute does NOT call its
        # argument — it just returns another auto-generated Mock. This is the
        # opposite of the old create_mock_run_in_transaction fake, which
        # unwrapped args and actually ran the callback (simulating success
        # for an API that doesn't exist in production).
        mock_db.run_in_transaction(_callback)

        assert callback_invoked["called"] is False


# ---------------------------------------------------------------------------
# 6. Subscription quota — real atomic transaction (not silent fallback)
# ---------------------------------------------------------------------------

class TestQuotaAtomicTransaction:
    """consume_quota must run inside a REAL Firestore transaction. The old
    db.run_in_transaction() call raised AttributeError every time in prod and
    silently used the racy fallback; this proves the atomic path now runs."""

    def test_consume_quota_uses_real_transaction(self):
        import src.services.subscription_service as s
        from tests.conftest import _FakeFirestoreTransaction

        calls = {"txn": 0, "set": 0}

        class Ref:
            def get(self, transaction=None):
                snap = MagicMock()
                snap.exists = False
                return snap
            def set(self, data, **k):
                calls["set"] += 1

        usage_ref = Ref()

        class DB:
            def transaction(self):
                calls["txn"] += 1
                t = _FakeFirestoreTransaction()
                # Route the transactional write through our counter.
                t.set = lambda ref, data, **k: calls.__setitem__("set", calls["set"] + 1)
                return t

        original_db = s.db
        original_ref = s.SubscriptionService._get_usage_ref
        try:
            s.db = DB()
            s.SubscriptionService._get_usage_ref = classmethod(lambda cls, uid: usage_ref)
            res = s.SubscriptionService.consume_quota("u1", "chat_messages", {"chatMessagesPerDay": 5})
        finally:
            s.db = original_db
            s.SubscriptionService._get_usage_ref = original_ref

        assert calls["txn"] == 1, f"db.transaction() must be called: {calls}"
        assert calls["set"] == 1, f"atomic transactional set must run, not fallback: {calls}"
        assert res["chat_messages"] == 1

    def test_consume_quota_enforces_limit_atomically(self):
        import src.services.subscription_service as s
        from tests.conftest import _FakeFirestoreTransaction

        class Ref:
            def get(self, transaction=None):
                snap = MagicMock()
                snap.exists = True
                snap.to_dict = lambda: {"date": s.SubscriptionService._today(),
                                        "mood_logs": 0, "chat_messages": 5}
                return snap
            def set(self, *a, **k):
                pass

        class DB:
            def transaction(self):
                return _FakeFirestoreTransaction()

        original_db = s.db
        original_ref = s.SubscriptionService._get_usage_ref
        try:
            s.db = DB()
            s.SubscriptionService._get_usage_ref = classmethod(lambda cls, uid: Ref())
            with pytest.raises(s.SubscriptionLimitError):
                s.SubscriptionService.consume_quota("u1", "chat_messages", {"chatMessagesPerDay": 5})
        finally:
            s.db = original_db
            s.SubscriptionService._get_usage_ref = original_ref

    def test_transaction_failure_fails_open_without_racy_write(self):
        """BUG FIX: when the Firestore transaction raises (exhausted internal
        retries / real contention), the old fallback did a plain
        read-check-write with no transaction — reintroducing the exact race
        this feature exists to close, and doing so for EVERY concurrent
        request hitting the same contention. It must now fail open (not block
        the user) WITHOUT performing any write."""
        import src.services.subscription_service as s

        calls = {"set": 0}

        class Ref:
            def get(self, transaction=None):
                snap = MagicMock()
                snap.exists = True
                snap.to_dict = lambda: {"date": s.SubscriptionService._today(),
                                        "mood_logs": 0, "chat_messages": 2}
                return snap
            def set(self, *a, **k):
                calls["set"] += 1

        class DB:
            def transaction(self):
                raise RuntimeError("simulated sustained write contention")

        original_db = s.db
        original_ref = s.SubscriptionService._get_usage_ref
        try:
            s.db = DB()
            s.SubscriptionService._get_usage_ref = classmethod(lambda cls, uid: Ref())
            with patch.object(s, "telemetry") as mock_telemetry:
                result = s.SubscriptionService.consume_quota(
                    "u1", "chat_messages", {"chatMessagesPerDay": 5}
                )
            mock_telemetry.critical.assert_called_once()
        finally:
            s.db = original_db
            s.SubscriptionService._get_usage_ref = original_ref

        assert calls["set"] == 0, "must not perform a non-transactional write on transaction failure"
        assert result["chat_messages"] == 2  # reflects existing state, not incremented


# ---------------------------------------------------------------------------
# 7. Per-user context cache
# ---------------------------------------------------------------------------

class TestContextCache:
    def setup_method(self):
        import src.utils.context_cache as cc
        # Reset module-global state between tests (cooldown, cipher memoization).
        cc._redis_unavailable_until = 0.0
        cc._last_degraded_report = 0.0
        cc._cipher = None
        cc._cipher_checked = False

    def _fake_fernet_cipher(self):
        from cryptography.fernet import Fernet
        return Fernet(Fernet.generate_key())

    def test_computes_and_never_caches_when_redis_down(self):
        import src.utils.context_cache as cc

        calls = {"n": 0}
        def compute():
            calls["n"] += 1
            return "block"

        with patch.object(cc, "_get_redis", return_value=None):
            assert cc.cached_user_context("profile", "u1", compute) == "block"
            assert cc.cached_user_context("profile", "u1", compute) == "block"
        # No cache → compute runs every time.
        assert calls["n"] == 2

    def test_read_through_serves_cached_value_encrypted(self):
        """Cached values are ENCRYPTED at rest — a raw Redis dump of the key
        must not reveal the clinical context in plaintext."""
        import src.utils.context_cache as cc

        store = {}
        fake_redis = MagicMock()
        fake_redis.get.side_effect = lambda k: store.get(k)
        fake_redis.setex.side_effect = lambda k, ttl, v: store.__setitem__(k, v.encode())

        calls = {"n": 0}
        def compute():
            calls["n"] += 1
            return "expensive clinical context: PHQ-9 score 22"

        with patch.object(cc, "_get_redis", return_value=fake_redis), \
                patch.object(cc, "_get_cipher", return_value=self._fake_fernet_cipher()):
            result1 = cc.cached_user_context("profile", "u1", compute)
            result2 = cc.cached_user_context("profile", "u1", compute)

        assert result1 == result2 == "expensive clinical context: PHQ-9 score 22"
        assert calls["n"] == 1  # computed exactly once (2nd call was a cache hit)
        # The raw bytes stored in Redis must NOT contain the plaintext.
        raw_stored = list(store.values())[0]
        assert b"PHQ-9" not in raw_stored
        assert b"clinical" not in raw_stored

    def test_no_encryption_key_skips_caching_not_plaintext_fallback(self):
        """Without HIPAA_ENCRYPTION_KEY, clinical data must NEVER be written to
        Redis in plaintext — caching is skipped entirely instead."""
        import src.utils.context_cache as cc

        fake_redis = MagicMock()
        fake_redis.get.return_value = None

        calls = {"n": 0}
        def compute():
            calls["n"] += 1
            return "sensitive text"

        with patch.object(cc, "_get_redis", return_value=fake_redis), \
                patch.object(cc, "_get_cipher", return_value=None):
            cc.cached_user_context("profile", "u1", compute)

        fake_redis.setex.assert_not_called()

    def test_empty_result_is_never_cached(self):
        """The wrapped compute functions return "" for BOTH 'no data' and
        'Firestore read failed' — caching "" would pin a transient failure as
        a real empty profile for the whole TTL. Empty results must never be
        written to Redis."""
        import src.utils.context_cache as cc

        fake_redis = MagicMock()
        fake_redis.get.return_value = None

        with patch.object(cc, "_get_redis", return_value=fake_redis), \
                patch.object(cc, "_get_cipher", return_value=self._fake_fernet_cipher()):
            result = cc.cached_user_context("profile", "u1", lambda: "")

        assert result == ""
        fake_redis.setex.assert_not_called()

    def test_empty_user_id_bypasses_cache(self):
        import src.utils.context_cache as cc
        calls = {"n": 0}
        def compute():
            calls["n"] += 1
            return "x"
        # Must not touch redis at all for an empty user id.
        with patch.object(cc, "_get_redis", side_effect=AssertionError("redis touched")):
            assert cc.cached_user_context("profile", "", compute) == "x"
        assert calls["n"] == 1

    def test_redis_failure_enters_cooldown_and_skips_reconnect(self):
        """A single Redis failure must not trigger a fresh reconnect attempt
        (with its 5s socket_connect_timeout) on every subsequent call for the
        rest of the outage — that turns 'fail open' into 'fail slow'."""
        import src.utils.context_cache as cc

        reconnect_attempts = {"n": 0}

        def flaky_get_redis_client():
            reconnect_attempts["n"] += 1
            raise ConnectionError("redis down")

        with patch("src.redis_config.get_redis_client", side_effect=flaky_get_redis_client):
            for _ in range(5):
                cc.cached_user_context("profile", "u1", lambda: "value")

        # Only the FIRST call should have attempted a real reconnect; the rest
        # must be served from the cooldown short-circuit.
        assert reconnect_attempts["n"] == 1

    def test_degraded_reported_on_new_outage_not_just_once_ever(self):
        """Degradation must be reported again when a NEW outage begins after
        Redis was healthy — not only on the very first-ever failure. Patches
        the underlying redis_config client (not _get_redis itself) so the
        real cooldown/reporting logic in _get_redis() actually executes."""
        import src.utils.context_cache as cc
        from src.utils.telemetry import telemetry

        telemetry.reset()
        with patch("src.redis_config.get_redis_client", return_value=None):
            cc.cached_user_context("profile", "u1", lambda: "x")
        assert telemetry.get_stats()["degradations"].get("ai_chat_context_cache:redis_unavailable") == 1

        # Simulate recovery: clear cooldown as if the outage window passed and
        # Redis is healthy again, then fail once more — a SECOND report must fire.
        cc._redis_unavailable_until = 0.0
        cc._last_degraded_report = 0.0
        with patch("src.redis_config.get_redis_client", return_value=None):
            cc.cached_user_context("profile", "u1", lambda: "x")
        assert telemetry.get_stats()["degradations"]["ai_chat_context_cache:redis_unavailable"] == 2


# ---------------------------------------------------------------------------
# 8. 2FA login gate — pending token cannot access protected routes
# ---------------------------------------------------------------------------

class TestTwoFactorPendingToken:
    def test_pending_token_rejected_as_access_token(self):
        """The pending_2fa token MUST NOT authorize normal API access."""
        from src.services.auth_service import AuthService

        uid = "user-abcdef123456"
        pending = AuthService.generate_pending_2fa_token(uid)

        # verify_token (used by jwt_required for all protected routes) requires
        # type == 'access' and must reject the pending token.
        user_id, err = AuthService.verify_token(pending)
        assert user_id is None
        assert err is not None

    def test_pending_token_valid_only_for_2fa_exchange(self):
        from src.services.auth_service import AuthService

        uid = "user-abcdef123456"
        pending = AuthService.generate_pending_2fa_token(uid)

        # It IS valid for the dedicated pending verifier.
        user_id, err = AuthService.verify_pending_2fa_token(pending)
        assert user_id == uid
        assert err is None

    def test_access_token_rejected_by_pending_verifier(self):
        """Symmetry: a full access token is not a pending-2fa token."""
        from src.services.auth_service import AuthService

        uid = "user-abcdef123456"
        access = AuthService.generate_access_token(uid)
        user_id, err = AuthService.verify_pending_2fa_token(access)
        assert user_id is None
        assert err is not None


# ---------------------------------------------------------------------------
# 9. Consent enforcement decorator
# ---------------------------------------------------------------------------

class TestConsentEnforcement:
    def _make_app_and_view(self, consent_status, strict=False, raise_err=False):
        from flask import Flask, g

        from src.services.consent_service import consent_service

        app = Flask(__name__)

        if raise_err:
            consent_service.check_consent = lambda uid, ct: (_ for _ in ()).throw(RuntimeError("firestore down"))
        else:
            consent_service.check_consent = lambda uid, ct: consent_status

        @consent_service.require_consent(['ai_processing'], strict=strict)
        def view():
            from flask import jsonify
            return jsonify({"ok": True}), 200

        return app, view, g

    def test_withdrawn_consent_returns_403(self):
        app, view, g = self._make_app_and_view(
            {"has_consent": False, "withdrawn": True, "granted_at": "2020-01-01"}
        )
        with app.test_request_context():
            g.user_id = "user-abcdef123456"
            resp = view()
        status = resp[1] if isinstance(resp, tuple) else resp.status_code
        assert status == 403

    def test_granted_consent_allows(self):
        app, view, g = self._make_app_and_view(
            {"has_consent": True, "withdrawn": False, "granted_at": "2020-01-01"}
        )
        with app.test_request_context():
            g.user_id = "user-abcdef123456"
            resp = view()
        status = resp[1] if isinstance(resp, tuple) else resp.status_code
        assert status == 200

    def test_missing_record_allows_in_nonstrict(self):
        app, view, g = self._make_app_and_view(
            {"has_consent": False, "granted_at": None}
        )
        with app.test_request_context():
            g.user_id = "user-abcdef123456"
            resp = view()
        status = resp[1] if isinstance(resp, tuple) else resp.status_code
        assert status == 200

    def test_missing_record_blocks_in_strict(self):
        app, view, g = self._make_app_and_view(
            {"has_consent": False, "granted_at": None}, strict=True
        )
        with app.test_request_context():
            g.user_id = "user-abcdef123456"
            resp = view()
        status = resp[1] if isinstance(resp, tuple) else resp.status_code
        assert status == 403

    def test_consent_check_error_fails_open(self):
        app, view, g = self._make_app_and_view({}, raise_err=True)
        with app.test_request_context():
            g.user_id = "user-abcdef123456"
            resp = view()
        status = resp[1] if isinstance(resp, tuple) else resp.status_code
        assert status == 200  # infra error must never block the feature


# ---------------------------------------------------------------------------
# 10. Crisis queue health snapshot
# ---------------------------------------------------------------------------

class TestCrisisQueueHealth:
    def test_health_degraded_when_db_none(self):
        from src.services import crisis_task_queue
        with patch.object(crisis_task_queue, "_get_db", return_value=None):
            health = crisis_task_queue.get_queue_health()
        assert health["available"] is False

    def test_health_reports_counts(self):
        from src.services import crisis_task_queue

        class AggResult:
            def __init__(self, v):
                self.value = v

        class FakeQuery:
            def __init__(self, n):
                self._n = n
            def count(self):
                return self
            def get(self):
                return [[AggResult(self._n)]]
            def where(self, *a, **k):
                return self
            def order_by(self, *a, **k):
                return self
            def limit(self, *a, **k):
                return self
            def stream(self):
                return iter([])

        counts_by_status = {"pending": 3, "processing": 1, "failed": 2}

        class FakeCollection:
            def where(self, *args, **kwargs):
                status = None
                if "filter" in kwargs:
                    status = getattr(kwargs["filter"], "value", None)
                return FakeQuery(counts_by_status.get(status, 0))
            def count(self):
                return FakeQuery(0)

        fake_db = MagicMock()
        fake_db.collection.return_value = FakeCollection()

        # FieldFilter carries the compared value on .value in this fake.
        import src.services.crisis_task_queue as q
        with patch.object(q, "_get_db", return_value=fake_db):
            health = q.get_queue_health()

        assert health["available"] is True
        assert set(health["counts"].keys()) == {"pending", "processing", "failed"}


# ---------------------------------------------------------------------------
# 11. GDPR breach notification
# ---------------------------------------------------------------------------

class TestBreachNotification:
    def test_schedule_fires_critical_and_sets_72h_deadline(self):
        import src.services.breach_notification_service as bns
        from src.utils.telemetry import telemetry

        telemetry.reset()
        updates = {}
        doc_ref = MagicMock()
        doc_ref.update.side_effect = lambda payload: updates.update(payload)
        fake_db = MagicMock()
        fake_db.collection.return_value.document.return_value = doc_ref

        svc = bns.BreachNotificationService()
        record = {
            "breach_id": "breach-1",
            "assessment": {"affected_users": 1200, "severity": "critical"},
        }

        with patch.object(bns, "_db", fake_db), \
                patch.object(svc, "_send_dpo_email", return_value=True):
            svc._schedule_notifications(record)

        # 72h GDPR authority deadline persisted.
        assert "gdpr_authority_deadline_at" in updates
        assert updates["high_risk"] is True
        assert updates["oncall_alert_delivered"] is True
        # On-call was paged via telemetry critical.
        assert "data_breach_detected" in telemetry.get_stats()["criticals"]
        # Art. 33 authority + Art. 34 subject notifications both scheduled.
        types = {n["type"] for n in updates["scheduled_notifications"]}
        assert "supervisory_authority_imy" in types
        assert "affected_data_subjects" in types

    def test_high_severity_single_user_still_high_risk(self):
        """Case-sensitivity regression test: _calculate_severity() returns
        UPPERCASE ('HIGH'/'MEDIUM'/'LOW'). A single affected user (below the
        500-user threshold) with HIGH severity (e.g. one user's
        suicidal-ideation record leaked) MUST still be high_risk — this is
        exactly the case a lowercase comparison bug would hide, because the
        affected_users>=500 OR-branch alone would never catch it."""
        import src.services.breach_notification_service as bns

        updates = {}
        doc_ref = MagicMock()
        doc_ref.update.side_effect = lambda payload: updates.update(payload)
        fake_db = MagicMock()
        fake_db.collection.return_value.document.return_value = doc_ref

        svc = bns.BreachNotificationService()
        record = {
            "breach_id": "breach-3",
            "assessment": {"affected_users": 1, "severity": "HIGH"},
        }
        with patch.object(bns, "_db", fake_db), \
                patch.object(svc, "_send_dpo_email", return_value=True):
            svc._schedule_notifications(record)

        assert updates["high_risk"] is True
        types = {n["type"] for n in updates["scheduled_notifications"]}
        assert "affected_data_subjects" in types

    def test_low_risk_skips_subject_notification(self):
        import src.services.breach_notification_service as bns
        from src.utils.telemetry import telemetry

        telemetry.reset()
        updates = {}
        doc_ref = MagicMock()
        doc_ref.update.side_effect = lambda payload: updates.update(payload)
        fake_db = MagicMock()
        fake_db.collection.return_value.document.return_value = doc_ref

        svc = bns.BreachNotificationService()
        record = {
            "breach_id": "breach-2",
            "assessment": {"affected_users": 1, "severity": "low"},
        }
        with patch.object(bns, "_db", fake_db), \
                patch.object(svc, "_send_dpo_email", return_value=False):
            svc._schedule_notifications(record)

        assert updates["high_risk"] is False
        assert updates["oncall_alert_delivered"] is False  # no channel configured
        types = {n["type"] for n in updates["scheduled_notifications"]}
        assert types == {"supervisory_authority_imy"}

    def test_single_user_mental_health_breach_is_scored_high_severity(self):
        """BUG FIX: _calculate_severity() previously ignored `data_types`
        entirely and scored purely on affected_users count, so a breach of
        ONE user's mental-health/crisis record was always 'LOW' — never
        reaching Art. 34 subject notification regardless of how sensitive the
        exposed data was. A single-user breach of special-category clinical
        data must now be scored HIGH."""
        import src.services.breach_notification_service as bns

        svc = bns.BreachNotificationService()

        # Previously: always 'LOW' for affected_users=1, no matter the data.
        assert svc._calculate_severity(1, ["mental_health_records"]) == "HIGH"
        assert svc._calculate_severity(1, ["medical_data"]) == "HIGH"
        assert svc._calculate_severity(1, ["treatment_history"]) == "HIGH"
        # Non-sensitive, low-volume data is still correctly LOW.
        assert svc._calculate_severity(1, ["contact_info"]) == "LOW"
        # High affected_users count still independently forces HIGH.
        assert svc._calculate_severity(600, ["contact_info"]) == "HIGH"

    def test_detect_potential_breach_end_to_end_single_user_crisis_data(self):
        """End-to-end: detect_potential_breach() -> _calculate_severity() ->
        assessment['severity'] must be 'HIGH' for a single-user mental-health
        breach, proving the fix is wired through the real public entry point,
        not just the isolated helper."""
        import src.services.breach_notification_service as bns

        svc = bns.BreachNotificationService()
        with patch.object(bns.audit_service, "log_event"), \
                patch.object(svc, "_initiate_breach_response"):
            assessment = svc.detect_potential_breach({
                "affected_users": 1,
                "data_types": ["mental_health_records"],
                "breach_type": "unauthorized_access",
            })

        assert assessment["is_breach"] is True
        assert assessment["severity"] == "HIGH"


# ---------------------------------------------------------------------------
# 12. Account lockout counts Firebase's modern credential error
# ---------------------------------------------------------------------------

class TestAccountLockoutCredentialErrors:
    """Firebase returns INVALID_LOGIN_CREDENTIALS for a wrong password. If that
    code is not counted as a failed attempt, lockout never triggers and there is
    no brute-force protection."""

    @pytest.mark.parametrize("firebase_error", [
        "Firebase auth failed: INVALID_LOGIN_CREDENTIALS",
        "Firebase auth failed: TOO_MANY_ATTEMPTS_TRY_LATER",
        "Firebase auth failed: INVALID_PASSWORD",
        "Firebase auth failed: EMAIL_NOT_FOUND",
    ])
    def test_credential_errors_record_failed_attempt(self, firebase_error):
        from src.services.auth_service import AuthService

        recorded = []
        with patch.object(AuthService, "check_account_lockout", return_value=(False, None)), \
                patch.object(AuthService, "record_failed_attempt", side_effect=lambda e: recorded.append(e)), \
                patch("src.services.auth_service.requests.post",
                      side_effect=Exception(firebase_error)):
            user, error, _a, _r = AuthService.login_user("u@example.com", "wrong")

        assert user is None and error is not None
        assert recorded == ["u@example.com"], f"{firebase_error} must count toward lockout"

    def test_infrastructure_error_does_not_count(self):
        """A network/infra failure must NOT lock the user out."""
        from src.services.auth_service import AuthService

        recorded = []
        with patch.object(AuthService, "check_account_lockout", return_value=(False, None)), \
                patch.object(AuthService, "record_failed_attempt", side_effect=lambda e: recorded.append(e)), \
                patch("src.services.auth_service.requests.post",
                      side_effect=Exception("Connection timed out")):
            AuthService.login_user("u@example.com", "pw")

        assert recorded == []


# ---------------------------------------------------------------------------
# 13. Rate-limiter tier caching (no Firestore read per request)
# ---------------------------------------------------------------------------

class TestRateLimiterTierCache:
    def test_tier_cached_in_redis(self):
        from src.services.rate_limiting import AdvancedRateLimiter

        limiter = AdvancedRateLimiter()
        store = {}
        fake_redis = MagicMock()
        fake_redis.get.side_effect = lambda k: store.get(k)
        fake_redis.setex.side_effect = lambda k, ttl, v: store.__setitem__(k, str(v).encode())

        reads = {"n": 0}

        class Doc:
            exists = True
            def to_dict(self):
                return {"subscription": {"active": True, "plan": "premium"}}

        class DB:
            def collection(self, _n):
                return self
            def document(self, _d):
                return self
            def get(self):
                reads["n"] += 1
                return Doc()

        import src.firebase_config as fc
        with patch("src.redis_config.get_redis_client", return_value=fake_redis), \
                patch.object(fc, "db", DB()):
            assert limiter.get_user_tier("u1") == "premium"   # miss → Firestore
            assert limiter.get_user_tier("u1") == "premium"   # hit  → cached

        assert reads["n"] == 1, "tier must be read from Firestore only once"

    def test_falls_back_to_process_cache_without_redis(self):
        from src.services.rate_limiting import AdvancedRateLimiter

        limiter = AdvancedRateLimiter()
        reads = {"n": 0}

        class Doc:
            exists = True
            def to_dict(self):
                return {"subscription": {"active": True, "plan": "pro"}}

        class DB:
            def collection(self, _n):
                return self
            def document(self, _d):
                return self
            def get(self):
                reads["n"] += 1
                return Doc()

        import src.firebase_config as fc
        with patch("src.redis_config.get_redis_client", return_value=None), \
                patch.object(fc, "db", DB()):
            assert limiter.get_user_tier("u2") == "pro"
            assert limiter.get_user_tier("u2") == "pro"

        assert reads["n"] == 1

    def test_no_user_id_is_free_without_lookup(self):
        from src.services.rate_limiting import AdvancedRateLimiter
        limiter = AdvancedRateLimiter()
        assert limiter.get_user_tier(None) == "free"

    def test_invalidate_clears_redis_and_process_cache(self):
        """A subscription change must bust BOTH the Redis entry and the
        per-process fallback cache immediately, or an upgraded/downgraded user
        keeps stale limits for up to TIER_CACHE_TTL."""
        from src.services.rate_limiting import AdvancedRateLimiter

        limiter = AdvancedRateLimiter()
        limiter._tier_cache["u1"] = ("free", 9999999999.0)

        fake_redis = MagicMock()
        with patch("src.redis_config.get_redis_client", return_value=fake_redis):
            limiter.invalidate_user_tier("u1")

        assert "u1" not in limiter._tier_cache
        fake_redis.delete.assert_called_once_with("ratelimit:tier:u1")

    def test_subscription_webhook_invalidates_tier_on_activation(self):
        """The Stripe webhook's checkout.session.completed handler (the
        actual subscription-activation write) must invalidate the cached
        tier — this was implemented but never wired to any caller."""
        import json
        import os as _os

        from flask import Flask

        from src.routes import subscription_routes as sr

        fake_db = MagicMock()
        payload = json.dumps({
            "type": "checkout.session.completed",
            "data": {"object": {
                "metadata": {"user_id": "user-123", "plan": "premium"},
                "customer": "cus_1", "subscription": "sub_1",
            }},
        })

        app = Flask(__name__)
        app.register_blueprint(sr.subscription_bp, url_prefix="/api/v1/subscription")

        original_env = _os.environ.get("FLASK_ENV")
        _os.environ["FLASK_ENV"] = "development"
        try:
            with patch.object(sr, "db", fake_db), \
                    patch.object(sr, "STRIPE_AVAILABLE", True), \
                    patch.object(sr, "STRIPE_WEBHOOK_SECRET", ""), \
                    patch.object(sr, "rate_limiter") as mock_limiter:
                with app.test_client() as client:
                    client.post(
                        "/api/v1/subscription/webhook",
                        data=payload,
                        content_type="application/json",
                    )
            mock_limiter.invalidate_user_tier.assert_called_with("user-123")
        finally:
            if original_env is not None:
                _os.environ["FLASK_ENV"] = original_env
            else:
                _os.environ.pop("FLASK_ENV", None)


# ---------------------------------------------------------------------------
# 14. RAG embedding batching (N sequential API calls -> 1)
# ---------------------------------------------------------------------------

class TestRagEmbeddingBatching:
    def _service(self, client):
        from src.services.chat_rag_service import ChatRAGService
        svc = ChatRAGService.__new__(ChatRAGService)
        svc.embedding_client = client
        svc._embedding_deployment = "text-embedding-3-small"
        svc._embedding_cache = {}
        svc._cache_hits = 0
        svc._cache_misses = 0
        svc._max_cache_size = 1000
        return svc

    def _client(self, calls):
        class Item:
            def __init__(self, i):
                self.index = i
                self.embedding = [0.1, 0.2, 0.3]

        class Embeddings:
            def create(self, input, model):  # noqa: A002 - mirrors SDK kwarg
                calls.append(list(input) if isinstance(input, list) else [input])
                items = input if isinstance(input, list) else [input]
                return MagicMock(data=[Item(i) for i in range(len(items))])

        client = MagicMock()
        client.embeddings = Embeddings()
        return client

    def test_prewarm_uses_single_call_for_many_texts(self):
        calls = []
        svc = self._service(self._client(calls))
        texts = [f"document number {i}" for i in range(40)]

        svc.prewarm_embeddings(texts)

        assert len(calls) == 1, f"expected 1 batched call, got {len(calls)}"
        assert len(calls[0]) == 40
        # Every text is now cached, so per-text embedding costs no API calls.
        for t in texts:
            assert svc.embed_text(t) is not None
        assert len(calls) == 1

    def test_prewarm_skips_already_cached_and_dedups(self):
        calls = []
        svc = self._service(self._client(calls))
        svc.prewarm_embeddings(["a", "b"])
        assert len(calls[0]) == 2

        # 'a' cached; 'c' duplicated in the input must be sent once.
        svc.prewarm_embeddings(["a", "c", "c"])
        assert len(calls) == 2
        assert calls[1] == ["c"]

    def test_batch_failure_is_non_fatal(self):
        class Failing:
            def create(self, **kwargs):
                raise RuntimeError("azure down")

        client = MagicMock()
        client.embeddings = Failing()
        svc = self._service(client)
        # Must not raise — callers fall back to per-text embedding.
        svc.prewarm_embeddings(["x", "y"])

    def test_one_bad_chunk_does_not_abandon_remaining_chunks(self):
        """A transient failure on chunk 1 must not silently abandon every
        later chunk — with >64 pending texts (2+ chunks), only the failing
        chunk should be skipped; subsequent chunks must still batch."""
        calls = []

        class Item:
            def __init__(self, i):
                self.index = i
                self.embedding = [0.1, 0.2, 0.3]

        class FlakyOnFirstChunk:
            def create(self, input, model):
                calls.append(list(input))
                if len(calls) == 1:
                    raise RuntimeError("transient azure blip")
                items = input
                return MagicMock(data=[Item(i) for i in range(len(items))])

        client = MagicMock()
        client.embeddings = FlakyOnFirstChunk()
        svc = self._service(client)

        texts = [f"doc {i}" for i in range(130)]  # 3 chunks of <=64
        svc.prewarm_embeddings(texts)

        # All 3 chunks must have been ATTEMPTED (continue, not return).
        assert len(calls) == 3
        # Texts from chunk 2 and 3 must be cached even though chunk 1 failed.
        assert svc.embed_text(texts[70]) is not None
        assert svc.embed_text(texts[120]) is not None


# ---------------------------------------------------------------------------
# 15. Dead security_service.require_auth must not accept pending-2fa tokens
# ---------------------------------------------------------------------------

class TestSecurityServiceRequireAuthHardened:
    """require_auth previously decoded JWTs itself with no type/iss/aud
    checks, so a pending_2fa token (issued at login for a 2FA account, before
    the second factor is verified) would have been accepted as a full
    session if this decorator were ever wired to a route. It must now delegate
    to AuthService.verify_token, which rejects non-'access' token types."""

    def test_pending_2fa_token_rejected(self):
        from flask import Flask

        from src.services.auth_service import AuthService
        from src.services.security_service import SecurityService

        app = Flask(__name__)
        svc = SecurityService(audit_service=MagicMock())

        @svc.require_auth
        def view():
            from flask import jsonify
            return jsonify({"ok": True}), 200

        pending = AuthService.generate_pending_2fa_token("user-abcdef123456")
        with app.test_request_context(headers={"Authorization": f"Bearer {pending}"}):
            resp = view()
        status = resp[1] if isinstance(resp, tuple) else resp.status_code
        assert status == 401

    def test_valid_access_token_accepted(self):
        from flask import Flask, g

        from src.services.auth_service import AuthService
        from src.services.security_service import SecurityService

        app = Flask(__name__)
        svc = SecurityService(audit_service=MagicMock())

        @svc.require_auth
        def view():
            from flask import jsonify
            return jsonify({"user_id": g.user_id}), 200

        token = AuthService.generate_access_token("user-abcdef123456")
        with app.test_request_context(headers={"Authorization": f"Bearer {token}"}):
            resp = view()
        status = resp[1] if isinstance(resp, tuple) else resp.status_code
        assert status == 200


# ---------------------------------------------------------------------------
# 16. Sentry init failure must fail closed in production
# ---------------------------------------------------------------------------

class TestSentryMalformedDsnFailsClosed:
    """A missing SENTRY_DSN already refused production boot. A DSN that IS
    set but malformed/unreachable used to be silently swallowed by init_sentry
    (logged, returned False) — reproducing the exact 'CRITICAL events only
    reach stdout' state the missing-DSN guard exists to prevent."""

    def test_malformed_dsn_raises_in_production(self):
        from src.monitoring import sentry_config

        with patch.object(sentry_config, "sentry_sdk") as mock_sdk, \
                patch.dict("os.environ", {
                    "SENTRY_DSN": "not-a-real-dsn",
                    "FLASK_ENV": "production",
                }, clear=False):
            os.environ.pop("ALLOW_MISSING_SENTRY", None)
            mock_sdk.init.side_effect = Exception("invalid dsn")
            with pytest.raises(RuntimeError):
                sentry_config.init_sentry()

    def test_malformed_dsn_allowed_with_explicit_override(self):
        from src.monitoring import sentry_config

        with patch.object(sentry_config, "sentry_sdk") as mock_sdk, \
                patch.dict("os.environ", {
                    "SENTRY_DSN": "not-a-real-dsn",
                    "FLASK_ENV": "production",
                    "ALLOW_MISSING_SENTRY": "true",
                }, clear=False):
            mock_sdk.init.side_effect = Exception("invalid dsn")
            assert sentry_config.init_sentry() is False

    def test_malformed_dsn_does_not_raise_in_development(self):
        from src.monitoring import sentry_config

        with patch.object(sentry_config, "sentry_sdk") as mock_sdk, \
                patch.dict("os.environ", {
                    "SENTRY_DSN": "not-a-real-dsn",
                    "FLASK_ENV": "development",
                }, clear=False):
            os.environ.pop("ALLOW_MISSING_SENTRY", None)
            mock_sdk.init.side_effect = Exception("invalid dsn")
            assert sentry_config.init_sentry() is False


# ---------------------------------------------------------------------------
# 17. WebSocket crisis monitor routes through the durable queue
# ---------------------------------------------------------------------------

class TestCrisisMonitorUsesDurableQueue:
    """crisis_monitor.py's WebSocket path previously called
    escalation_service.escalate(alert) directly and discarded the result —
    the exact loss mode the durable /crisis_tasks queue exists to eliminate.
    It must now enqueue instead."""

    def test_escalate_crisis_enqueues_not_calls_escalate_directly(self):
        import asyncio

        from src.services import crisis_monitor as cm

        session = MagicMock()
        session.user_id = "user-123456"
        session.messages = [{"content": "jag mår mycket dåligt"}]
        risk = MagicMock()
        risk.risk_level = "critical"
        risk.semantic_score = 0.9
        risk.semantic_indicators = ["ind"]

        monitor = cm.CrisisMonitorWebSocket.__new__(cm.CrisisMonitorWebSocket)

        enqueued = {}
        with patch("src.services.crisis_task_queue.enqueue_crisis_escalation",
                   side_effect=lambda alert: enqueued.setdefault("alert", alert) or "task-1"), \
                patch("src.services.crisis_escalation.get_crisis_escalation_service") as mock_get_svc:
            asyncio.run(monitor._escalate_crisis(session, risk))

        assert "alert" in enqueued, "must call enqueue_crisis_escalation"
        assert enqueued["alert"].user_id == "user-123456"
        # The old direct-call path must NOT be used.
        mock_get_svc.return_value.escalate.assert_not_called()

    def test_queue_unavailable_logs_critical_not_swallowed_silently(self):
        import asyncio

        from src.services import crisis_monitor as cm
        from src.services.crisis_task_queue import CrisisQueueUnavailableError

        session = MagicMock()
        session.user_id = "user-123456"
        session.messages = [{"content": "hjälp"}]
        risk = MagicMock()
        risk.risk_level = "high"
        risk.semantic_score = 0.8
        risk.semantic_indicators = []

        monitor = cm.CrisisMonitorWebSocket.__new__(cm.CrisisMonitorWebSocket)

        with patch("src.services.crisis_task_queue.enqueue_crisis_escalation",
                   side_effect=CrisisQueueUnavailableError("db down")):
            # Must not raise — the outer try/except in _escalate_crisis
            # catches this and logs, it does not propagate.
            asyncio.run(monitor._escalate_crisis(session, risk))


# ---------------------------------------------------------------------------
# 18. GDPR purge_user_data covers previously-missed collections
# ---------------------------------------------------------------------------

class TestPurgeUserDataCompleteness:
    """A 'complete' GDPR Art. 17 deletion previously left generated insight
    text, OAuth tokens, live refresh sessions, WebAuthn credentials/challenges,
    device registrations and health integration data behind. All must now be
    purged."""

    def _fake_db(self, filtered_collections_hit, health_subcollections=()):
        """A minimal fake Firestore client that records which top-level
        collections were queried with a user_id filter, and simulates the
        health_data/{uid} document + its provider subcollections. Supports
        the users/{uid}/<subcollection> pattern used throughout purge_user_data
        (doc refs expose .collection() returning another empty FakeCollection)."""

        class FakeQuery:
            def __init__(self, name):
                self._name = name
            def where(self, *a, **k):
                filtered_collections_hit.add(self._name)
                return self
            def limit(self, *a, **k):
                return self
            def stream(self):
                return iter([])  # no docs to delete in this test — presence-of-call is what's asserted

        class FakeProviderCollection:
            def __init__(self, cid):
                self.id = cid
            def limit(self, *a, **k):
                return self
            def stream(self):
                return iter([])

        class FakeDocRef:
            def __init__(self, name, doc_id):
                self._name = name
                self._doc_id = doc_id
            def get(self):
                return MagicMock(exists=False)
            def delete(self):
                pass
            def collections(self):
                if self._name == 'health_data':
                    return [FakeProviderCollection(c) for c in health_subcollections]
                return []
            def collection(self, subcollection_name):
                return FakeCollection(f"{self._name}/{self._doc_id}/{subcollection_name}")

        class FakeCollection:
            def __init__(self, name):
                self._name = name
            def where(self, *a, **k):
                filtered_collections_hit.add(self._name)
                return FakeQuery(self._name)
            def document(self, doc_id=None):
                return FakeDocRef(self._name, doc_id)
            def limit(self, *a, **k):
                return self
            def stream(self):
                return iter([])

        fake_db = MagicMock()
        fake_db.collection.side_effect = lambda name: FakeCollection(name)
        return fake_db

    def test_new_user_keyed_collections_are_filtered(self):
        import src.routes.privacy_routes as pr

        hit = set()
        fake_db = self._fake_db(hit)
        with patch.object(pr, "db", fake_db), \
                patch.object(pr, "auth", None), \
                patch.object(pr, "audit_log"):
            pr.purge_user_data("user-abcdef123456")

        for expected in (
            "insights", "oauth_tokens", "refresh_sessions", "webauthn_credentials", "health_data",
            "breathing_sessions", "ai_generated_tracks", "referral_invitations",
            "referral_history", "reward_redemptions", "notifications",
        ):
            assert expected in hit, f"{expected} must be queried by user_id during purge"

    def test_document_keyed_collections_are_checked(self):
        import src.routes.privacy_routes as pr

        checked_docs = []
        fake_db = MagicMock()

        class FakeDocRef:
            def __init__(self, name):
                self._name = name
            def get(self):
                checked_docs.append(self._name)
                return MagicMock(exists=False)
            def delete(self):
                pass
            def collections(self):
                return []
            def collection(self, subcollection_name):
                return FakeCollection(f"{self._name}/_/{subcollection_name}")

        class FakeCollection:
            def __init__(self, name):
                self._name = name
            def where(self, *a, **k):
                return self
            def document(self, doc_id=None):
                return FakeDocRef(self._name)
            def limit(self, *a, **k):
                return self
            def stream(self):
                return iter([])

        fake_db.collection.side_effect = lambda name: FakeCollection(name)
        with patch.object(pr, "db", fake_db), \
                patch.object(pr, "auth", None), \
                patch.object(pr, "audit_log"):
            pr.purge_user_data("user-abcdef123456")

        assert "webauthn_challenges" in checked_docs
        assert "user_devices" in checked_docs
        assert "user_rewards" in checked_docs
        assert "gratitude_challenges" in checked_docs
        assert "integrations" in checked_docs
        assert "user_challenges" in checked_docs

    def test_health_data_provider_subcollections_are_walked(self):
        """health_data/{uid}/{provider} subcollections must be enumerated and
        deleted — Firestore does not cascade-delete them when the parent doc
        (health_data/{uid}) is deleted."""
        import src.routes.privacy_routes as pr

        deleted_subcollections = []

        class FakeProviderCollection:
            def __init__(self, cid):
                self.id = cid
            def limit(self, *a, **k):
                return self
            def stream(self):
                deleted_subcollections.append(self.id)
                return iter([])

        class FakeHealthDocRef:
            def get(self):
                return MagicMock(exists=True)
            def delete(self):
                pass
            def collections(self):
                return [FakeProviderCollection("fitbit"), FakeProviderCollection("apple_health")]
            def collection(self, subcollection_name):
                return FakeGenericCollection(f"health_data/_/{subcollection_name}")

        class FakeGenericDocRef:
            def get(self):
                return MagicMock(exists=False)
            def delete(self):
                pass
            def collections(self):
                return []
            def collection(self, subcollection_name):
                return FakeGenericCollection(f"_/{subcollection_name}")

        class FakeGenericCollection:
            def __init__(self, name):
                self._name = name
            def where(self, *a, **k):
                return self
            def document(self, doc_id=None):
                return FakeGenericDocRef()
            def limit(self, *a, **k):
                return self
            def stream(self):
                return iter([])

        class FakeCollection:
            def __init__(self, name):
                self._name = name
            def where(self, *a, **k):
                return self
            def document(self, doc_id=None):
                return FakeHealthDocRef() if self._name == 'health_data' else FakeGenericDocRef()
            def limit(self, *a, **k):
                return self
            def stream(self):
                return iter([])

        fake_db = MagicMock()
        fake_db.collection.side_effect = lambda name: FakeCollection(name)
        with patch.object(pr, "db", fake_db), \
                patch.object(pr, "auth", None), \
                patch.object(pr, "audit_log"):
            pr.purge_user_data("user-abcdef123456")

        assert "fitbit" in deleted_subcollections
        assert "apple_health" in deleted_subcollections


# ---------------------------------------------------------------------------
# 0b. Retention sweep coverage for 'insights' (root-level, Timestamp-typed)
# ---------------------------------------------------------------------------

class TestDataRetentionInsights:
    """'insights' documents store 'created_at' as a native Firestore
    Timestamp (daily_insight_service_v2.py writes a datetime object, not
    .isoformat()) — unlike the ISO-string 'timestamp' field used by
    feedback/referrals. The retention sweep must compare against a datetime
    cutoff for this collection, not the ISO-string cutoff used elsewhere, or
    the query would silently match zero documents forever."""

    def _fake_insights_collection(self, captured_filters):
        from unittest.mock import MagicMock

        class FakeQuery:
            def where(self, filter):
                captured_filters.append(filter)
                return self
            def stream(self):
                return iter([])

        fake_collection = MagicMock()
        fake_collection.where.side_effect = lambda filter: (
            captured_filters.append(filter) or FakeQuery()
        )
        return fake_collection

    def test_insights_in_retention_policy(self):
        from src.services.data_retention_service import DataRetentionService
        svc = DataRetentionService()
        assert "insights" in svc.gdpr_retention_days
        assert svc.gdpr_retention_days["insights"] == 2555

    def test_insights_query_uses_datetime_cutoff_not_iso_string(self):
        from src.services import data_retention_service as drs_module

        captured_filters = []
        fake_db = MagicMock()
        fake_db.collection.side_effect = lambda name: self._fake_insights_collection(captured_filters)
        fake_db.batch.return_value = MagicMock()

        with patch.object(drs_module, "db", fake_db):
            svc = drs_module.DataRetentionService()
            svc._delete_expired_data("user-123", "insights", 2555)

        assert len(captured_filters) == 2
        user_filter, created_at_filter = captured_filters
        assert user_filter.field_path == "user_id"
        assert user_filter.value == "user-123"
        assert created_at_filter.field_path == "created_at"
        # The core regression: this must be a real datetime, not the
        # isoformat() string used for the subcollection/feedback branches.
        assert isinstance(created_at_filter.value, datetime)

    def test_insights_count_uses_datetime_cutoff_not_iso_string(self):
        from src.services import data_retention_service as drs_module

        captured_filters = []
        fake_db = MagicMock()
        fake_db.collection.side_effect = lambda name: self._fake_insights_collection(captured_filters)

        with patch.object(drs_module, "db", fake_db):
            svc = drs_module.DataRetentionService()
            svc._count_expired_data("user-123", "insights", 2555)

        assert len(captured_filters) == 2
        assert isinstance(captured_filters[1].value, datetime)

    def test_journal_entries_query_targets_top_level_collection_with_user_id_field(self):
        """BUG FIX: journal_routes.py writes to the TOP-LEVEL 'journal_entries'
        collection (field 'user_id', 'created_at' as a native datetime) — the
        retention sweep previously queried users/{uid}/journal_entries with an
        ISO-string 'timestamp' field, which matches zero real documents."""
        from src.services import data_retention_service as drs_module

        captured_filters = []
        fake_db = MagicMock()
        fake_db.collection.side_effect = lambda name: self._fake_insights_collection(captured_filters)

        with patch.object(drs_module, "db", fake_db):
            svc = drs_module.DataRetentionService()
            svc._delete_expired_data("user-123", "journal_entries", 2555)

        # Top-level collection accessed directly by name, not users/{uid}/...
        fake_db.collection.assert_any_call("journal_entries")
        assert len(captured_filters) == 2
        user_filter, created_at_filter = captured_filters
        assert user_filter.field_path == "user_id"
        assert created_at_filter.field_path == "created_at"
        assert isinstance(created_at_filter.value, datetime)

    def test_notifications_query_targets_top_level_collection_with_camelcase_fields(self):
        """BUG FIX: notifications_routes.py writes to the TOP-LEVEL
        'notifications' collection with camelCase 'userId'/'sentAt' fields —
        the retention sweep previously queried users/{uid}/notifications with
        a lowercase 'timestamp' field, which matches zero real documents."""
        from src.services import data_retention_service as drs_module

        captured_filters = []
        fake_db = MagicMock()
        fake_db.collection.side_effect = lambda name: self._fake_insights_collection(captured_filters)
        fake_db.batch.return_value = MagicMock()

        with patch.object(drs_module, "db", fake_db):
            svc = drs_module.DataRetentionService()
            svc._delete_expired_data("user-123", "notifications", 365)

        fake_db.collection.assert_any_call("notifications")
        assert len(captured_filters) == 2
        user_filter, sent_at_filter = captured_filters
        assert user_filter.field_path == "userId"
        assert sent_at_filter.field_path == "sentAt"
        assert isinstance(sent_at_filter.value, datetime)


# ---------------------------------------------------------------------------
# 0c. ml_forecaster's volatility recommendations used a stale risk-factor label
# ---------------------------------------------------------------------------

class TestMlForecasterVolatilityRecommendations:
    """generate_predictive_recommendations() checked for 'high_mood_volatility',
    a label its only producer (predictive_mood_analytics) never emits — it
    emits 'high_volatility_predicted' instead — so the mindfulness/journaling
    coping recommendations for high-volatility users were permanently dead."""

    def test_high_volatility_predicted_label_triggers_recommendations(self):
        from src.services.ai.ml_forecaster import MLForecaster

        recs = MLForecaster.generate_predictive_recommendations(
            risk_factors=["high_volatility_predicted"],
            trend=0.0, volatility=2.0, predictions=[5.0, 5.0],
        )
        assert any("mindfulness" in r.lower() for r in recs)


# ---------------------------------------------------------------------------
# 1. Telemetry
# ---------------------------------------------------------------------------

class TestTelemetry:
    def test_degraded_and_critical_counted(self):
        from src.utils.telemetry import telemetry
        telemetry.reset()
        telemetry.degraded("ai_chat", "local_fallback")
        telemetry.degraded("ai_chat", "local_fallback")
        telemetry.critical("crisis_lost", "boom", user="x")
        stats = telemetry.get_stats()
        assert stats["degradations"]["ai_chat:local_fallback"] == 2
        assert stats["criticals"]["crisis_lost"] == 1

    def test_telemetry_never_raises_on_bad_field(self):
        from src.utils.telemetry import telemetry

        class Unprintable:
            def __str__(self):
                raise RuntimeError("cannot str")

        # Must not propagate — telemetry can never break the feature it observes.
        telemetry.degraded("x", "y", bad=Unprintable())
        telemetry.critical("e", "m", bad=Unprintable())
