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

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from src.firebase_config import db, initialize_firebase

def backup_collection(collection_name: str, output_dir: Path) -> dict:
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
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2, default=str, ensure_ascii=False)
        
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

def backup_all_collections(output_dir: Path) -> list:
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
    with open(summary_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_documents': total_docs,
            'total_size_mb': total_size,
            'collections': results
        }, f, indent=2)
    
    print(f"📊 Summary saved to: {summary_file}")
    
    return results

def restore_collection(collection_name: str, backup_file: Path) -> dict:
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
        # Load backup data
        with open(backup_file, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
        
        doc_count = 0
        batch = db.batch()
        
        for doc_data in backup_data:
            doc_id = doc_data.pop('_id', None)
            if not doc_id:
                continue
            
            doc_ref = db.collection(collection_name).document(doc_id)
            batch.set(doc_ref, doc_data)
            doc_count += 1
            
            # Commit batch every 500 documents
            if doc_count % 500 == 0:
                batch.commit()
                batch = db.batch()
                print(f"  ✓ Restored {doc_count} documents...")
        
        # Commit remaining
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
    
    args = parser.parse_args()
    
    # Initialize Firebase
    print("🔥 Initializing Firebase...")
    try:
        initialize_firebase()
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
        
        backup_file = Path(args.restore)
        if not backup_file.exists():
            print(f"❌ Error: Backup file not found: {backup_file}")
            return 1
        
        restore_collection(args.restore_collection, backup_file)
        return 0
    
    # Handle backup
    if args.collection:
        backup_collection(args.collection, output_dir)
    else:
        backup_all_collections(output_dir)
    
    return 0

if __name__ == '__main__':
    exit(main())
