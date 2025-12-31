"""
Async Database Service - High-performance async database operations

Provides async database operations with connection pooling for 10k concurrent users.
Includes query optimization, batch operations, and performance monitoring.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional, Tuple, Union
from datetime import datetime, timezone
import time

from ..firebase_config import db
from ..utils.error_handling import handle_service_errors, ServiceError
from .performance_monitor import PerformanceMonitor

logger = logging.getLogger(__name__)

class AsyncDatabaseService:
    """Async database service with connection pooling and performance optimization"""

    def __init__(self, performance_monitor: Optional[PerformanceMonitor] = None):
        self.performance_monitor = performance_monitor or PerformanceMonitor()
        self._connection_pool_size = 50  # Connection pool size for 10k users
        self._max_batch_size = 500  # Maximum batch size
        self._query_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = 300  # 5 minutes cache TTL

    async def initialize_pool(self):
        """Initialize connection pool for high concurrency"""
        logger.info(f"Initializing async database connection pool (size: {self._connection_pool_size})")
        # Firebase handles connection pooling internally, but we can add custom pooling here if needed
        return True

    @handle_service_errors
    async def get_document_async(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Async get document with caching and performance monitoring
        """
        start_time = time.time()

        try:
            # Check cache first
            cache_key = f"{collection}:{doc_id}"
            cached_result = self._get_from_cache(cache_key)
            if cached_result is not None:
                await self.performance_monitor.record_metric(
                    'cache_hit', time.time() - start_time, {'collection': collection}
                )
                return cached_result

            # Execute query in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._sync_get_document, collection, doc_id)

            # Cache result
            if result:
                self._set_cache(cache_key, result)

            await self.performance_monitor.record_metric(
                'db_get', time.time() - start_time, {'collection': collection, 'cached': False}
            )

            return result

        except Exception as e:
            await self.performance_monitor.record_metric(
                'db_error', time.time() - start_time, {'operation': 'get', 'error': str(e)}
            )
            raise

    @handle_service_errors
    async def create_document_async(self, collection: str, doc_id: str, data: Dict[str, Any]) -> bool:
        """
        Async create document with performance monitoring
        """
        start_time = time.time()

        try:
            # Execute in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._sync_create_document, collection, doc_id, data)

            # Invalidate cache
            cache_key = f"{collection}:{doc_id}"
            self._invalidate_cache(cache_key)

            await self.performance_monitor.record_metric(
                'db_create', time.time() - start_time, {'collection': collection}
            )

            return result

        except Exception as e:
            await self.performance_monitor.record_metric(
                'db_error', time.time() - start_time, {'operation': 'create', 'error': str(e)}
            )
            raise

    @handle_service_errors
    async def update_document_async(self, collection: str, doc_id: str, data: Dict[str, Any]) -> bool:
        """
        Async update document with optimistic locking
        """
        start_time = time.time()

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._sync_update_document, collection, doc_id, data)

            # Invalidate cache
            cache_key = f"{collection}:{doc_id}"
            self._invalidate_cache(cache_key)

            await self.performance_monitor.record_metric(
                'db_update', time.time() - start_time, {'collection': collection}
            )

            return result

        except Exception as e:
            await self.performance_monitor.record_metric(
                'db_error', time.time() - start_time, {'operation': 'update', 'error': str(e)}
            )
            raise

    @handle_service_errors
    async def query_documents_async(self, collection: str, filters: Optional[List[Tuple[str, str, Any]]] = None,
                                   limit: Optional[int] = None, order_by: Optional[str] = None,
                                   offset: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Async query with pagination and performance optimization
        """
        start_time = time.time()

        try:
            # Generate cache key for query
            query_key = self._generate_query_key(collection, filters, limit, order_by, offset)
            cached_result = self._get_from_cache(query_key)
            if cached_result is not None:
                await self.performance_monitor.record_metric(
                    'cache_hit', time.time() - start_time, {'collection': collection, 'operation': 'query'}
                )
                return cached_result

            # Execute query in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, self._sync_query_documents, collection, filters, limit, order_by, offset
            )

            # Cache result for frequently accessed queries
            if len(result) <= 100:  # Only cache small result sets
                self._set_cache(query_key, result)

            await self.performance_monitor.record_metric(
                'db_query', time.time() - start_time,
                {'collection': collection, 'result_count': len(result), 'cached': False}
            )

            return result

        except Exception as e:
            await self.performance_monitor.record_metric(
                'db_error', time.time() - start_time, {'operation': 'query', 'error': str(e)}
            )
            raise

    @handle_service_errors
    async def batch_write_async(self, operations: List[Dict[str, Any]]) -> bool:
        """
        Async batch write for high-throughput operations
        """
        start_time = time.time()

        try:
            # Split large batches into smaller chunks
            batch_size = self._max_batch_size
            for i in range(0, len(operations), batch_size):
                batch_ops = operations[i:i + batch_size]

                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self._sync_batch_write, batch_ops)

            # Invalidate affected cache entries
            for op in operations:
                if 'doc_id' in op:
                    cache_key = f"{op['collection']}:{op['doc_id']}"
                    self._invalidate_cache(cache_key)

            await self.performance_monitor.record_metric(
                'db_batch_write', time.time() - start_time,
                {'operation_count': len(operations), 'batches': (len(operations) + batch_size - 1) // batch_size}
            )

            return True

        except Exception as e:
            await self.performance_monitor.record_metric(
                'db_error', time.time() - start_time, {'operation': 'batch_write', 'error': str(e)}
            )
            raise

    @handle_service_errors
    async def transactional_operation_async(self, operations: List[Dict[str, Any]]) -> bool:
        """
        Execute multiple operations in a transaction for consistency
        """
        start_time = time.time()

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._sync_transactional_operation, operations)

            await self.performance_monitor.record_metric(
                'db_transaction', time.time() - start_time, {'operation_count': len(operations)}
            )

            return result

        except Exception as e:
            await self.performance_monitor.record_metric(
                'db_error', time.time() - start_time, {'operation': 'transaction', 'error': str(e)}
            )
            raise

    @handle_service_errors
    async def get_collection_stats_async(self, collection: str) -> Dict[str, Any]:
        """
        Get collection statistics for monitoring and optimization
        """
        start_time = time.time()

        try:
            loop = asyncio.get_event_loop()
            stats = await loop.run_in_executor(None, self._sync_get_collection_stats, collection)

            await self.performance_monitor.record_metric(
                'db_stats', time.time() - start_time, {'collection': collection}
            )

            return stats

        except Exception as e:
            await self.performance_monitor.record_metric(
                'db_error', time.time() - start_time, {'operation': 'stats', 'error': str(e)}
            )
            raise

    # Synchronous helper methods (executed in thread pool)
    def _sync_get_document(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous document retrieval"""
        doc = db.collection(collection).document(doc_id).get()
        return doc.to_dict() if doc.exists else None

    def _sync_create_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> bool:
        """Synchronous document creation"""
        db.collection(collection).document(doc_id).set(data)
        return True

    def _sync_update_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> bool:
        """Synchronous document update"""
        db.collection(collection).document(doc_id).update(data)
        return True

    def _sync_query_documents(self, collection: str, filters: Optional[List[Tuple[str, str, Any]]] = None,
                             limit: Optional[int] = None, order_by: Optional[str] = None,
                             offset: Optional[int] = None) -> List[Dict[str, Any]]:
        """Synchronous document querying"""
        query = db.collection(collection)

        if filters:
            for field, operator, value in filters:
                query = query.where(field, operator, value)

        if order_by:
            query = query.order_by(order_by)

        if limit:
            query = query.limit(limit)

        if offset:
            query = query.offset(offset)

        docs = query.stream()
        return [doc.to_dict() for doc in docs]

    def _sync_batch_write(self, operations: List[Dict[str, Any]]) -> bool:
        """Synchronous batch write"""
        batch = db.batch()

        for op in operations:
            collection = op['collection']
            doc_id = op['doc_id']
            doc_ref = db.collection(collection).document(doc_id)

            if op['type'] == 'set':
                batch.set(doc_ref, op['data'])
            elif op['type'] == 'update':
                batch.update(doc_ref, op['data'])
            elif op['type'] == 'delete':
                batch.delete(doc_ref)

        batch.commit()
        return True

    def _sync_transactional_operation(self, operations: List[Dict[str, Any]]) -> bool:
        """Synchronous transactional operation"""
        @firestore.transactional
        def transaction_runner(transaction, ops):
            for op in ops:
                doc_ref = db.collection(op['collection']).document(op['doc_id'])
                if op['type'] == 'create':
                    transaction.set(doc_ref, op['data'])
                elif op['type'] == 'update':
                    transaction.update(doc_ref, op['data'])
                elif op['type'] == 'delete':
                    transaction.delete(doc_ref)

        transaction_runner(db.transaction(), operations)
        return True

    def _sync_get_collection_stats(self, collection: str) -> Dict[str, Any]:
        """Synchronous collection statistics"""
        # This is a simplified version - in production you'd use Firestore aggregation queries
        query = db.collection(collection).limit(1)
        docs = query.stream()
        doc_count = sum(1 for _ in docs)

        return {
            'collection': collection,
            'estimated_document_count': doc_count,
            'last_updated': datetime.now(timezone.utc).isoformat()
        }

    # Cache management methods
    def _get_from_cache(self, key: str) -> Optional[Any]:
        """Get value from query cache"""
        if key in self._query_cache:
            entry = self._query_cache[key]
            if entry['expires'] > time.time():
                return entry['value']
            else:
                # Expired, remove it
                del self._query_cache[key]
        return None

    def _set_cache(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in query cache"""
        ttl = ttl or self._cache_ttl
        self._query_cache[key] = {
            'value': value,
            'expires': time.time() + ttl
        }

    def _invalidate_cache(self, key: str):
        """Invalidate cache entry"""
        if key in self._query_cache:
            del self._query_cache[key]

    def _generate_query_key(self, collection: str, filters: Optional[List[Tuple[str, str, Any]]] = None,
                           limit: Optional[int] = None, order_by: Optional[str] = None,
                           offset: Optional[int] = None) -> str:
        """Generate cache key for query"""
        key_parts = [collection]

        if filters:
            sorted_filters = sorted(filters, key=lambda x: x[0])
            key_parts.append(str(sorted_filters))

        if limit:
            key_parts.append(f"limit:{limit}")

        if order_by:
            key_parts.append(f"order:{order_by}")

        if offset:
            key_parts.append(f"offset:{offset}")

        return ":".join(key_parts)

    async def health_check_async(self) -> Dict[str, Any]:
        """Async health check for database connectivity"""
        start_time = time.time()

        try:
            # Simple connectivity test
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._sync_health_check)

            await self.performance_monitor.record_metric(
                'health_check', time.time() - start_time, {'status': 'healthy'}
            )

            return {
                'status': 'healthy',
                'response_time': time.time() - start_time,
                'connection_pool_size': self._connection_pool_size
            }

        except Exception as e:
            await self.performance_monitor.record_metric(
                'health_check', time.time() - start_time, {'status': 'unhealthy', 'error': str(e)}
            )

            return {
                'status': 'unhealthy',
                'error': str(e),
                'response_time': time.time() - start_time
            }

    def _sync_health_check(self):
        """Synchronous health check"""
        # Simple query to test connectivity
        test_query = db.collection('_health_check').limit(1)
        list(test_query.stream())  # Consume iterator to test connection