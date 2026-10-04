"""/health must answer while a dependency hangs.

The Firestore probe ran inline with no deadline, and the cached result was
only written after a probe finished, so every health check that arrived
while Firestore hung started its own probe. Measured locally against an
unreachable Firestore: /health did not answer within 60 s, and the worker's
threads went with it.
"""

import threading
import time

from src.utils.health_probe import HealthProbe


def test_a_hung_check_reports_timeout_within_the_deadline():
    release = threading.Event()
    probe = HealthProbe({'firebase': lambda: release.wait(30) and 'connected',
                         'redis': lambda: 'connected'}, timeout_seconds=0.2)
    started = time.monotonic()
    result = probe.result()
    elapsed = time.monotonic() - started
    release.set()
    assert result == {'firebase': 'timeout', 'redis': 'connected'}
    assert elapsed < 1.0


def test_callers_during_a_running_probe_do_not_wait_or_start_another():
    calls = []
    entered, release = threading.Event(), threading.Event()

    def slow():
        calls.append(1)
        entered.set()
        release.wait(5)
        return 'connected'

    probe = HealthProbe({'firebase': slow}, timeout_seconds=5)
    first = threading.Thread(target=probe.result)
    first.start()
    assert entered.wait(2)

    started = time.monotonic()
    concurrent = [probe.result() for _ in range(20)]
    assert time.monotonic() - started < 0.5, "concurrent callers must not block"
    assert concurrent == [None] * 20, "no result yet; caller answers 'starting'"
    assert len(calls) == 1, "single flight"

    release.set()
    first.join(2)
    assert probe.result() == {'firebase': 'connected'}
    assert len(calls) == 1, "fresh result is served from cache"


def test_stale_result_is_served_while_refreshing():
    now = [0.0]
    entered, release = threading.Event(), threading.Event()
    state = {'n': 0}

    def check():
        state['n'] += 1
        if state['n'] == 2:
            entered.set()
            release.wait(5)
        return f"run{state['n']}"

    probe = HealthProbe({'x': check}, ttl_seconds=30, timeout_seconds=5, clock=lambda: now[0])
    assert probe.result() == {'x': 'run1'}

    now[0] = 31.0
    refresher = threading.Thread(target=probe.result)
    refresher.start()
    assert entered.wait(2)
    assert probe.result() == {'x': 'run1'}, "last known result while the refresh runs"
    release.set()
    refresher.join(2)
    assert probe.result() == {'x': 'run2'}


def test_a_raising_check_is_an_error_not_a_crash():
    def boom():
        raise RuntimeError('unreachable')
    assert HealthProbe({'redis': boom}).result() == {'redis': 'error'}
