"""
Database Service - Abstracted database operations

Provides a clean interface for database operations with proper error handling
and testability. Implements IDatabaseService protocol with Tuple[data, error] returns.
"""

from typing import Any, Dict, List, Optional, Union, Tuple
from abc import ABC, abstractmethod
import logging
from ..firebase_config import db

logger = logging.getLogger(__name__)

class DatabaseService:
    """Database service with abstracted operations - implements IDatabaseService protocol"""

    def get_collection(self, name: str) -> Tuple[Any, Optional[str]]:
        """Get a collection reference"""
        try:
            collection = db.collection(name)  # type: ignore
            return (collection, None)
        except Exception as e:
            error_msg = f"Failed to get collection {name}: {e}"
            logger.error(error_msg)
            return (None, error_msg)

    def get_document(self, collection: str, doc_id: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Get a document by ID"""
        try:
            doc = db.collection(collection).document(doc_id).get()  # type: ignore
            if doc.exists:
                return (doc.to_dict(), None)
            else:
                return (None, None)  # Not found is not an error
        except Exception as e:
            error_msg = f"Failed to get document {collection}/{doc_id}: {e}"
            logger.error(error_msg)
            return (None, error_msg)

    def create_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Create a new document"""
        try:
            db.collection(collection).document(doc_id).set(data)  # type: ignore
            logger.info(f"Document created: {collection}/{doc_id}")
            return (True, None)
        except Exception as e:
            error_msg = f"Failed to create document {collection}/{doc_id}: {e}"
            logger.error(error_msg)
            return (False, error_msg)

    def update_document(self, collection: str, doc_id: str, data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Update an existing document"""
        try:
            db.collection(collection).document(doc_id).update(data)  # type: ignore
            logger.info(f"Document updated: {collection}/{doc_id}")
            return (True, None)
        except Exception as e:
            error_msg = f"Failed to update document {collection}/{doc_id}: {e}"
            logger.error(error_msg)
            return (False, error_msg)

    def delete_document(self, collection: str, doc_id: str) -> Tuple[bool, Optional[str]]:
        """Delete a document"""
        try:
            db.collection(collection).document(doc_id).delete()  # type: ignore
            logger.info(f"Document deleted: {collection}/{doc_id}")
            return (True, None)
        except Exception as e:
            error_msg = f"Failed to delete document {collection}/{doc_id}: {e}"
            logger.error(error_msg)
            return (False, error_msg)

    def query_documents(self, collection: str, filters: Optional[List[tuple]] = None,
                       limit: Optional[int] = None, order_by: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Query documents with filters"""
        try:
            query = db.collection(collection)  # type: ignore

            if filters:
                for field, operator, value in filters:
                    query = query.where(field, operator, value)

            if order_by:
                query = query.order_by(order_by)

            if limit:
                query = query.limit(limit)

            docs = query.stream()
            results = [doc.to_dict() for doc in docs]
            return (results, None)
        except Exception as e:
            error_msg = f"Failed to query documents in {collection}: {e}"
            logger.error(error_msg)
            return ([], error_msg)

    def batch_write(self, operations: List[Dict[str, Any]]) -> Tuple[bool, Optional[str]]:
        """Perform batch write operations"""
        try:
            batch = db.batch()  # type: ignore

            for op in operations:
                collection = op['collection']
                doc_id = op['doc_id']
                doc_ref = db.collection(collection).document(doc_id)  # type: ignore

                if op['type'] == 'set':
                    batch.set(doc_ref, op['data'])
                elif op['type'] == 'update':
                    batch.update(doc_ref, op['data'])
                elif op['type'] == 'delete':
                    batch.delete(doc_ref)

            batch.commit()
            logger.info(f"Batch write completed: {len(operations)} operations")
            return (True, None)
        except Exception as e:
            error_msg = f"Batch write failed: {e}"
            logger.error(error_msg)
            return (False, error_msg)
