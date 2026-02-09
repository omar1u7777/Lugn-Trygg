"""
Automated Backup Service for Lugn & Trygg
Comprehensive backup system with scheduling, encryption, and recovery
"""

import base64
import gzip
import json
import logging
import os
import threading
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import schedule
from firebase_admin import firestore, storage

logger = logging.getLogger(__name__)

class BackupService:
    """Comprehensive backup service for all Lugn & Trygg data"""

    def __init__(self, backup_dir: str = "backups", encryption_key: str | None = None):
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)

        # Encryption settings
        self.encryption_key = encryption_key or os.getenv('BACKUP_ENCRYPTION_KEY')
        self.enable_encryption = bool(self.encryption_key)

        # Firebase services - lazy initialization
        self._db = None
        self._bucket = None
        self._bucket_name = os.getenv('FIREBASE_STORAGE_BUCKET', 'lugn-trygg-53d75.appspot.com')

        # Backup configuration
        self.backup_schedules = {
            'hourly': {'interval': 1, 'unit': 'hours', 'retention': 24},      # 24 hours
            'daily': {'interval': 1, 'unit': 'days', 'retention': 30},        # 30 days
            'weekly': {'interval': 7, 'unit': 'days', 'retention': 12},       # 12 weeks
            'monthly': {'interval': 30, 'unit': 'days', 'retention': 12},     # 12 months
        }

        # Collections to backup
        self.collections_to_backup = [
            'users', 'moods', 'memories', 'ai_stories',
            'subscriptions', 'audit_logs', 'migration_history'
        ]

        # Backup status
        self.backup_status: dict[str, Any] = {}
        self.is_running = False
        self.scheduler_thread: threading.Thread | None = None

        # Callbacks
        self.backup_callbacks: list[Callable] = []
        self.restore_callbacks: list[Callable] = []

    @property
    def db(self):
        """Lazy initialize Firestore client"""
        if self._db is None:
            self._db = firestore.client()
        return self._db

    @property
    def bucket(self):
        """Lazy initialize Storage bucket"""
        if self._bucket is None:
            self._bucket = storage.bucket(self._bucket_name)
        return self._bucket

    def start_automated_backups(self):
        """Start automated backup scheduling"""
        if self.is_running:
            return

        self.is_running = True
        self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.scheduler_thread.start()

        # Schedule backups
        self._schedule_backups()

        logger.info("🚀 Automated backup service started")

    def stop_automated_backups(self):
        """Stop automated backup scheduling"""
        self.is_running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        logger.info("⏹️ Automated backup service stopped")

    def _schedule_backups(self):
        """Set up backup schedules"""
        # Hourly backups (keep 24 hours)
        schedule.every().hour.at(":00").do(
            lambda: self.create_backup('hourly', 'firestore')
        )

        # Daily backups at 2 AM (keep 30 days)
        schedule.every().day.at("02:00").do(
            lambda: self.create_backup('daily', 'full')
        )

        # Weekly backups on Sunday at 3 AM (keep 12 weeks)
        schedule.every().sunday.at("03:00").do(
            lambda: self.create_backup('weekly', 'full')
        )

        # Monthly backups on 1st at 4 AM (keep 12 months)
        schedule.every(30).days.at("04:00").do(
            lambda: self.create_backup('monthly', 'full')
        )

    def _run_scheduler(self):
        """Run the backup scheduler"""
        while self.is_running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except Exception as e:
                logger.error(f"Backup scheduler error: {e}")
                time.sleep(300)  # Wait 5 minutes on error

    def create_backup(self, schedule_type: str, backup_type: str = 'firestore') -> str | None:
        """
        Create a backup

        Args:
            schedule_type: hourly, daily, weekly, monthly
            backup_type: firestore, storage, full

        Returns:
            Backup filename if successful
        """
        backup_id: str | None = None
        try:
            timestamp = datetime.now(UTC).strftime('%Y%m%d_%H%M%S')
            backup_id = f"{schedule_type}_{timestamp}"

            logger.info(f"📦 Creating {schedule_type} backup: {backup_id}")

            backup_data = {
                'backup_id': backup_id,
                'schedule_type': schedule_type,
                'backup_type': backup_type,
                'timestamp': datetime.now(UTC),
                'collections': {},
                'metadata': {
                    'version': '1.0',
                    'system': 'lugn-trygg',
                    'encryption': self.enable_encryption
                }
            }

            # Backup Firestore collections
            if backup_type in ['firestore', 'full']:
                for collection in self.collections_to_backup:
                    try:
                        docs = self._backup_collection(collection)
                        backup_data['collections'][collection] = docs
                        logger.info(f"✅ Backed up {len(docs)} documents from {collection}")
                    except Exception as e:
                        logger.error(f"❌ Failed to backup {collection}: {e}")
                        backup_data['collections'][collection] = {'error': str(e)}

            # Backup Firebase Storage files
            if backup_type == 'full':
                try:
                    storage_backup = self._backup_storage_files()
                    backup_data['storage'] = storage_backup
                    logger.info(f"✅ Backed up {len(storage_backup)} storage files")
                except Exception as e:
                    logger.error(f"❌ Failed to backup storage: {e}")
                    backup_data['storage'] = {'error': str(e)}

            # Save backup to file
            filename = self._save_backup(backup_data, backup_id)

            # Upload to cloud storage (for redundancy)
            if filename:
                self._upload_backup_to_cloud(filename)

            # Clean up old backups
            self._cleanup_old_backups(schedule_type)

            # Update status
            self.backup_status[backup_id] = {
                'status': 'completed',
                'timestamp': datetime.now(UTC),
                'filename': filename,
                'size': os.path.getsize(filename) if filename and os.path.exists(filename) else 0
            }

            # Trigger callbacks
            for callback in self.backup_callbacks:
                try:
                    callback(backup_id, 'completed', backup_data)
                except Exception as e:
                    logger.error(f"Backup callback error: {e}")

            logger.info(f"✅ Backup completed: {backup_id}")
            return filename

        except Exception as e:
            logger.error(f"❌ Backup failed: {e}")

            # Update status on failure
            if backup_id:
                self.backup_status[backup_id] = {
                    'status': 'failed',
                    'timestamp': datetime.now(UTC),
                    'error': str(e)
                }

            return None

    def _backup_collection(self, collection: str, batch_size: int = 1000) -> list[dict]:
        """Backup all documents in a collection"""
        docs = []
        # Order by document ID to enable cursors
        query = self.db.collection(collection).order_by('__name__').limit(batch_size)

        last_doc_ref = None
        while True:
            batch_docs = []
            for doc in query.stream():
                doc_data = doc.to_dict()
                doc_data['_id'] = doc.id
                doc_data['_backup_timestamp'] = datetime.now(UTC)
                batch_docs.append(doc_data)
                last_doc_ref = doc

            docs.extend(batch_docs)

            # If we got a full batch, there might be more
            if len(batch_docs) < batch_size:
                break

            # Get the last document reference for pagination
            if last_doc_ref:
                query = self.db.collection(collection).order_by('__name__').start_after(last_doc_ref).limit(batch_size)

        return docs

    def _backup_storage_files(self) -> list[dict]:
        """Backup Firebase Storage file metadata"""
        files = []
        try:
            blobs = self.bucket.list_blobs()
            for blob in blobs:
                file_info = {
                    'name': blob.name,
                    'size': blob.size,
                    'content_type': blob.content_type,
                    'created': blob.time_created,
                    'updated': blob.updated,
                    'metadata': blob.metadata or {}
                }
                files.append(file_info)
        except Exception as e:
            logger.error(f"Storage backup error: {e}")

        return files

    def _save_backup(self, backup_data: dict, backup_id: str) -> str | None:
        """Save backup data to compressed file"""
        try:
            # Convert to JSON
            json_data = json.dumps(backup_data, indent=2, default=str)

            # Compress
            compressed_data = gzip.compress(json_data.encode('utf-8'))

            # Encrypt if enabled
            if self.enable_encryption:
                compressed_data = self._encrypt_data(compressed_data)

            # Save to file
            filename = self.backup_dir / f"{backup_id}.backup.gz"
            with open(filename, 'wb') as f:
                f.write(compressed_data)

            logger.info(f"💾 Backup saved: {filename} ({len(compressed_data)} bytes)")
            return str(filename)

        except Exception as e:
            logger.error(f"Failed to save backup: {e}")
            return None

    def _encrypt_data(self, data: bytes) -> bytes:
        """Encrypt backup data"""
        if not self.encryption_key:
            logger.warning("No encryption key provided, skipping encryption")
            return data

        try:
            from cryptography.fernet import Fernet

            # Use encryption key to create cipher
            key = base64.urlsafe_b64encode(self.encryption_key.encode()[:32].ljust(32, b'\0'))
            cipher = Fernet(key)
            return cipher.encrypt(data)

        except ImportError:
            logger.warning("Cryptography library not available, skipping encryption")
            return data
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return data

    def _decrypt_data(self, data: bytes) -> bytes:
        """Decrypt backup data"""
        if not self.encryption_key:
            logger.warning("No encryption key provided, using unencrypted data")
            return data

        try:
            from cryptography.fernet import Fernet

            key = base64.urlsafe_b64encode(self.encryption_key.encode()[:32].ljust(32, b'\0'))
            cipher = Fernet(key)
            return cipher.decrypt(data)

        except ImportError:
            logger.warning("Cryptography library not available, using unencrypted data")
            return data
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return data

    def _upload_backup_to_cloud(self, filename: str):
        """Upload backup to cloud storage for redundancy"""
        try:
            blob = self.bucket.blob(f"backups/{Path(filename).name}")
            blob.upload_from_filename(filename)
            logger.info(f"☁️ Backup uploaded to cloud: {blob.name}")
        except Exception as e:
            logger.warning(f"Cloud upload failed: {e}")

    def _cleanup_old_backups(self, schedule_type: str):
        """Clean up old backups based on retention policy"""
        try:
            retention_days = self.backup_schedules[schedule_type]['retention']

            # Find old backup files
            pattern = f"{schedule_type}_*.backup.gz"
            backup_files = list(self.backup_dir.glob(pattern))

            # Sort by modification time (newest first)
            backup_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)

            # Remove files older than retention period
            cutoff_time = datetime.now(UTC) - timedelta(days=retention_days)

            removed_count = 0
            for backup_file in backup_files[1:]:  # Keep the newest
                file_time = datetime.fromtimestamp(
                    backup_file.stat().st_mtime,
                    tz=UTC,
                )
                if file_time < cutoff_time:
                    backup_file.unlink()
                    removed_count += 1

            if removed_count > 0:
                logger.info(f"🗑️ Cleaned up {removed_count} old {schedule_type} backups")

        except Exception as e:
            logger.warning(f"Cleanup failed: {e}")

    def restore_backup(self, backup_id_or_file: str, collections: list[str] | None = None) -> bool:
        """
        Restore from backup

        Args:
            backup_id_or_file: Backup ID or filename
            collections: Specific collections to restore (None = all)

        Returns:
            Success status
        """
        try:
            # Load backup data
            backup_data = self._load_backup(backup_id_or_file)
            if not backup_data:
                return False

            logger.info(f"🔄 Restoring backup: {backup_data['backup_id']}")

            # Restore collections
            collections_to_restore = collections or self.collections_to_backup

            for collection in collections_to_restore:
                if collection in backup_data.get('collections', {}):
                    try:
                        docs = backup_data['collections'][collection]
                        if isinstance(docs, list):
                            restored_count = self._restore_collection(collection, docs)
                            logger.info(f"✅ Restored {restored_count} documents to {collection}")
                        else:
                            logger.warning(f"Skipping {collection}: invalid data format")
                    except Exception as e:
                        logger.error(f"❌ Failed to restore {collection}: {e}")

            # Trigger callbacks
            for callback in self.restore_callbacks:
                try:
                    callback(backup_data['backup_id'], 'completed', backup_data)
                except Exception as e:
                    logger.error(f"Restore callback error: {e}")

            logger.info("✅ Backup restoration completed")
            return True

        except Exception as e:
            logger.error(f"❌ Backup restoration failed: {e}")
            return False

    def _load_backup(self, backup_id_or_file: str) -> dict | None:
        """Load backup data from file"""
        try:
            # Check if it's a file path
            if os.path.isfile(backup_id_or_file):
                filename = backup_id_or_file
            else:
                # Look for backup file by ID
                pattern = f"*{backup_id_or_file}*.backup.gz"
                matches = list(self.backup_dir.glob(pattern))
                if not matches:
                    logger.error(f"Backup not found: {backup_id_or_file}")
                    return None
                filename = str(matches[0])

            # Load and decompress
            with open(filename, 'rb') as f:
                compressed_data = f.read()

            # Decrypt if needed
            if self.enable_encryption:
                compressed_data = self._decrypt_data(compressed_data)

            # Decompress and parse
            json_data = gzip.decompress(compressed_data)
            backup_data = json.loads(json_data.decode('utf-8'))

            return backup_data

        except Exception as e:
            logger.error(f"Failed to load backup: {e}")
            return None

    def _restore_collection(self, collection: str, docs: list[dict]) -> int:
        """Restore documents to a collection"""
        restored_count = 0

        for doc in docs:
            doc_id = None
            try:
                doc_id = doc.pop('_id')
                # Remove backup metadata
                doc.pop('_backup_timestamp', None)

                # Restore document
                doc_ref = self.db.collection(collection).document(doc_id)
                doc_ref.set(doc)
                restored_count += 1

            except Exception as e:
                logger.error(f"Failed to restore document {doc_id or 'unknown'}: {e}")

        return restored_count

    def get_backup_status(self) -> dict[str, Any]:
        """Get comprehensive backup status"""
        status = {
            'service_running': self.is_running,
            'last_backups': {},
            'backup_counts': {},
            'storage_usage': self._get_storage_usage(),
            'schedule_status': {}
        }

        # Get last backup for each schedule type
        for schedule_type in self.backup_schedules.keys():
            last_backup = None
            for backup_id, backup_info in self.backup_status.items():
                if backup_id.startswith(schedule_type):
                    if not last_backup or backup_info['timestamp'] > last_backup['timestamp']:
                        last_backup = backup_info

            status['last_backups'][schedule_type] = last_backup

        # Count backups by type
        for backup_id in self.backup_status.keys():
            schedule_type = backup_id.split('_')[0]
            status['backup_counts'][schedule_type] = status['backup_counts'].get(schedule_type, 0) + 1

        # Schedule status
        for schedule_type, config in self.backup_schedules.items():
            next_run = self._get_next_run_time(schedule_type)
            status['schedule_status'][schedule_type] = {
                'next_run': next_run,
                'retention_days': config['retention']
            }

        return status

    def _get_storage_usage(self) -> dict[str, Any]:
        """Get backup storage usage"""
        try:
            total_size = 0
            file_count = 0

            for backup_file in self.backup_dir.glob("*.backup.gz"):
                total_size += backup_file.stat().st_size
                file_count += 1

            return {
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'file_count': file_count,
                'average_size_mb': round(total_size / (1024 * 1024) / max(file_count, 1), 2)
            }
        except Exception as e:
            logger.error(f"Storage usage calculation failed: {e}")
            return {'error': str(e)}

    def _get_next_run_time(self, schedule_type: str) -> datetime | None:
        """Get next scheduled run time"""
        # This is a simplified implementation
        # In a real system, you'd query the schedule library
        now = datetime.now(UTC)

        if schedule_type == 'hourly':
            # Next hour
            next_run = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        elif schedule_type == 'daily':
            # Tomorrow at 2 AM
            next_run = (now + timedelta(days=1)).replace(hour=2, minute=0, second=0, microsecond=0)
        elif schedule_type == 'weekly':
            # Next Sunday at 3 AM
            days_until_sunday = (6 - now.weekday()) % 7
            if days_until_sunday == 0:
                days_until_sunday = 7
            next_run = (now + timedelta(days=days_until_sunday)).replace(hour=3, minute=0, second=0, microsecond=0)
        elif schedule_type == 'monthly':
            # 1st of next month at 4 AM
            if now.month == 12:
                next_month = 1
                next_year = now.year + 1
            else:
                next_month = now.month + 1
                next_year = now.year
            next_run = datetime(next_year, next_month, 1, 4, 0, 0)
        else:
            return None

        return next_run if next_run > now else None

    def add_backup_callback(self, callback: Callable):
        """Add callback for backup events"""
        self.backup_callbacks.append(callback)

    def add_restore_callback(self, callback: Callable):
        """Add callback for restore events"""
        self.restore_callbacks.append(callback)

    def create_manual_backup(self, backup_type: str = 'full') -> str | None:
        """Create a manual backup"""
        return self.create_backup('manual', backup_type)

    def list_backups(self) -> list[dict[str, Any]]:
        """List all available backups"""
        backups = []

        try:
            for backup_file in self.backup_dir.glob("*.backup.gz"):
                stat = backup_file.stat()
                backup_info = {
                    'filename': backup_file.name,
                    'path': str(backup_file),
                    'size_bytes': stat.st_size,
                    'size_mb': round(stat.st_size / (1024 * 1024), 2),
                    'created': datetime.fromtimestamp(stat.st_mtime),
                    'schedule_type': backup_file.name.split('_')[0]
                }
                backups.append(backup_info)

            # Sort by creation time (newest first)
            backups.sort(key=lambda x: x['created'], reverse=True)

        except Exception as e:
            logger.error(f"Failed to list backups: {e}")

        return backups

# Global backup service instance (lazy initialization to avoid Firebase init at import time)
backup_service = None

def _get_backup_service():
    """Lazy initialization of backup service"""
    global backup_service
    if backup_service is None:
        backup_service = BackupService()
    return backup_service

def start_backup_service():
    """Start the automated backup service"""
    _get_backup_service().start_automated_backups()

def stop_backup_service():
    """Stop the automated backup service"""
    _get_backup_service().stop_automated_backups()

def create_backup(schedule_type: str = 'manual', backup_type: str = 'firestore') -> str | None:
    """Create a backup"""
    return _get_backup_service().create_backup(schedule_type, backup_type)

def restore_backup(backup_id: str, collections: list[str] | None = None) -> bool:
    """Restore from backup"""
    return _get_backup_service().restore_backup(backup_id, collections)

def get_backup_status() -> dict[str, Any]:
    """Get backup service status"""
    return _get_backup_service().get_backup_status()

__all__ = [
    'BackupService',
    'backup_service',
    'start_backup_service',
    'stop_backup_service',
    'create_backup',
    'restore_backup',
    'get_backup_status'
]
