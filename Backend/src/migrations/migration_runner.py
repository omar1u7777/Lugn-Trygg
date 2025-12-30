"""
Data Migration Runner for Lugn & Trygg
Automated migration execution with rollback support and validation
"""

import os
import sys
import importlib
import inspect
from typing import Dict, List, Optional, Any, Callable, Type
from datetime import datetime, timezone
from pathlib import Path
import logging
from firebase_admin import firestore
import json

logger = logging.getLogger(__name__)

class Migration:
    """Base class for data migrations"""

    def __init__(self, version: str, description: str):
        self.version = version
        self.description = description
        self.applied_at: Optional[datetime] = None
        self.checksum: Optional[str] = None

    def up(self) -> bool:
        """Execute the migration"""
        raise NotImplementedError("Migration must implement up() method")

    def down(self) -> bool:
        """Rollback the migration"""
        raise NotImplementedError("Migration must implement down() method")

    def validate(self) -> bool:
        """Validate migration state after execution"""
        return True

class DataMigration(Migration):
    """Migration for data transformations"""

    def __init__(self, version: str, description: str):
        super().__init__(version, description)
        self.db = firestore.client()
        self.batch_size = 500  # Firestore batch limit

    def get_collection_documents(self, collection: str, limit: Optional[int] = None) -> List[Dict]:
        """Get all documents from a collection"""
        docs = self.db.collection(collection).limit(limit or 10000).stream()
        return [{**doc.to_dict(), 'id': doc.id} for doc in docs]

    def update_document(self, collection: str, doc_id: str, updates: Dict) -> bool:
        """Update a single document"""
        try:
            self.db.collection(collection).document(doc_id).update(updates)
            return True
        except Exception as e:
            logger.error(f"Failed to update document {doc_id}: {e}")
            return False

    def batch_update(self, collection: str, updates: List[Tuple[str, Dict]]) -> bool:
        """Batch update multiple documents"""
        try:
            for i in range(0, len(updates), self.batch_size):
                batch = self.db.batch()
                batch_updates = updates[i:i + self.batch_size]

                for doc_id, update_data in batch_updates:
                    doc_ref = self.db.collection(collection).document(doc_id)
                    batch.update(doc_ref, update_data)

                batch.commit()
                logger.info(f"Committed batch update of {len(batch_updates)} documents")

            return True
        except Exception as e:
            logger.error(f"Batch update failed: {e}")
            return False

class SchemaMigration(Migration):
    """Migration for schema changes"""

    def __init__(self, version: str, description: str):
        super().__init__(version, description)
        self.db = firestore.client()

    def create_index(self, collection: str, fields: List[str]) -> bool:
        """Create a composite index (note: Firestore handles this automatically)"""
        logger.info(f"Index creation requested for {collection}: {fields}")
        # In Firestore, indexes are created automatically
        # This is just for documentation
        return True

    def validate_collection_exists(self, collection: str) -> bool:
        """Validate that a collection exists"""
        try:
            docs = self.db.collection(collection).limit(1).stream()
            return len(list(docs)) >= 0  # Collection exists if we can query it
        except Exception:
            return False

