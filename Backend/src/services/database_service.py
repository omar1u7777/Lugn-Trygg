"""
Database Service - Abstracted database operations

Provides a clean interface for database operations with proper error handling
and testability.
"""

from typing import Any, Dict, List, Optional, Union
from abc import ABC, abstractmethod
import logging
from ..firebase_config import db
from ..utils.error_handling import handle_service_errors, ServiceError

logger = logging.getLogger(__name__)

class DatabaseService:
    """Database service with abstracted operations"""

    @handle_service_errors
    def get_collection(self, name: str) -> Any:
        """Get a collection reference"""
        return db.collection(name)

    @handle_service_errors
    def get_document(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """Get a document by ID"""
        try:
            doc = db.collection(collection).document(doc_id).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Failed to get document {collection}/{doc_id}: {e}")
            return None

    @handle_service_errors
    def create_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> bool:
        """Create a new document"""
        try:
            db.collection(collection).document(doc_id).set(data)
            logger.info(f"Document created: {collection}/{doc_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to create document {collection}/{doc_id}: {e}")
            return False

    @handle_service_errors
    def update_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> bool:
        """Update an existing document"""
        try:
            db.collection(collection).document(doc_id).update(data)
            logger.info(f"Document updated: {collection}/{doc_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to update document {collection}/{doc_id}: {e}")
            return False

    @handle_service_errors
    def delete_document(self, collection: str, doc_id: str) -> bool:
        """Delete a document"""
        try:
            db.collection(collection).document(doc_id).delete()
            logger.info(f"Document deleted: {collection}/{doc_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete document {collection}/{doc_id}: {e}")
            return False

    @handle_service_errors
    def query_documents(self, collection: str, filters: List[tuple] = None,
                       limit: int = None, order_by: str = None) -> List[Dict[str, Any]]:
        """Query documents with filters"""
        query = db.collection(collection)

        if filters:
            for field, operator, value in filters:
                query = query.where(field, operator, value)

        if order_by:
            query = query.order_by(order_by)

        if limit:
            query = query.limit(limit)

        docs = query.stream()
        return [doc.to_dict() for doc in docs]

    @handle_service_errors
    def batch_write(self, operations: List[Dict[str, Any]]) -> bool:
        """Perform batch write operations"""
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
        logger.info(f"Batch write completed: {len(operations)} operations")
        return True