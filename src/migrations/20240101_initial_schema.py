"""
Initial Schema Migration
Creates the basic database structure and indexes for Lugn & Trygg
"""

from src.migrations.migration_runner import SchemaMigration
import logging

logger = logging.getLogger(__name__)

class Migration20240101(SchemaMigration):
    def __init__(self):
        super().__init__(
            version="20240101_000000",
            description="Create initial database schema and indexes"
        )

    def up(self) -> bool:
        """Create initial schema"""
        try:
            logger.info("Creating initial database schema...")

            # Define collections and their initial indexes
            collections = {
                'users': [
                    ['email'],  # Single field index
                    ['subscription', 'created_at'],  # Composite index
                    ['last_login'],  # Single field index
                    ['language', 'subscription'],  # Composite index
                ],
                'moods': [
                    ['user_id', 'timestamp'],  # Composite index for user mood history
                    ['user_id', 'mood_value'],  # Composite index for mood analysis
                    ['timestamp'],  # Single field index for time-based queries
                    ['category', 'timestamp'],  # Composite index for category analysis
                    ['user_id', 'category', 'timestamp'],  # Composite index for detailed analysis
                ],
                'memories': [
                    ['user_id', 'uploaded_at'],  # Composite index for user memories
                    ['tags'],  # Array index for tag-based search
                    ['mime_type', 'uploaded_at'],  # Composite index for media queries
                ],
                'ai_stories': [
                    ['user_id', 'created_at'],  # Composite index for user stories
                    ['mood_themes'],  # Array index for theme-based search
                ],
                'subscriptions': [
                    ['user_id', 'status'],  # Composite index for user subscriptions
                    ['status', 'current_period_end'],  # Composite index for billing
                    ['plan', 'created_at'],  # Composite index for plan analytics
                ],
                'audit_logs': [
                    ['user_id', 'timestamp'],  # Composite index for user audit trail
                    ['event_type', 'timestamp'],  # Composite index for event analysis
                    ['timestamp'],  # Single field index for time-based queries
                ]
            }

            # Create indexes for each collection
            for collection, indexes in collections.items():
                for index_fields in indexes:
                    if self.create_index(collection, index_fields):
                        logger.info(f"✅ Created index for {collection}: {index_fields}")
                    else:
                        logger.warning(f"⚠️ Failed to create index for {collection}: {index_fields}")

            # Validate that collections can be accessed
            for collection in collections.keys():
                if not self.validate_collection_exists(collection):
                    logger.warning(f"⚠️ Collection {collection} may not be accessible")
                else:
                    logger.info(f"✅ Collection {collection} is accessible")

            logger.info("✅ Initial schema migration completed")
            return True

        except Exception as e:
            logger.error(f"Initial schema migration failed: {e}")
            return False

    def down(self) -> bool:
        """Rollback initial schema - Note: Firestore indexes are managed automatically"""
        try:
            logger.info("Rolling back initial schema migration...")

            # In Firestore, we can't actually "drop" indexes as they're managed automatically
            # This is mainly for documentation and any cleanup needed

            logger.info("✅ Initial schema rollback completed (no actual rollback needed for Firestore)")
            return True

        except Exception as e:
            logger.error(f"Initial schema rollback failed: {e}")
            return False

    def validate(self) -> bool:
        """Validate that the initial schema is properly set up"""
        try:
            # Check that we can query each collection
            collections_to_check = ['users', 'moods', 'memories', 'ai_stories', 'subscriptions', 'audit_logs']

            for collection in collections_to_check:
                if not self.validate_collection_exists(collection):
                    logger.error(f"❌ Collection {collection} is not accessible")
                    return False

            logger.info("✅ Initial schema validation passed")
            return True

        except Exception as e:
            logger.error(f"Initial schema validation failed: {e}")
            return False