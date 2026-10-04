"""A new Gunicorn worker serves nothing until post_worker_init returns.

run_worker_bootstrap blocked it on a Firestore warmup (up to 10 s) and a
seeding transaction with no deadline. With one worker per instance, every
max_requests recycle and every deploy was an outage as long as Firestore took.
"""

import threading
import time

from src.services import background_services as bs


def test_returns_while_firestore_hangs_and_starts_consumers_first(monkeypatch):
    order = []
    release = threading.Event()

    monkeypatch.setattr(bs, 'is_test_environment', lambda: False)
    monkeypatch.setattr(bs, 'start_background_services',
                        lambda context: order.append('consumers') or [])

    def hanging_warmup():
        order.append('warmup')
        release.wait(5)

    import src.firebase_config as firebase_config
    import src.services.distributed_lock as distributed_lock
    monkeypatch.setattr(firebase_config, 'warmup_firestore', hanging_warmup)

    class NoClaim:
        def __init__(self, _name):
            pass

        def try_claim_period(self, _seconds):
            return False

    monkeypatch.setattr(distributed_lock, 'FirestoreLeaseLock', NoClaim)

    started = time.monotonic()
    thread = bs.run_worker_bootstrap(worker_pid=1)
    elapsed = time.monotonic() - started

    assert elapsed < 0.5, "post_worker_init must not wait on Firestore"
    assert order[0] == 'consumers', "crisis consumers must not wait behind warmup"
    assert thread is not None and thread.daemon
    release.set()
    thread.join(5)


def test_is_a_no_op_under_test():
    assert bs.run_worker_bootstrap(worker_pid=1) is None
