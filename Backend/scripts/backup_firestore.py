#!/usr/bin/env python3
"""
🔄 Automated Backup System for Lugn & Trygg
Backs up Firebase Firestore data to local JSON files

Usage:
    python backup_firestore.py [--collection COLLECTION] [--output-dir DIR]
"""

import os
import json
import argparse
from datetime import datetime
from pathlib import Path
import sys
from typing import Any

# Add Backend directory to path (one level up from scripts/)
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from src.firebase_config import initialize_firebase


BackupResult = dict[str, Any]


def _get_db():
    """Get initialized Firestore client from firebase_config."""
    from src.firebase_config import db

    if db is None:
        raise RuntimeError("Firestore client (db) is not initialized.")
    return db


def _write_json_file(path: Path, payload: Any) -> None:
    """Write JSON with stable UTF-8 settings used across backup artifacts."""
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, default=str, ensure_ascii=False)

def backup_collection(collection_name: str, output_dir: Path) -> BackupResult:
    """
    Backup a single Firestore collection
    
    Args:
        collection_name: Name of the collection to backup
        output_dir: Directory to save backup files
        
    Returns:
        dict: Backup statistics
    """
    print(f"📦 Backing up collection: {collection_name}")
    
    try:
        db = _get_db()
        # Get all documents from collection
        docs = db.collection(collection_name).stream()

        backup_data = []
        doc_count = 0

        for doc in docs:
            doc_dict = doc.to_dict()
            doc_dict['_id'] = doc.id  # Add document ID
            backup_data.append(doc_dict)
            doc_count += 1

            if doc_count % 100 == 0:
                print(f"  ✓ Backed up {doc_count} documents...")

        # Create filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = output_dir / f"{collection_name}_{timestamp}.json"

        # Write to file
        _write_json_file(filename, backup_data)

        file_size_mb = filename.stat().st_size / (1024 * 1024)
        
        print(f"✅ Backup complete: {doc_count} documents ({file_size_mb:.2f} MB)")
        print(f"   Saved to: {filename}")
        
        return {
            'collection': collection_name,
            'documents': doc_count,
            'filename': str(filename),
            'size_mb': file_size_mb,
            'timestamp': timestamp
        }
        
    except Exception as e:
        print(f"❌ Error backing up {collection_name}: {e}")
        return {
            'collection': collection_name,
            'error': str(e)
        }

def backup_all_collections(output_dir: Path) -> list[BackupResult]:
    """
    Backup all collections in Firestore
    
    Args:
        output_dir: Directory to save backup files
        
    Returns:
        list: List of backup statistics for each collection
    """
    # Common collections in Lugn & Trygg
    collections = [
        'users',
        'moods',
        'memories',
        'chat_sessions',
        'ai_conversations',
        'referrals',
        'achievements',
        'journal_entries',
        'wellness_activities',
        'notifications',
        'feedback',
        'subscriptions'
    ]
    
    results = []
    total_docs = 0
    total_size = 0
    
    print(f"\n🚀 Starting full backup of {len(collections)} collections...")
    print(f"📁 Output directory: {output_dir}")
    print("=" * 60)
    
    for collection in collections:
        try:
            result = backup_collection(collection, output_dir)
            results.append(result)
            
            if 'documents' in result:
                total_docs += result['documents']
                total_size += result['size_mb']
        except Exception as e:
            print(f"⚠️  Skipping {collection}: {e}")
    
    print("\n" + "=" * 60)
    print(f"✅ BACKUP COMPLETE!")
    print(f"   Total documents: {total_docs}")
    print(f"   Total size: {total_size:.2f} MB")
    print(f"   Collections backed up: {len([r for r in results if 'documents' in r])}")
    
    # Save summary
    summary_file = output_dir / f"backup_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    _write_json_file(
        summary_file,
        {
            'timestamp': datetime.now().isoformat(),
            'total_documents': total_docs,
            'total_size_mb': total_size,
            'collections': results
        }
    )
    
    print(f"📊 Summary saved to: {summary_file}")
    
    return results

def restore_collection(collection_name: str, backup_file: Path) -> BackupResult:
    """
    Restore a collection from backup file
    
    Args:
        collection_name: Name of the collection to restore
        backup_file: Path to backup JSON file
        
    Returns:
        dict: Restore statistics
    """
    print(f"📥 Restoring collection: {collection_name}")
    print(f"   From file: {backup_file}")
    
    try:
        db = _get_db()
        # Load backup data
        with open(backup_file, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)

        if not isinstance(backup_data, list):
            raise ValueError("Backup file format invalid: expected a JSON array of documents")

        doc_count = 0
        pending_in_batch = 0
        batch = db.batch()

        for doc_data in backup_data:
            if not isinstance(doc_data, dict):
                continue

            doc_id = doc_data.get('_id')
            if not doc_id:
                continue

            payload = {k: v for k, v in doc_data.items() if k != '_id'}

            doc_ref = db.collection(collection_name).document(doc_id)
            batch.set(doc_ref, payload)
            doc_count += 1
            pending_in_batch += 1

            # Commit batch every 500 documents
            if pending_in_batch >= 500:
                batch.commit()
                batch = db.batch()
                pending_in_batch = 0
                print(f"  ✓ Restored {doc_count} documents...")

        # Commit remaining
        if pending_in_batch > 0:
            batch.commit()
        
        print(f"✅ Restore complete: {doc_count} documents")
        
        return {
            'collection': collection_name,
            'documents': doc_count,
            'status': 'success'
        }
        
    except Exception as e:
        print(f"❌ Error restoring {collection_name}: {e}")
        return {
            'collection': collection_name,
            'error': str(e),
            'status': 'failed'
        }

def main():
    parser = argparse.ArgumentParser(description='Backup/Restore Firestore data')
    parser.add_argument('--collection', type=str, help='Specific collection to backup')
    parser.add_argument('--output-dir', type=str, default='backups', 
                        help='Output directory for backups')
    parser.add_argument('--restore', type=str, help='Restore from backup file')
    parser.add_argument('--restore-collection', type=str, 
                        help='Collection name for restore (required with --restore)')
    parser.add_argument(
        '--force',
        action='store_true',
        help='Required with --restore to confirm write operations to Firestore'
    )
    
    args = parser.parse_args()
    
    # Initialize Firebase
    print("🔥 Initializing Firebase...")
    try:
        initialize_firebase()
        from src.firebase_config import db
        if db is None:
            print("❌ Firebase Firestore client (db) is not initialized. Check your credentials and .env configuration.")
            return 1
        print("✅ Firebase connected")
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        return 1

    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Handle restore
    if args.restore:
        if not args.restore_collection:
            print("❌ Error: --restore-collection required with --restore")
            return 1

        if not args.force:
            print("❌ Error: --force is required for restore operations to prevent accidental writes")
            return 1

        backup_file = Path(args.restore)
        if not backup_file.exists():
            print(f"❌ Error: Backup file not found: {backup_file}")
            return 1

        restore_result = restore_collection(args.restore_collection, backup_file)
        return 0 if restore_result.get('status') == 'success' else 1

    # Handle backup
    if args.collection:
        result = backup_collection(args.collection, output_dir)
        return 0 if 'documents' in result else 1
    else:
        results = backup_all_collections(output_dir)
        failed = [r for r in results if 'documents' not in r]
        return 1 if failed else 0

if __name__ == '__main__':
    exit(main())