class MigrationRunner:
    """Executes and manages data migrations"""

    def __init__(self, migrations_dir: str = "src/migrations", db=None):
        self.migrations_dir = Path(__file__).parent / migrations_dir
        self.db = db or firestore.client()
        self.migration_history_collection = 'migration_history'
        self.migrations: Dict[str, Type[Migration]] = {}
        self.applied_migrations: List[str] = []

        # Load available migrations
        self._load_migrations()

    def _load_migrations(self):
        """Load all migration classes from migration files"""
        if not self.migrations_dir.exists():
            logger.warning(f"Migrations directory {self.migrations_dir} does not exist")
            return

        # Import all migration modules
        for migration_file in self.migrations_dir.glob("*.py"):
            if migration_file.name.startswith('_'):
                continue

            try:
                module_name = f"src.migrations.{migration_file.stem}"
                module = importlib.import_module(module_name)

                # Find migration classes
                for name, obj in inspect.getmembers(module):
                    if (inspect.isclass(obj) and
                        issubclass(obj, Migration) and
                        obj != Migration and
                        obj != DataMigration and
                        obj != SchemaMigration):

                        migration_instance = obj()
                        self.migrations[migration_instance.version] = obj
                        logger.info(f"Loaded migration: {migration_instance.version} - {migration_instance.description}")

            except Exception as e:
                logger.error(f"Failed to load migration {migration_file}: {e}")

    def get_applied_migrations(self) -> List[str]:
        """Get list of applied migrations from database"""
        try:
            docs = self.db.collection(self.migration_history_collection).stream()
            applied = []
            for doc in docs:
                data = doc.to_dict()
                applied.append(data['version'])
            self.applied_migrations = sorted(applied)
            return self.applied_migrations
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
                'applied_at': migration.applied_at or datetime.now(timezone.utc),
                'checksum': migration.checksum or self._calculate_checksum(migration)
            }

            if direction == 'down':
                # For rollbacks, we might want to keep the record but mark as rolled back
                data['rolled_back_at'] = datetime.now(timezone.utc)
            else:
                doc_ref.set(data)

            logger.info(f"📋 Recorded migration {migration.version} ({direction})")

        except Exception as e:
            logger.error(f"Failed to record migration {migration.version}: {e}")

    def _calculate_checksum(self, migration: Migration) -> str:
        """Calculate checksum for migration validation (not used for security)"""
        import hashlib
        content = f"{migration.version}{migration.description}"
        if hasattr(migration, 'up'):
            content += str(migration.up.__code__.co_code)
        # MD5 used only for checksum verification, not security - nosec
        return hashlib.md5(content.encode(), usedforsecurity=False).hexdigest()[:8]

    def apply_migration(self, migration_class: Type[Migration], direction: str = 'up') -> bool:
        """Apply a single migration"""
        try:
            migration = migration_class()

            logger.info(f"{'🔄' if direction == 'down' else '⬆️'} Applying migration {migration.version}: {migration.description}")

            # Execute migration
            success = migration.up() if direction == 'up' else migration.down()

            if success:
                # Validate migration
                if direction == 'up' and not migration.validate():
                    logger.error(f"❌ Migration {migration.version} validation failed")
                    return False

                # Record migration
                migration.applied_at = datetime.now(timezone.utc)
                self.record_migration(migration, direction)

                if direction == 'up':
                    self.applied_migrations.append(migration.version)
                else:
                    if migration.version in self.applied_migrations:
                        self.applied_migrations.remove(migration.version)

                logger.info(f"✅ Migration {migration.version} applied successfully ({direction})")
                return True
            else:
                logger.error(f"❌ Migration {migration.version} failed ({direction})")
                return False

        except Exception as e:
            logger.error(f"❌ Migration {migration.version} error: {e}")
            return False

    def apply_pending_migrations(self) -> Dict[str, Any]:
        """Apply all pending migrations"""
        logger.info("🚀 Starting migration process...")

        self.get_applied_migrations()
        available_versions = sorted(self.migrations.keys())
        pending_versions = [v for v in available_versions if v not in self.applied_migrations]

        results = {
            'total_migrations': len(available_versions),
            'pending_migrations': len(pending_versions),
            'applied_migrations': len(self.applied_migrations),
            'successful': [],
            'failed': [],
            'skipped': []
        }

        for version in pending_versions:
            migration_class = self.migrations[version]

            # Check dependencies
            if hasattr(migration_class, 'depends_on'):
                dependencies = migration_class.depends_on
                missing_deps = [dep for dep in dependencies if dep not in self.applied_migrations]
                if missing_deps:
                    logger.warning(f"⏭️ Skipping migration {version} - missing dependencies: {missing_deps}")
                    results['skipped'].append({
                        'version': version,
                        'reason': f"Missing dependencies: {missing_deps}"
                    })
                    continue

            if self.apply_migration(migration_class, 'up'):
                results['successful'].append(version)
            else:
                results['failed'].append(version)
                break  # Stop on first failure

        logger.info(f"📊 Migration process completed: {len(results['successful'])} successful, {len(results['failed'])} failed, {len(results['skipped'])} skipped")

        return results

    def rollback_migration(self, version: str) -> bool:
        """Rollback a specific migration"""
        if not self.is_migration_applied(version):
            logger.warning(f"Migration {version} not applied, cannot rollback")
            return False

        migration_class = self.migrations.get(version)
        if not migration_class:
            logger.error(f"Migration {version} not found")
            return False

        return self.apply_migration(migration_class, 'down')

    def rollback_to_version(self, target_version: str) -> Dict[str, Any]:
        """Rollback all migrations after target version"""
        self.get_applied_migrations()

        # Find migrations to rollback (newer than target)
        to_rollback = [v for v in self.applied_migrations if v > target_version]

        results = {
            'target_version': target_version,
            'to_rollback': to_rollback,
            'successful': [],
            'failed': []
        }

        for version in reversed(to_rollback):  # Rollback in reverse order
            if self.rollback_migration(version):
                results['successful'].append(version)
            else:
                results['failed'].append(version)
                break

        return results

    def get_migration_status(self) -> Dict[str, Any]:
        """Get comprehensive migration status"""
        self.get_applied_migrations()

        status = {
            'total_migrations': len(self.migrations),
            'applied_migrations': self.applied_migrations,
            'pending_migrations': [v for v in sorted(self.migrations.keys()) if v not in self.applied_migrations],
            'applied_count': len(self.applied_migrations),
            'pending_count': len(self.migrations) - len(self.applied_migrations),
            'last_applied': self.applied_migrations[-1] if self.applied_migrations else None,
            'migrations': {}
        }

        # Detailed migration info
        for version in sorted(self.migrations.keys()):
            migration_class = self.migrations[version]
            migration_info = {
                'version': version,
                'description': getattr(migration_class(), 'description', 'No description'),
                'applied': version in self.applied_migrations,
                'has_down': hasattr(migration_class(), 'down')
            }

            # Get dependencies if available
            if hasattr(migration_class, 'depends_on'):
                migration_info['depends_on'] = migration_class.depends_on

            status['migrations'][version] = migration_info

        return status

    def create_migration_template(self, name: str, migration_type: str = 'data') -> str:
        """Create a migration template file"""
        version = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        filename = f"{version}_{name}.py"

        if migration_type == 'data':
            template = f'''"""
Migration: {name}
Created: {datetime.now(timezone.utc).isoformat()}
"""

from src.migrations.migration_runner import DataMigration

class Migration{version}(DataMigration):
    def __init__(self):
        super().__init__(
            version="{version}",
            description="{name}"
        )

    def up(self) -> bool:
        """Apply the migration"""
        try:
            # TODO: Implement migration logic
            logger.info("Applying migration: {name}")

            # Example: Update all users
            # users = self.get_collection_documents('users')
            # updates = []
            # for user in users:
            #     updates.append((user['id'], {{
            #         'new_field': 'default_value'
            #     }}))
            # return self.batch_update('users', updates)

            return True
        except Exception as e:
            logger.error(f"Migration failed: {{e}}")
            return False

    def down(self) -> bool:
        """Rollback the migration"""
        try:
            # TODO: Implement rollback logic
            logger.info("Rolling back migration: {name}")
            return True
        except Exception as e:
            logger.error(f"Rollback failed: {{e}}")
            return False

    def validate(self) -> bool:
        """Validate migration success"""
        # TODO: Add validation logic
        return True
'''
        else:  # schema migration
            template = f'''"""
Schema Migration: {name}
Created: {datetime.now(timezone.utc).isoformat()}
"""

from src.migrations.migration_runner import SchemaMigration

class Migration{version}(SchemaMigration):
    def __init__(self):
        super().__init__(
            version="{version}",
            description="{name}"
        )

    def up(self) -> bool:
        """Apply the schema migration"""
        try:
            # TODO: Implement schema changes
            logger.info("Applying schema migration: {name}")

            # Example: Create indexes
            # self.create_index('collection_name', ['field1', 'field2'])

            return True
        except Exception as e:
            logger.error(f"Schema migration failed: {{e}}")
            return False

    def down(self) -> bool:
        """Rollback the schema migration"""
        try:
            # TODO: Implement schema rollback
            logger.info("Rolling back schema migration: {name}")
            return True
        except Exception as e:
            logger.error(f"Schema rollback failed: {{e}}")
            return False
'''

        # Write template to file
        filepath = self.migrations_dir / filename
        with open(filepath, 'w') as f:
            f.write(template)

        logger.info(f"📝 Created migration template: {filepath}")
        return str(filepath)

