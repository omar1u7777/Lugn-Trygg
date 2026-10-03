"""
Data Retention Service for GDPR and HIPAA Compliance
Implements automated data retention and deletion policies
"""

import logging
import threading
import time
from datetime import UTC, datetime, timedelta
from typing import Any

from google.api_core import exceptions as gapi_exceptions
from google.api_core import retry as gapi_retry
from google.cloud.firestore import FieldFilter

from ..firebase_config import db
from .audit_service import audit_service

logger = logging.getLogger(__name__)


class RetentionEnumerationError(RuntimeError):
    """Raised when the user enumeration itself fails.

    Distinct from a per-user failure, which is logged and skipped. This one
    means the sweep does not know where it stopped, so the caller must keep the
    existing resume cursor rather than treating the short iteration as
    completion.
    """


# Cooperative shutdown for the all-users sweep.
#
# The sweep runs in a daemon thread of a Gunicorn worker, and that worker is
# recycled on max_requests roughly every 73 minutes. A recycle is planned and
# graceful, but a daemon thread is not told about it: it simply stops existing
# when the interpreter exits. The per-page checkpoint keeps the progress, yet
# the next run still finds the in-progress flag and raises
# data_retention_interrupted at level=fatal — so a routine recycle and a real
# kill (OOM, SIGKILL) produced the same alarm, about one night in three.
#
# Gunicorn's worker_exit hook runs in the worker after the serving loop has
# drained and before the process exits. It sets _stop_requested and waits on
# _sweep_idle; the sweep sees the request at the next user boundary, writes
# its position as a clean stop, and returns. The alarm is then left for the
# deaths nothing could announce.
_stop_requested = threading.Event()
_sweep_idle = threading.Event()
_sweep_idle.set()


def request_sweep_stop(timeout: float) -> bool:
    """Ask a running sweep to stop at the next user boundary and wait for it.

    Returns True when no sweep is running by the time this returns, False if
    it was still running after `timeout` seconds.
    """
    _stop_requested.set()
    return _sweep_idle.wait(timeout)


