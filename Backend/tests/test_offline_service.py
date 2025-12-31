"""
Tests for offline service (sync queue, offline data, PWA config)
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, patch, MagicMock
from src.utils.offline_service import OfflineSyncService, ServiceWorkerConfig, offline_sync_service


class TestOfflineSyncService:
    """Tests for OfflineSyncService"""

    @pytest.fixture
    def sync_service(self):
        """Create a fresh sync service instance"""
        service = OfflineSyncService()
        yield service
        # Cleanup
        service.sync_queue.clear()

    def test_init(self, sync_service):
        """Test service initialization"""
        assert sync_service.sync_queue == []
        assert isinstance(sync_service.sync_queue, list)

    def test_queue_for_sync_create(self, sync_service):
        """Test queueing data for sync with create operation"""
        user_id = "test-user-123"
        collection = "moods"
        data = {"mood": "happy", "note": "Great day!"}
        
        sync_service.queue_for_sync(user_id, collection, data, "create")
        
        assert len(sync_service.sync_queue) == 1
        item = sync_service.sync_queue[0]
        assert item["user_id"] == user_id
        assert item["collection"] == collection
        assert item["data"] == data
        assert item["operation"] == "create"
        assert item["sync_status"] == "pending"
        assert "queued_at" in item

    def test_queue_for_sync_default_operation(self, sync_service):
        """Test queueing with default operation (create)"""
        sync_service.queue_for_sync("user1", "memories", {"text": "Memory"})
        
        assert sync_service.sync_queue[0]["operation"] == "create"

    def test_queue_for_sync_update(self, sync_service):
        """Test queueing update operation"""
        sync_service.queue_for_sync("user1", "moods", {"id": "123", "mood": "sad"}, "update")
        
        assert sync_service.sync_queue[0]["operation"] == "update"

    def test_queue_for_sync_delete(self, sync_service):
        """Test queueing delete operation"""
        sync_service.queue_for_sync("user1", "notes", {"id": "456"}, "delete")
        
        assert sync_service.sync_queue[0]["operation"] == "delete"

    def test_queue_multiple_items(self, sync_service):
        """Test queueing multiple items"""
        sync_service.queue_for_sync("user1", "moods", {"mood": "happy"}, "create")
        sync_service.queue_for_sync("user1", "memories", {"text": "Memory"}, "create")
        sync_service.queue_for_sync("user2", "moods", {"mood": "sad"}, "create")
        
        assert len(sync_service.sync_queue) == 3

    @patch('src.utils.offline_service.db')
    def test_sync_pending_data_create_success(self, mock_db, sync_service):
        """Test successful sync of create operation"""
        # Setup mock
        mock_collection = Mock()
        mock_document = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        
        # Queue item
        sync_service.queue_for_sync("user1", "moods", {"mood": "happy"}, "create")
        
        # Sync
        result = sync_service.sync_pending_data("user1")
        
        assert result["synced_count"] == 1
        assert result["failed_count"] == 0
        assert len(result["errors"]) == 0
        assert len(sync_service.sync_queue) == 0
        mock_document.set.assert_called_once()

    @patch('src.utils.offline_service.db')
    def test_sync_pending_data_update_success(self, mock_db, sync_service):
        """Test successful sync of update operation"""
        # Setup mock
        mock_collection = Mock()
        mock_document = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        
        # Queue item
        data = {"id": "doc123", "mood": "neutral"}
        sync_service.queue_for_sync("user1", "moods", data, "update")
        
        # Sync
        result = sync_service.sync_pending_data("user1")
        
        assert result["synced_count"] == 1
        assert result["failed_count"] == 0
        mock_collection.document.assert_called_with("doc123")
        mock_document.update.assert_called_once_with(data)

    @patch('src.utils.offline_service.db')
    def test_sync_pending_data_delete_success(self, mock_db, sync_service):
        """Test successful sync of delete operation"""
        # Setup mock
        mock_collection = Mock()
        mock_document = Mock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        
        # Queue item
        data = {"id": "doc456"}
        sync_service.queue_for_sync("user1", "moods", data, "delete")
        
        # Sync
        result = sync_service.sync_pending_data("user1")
        
        assert result["synced_count"] == 1
        assert result["failed_count"] == 0
        mock_collection.document.assert_called_with("doc456")
        mock_document.delete.assert_called_once()

    @patch('src.utils.offline_service.db')
    def test_sync_pending_data_update_without_id(self, mock_db, sync_service):
        """Test sync of update without id (should skip)"""
        # Queue item without id
        sync_service.queue_for_sync("user1", "moods", {"mood": "happy"}, "update")
        
        # Sync
        result = sync_service.sync_pending_data("user1")
        
        # Item should be removed from queue even if skipped
        assert len(sync_service.sync_queue) == 0

    @patch('src.utils.offline_service.db')
    def test_sync_pending_data_delete_without_id(self, mock_db, sync_service):
        """Test sync of delete without id (should skip)"""
        # Queue item without id
        sync_service.queue_for_sync("user1", "moods", {}, "delete")
        
        # Sync
        result = sync_service.sync_pending_data("user1")
        
        assert len(sync_service.sync_queue) == 0

    @patch('src.utils.offline_service.db')
    def test_sync_pending_data_failure(self, mock_db, sync_service):
        """Test sync failure handling"""
        # Setup mock to raise exception
        mock_db.collection.side_effect = Exception("Database error")
        
        # Queue item
        sync_service.queue_for_sync("user1", "moods", {"mood": "happy"}, "create")
        
        # Sync
        result = sync_service.sync_pending_data("user1")
        
        assert result["synced_count"] == 0
        assert result["failed_count"] == 1
        assert len(result["errors"]) == 1
        assert "Database error" in result["errors"][0]
        # Item should still be in queue
        assert len(sync_service.sync_queue) == 1

    @patch('src.utils.offline_service.db')
    def test_sync_pending_data_mixed_results(self, mock_db, sync_service):
        """Test sync with both successful and failed items"""
        # Setup mock to fail on second call
        mock_collection = Mock()
        mock_document = Mock()
        
        call_count = 0
        def collection_side_effect(name):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise Exception("Second item failed")
            return mock_collection
        
        mock_db.collection.side_effect = collection_side_effect
        mock_collection.document.return_value = mock_document
        
        # Queue two items
        sync_service.queue_for_sync("user1", "moods", {"mood": "happy"}, "create")
        sync_service.queue_for_sync("user1", "memories", {"text": "Memory"}, "create")
        
        # Sync
        result = sync_service.sync_pending_data("user1")
        
        assert result["synced_count"] == 1
        assert result["failed_count"] == 1

    def test_sync_pending_data_only_user_items(self, sync_service):
        """Test that sync only processes items for specified user"""
        sync_service.queue_for_sync("user1", "moods", {"mood": "happy"}, "create")
        sync_service.queue_for_sync("user2", "moods", {"mood": "sad"}, "create")
        sync_service.queue_for_sync("user1", "memories", {"text": "Memory"}, "create")
        
        with patch('src.utils.offline_service.db'):
            result = sync_service.sync_pending_data("user1")
        
        # Should process 2 items for user1
        assert result["synced_count"] == 2
        # user2's item should still be in queue
        assert len(sync_service.sync_queue) == 1
        assert sync_service.sync_queue[0]["user_id"] == "user2"

    def test_sync_pending_data_empty_queue(self, sync_service):
        """Test sync with empty queue"""
        result = sync_service.sync_pending_data("user1")
        
        assert result["synced_count"] == 0
        assert result["failed_count"] == 0
        assert len(result["errors"]) == 0
        assert "timestamp" in result

    @patch('src.utils.offline_service.db')
    def test_get_offline_data_success(self, mock_db, sync_service):
        """Test fetching offline data"""
        # Setup mock
        mock_doc1 = Mock()
        mock_doc1.id = "doc1"
        mock_doc1.to_dict.return_value = {"mood": "happy", "user_id": "user1"}
        
        mock_doc2 = Mock()
        mock_doc2.id = "doc2"
        mock_doc2.to_dict.return_value = {"mood": "sad", "user_id": "user1"}
        
        mock_query = Mock()
        mock_query.stream.return_value = [mock_doc1, mock_doc2]
        mock_query.limit.return_value = mock_query
        
        mock_collection = Mock()
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection
        
        # Get offline data
        result = sync_service.get_offline_data("user1", "moods")
        
        assert len(result) == 2
        assert result[0]["id"] == "doc1"
        assert result[0]["mood"] == "happy"
        assert "offline_cached_at" in result[0]
        assert result[1]["id"] == "doc2"
        mock_collection.where.assert_called_with("user_id", "==", "user1")

    @patch('src.utils.offline_service.db')
    def test_get_offline_data_with_limit(self, mock_db, sync_service):
        """Test fetching offline data with custom limit"""
        mock_query = Mock()
        mock_query.stream.return_value = []
        mock_query.limit.return_value = mock_query
        
        mock_collection = Mock()
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection
        
        # Get with custom limit
        sync_service.get_offline_data("user1", "moods", limit=50)
        
        mock_query.limit.assert_called_with(50)

    @patch('src.utils.offline_service.db')
    def test_get_offline_data_default_limit(self, mock_db, sync_service):
        """Test fetching offline data with default limit"""
        mock_query = Mock()
        mock_query.stream.return_value = []
        mock_query.limit.return_value = mock_query
        
        mock_collection = Mock()
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection
        
        # Get with default limit
        sync_service.get_offline_data("user1", "moods")
        
        mock_query.limit.assert_called_with(100)

    @patch('src.utils.offline_service.db')
    def test_get_offline_data_failure(self, mock_db, sync_service):
        """Test get offline data failure handling"""
        mock_db.collection.side_effect = Exception("Database error")
        
        result = sync_service.get_offline_data("user1", "moods")
        
        assert result == []

    @patch('src.utils.offline_service.db')
    def test_get_offline_data_empty_result(self, mock_db, sync_service):
        """Test get offline data with no results"""
        mock_query = Mock()
        mock_query.stream.return_value = []
        mock_query.limit.return_value = mock_query
        
        mock_collection = Mock()
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection
        
        result = sync_service.get_offline_data("user1", "moods")
        
        assert result == []

    def test_clear_sync_queue(self, sync_service):
        """Test clearing sync queue for a user"""
        sync_service.queue_for_sync("user1", "moods", {"mood": "happy"}, "create")
        sync_service.queue_for_sync("user2", "moods", {"mood": "sad"}, "create")
        sync_service.queue_for_sync("user1", "memories", {"text": "Memory"}, "create")
        
        assert len(sync_service.sync_queue) == 3
        
        sync_service.clear_sync_queue("user1")
        
        assert len(sync_service.sync_queue) == 1
        assert sync_service.sync_queue[0]["user_id"] == "user2"

    def test_clear_sync_queue_all_items(self, sync_service):
        """Test clearing all items for a user"""
        sync_service.queue_for_sync("user1", "moods", {"mood": "happy"}, "create")
        sync_service.queue_for_sync("user1", "memories", {"text": "Memory"}, "create")
        
        sync_service.clear_sync_queue("user1")
        
        assert len(sync_service.sync_queue) == 0

    def test_clear_sync_queue_nonexistent_user(self, sync_service):
        """Test clearing queue for user with no items"""
        sync_service.queue_for_sync("user1", "moods", {"mood": "happy"}, "create")
        
        sync_service.clear_sync_queue("user2")
        
        assert len(sync_service.sync_queue) == 1


class TestGlobalOfflineSyncService:
    """Tests for global offline_sync_service instance"""

    def test_global_instance_exists(self):
        """Test that global instance is created"""
        assert offline_sync_service is not None
        assert isinstance(offline_sync_service, OfflineSyncService)

    def test_global_instance_is_singleton(self):
        """Test that global instance behaves like singleton"""
        from src.utils.offline_service import offline_sync_service as instance1
        from src.utils.offline_service import offline_sync_service as instance2
        
        assert instance1 is instance2


class TestServiceWorkerConfig:
    """Tests for ServiceWorkerConfig"""

    def test_get_config_structure(self):
        """Test service worker config structure"""
        config = ServiceWorkerConfig.get_config()
        
        assert isinstance(config, dict)
        assert "cache_version" in config
        assert "cache_name" in config
        assert "static_assets" in config
        assert "api_cache_endpoints" in config
        assert "offline_page" in config
        assert "cache_strategies" in config

    def test_get_config_cache_version(self):
        """Test cache version is present"""
        config = ServiceWorkerConfig.get_config()
        
        assert config["cache_version"] == "v1.0.0"
        assert isinstance(config["cache_version"], str)

    def test_get_config_cache_name(self):
        """Test cache name is present"""
        config = ServiceWorkerConfig.get_config()
        
        assert "lugn-trygg" in config["cache_name"].lower()
        assert isinstance(config["cache_name"], str)

    def test_get_config_static_assets(self):
        """Test static assets list"""
        config = ServiceWorkerConfig.get_config()
        
        assert isinstance(config["static_assets"], list)
        assert len(config["static_assets"]) > 0
        assert "/" in config["static_assets"]
        assert "/index.html" in config["static_assets"]

    def test_get_config_api_cache_endpoints(self):
        """Test API cache endpoints"""
        config = ServiceWorkerConfig.get_config()
        
        assert isinstance(config["api_cache_endpoints"], list)
        assert any("/api/mood" in endpoint for endpoint in config["api_cache_endpoints"])

    def test_get_config_offline_page(self):
        """Test offline page is configured"""
        config = ServiceWorkerConfig.get_config()
        
        assert config["offline_page"] == "/offline.html"

    def test_get_config_cache_strategies(self):
        """Test cache strategies"""
        config = ServiceWorkerConfig.get_config()
        
        strategies = config["cache_strategies"]
        assert isinstance(strategies, dict)
        assert "static" in strategies
        assert "api" in strategies
        assert "images" in strategies
        assert strategies["static"] == "cache-first"
        assert strategies["api"] == "network-first"

    def test_generate_manifest_structure(self):
        """Test PWA manifest structure"""
        manifest = ServiceWorkerConfig.generate_manifest()
        
        assert isinstance(manifest, dict)
        assert "name" in manifest
        assert "short_name" in manifest
        assert "description" in manifest
        assert "start_url" in manifest
        assert "display" in manifest
        assert "icons" in manifest

    def test_generate_manifest_name(self):
        """Test app name in manifest"""
        manifest = ServiceWorkerConfig.generate_manifest()
        
        assert "Lugn" in manifest["name"]
        assert "Trygg" in manifest["name"]
        assert isinstance(manifest["short_name"], str)

    def test_generate_manifest_display(self):
        """Test display mode"""
        manifest = ServiceWorkerConfig.generate_manifest()
        
        assert manifest["display"] == "standalone"

    def test_generate_manifest_colors(self):
        """Test theme colors"""
        manifest = ServiceWorkerConfig.generate_manifest()
        
        assert "background_color" in manifest
        assert "theme_color" in manifest
        assert manifest["background_color"].startswith("#")
        assert manifest["theme_color"].startswith("#")

    def test_generate_manifest_icons(self):
        """Test icons configuration"""
        manifest = ServiceWorkerConfig.generate_manifest()
        
        icons = manifest["icons"]
        assert isinstance(icons, list)
        assert len(icons) >= 2
        
        # Check for required icon sizes
        sizes = [icon["sizes"] for icon in icons]
        assert "192x192" in sizes
        assert "512x512" in sizes

    def test_generate_manifest_orientation(self):
        """Test orientation setting"""
        manifest = ServiceWorkerConfig.generate_manifest()
        
        assert manifest["orientation"] == "portrait"

    def test_generate_manifest_categories(self):
        """Test app categories"""
        manifest = ServiceWorkerConfig.generate_manifest()
        
        categories = manifest["categories"]
        assert isinstance(categories, list)
        assert "health" in categories

    def test_generate_manifest_offline_enabled(self):
        """Test offline capability flag"""
        manifest = ServiceWorkerConfig.generate_manifest()
        
        assert "offline_enabled" in manifest
        assert manifest["offline_enabled"] is True

    def test_generate_manifest_start_url(self):
        """Test start URL"""
        manifest = ServiceWorkerConfig.generate_manifest()
        
        assert manifest["start_url"] == "/"

    def test_config_is_static_method(self):
        """Test that get_config is a static method"""
        # Should be callable without instance
        config = ServiceWorkerConfig.get_config()
        assert config is not None

    def test_manifest_is_static_method(self):
        """Test that generate_manifest is a static method"""
        # Should be callable without instance
        manifest = ServiceWorkerConfig.generate_manifest()
        assert manifest is not None
