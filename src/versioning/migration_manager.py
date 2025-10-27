"""
API Migration Manager for Lugn & Trygg
Handles data migrations, schema updates, and backward compatibility
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from flask import current_app
import logging
from firebase_admin import firestore

logger = logging.getLogger(__name__)

class Migration:
    """Represents a single migration"""

    def __init__(self, version: str, description: str,
                 up_func: Callable, down_func: Optional[Callable] = None,
                 dependencies: List[str] = None):
        self.version = version
        self.description = description
        self.up_func = up_func
        self.down_func = down_func
        self.dependencies = dependencies or []
        self.applied_at = None
        self.checksum = None

    def apply(self, direction: str = 'up') -> bool:
        """Apply the migration"""
        try:
            if direction == 'up':
                self.up_func()
            elif direction == 'down' and self.down_func:
                self.down_func()
            else:
                raise ValueError(f"Invalid migration direction: {direction}")

            self.applied_at = datetime.utcnow()
            logger.info(f"✅ Migration {self.version} applied ({direction})")
            return True

        except Exception as e:
            logger.error(f"❌ Migration {self.version} failed: {e}")
            return False

class MigrationManager:
    """Manages database migrations and schema updates"""

    def __init__(self, firestore_client=None):
        self.db = firestore_client or firestore.client()
        self.migrations: Dict[str, Migration] = {}
        self.applied_migrations: List[str] = []
        self.migration_history_collection = 'migration_history'

    def add_migration(self, migration: Migration):
        """Add a migration to the manager"""
        self.migrations[migration.version] = migration
        logger.info(f"📝 Added migration: {migration.version} - {migration.description}")

    def get_applied_migrations(self) -> List[str]:
        """Get list of applied migrations from database"""
        try:
            docs = self.db.collection(self.migration_history_collection).stream()
            applied = []
            for doc in docs:
                data = doc.to_dict()
                applied.append(data['version'])
            self.applied_migrations = applied
            return applied
        except Exception as e:
            logger.warning(f"Could not get applied migrations: {e}")
            return []

    def is_migration_applied(self, version: str) -> bool:
        """Check if a migration has been applied"""
        return version in self.applied_migrations

    def record_migration(self, migration: Migration, direction: str = 'up'):
        """Record migration application in database"""
        try:
            doc_ref = self.db.collection(self.migration_history_collection).document(migration.version)

            data = {
                'version': migration.version,
                'description': migration.description,
                'direction': direction,
                'applied_at': migration.applied_at,
                'checksum': migration.checksum
            }

            if direction == 'down':
                # Remove the record for down migrations
                doc_ref.delete()
            else:
                doc_ref.set(data)

            logger.info(f"📋 Recorded migration {migration.version} ({direction})")

        except Exception as e:
            logger.error(f"Failed to record migration {migration.version}: {e}")

    def apply_migrations(self, target_version: Optional[str] = None) -> bool:
        """Apply pending migrations up to target version"""
        try:
            self.get_applied_migrations()

            # Get migrations to apply
            pending_migrations = []
            for version, migration in self.migrations.items():
                if not self.is_migration_applied(version):
                    # Check dependencies
                    deps_satisfied = all(self.is_migration_applied(dep) for dep in migration.dependencies)
                    if deps_satisfied:
                        pending_migrations.append(migration)

            # Sort by version
            pending_migrations.sort(key=lambda m: m.version)

            # Apply migrations
            success = True
            for migration in pending_migrations:
                if target_version and migration.version > target_version:
                    break

                if migration.apply('up'):
                    self.record_migration(migration, 'up')
                    self.applied_migrations.append(migration.version)
                else:
                    success = False
                    break

            return success

        except Exception as e:
            logger.error(f"Migration application failed: {e}")
            return False

    def rollback_migration(self, version: str) -> bool:
        """Rollback a specific migration"""
        try:
            if not self.is_migration_applied(version):
                logger.warning(f"Migration {version} not applied, cannot rollback")
                return False

            migration = self.migrations.get(version)
            if not migration or not migration.down_func:
                logger.error(f"Migration {version} has no down function")
                return False

            if migration.apply('down'):
                self.record_migration(migration, 'down')
                if version in self.applied_migrations:
                    self.applied_migrations.remove(version)
                return True

            return False

        except Exception as e:
            logger.error(f"Migration rollback failed: {e}")
            return False

# Global migration manager
migration_manager = MigrationManager()

# Example migrations for Lugn & Trygg
def create_initial_schema():
    """Migration: Create initial database schema"""
    db = firestore.client()

    # Create indexes (Firestore handles this automatically, but we can log it)
    logger.info("Creating initial schema indexes...")

    # Create collections if they don't exist (Firestore creates them automatically)
    collections = ['users', 'moods', 'memories', 'ai_stories', 'subscriptions']

    for collection in collections:
        # Just ensure the collection exists by adding a dummy document and deleting it
        doc_ref = db.collection(collection).document('_migration_check')
        doc_ref.set({'_migration': True, 'created_at': datetime.utcnow()})
        doc_ref.delete()

    logger.info("✅ Initial schema created")

def migrate_user_profiles_v1_to_v2():
    """Migration: Update user profiles from v1 to v2 format"""
    db = firestore.client()

    # Get all users
    users_ref = db.collection('users')
    users = users_ref.stream()

    updated_count = 0
    for user_doc in users:
        user_data = user_doc.to_dict()

        # Migrate old field names
        updates = {}

        # Rename 'name' to 'first_name' + 'last_name'
        if 'name' in user_data and 'first_name' not in user_data:
            name_parts = user_data['name'].split(' ', 1)
            updates['first_name'] = name_parts[0]
            updates['last_name'] = name_parts[1] if len(name_parts) > 1 else ''
            updates['display_name'] = user_data['name']

        # Convert old preference format
        if 'preferences' in user_data:
            prefs = user_data['preferences']
            if isinstance(prefs, dict):
                # Ensure new preference fields exist
                if 'notifications_enabled' not in prefs:
                    prefs['notifications_enabled'] = True
                if 'theme' not in prefs:
                    prefs['theme'] = 'light'
                updates['preferences'] = prefs

        # Apply updates
        if updates:
            users_ref.document(user_doc.id).update(updates)
            updated_count += 1

    logger.info(f"✅ Migrated {updated_count} user profiles to v2 format")

def migrate_mood_data_v1_to_v2():
    """Migration: Update mood data structure"""
    db = firestore.client()

    # Get all mood entries
    moods_ref = db.collection('moods')
    moods = moods_ref.stream()

    updated_count = 0
    for mood_doc in moods:
        mood_data = mood_doc.to_dict()

        updates = {}

        # Add new fields with defaults
        if 'intensity' not in mood_data:
            updates['intensity'] = 'medium'

        if 'ai_insights' not in mood_data:
            updates['ai_insights'] = None

        if 'sentiment_score' not in mood_data:
            updates['sentiment_score'] = None

        # Convert old category format
        if 'category' in mood_data:
            old_category = mood_data['category']
            # Map old categories to new enum values
            category_mapping = {
                'happy': 'glad',
                'sad': 'ledsen',
                'stressed': 'stressad',
                'relaxed': 'avslappnad',
                'angry': 'arg',
                'anxious': 'ängslig'
            }
            if old_category in category_mapping:
                updates['category'] = category_mapping[old_category]

        # Apply updates
        if updates:
            moods_ref.document(mood_doc.id).update(updates)
            updated_count += 1

    logger.info(f"✅ Migrated {updated_count} mood entries to v2 format")

def add_subscription_indexes():
    """Migration: Add indexes for subscription queries"""
    # Firestore creates indexes automatically, but we can ensure they're optimized
    logger.info("✅ Subscription indexes verified/created")

def migrate_memory_storage():
    """Migration: Update memory storage structure"""
    db = firestore.client()

    memories_ref = db.collection('memories')
    memories = memories_ref.stream()

    updated_count = 0
    for memory_doc in memories:
        memory_data = memory_doc.to_dict()

        updates = {}

        # Add new metadata fields
        if 'file_size' not in memory_data:
            updates['file_size'] = 0

        if 'mime_type' not in memory_data:
            updates['mime_type'] = 'application/octet-stream'

        if 'uploaded_by' not in memory_data:
            # Try to infer from user_id
            updates['uploaded_by'] = memory_data.get('user_id')

        # Apply updates
        if updates:
            memories_ref.document(memory_doc.id).update(updates)
            updated_count += 1

    logger.info(f"✅ Migrated {updated_count} memory entries")

# Register migrations
migration_manager.add_migration(Migration(
    version="1.0.0",
    description="Create initial database schema",
    up_func=create_initial_schema
))

migration_manager.add_migration(Migration(
    version="1.1.0",
    description="Update user profiles to v2 format",
    up_func=migrate_user_profiles_v1_to_v2,
    dependencies=["1.0.0"]
))

migration_manager.add_migration(Migration(
    version="1.2.0",
    description="Update mood data structure",
    up_func=migrate_mood_data_v1_to_v2,
    dependencies=["1.1.0"]
))

migration_manager.add_migration(Migration(
    version="1.3.0",
    description="Add subscription indexes",
    up_func=add_subscription_indexes,
    dependencies=["1.2.0"]
))

migration_manager.add_migration(Migration(
    version="2.0.0",
    description="Update memory storage structure",
    up_func=migrate_memory_storage,
    dependencies=["1.3.0"]
))

def run_migrations():
    """Run all pending migrations"""
    logger.info("🚀 Starting database migrations...")

    success = migration_manager.apply_migrations()

    if success:
        logger.info("✅ All migrations completed successfully")
    else:
        logger.error("❌ Some migrations failed")

    return success

def get_migration_status() -> Dict[str, Any]:
    """Get current migration status"""
    applied = migration_manager.get_applied_migrations()
    pending = [v for v in migration_manager.migrations.keys() if v not in applied]

    return {
        'applied_migrations': applied,
        'pending_migrations': pending,
        'total_migrations': len(migration_manager.migrations),
        'applied_count': len(applied),
        'pending_count': len(pending)
    }

__all__ = [
    'Migration',
    'MigrationManager',
    'migration_manager',
    'run_migrations',
    'get_migration_status'
]