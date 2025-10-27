"""
Offline Support Service
Handles data synchronization and offline functionality
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any
from src.firebase_config import db

logger = logging.getLogger(__name__)

class OfflineSyncService:
    """Manage offline data synchronization"""

    def __init__(self):
        self.sync_queue: List[Dict[str, Any]] = []

    def queue_for_sync(self, user_id: str, collection: str, data: Dict[str, Any], operation: str = "create"):
        """Queue data for synchronization"""
        sync_item = {
            "user_id": user_id,
            "collection": collection,
            "data": data,
            "operation": operation,
            "queued_at": datetime.now(timezone.utc).isoformat(),
            "sync_status": "pending"
        }
        self.sync_queue.append(sync_item)
        logger.info(f"Queued for sync: {collection} - {operation}")

    def sync_pending_data(self, user_id: str) -> Dict[str, Any]:
        """Synchronize all pending data for a user"""
        user_items = [item for item in self.sync_queue if item["user_id"] == user_id]

        synced_count = 0
        failed_count = 0
        errors = []

        for item in user_items:
            try:
                collection = item["collection"]
                data = item["data"]
                operation = item["operation"]

                if operation == "create":
                    db.collection(collection).document().set(data)
                elif operation == "update":
                    doc_id = data.get("id")
                    if doc_id:
                        db.collection(collection).document(doc_id).update(data)
                elif operation == "delete":
                    doc_id = data.get("id")
                    if doc_id:
                        db.collection(collection).document(doc_id).delete()

                # Remove from queue
                self.sync_queue.remove(item)
                synced_count += 1

            except Exception as e:
                logger.error(f"Sync failed for item: {str(e)}")
                failed_count += 1
                errors.append(str(e))

        return {
            "synced_count": synced_count,
            "failed_count": failed_count,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def get_offline_data(self, user_id: str, collection: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get data for offline use"""
        try:
            docs = db.collection(collection).where("user_id", "==", user_id).limit(limit).stream()

            offline_data = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                data["offline_cached_at"] = datetime.now(timezone.utc).isoformat()
                offline_data.append(data)

            logger.info(f"Fetched {len(offline_data)} items for offline use")
            return offline_data

        except Exception as e:
            logger.error(f"Failed to fetch offline data: {str(e)}")
            return []

    def clear_sync_queue(self, user_id: str):
        """Clear sync queue for a user"""
        self.sync_queue = [item for item in self.sync_queue if item["user_id"] != user_id]
        logger.info(f"Cleared sync queue for user {user_id}")

# Global offline sync service instance
offline_sync_service = OfflineSyncService()

class ServiceWorkerConfig:
    """Configuration for Progressive Web App service worker"""

    @staticmethod
    def get_config() -> Dict[str, Any]:
        """Get service worker configuration"""
        return {
            "cache_version": "v1.0.0",
            "cache_name": "lugn-trygg-cache-v1",
            "static_assets": [
                "/",
                "/index.html",
                "/static/css/main.css",
                "/static/js/main.js",
                "/manifest.json"
            ],
            "api_cache_endpoints": [
                "/api/mood/get",
                "/api/memory/list",
                "/api/chatbot/history"
            ],
            "offline_page": "/offline.html",
            "cache_strategies": {
                "static": "cache-first",
                "api": "network-first",
                "images": "cache-first"
            }
        }

    @staticmethod
    def generate_manifest() -> Dict[str, Any]:
        """Generate PWA manifest"""
        return {
            "name": "Lugn & Trygg",
            "short_name": "Lugn&Trygg",
            "description": "Mental wellness and mood tracking app",
            "start_url": "/",
            "display": "standalone",
            "background_color": "#ffffff",
            "theme_color": "#1976d2",
            "orientation": "portrait",
            "icons": [
                {
                    "src": "/icons/icon-192.png",
                    "sizes": "192x192",
                    "type": "image/png"
                },
                {
                    "src": "/icons/icon-512.png",
                    "sizes": "512x512",
                    "type": "image/png"
                }
            ],
            "categories": ["health", "lifestyle", "medical"],
            "offline_enabled": True
        }