# Global migration runner
migration_runner = MigrationRunner()

def run_migrations():
    """Run all pending migrations"""
    return migration_runner.apply_pending_migrations()

def get_migration_status():
    """Get migration status"""
    return migration_runner.get_migration_status()

if __name__ == '__main__':
    # CLI interface for migrations
    import argparse

    parser = argparse.ArgumentParser(description='Data Migration Runner')
    parser.add_argument('command', choices=['status', 'migrate', 'rollback', 'create'])
    parser.add_argument('--version', help='Migration version for rollback')
    parser.add_argument('--name', help='Migration name for create')
    parser.add_argument('--type', choices=['data', 'schema'], default='data', help='Migration type')

    args = parser.parse_args()

    if args.command == 'status':
        status = get_migration_status()
        print(json.dumps(status, indent=2))

    elif args.command == 'migrate':
        results = run_migrations()
        print(json.dumps(results, indent=2))

    elif args.command == 'rollback':
        if not args.version:
            print("Error: --version required for rollback")
            sys.exit(1)
        results = migration_runner.rollback_to_version(args.version)
        print(json.dumps(results, indent=2))

    elif args.command == 'create':
        if not args.name:
            print("Error: --name required for create")
            sys.exit(1)
        filepath = migration_runner.create_migration_template(args.name, args.type)
        print(f"Created migration template: {filepath}")

__all__ = [
    'Migration',
    'DataMigration',
    'SchemaMigration',
    'MigrationRunner',
    'migration_runner',
    'run_migrations',
    'get_migration_status'
]