class DataRetentionService:
    """Service for managing data retention policies"""

    def __init__(self):
        # GDPR: Configurable retention periods (default 7 years for medical data)
        self.gdpr_retention_days = {
            'moods': 2555,  # 7 years
            'memories': 2555,
            'chat_sessions': 2555,
            'ai_conversations': 2555,  # legacy collection name, kept for any old data
            # 'conversations' is the ACTUAL AI chat transcript store written by
            # chatbot_routes.py (users/{uid}/conversations). Without this entry
            # the daily retention sweep deleted everything EXCEPT the highest-
            # sensitivity data — verbatim therapy transcripts accumulated forever.
            'conversations': 2555,
            'journal_entries': 2555,
            'voice_recordings': 2555,
            'wellness_activities': 2555,
            'notifications': 365,  # 1 year for non-critical data
            'feedback': 2555,
            'achievements': 2555,
            'referrals': 2555,
            # Root-level, user_id-filtered, AI-generated psychological
            # insights — same 7-year clinical-data retention as moods/
            # conversations. See _delete_expired_data: 'created_at' here is
            # stored as a native Firestore Timestamp (daily_insight_service_v2
            # writes a datetime object, not .isoformat()), so it needs the
            # datetime cutoff, not the ISO-string cutoff used elsewhere.
            'insights': 2555,
        }

        # HIPAA: 7 years minimum for medical records
        self.hipaa_retention_days = 2555

    def apply_retention_policy(self, user_id: str | None = None) -> dict[str, Any]:
        """
        Apply data retention policies to delete expired data

        Args:
            user_id: Specific user to process, or None for all users

        Returns:
            Dict with deletion statistics
        """
        logger.info(f"🗑️ Starting data retention enforcement{' for user ' + user_id if user_id else ' for all users'}")

        total_deleted = 0
        collections_processed = []
        users_processed = 0

        if user_id is None:
            # Single-user calls are short HTTP requests; only the all-users
            # sweep outlives a request and needs worker_exit to wait for it.
            _sweep_idle.clear()

        try:
            if user_id:
                # Process single user
                result = self._process_user_retention(user_id)
                total_deleted = result['total_deleted']
                collections_processed = result['collections']
            else:
                # Process all users, resuming where a budget-limited run stopped.
                started = time.monotonic()
                resume_from = self._read_cursor()

                # A killed sweep cannot report its own death — the worker is
                # gone before it can log. The only durable trace is the flag
                # its last checkpoint left behind, so the NEXT run is what
                # raises the alarm.
                if self._previous_run_was_interrupted():
                    from src.utils.telemetry import telemetry
                    telemetry.critical(
                        'data_retention_interrupted',
                        'The previous retention sweep was killed before it finished',
                        resume_after=str(resume_from),
                    )

                if resume_from:
                    logger.info("🗑️ Retention resuming after user %s", resume_from)

                last_seen: str | None = resume_from
                for current_user_id in self._iter_user_ids(start_after=resume_from):
                    if _stop_requested.is_set():
                        stopped_by = 'shutdown'
                    elif time.monotonic() - started > self.SWEEP_BUDGET_SECONDS:
                        stopped_by = 'budget'
                    else:
                        stopped_by = None

                    if stopped_by:
                        # Stop on our own terms rather than being killed mid-user.
                        self._write_cursor(last_seen, in_progress=False)
                        logger.warning(
                            "🗑️ Retention stopped (%s) after %d users; "
                            "%d records deleted. Resuming after %r next run.",
                            stopped_by, users_processed, total_deleted, last_seen,
                        )
                        return {
                            'success': True,
                            'partial': True,
                            'stopped_by': stopped_by,
                            'resume_after': last_seen,
                            'users_processed': users_processed,
                            'total_deleted': total_deleted,
                            'collections_processed': collections_processed,
                            'timestamp': datetime.now(UTC).isoformat(),
                        }

                    try:
                        result = self._process_user_retention(current_user_id)
                        total_deleted += result['total_deleted']
                        collections_processed.extend(result['collections'])
                    except Exception as e:
                        logger.error(f"Failed to process retention for user {current_user_id}: {str(e)}")
                    finally:
                        # Advance even when a user failed: retrying that one
                        # user forever would starve everybody after them.
                        last_seen = current_user_id
                        users_processed += 1

                    # Checkpoint on the page boundary, so the flag and the
                    # position always mean "this page is fully processed".
                    if users_processed % self.USER_PAGE_SIZE == 0:
                        self._write_cursor(last_seen, in_progress=True)

                # Reached the end of the collection — next run starts fresh.
                # Only on a genuine end: RetentionEnumerationError skips this
                # and is handled below, preserving the cursor.
                self._write_cursor(None, in_progress=False)

            # Audit the retention operation
            audit_service.log_event(
                'DATA_RETENTION_EXECUTED',
                user_id or 'SYSTEM',
                {
                    'total_records_deleted': total_deleted,
                    'collections_processed': collections_processed,
                    'retention_policy': 'GDPR_HIPAA_COMPLIANT'
                }
            )

            logger.info(f"✅ Data retention completed: {total_deleted} records deleted")
            return {
                'success': True,
                'total_deleted': total_deleted,
                'collections_processed': collections_processed,
                'timestamp': datetime.now(UTC).isoformat()
            }

        except RetentionEnumerationError as e:
            # The cursor is deliberately left where it was: this run does not
            # know where it stopped, so tomorrow resumes from the last position
            # it DID confirm rather than starting over or skipping ahead.
            # Terminal, but NOT killed — clear the flag without touching the
            # position, which must survive exactly as it was.
            self._clear_in_progress()
            logger.error("Data retention could not enumerate users: %s", e)
            return {
                'success': False,
                'error': str(e),
                'total_deleted': total_deleted,
                'users_processed': users_processed,
                'collections_processed': collections_processed,
            }
        except Exception as e:
            # Terminal too: the run failed, but it was not killed, and the flag
            # must only ever mean the latter. Guarded on the sweep, because a
            # single-user call does not own the cursor — clearing the flag on
            # its behalf would erase the evidence that last night's sweep died.
            if user_id is None:
                self._clear_in_progress()
            logger.error(f"Data retention failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'total_deleted': total_deleted,
                'collections_processed': collections_processed,
            }
        finally:
            if user_id is None:
                _sweep_idle.set()

    # Bounded so one failing page costs at most this many users, and so the
    # stream backing each page is short-lived enough not to hit a deadline.
    USER_PAGE_SIZE = 200

    # It doubles as the checkpoint cadence: the resume position is made
    # durable at each page boundary, so the stored position always means
    # "this page is fully processed".
    #
    # The budget below can only stop a sweep that is still alive to read it,
    # and this one usually is not: it needs ~19.5 minutes and lives inside a
    # Gunicorn worker that recycles on max_requests. Five consecutive runs:
    #
    #   2026-08-19  died after 12.7 min, 6 pages
    #   2026-08-20  died after 12.8 min, 6 pages
    #   2026-08-21  COMPLETED in 19.4 min, 1499 users
    #   2026-08-22  worker recycled after 11.5 min, 5 pages
    #   2026-08-23  worker recycled after 14.4 min, 6 pages
    #
    # The last is the one that settles it: it is the first run on the budget
    # code above, and the budget still never fired. The job was claimed by pid
    # 10323 at 03:22:40 and gunicorn logged "Autorestarting worker after
    # current request" for that same pid at 03:37:02.
    #
    # Four of the five were killed, and because the position was only written
    # on a clean stop, all three threw away every user they had processed. The
    # next run started from the top and died in the same place. Only the run
    # that happened to get a fresh worker ever finished.
    #
    # Checkpointing per page makes being killed merely "stopped early": the
    # next run resumes where this one got to, so the collection is swept across
    # however many runs it takes instead of only on a lucky night. One small
    # document write per page — 8 per sweep at current user counts.

    # Wall-clock budget for one sweep.
    #
    # The sweep runs in a daemon thread of a Gunicorn worker that recycles on
    # max_requests. On 2026-08-16 it started at 03:03:26 and the worker was
    # replaced at 03:15:33 — twelve minutes in. Nothing was logged after
    # "Starting": a killed process raises nothing, so apply_retention_policy
    # never returned, the success verdict was never read, and telemetry.critical
    # never fired. Sentry showed a clean night.
    #
    # I wrote that this was "comfortably inside the shortest recycle interval
    # observed (34 min)". That reasoning was wrong, and four nights of logs
    # show it. The interval does not matter: the sweep starts at a fixed time
    # and inherits whatever is LEFT of the current worker's life, which is
    # roughly uniform across that interval. A 20-minute budget therefore loses
    # far more often than it wins — observed kills at 11.5, 12.7, 12.8 and
    # 14.4 minutes against one completion at 19.4.
    #
    # The budget is kept at 20 anyway, because the fix for being killed is the
    # per-page checkpoint above, not a shorter deadline. Lowering it under the
    # typical survival time would guarantee that NO run ever completes, and
    # would also silence the interrupted-sweep alarm — which is the evidence
    # that this job needs a different home.
    #
    # That home is a Render Cron Job. This makes the current one survivable
    # and honest about what it managed; it does not make it right.
    SWEEP_BUDGET_SECONDS = 20 * 60

    # Every Firestore call in this sweep runs on a deadline.
    #
    # Without one they block indefinitely, and the budget above cannot save
    # them: it is evaluated inside the per-user loop, so it only runs BETWEEN
    # users. A call that never returns means the loop never advances and the
    # budget is never read. That is not hypothetical — on 2026-08-17 the sweep
    # logged "Starting data retention enforcement" at 03:42 and had produced
    # nothing at all by 04:14, past its own 20-minute budget, on a worker that
    # was still alive and serving health checks.
    #
    # 30s is generous for a 200-document page; anything slower is a stuck call,
    # not a slow one, and raising is what lets the sweep record where it got to
    # and resume next run instead of vanishing.
    QUERY_TIMEOUT_SECONDS = 30

    # Passed explicitly on every call, and the reason is not politeness.
    #
    # google-cloud-firestore's _retry_query_after_exception (query.py) reads
    # `gapic_callable._retry` to decide whether a faulted stream is retryable —
    # but ONLY on the branch taken when the caller left retry at DEFAULT. On
    # some grpcio builds that attribute does not exist, and the lookup raises
    # AttributeError from inside the library's own error handling, replacing
    # whatever the real failure was. That is the
    # "'_UnaryStreamMultiCallable' object has no attribute '_retry'" this sweep
    # died on: not our bug, but ours to avoid.
    #
    # Supplying a Retry means `retry is DEFAULT` is False, the lookup is never
    # reached, and a transient fault is retried on our terms instead of on an
    # attribute that may or may not be there.
    QUERY_RETRY = gapi_retry.Retry(
        predicate=gapi_retry.if_exception_type(
            gapi_exceptions.ServiceUnavailable,
            gapi_exceptions.DeadlineExceeded,
            gapi_exceptions.InternalServerError,
        ),
        initial=1.0,
        maximum=8.0,
        multiplier=2.0,
        timeout=QUERY_TIMEOUT_SECONDS,
    )

    # Where the resume point lives between runs.
    CURSOR_DOC = ('system', 'data_retention_cursor')

    def _read_cursor(self) -> str | None:
        """The user id the last budget-limited sweep stopped after."""
        try:
            snap = db.collection(self.CURSOR_DOC[0]).document(self.CURSOR_DOC[1]).get()  # type: ignore
            if snap.exists:
                return (snap.to_dict() or {}).get('last_user_id')
        except Exception as e:
            logger.warning("Could not read retention cursor, starting from the top: %s", e)
        return None

    def _previous_run_was_interrupted(self) -> bool:
        """True when the last sweep never reached a terminal state.

        Every way a sweep can stop on purpose clears this flag. So if it is
        still set, the process holding the sweep died — and a dead process
        logs nothing, which is precisely why three killed runs in four days
        looked exactly like no runs at all.
        """
        try:
            snap = db.collection(self.CURSOR_DOC[0]).document(self.CURSOR_DOC[1]).get()  # type: ignore
            if snap.exists:
                return bool((snap.to_dict() or {}).get('in_progress'))
        except Exception as e:
            logger.warning("Could not read retention cursor state: %s", e)
        return False

    def _write_cursor(self, last_user_id: str | None, *, in_progress: bool = False) -> None:
        """Persist the resume point and whether the sweep is still running.

        `in_progress=True` is written only by the mid-sweep checkpoint. Every
        terminal path writes False, so a True left in the document means the
        run never reached one.
        """
        try:
            ref = db.collection(self.CURSOR_DOC[0]).document(self.CURSOR_DOC[1])  # type: ignore
            ref.set({
                'last_user_id': last_user_id,
                'in_progress': in_progress,
                'updated_at': datetime.now(UTC),
            })
        except Exception as e:
            # Losing the cursor costs a restart from the top, not correctness.
            logger.warning("Could not persist retention cursor: %s", e)

    def _clear_in_progress(self) -> None:
        """Mark the run terminal without touching the resume position.

        Used when enumeration failed. Rewriting the position from this run's
        local variable would risk overwriting a real cursor with None if the
        READ was the thing that failed, and the whole point of that path is
        that the position survives untouched. merge=True leaves it alone.
        """
        try:
            ref = db.collection(self.CURSOR_DOC[0]).document(self.CURSOR_DOC[1])  # type: ignore
            ref.set({'in_progress': False, 'updated_at': datetime.now(UTC)}, merge=True)
        except Exception as e:
            logger.warning("Could not clear retention in-progress flag: %s", e)

    def _iter_user_ids(self, page_size: int | None = None, start_after: str | None = None):
        """Yield user ids, one cursor-paged batch at a time.

        `db.collection('users').stream()` is a single long-lived gRPC stream and
        it is consumed LAZILY: an exception surfaces inside the caller's `for`
        loop, not at the .stream() call. It therefore escaped the per-user and
        per-collection handlers, reached the top-level `except`, and aborted the
        entire sweep — every remaining user skipped, `success: False` returned,
        nothing deleted. That is how a GDPR Art. 17 obligation became one log
        line.

        It is not hypothetical. On 2026-08-15 the sweep died exactly this way
        with "'_UnaryStreamMultiCallable' object has no attribute '_retry'", a
        google-cloud-firestore/grpcio incompatibility in the library's own
        stream-retry path (googleapis/python-firestore#939). The bug only became
        reachable once the missing composite indexes were deployed and the sweep
        got far enough to stream.

        Paging bounds the blast radius to one page: a page that fails is logged
        and skipped, and the sweep continues from the last id it did read.
        Ordering by document id needs no composite index.
        """
        size = page_size or self.USER_PAGE_SIZE
        cursor = start_after
        pages_failed = 0

        while True:
            query = db.collection('users').order_by('__name__').limit(size)  # type: ignore
            if cursor is not None:
                query = query.start_after({'__name__': cursor})

            try:
                batch = list(query.stream(retry=self.QUERY_RETRY, timeout=self.QUERY_TIMEOUT_SECONDS))
            except Exception as page_error:
                # Cannot advance past a page we could not read: without an id to
                # resume from, continuing would re-request the same page forever.
                #
                # RAISE rather than return. Returning ends the generator, which
                # to the caller is indistinguishable from reaching the last page
                # — and the caller responds to that by clearing the resume
                # cursor. A page that timed out would therefore have looked like
                # a completed sweep and thrown away the position, so the users
                # after it would be skipped again the next night, silently.
                logger.error(
                    "Failed to read users page after %r: %s. "
                    "Retention sweep stops here; %d page(s) failed.",
                    cursor, page_error, pages_failed + 1,
                )
                raise RetentionEnumerationError(
                    f"users page after {cursor!r} could not be read: {page_error}"
                ) from page_error

            if not batch:
                return

            # A heartbeat per page. The old sweep logged "Starting" and then
            # nothing until it finished, so a run that died left no way to tell
            # whether it had processed nobody or almost everybody.
            logger.info(
                "🗑️ Retention: read %d users after %r", len(batch), cursor,
            )

            for doc in batch:
                yield doc.id

            if len(batch) < size:
                return
            cursor = batch[-1].id

    def _process_user_retention(self, user_id: str) -> dict[str, Any]:
        """Process data retention for a specific user"""
        total_deleted = 0
        collections = []

        # Process each collection with retention policy
        for collection_name, retention_days in self.gdpr_retention_days.items():
            try:
                deleted_count = self._delete_expired_data(user_id, collection_name, retention_days)
                if deleted_count > 0:
                    total_deleted += deleted_count
                    collections.append({
                        'collection': collection_name,
                        'deleted': deleted_count,
                        'retention_days': retention_days
                    })
                    logger.info(f"  ✓ Deleted {deleted_count} expired {collection_name} for user {user_id}")
            except Exception as e:
                logger.error(f"Failed to process {collection_name} for user {user_id}: {str(e)}")
                continue

        return {
            'total_deleted': total_deleted,
            'collections': collections
        }

    def _delete_expired_data(self, user_id: str, collection_name: str, retention_days: int) -> int:
        """Delete data older than retention period for a specific collection"""
        cutoff_date = datetime.now(UTC) - timedelta(days=retention_days)
        cutoff_iso = cutoff_date.isoformat()

        deleted_count = 0

        try:
            if collection_name in ['moods', 'memories', 'chat_sessions', 'ai_conversations',
                                 'conversations', 'wellness_activities', 'achievements']:
                # Subcollections under users/{user_id}/collection_name
                collection_ref = db.collection('users').document(user_id).collection(collection_name)  # type: ignore

                # Query for old documents
                old_docs = collection_ref.where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream(retry=self.QUERY_RETRY, timeout=self.QUERY_TIMEOUT_SECONDS)

                # Delete in batches
                batch = db.batch()  # type: ignore
                batch_count = 0

                for doc in old_docs:
                    batch.delete(doc.reference)
                    batch_count += 1
                    deleted_count += 1

                    # Commit batch every 500 operations
                    if batch_count >= 500:
                        batch.commit()
                        batch = db.batch()  # type: ignore
                        batch_count = 0

                # Commit remaining
                if batch_count > 0:
                    batch.commit()

            elif collection_name == 'voice_recordings':
                # Voice data is stored in mood entries, check mood timestamps
                moods_ref = db.collection('users').document(user_id).collection('moods')  # type: ignore
                old_moods = moods_ref.where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream(retry=self.QUERY_RETRY, timeout=self.QUERY_TIMEOUT_SECONDS)

                batch = db.batch()  # type: ignore
                batch_count = 0

                for doc in old_moods:
                    mood_data = doc.to_dict()
                    # Remove voice_url field if it exists
                    if 'voice_url' in mood_data:
                        update_data = {'voice_url': None, 'voice_transcript': None}
                        batch.update(doc.reference, update_data)
                        batch_count += 1
                        deleted_count += 1

                        if batch_count >= 500:
                            batch.commit()
                            batch = db.batch()  # type: ignore
                            batch_count = 0

                if batch_count > 0:
                    batch.commit()

            elif collection_name in ['feedback', 'referrals']:
                # Root level collections with user_id field
                field_name = 'user_id' if collection_name == 'feedback' else 'referrer_id'
                collection_ref = db.collection(collection_name)  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter(field_name, '==', user_id)) \
                                       .where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream(retry=self.QUERY_RETRY, timeout=self.QUERY_TIMEOUT_SECONDS)

                batch = db.batch()  # type: ignore
                batch_count = 0

                for doc in old_docs:
                    batch.delete(doc.reference)
                    batch_count += 1
                    deleted_count += 1

                    if batch_count >= 500:
                        batch.commit()
                        batch = db.batch()  # type: ignore
                        batch_count = 0

                if batch_count > 0:
                    batch.commit()

            elif collection_name in ('insights', 'journal_entries'):
                # Root-level, user_id-filtered like feedback/referrals, but
                # 'created_at' is a native Firestore Timestamp field, not an
                # ISO string — pass the datetime object, not cutoff_iso.
                # journal_entries: writer is journal_routes.py, which stores
                # documents in the TOP-LEVEL 'journal_entries' collection
                # (field 'user_id', 'created_at' as datetime.now(UTC)) — NOT
                # a users/{uid} subcollection with an ISO 'timestamp' field,
                # which is what this branch used to (incorrectly) assume.
                collection_ref = db.collection(collection_name)  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter('user_id', '==', user_id)) \
                                       .where(filter=FieldFilter('created_at', '<', cutoff_date)).stream(retry=self.QUERY_RETRY, timeout=self.QUERY_TIMEOUT_SECONDS)

                batch = db.batch()  # type: ignore
                batch_count = 0

                for doc in old_docs:
                    batch.delete(doc.reference)
                    batch_count += 1
                    deleted_count += 1

                    if batch_count >= 500:
                        batch.commit()
                        batch = db.batch()  # type: ignore
                        batch_count = 0

                if batch_count > 0:
                    batch.commit()

            elif collection_name == 'notifications':
                # notifications_routes.py writes to the TOP-LEVEL
                # 'notifications' collection with a camelCase 'userId' field
                # and 'sentAt' as a native Firestore Timestamp — not a
                # users/{uid} subcollection with an ISO 'timestamp' field.
                collection_ref = db.collection('notifications')  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter('userId', '==', user_id)) \
                                       .where(filter=FieldFilter('sentAt', '<', cutoff_date)).stream(retry=self.QUERY_RETRY, timeout=self.QUERY_TIMEOUT_SECONDS)

                batch = db.batch()  # type: ignore
                batch_count = 0

                for doc in old_docs:
                    batch.delete(doc.reference)
                    batch_count += 1
                    deleted_count += 1

                    if batch_count >= 500:
                        batch.commit()
                        batch = db.batch()  # type: ignore
                        batch_count = 0

                if batch_count > 0:
                    batch.commit()

        except Exception as e:
            logger.error(f"Error deleting expired {collection_name} data for user {user_id}: {str(e)}")
            raise

        return deleted_count

    def get_retention_status(self, user_id: str) -> dict[str, Any]:
        """Get current data retention status for a user"""
        status = {}

        for collection_name, retention_days in self.gdpr_retention_days.items():
            try:
                count = self._count_expired_data(user_id, collection_name, retention_days)
                status[collection_name] = {
                    'retention_days': retention_days,
                    'expired_count': count,
                    'will_be_deleted': count > 0
                }
            except Exception as e:
                logger.error(f"Failed to get retention status for {collection_name}: {str(e)}")
                status[collection_name] = {'error': str(e)}

        return {
            'user_id': user_id,
            'retention_status': status,
            'next_cleanup': (datetime.now(UTC) + timedelta(days=1)).isoformat()
        }

    def _count_expired_data(self, user_id: str, collection_name: str, retention_days: int) -> int:
        """Count expired data without deleting"""
        cutoff_date = datetime.now(UTC) - timedelta(days=retention_days)
        cutoff_iso = cutoff_date.isoformat()

        try:
            if collection_name in ['moods', 'memories', 'chat_sessions', 'ai_conversations',
                                 'conversations', 'wellness_activities', 'achievements']:
                collection_ref = db.collection('users').document(user_id).collection(collection_name)  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream(retry=self.QUERY_RETRY, timeout=self.QUERY_TIMEOUT_SECONDS)
                return len(list(old_docs))

            elif collection_name in ['feedback', 'referrals']:
                field_name = 'user_id' if collection_name == 'feedback' else 'referrer_id'
                collection_ref = db.collection(collection_name)  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter(field_name, '==', user_id)) \
                                       .where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream(retry=self.QUERY_RETRY, timeout=self.QUERY_TIMEOUT_SECONDS)
                return len(list(old_docs))

            elif collection_name in ('insights', 'journal_entries'):
                collection_ref = db.collection(collection_name)  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter('user_id', '==', user_id)) \
                                       .where(filter=FieldFilter('created_at', '<', cutoff_date)).stream(retry=self.QUERY_RETRY, timeout=self.QUERY_TIMEOUT_SECONDS)
                return len(list(old_docs))

            elif collection_name == 'notifications':
                collection_ref = db.collection('notifications')  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter('userId', '==', user_id)) \
                                       .where(filter=FieldFilter('sentAt', '<', cutoff_date)).stream(retry=self.QUERY_RETRY, timeout=self.QUERY_TIMEOUT_SECONDS)
                return len(list(old_docs))

        except Exception as e:
            logger.error(f"Error counting expired {collection_name} data: {str(e)}")
            return 0

        return 0

    def schedule_retention_cleanup(self) -> None:
        """Schedule automated retention cleanup (to be called by cron/scheduler)"""
        logger.info("🕐 Running scheduled data retention cleanup")

        try:
            result = self.apply_retention_policy()

            if result['success']:
                logger.info(f"✅ Scheduled retention cleanup completed: {result['total_deleted']} records deleted")
            else:
                logger.error(f"❌ Scheduled retention cleanup failed: {result['error']}")

        except Exception as e:
            logger.error(f"Scheduled retention cleanup error: {str(e)}")

# Global instance
data_retention_service = DataRetentionService()
