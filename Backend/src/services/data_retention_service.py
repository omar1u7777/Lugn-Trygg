"""
Data Retention Service for GDPR and HIPAA Compliance
Implements automated data retention and deletion policies
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from google.cloud.firestore import FieldFilter

from ..firebase_config import db
from .audit_service import audit_service

logger = logging.getLogger(__name__)

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

        try:
            if user_id:
                # Process single user
                result = self._process_user_retention(user_id)
                total_deleted = result['total_deleted']
                collections_processed = result['collections']
            else:
                # Process all users
                for current_user_id in self._iter_user_ids():
                    try:
                        result = self._process_user_retention(current_user_id)
                        total_deleted += result['total_deleted']
                        collections_processed.extend(result['collections'])
                    except Exception as e:
                        logger.error(f"Failed to process retention for user {current_user_id}: {str(e)}")
                        continue

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

        except Exception as e:
            logger.error(f"Data retention failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'total_deleted': 0,
                'collections_processed': []
            }

    # Bounded so one failing page costs at most this many users, and so the
    # stream backing each page is short-lived enough not to hit a deadline.
    USER_PAGE_SIZE = 200

    def _iter_user_ids(self, page_size: int | None = None):
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
        cursor = None
        pages_failed = 0

        while True:
            query = db.collection('users').order_by('__name__').limit(size)  # type: ignore
            if cursor is not None:
                query = query.start_after({'__name__': cursor})

            try:
                batch = list(query.stream())
            except Exception as page_error:
                # Cannot advance past a page we could not read: without an id to
                # resume from, continuing would re-request the same page forever.
                logger.error(
                    "Failed to read users page after %r: %s. "
                    "Retention sweep stops here; %d page(s) failed.",
                    cursor, page_error, pages_failed + 1,
                )
                return

            if not batch:
                return

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
                old_docs = collection_ref.where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream()

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
                old_moods = moods_ref.where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream()

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
                                       .where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream()

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
                                       .where(filter=FieldFilter('created_at', '<', cutoff_date)).stream()

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
                                       .where(filter=FieldFilter('sentAt', '<', cutoff_date)).stream()

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
                old_docs = collection_ref.where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream()
                return len(list(old_docs))

            elif collection_name in ['feedback', 'referrals']:
                field_name = 'user_id' if collection_name == 'feedback' else 'referrer_id'
                collection_ref = db.collection(collection_name)  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter(field_name, '==', user_id)) \
                                       .where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream()
                return len(list(old_docs))

            elif collection_name in ('insights', 'journal_entries'):
                collection_ref = db.collection(collection_name)  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter('user_id', '==', user_id)) \
                                       .where(filter=FieldFilter('created_at', '<', cutoff_date)).stream()
                return len(list(old_docs))

            elif collection_name == 'notifications':
                collection_ref = db.collection('notifications')  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter('userId', '==', user_id)) \
                                       .where(filter=FieldFilter('sentAt', '<', cutoff_date)).stream()
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
