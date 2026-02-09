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
            'ai_conversations': 2555,
            'journal_entries': 2555,
            'voice_data': 2555,
            'wellness_activities': 2555,
            'notifications': 365,  # 1 year for non-critical data
            'feedback': 2555,
            'achievements': 2555,
            'referrals': 2555
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
                users = db.collection('users').stream()  # type: ignore
                for user_doc in users:
                    current_user_id: str = user_doc.id  # type: ignore
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
                                 'journal_entries', 'wellness_activities', 'notifications',
                                 'achievements']:
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

            elif collection_name == 'voice_data':
                # Voice data is stored in mood entries, check mood timestamps
                moods_ref = db.collection('users').document(user_id).collection('moods')  # type: ignore
                old_moods = moods_ref.where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream()

                batch = db.batch()  # type: ignore
                batch_count = 0

                for doc in old_moods:
                    mood_data = doc.to_dict()
                    # Remove voice_data field if it exists
                    if 'voice_data' in mood_data:
                        update_data = {'voice_data': None, 'voice_transcript': None}
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
                                 'journal_entries', 'wellness_activities', 'notifications',
                                 'achievements']:
                collection_ref = db.collection('users').document(user_id).collection(collection_name)  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream()
                return len(list(old_docs))

            elif collection_name in ['feedback', 'referrals']:
                field_name = 'user_id' if collection_name == 'feedback' else 'referrer_id'
                collection_ref = db.collection(collection_name)  # type: ignore
                old_docs = collection_ref.where(filter=FieldFilter(field_name, '==', user_id)) \
                                       .where(filter=FieldFilter('timestamp', '<', cutoff_iso)).stream()
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
