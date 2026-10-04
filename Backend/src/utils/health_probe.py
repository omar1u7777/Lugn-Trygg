"""Dependency probes for /health that can never block the worker.

/health ran the Firestore probe inline with no deadline. When Firestore did
not answer, the request hung, and because the cached result was only written
after a probe finished, every health check arriving meanwhile (Render sends
one every few seconds) started a probe of its own. Within a minute all eight
gthread threads were parked in Firestore calls and the worker served nothing,
crisis endpoints included: one slow dependency became a full outage.

Here:
- one probe runs at a time; callers that arrive while it runs get the last
  result immediately instead of starting another;
- each check runs in a worker thread with a hard deadline, so a check that
  ignores its own timeout costs one parked thread, never a request thread;
- a check that misses the deadline reports 'timeout'.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

logger = logging.getLogger(__name__)

Check = Callable[[], str]


class HealthProbe:
    def __init__(self, checks: dict[str, Check], *, ttl_seconds: float = 30.0,
                 timeout_seconds: float = 3.0, clock: Callable[[], float] = time.monotonic):
        self._checks = checks
        self._ttl = ttl_seconds
        self._timeout = timeout_seconds
        self._clock = clock
        self._lock = threading.Lock()
        self._refreshing = False
        self._result: dict[str, str] | None = None
        self._expires = 0.0
        # Separate from request threads. A hung check holds one of these, and
        # single-flight means at most one probe's worth can be held at a time.
        self._pool = ThreadPoolExecutor(max_workers=max(1, len(checks)),
                                        thread_name_prefix='health-probe')

    def result(self) -> dict[str, str] | None:
        """The current probe result, refreshing it if stale.

        Returns None only before the first probe has ever completed and while
        another caller is running it.
        """
        with self._lock:
            fresh = self._result is not None and self._clock() < self._expires
            if fresh or self._refreshing:
                return self._result
            self._refreshing = True

        try:
            result = self._run_checks()
        finally:
            with self._lock:
                self._refreshing = False
        with self._lock:
            self._result = result
            self._expires = self._clock() + self._ttl
        return result

    def _run_checks(self) -> dict[str, str]:
        futures = {name: self._pool.submit(check) for name, check in self._checks.items()}
        deadline = self._clock() + self._timeout
        result: dict[str, str] = {}
        for name, future in futures.items():
            try:
                result[name] = future.result(timeout=max(0.0, deadline - self._clock()))
            except FutureTimeout:
                logger.warning("Health check %s exceeded %.1fs", name, self._timeout)
                result[name] = 'timeout'
            except Exception as e:
                logger.warning("Health check %s failed: %s", name, e)
                result[name] = 'error'
        return result
