"""
Firestore Index Optimization and Query Performance Service
Advanced indexing strategies, query optimization, and performance monitoring
"""

import time
from typing import Dict, List, Optional, Any, Tuple, Set
from collections import defaultdict, Counter
from datetime import datetime, timedelta
import logging
from firebase_admin import firestore
from google.cloud import firestore as gcp_firestore
from google.api_core.exceptions import ResourceExhausted, DeadlineExceeded

logger = logging.getLogger(__name__)

class FirestoreQueryOptimizer:
    """Optimizes Firestore queries and manages indexes"""

    def __init__(self, db=None):
        self.db = db or firestore.client()
        self.query_stats: Dict[str, Dict] = {}
        self.slow_queries: List[Dict] = []
        self.index_suggestions: List[Dict] = []
        self.performance_thresholds = {
            'slow_query_ms': 1000,  # Queries slower than 1s
            'very_slow_query_ms': 5000,  # Queries slower than 5s
            'max_results': 1000,  # Maximum results to fetch
        }

    def analyze_query_performance(self, collection: str, query_dict: Dict,
                                execution_time: float, result_count: int) -> Dict:
        """Analyze query performance and suggest optimizations"""

        analysis = {
            'collection': collection,
            'execution_time_ms': execution_time,
            'result_count': result_count,
            'timestamp': datetime.utcnow(),
            'query_hash': self._hash_query(query_dict),
            'performance_rating': self._rate_performance(execution_time, result_count),
            'optimizations': []
        }

        # Analyze query structure
        query_analysis = self._analyze_query_structure(query_dict)

        # Check for common performance issues
        issues = self._identify_performance_issues(query_analysis, execution_time, result_count)

        # Suggest optimizations
        optimizations = self._suggest_optimizations(query_analysis, issues)

        analysis['query_analysis'] = query_analysis
        analysis['issues'] = issues
        analysis['optimizations'] = optimizations

        # Store for monitoring
        query_hash = analysis['query_hash']
        if query_hash not in self.query_stats:
            self.query_stats[query_hash] = {
                'count': 0,
                'total_time': 0,
                'avg_time': 0,
                'max_time': 0,
                'min_time': float('inf'),
                'last_seen': None,
                'query_sample': query_dict
            }

        stats = self.query_stats[query_hash]
        stats['count'] += 1
        stats['total_time'] += execution_time
        stats['avg_time'] = stats['total_time'] / stats['count']
        stats['max_time'] = max(stats['max_time'], execution_time)
        stats['min_time'] = min(stats['min_time'], execution_time)
        stats['last_seen'] = datetime.utcnow()

        # Track slow queries
        if execution_time > self.performance_thresholds['slow_query_ms']:
            self.slow_queries.append(analysis)

        return analysis

    def _hash_query(self, query_dict: Dict) -> str:
        """Create a hash for query identification"""
        import hashlib
        import json

        # Normalize query for consistent hashing
        normalized = json.dumps(query_dict, sort_keys=True, default=str)
        return hashlib.md5(normalized.encode()).hexdigest()[:8]

    def _rate_performance(self, execution_time: float, result_count: int) -> str:
        """Rate query performance"""
        if execution_time < 100:
            return 'excellent'
        elif execution_time < 500:
            return 'good'
        elif execution_time < 1000:
            return 'fair'
        elif execution_time < 5000:
            return 'poor'
        else:
            return 'critical'

    def _analyze_query_structure(self, query_dict: Dict) -> Dict:
        """Analyze the structure of a Firestore query"""
        analysis = {
            'has_where_clauses': False,
            'where_fields': [],
            'where_operators': [],
            'has_order_by': False,
            'order_by_fields': [],
            'has_limit': False,
            'limit_value': None,
            'has_start_after': False,
            'has_end_before': False,
            'complexity_score': 0
        }

        # Analyze where clauses
        if 'where' in query_dict:
            analysis['has_where_clauses'] = True
            where_clauses = query_dict['where']
            if isinstance(where_clauses, list):
                for clause in where_clauses:
                    if isinstance(clause, dict):
                        field = clause.get('field')
                        op = clause.get('op', clause.get('operator', '=='))
                        if field:
                            analysis['where_fields'].append(field)
                            analysis['where_operators'].append(op)
                            analysis['complexity_score'] += 1

                            # Penalize expensive operators
                            if op in ['array-contains', 'in', 'array-contains-any']:
                                analysis['complexity_score'] += 2

        # Analyze order by
        if 'order_by' in query_dict or 'orderBy' in query_dict:
            analysis['has_order_by'] = True
            order_fields = query_dict.get('order_by') or query_dict.get('orderBy', [])
            if isinstance(order_fields, list):
                analysis['order_by_fields'] = order_fields
                analysis['complexity_score'] += len(order_fields)

        # Analyze limit
        if 'limit' in query_dict:
            analysis['has_limit'] = True
            analysis['limit_value'] = query_dict['limit']
            if query_dict['limit'] > 100:
                analysis['complexity_score'] += 1

        # Analyze cursors
        if 'start_after' in query_dict or 'startAfter' in query_dict:
            analysis['has_start_after'] = True
            analysis['complexity_score'] += 1

        if 'end_before' in query_dict or 'endBefore' in query_dict:
            analysis['has_end_before'] = True
            analysis['complexity_score'] += 1

        return analysis

    def _identify_performance_issues(self, query_analysis: Dict,
                                   execution_time: float, result_count: int) -> List[str]:
        """Identify potential performance issues"""
        issues = []

        # Slow execution
        if execution_time > self.performance_thresholds['very_slow_query_ms']:
            issues.append("Very slow query execution (>5s)")
        elif execution_time > self.performance_thresholds['slow_query_ms']:
            issues.append("Slow query execution (>1s)")

        # Large result sets
        if result_count > self.performance_thresholds['max_results']:
            issues.append(f"Large result set ({result_count} documents)")

        # Query structure issues
        if len(query_analysis['where_fields']) > 3:
            issues.append("Too many where clauses (may need composite index)")

        if query_analysis['complexity_score'] > 5:
            issues.append("High query complexity score")

        # Expensive operators
        expensive_ops = ['array-contains', 'in', 'array-contains-any']
        used_expensive_ops = [op for op in query_analysis['where_operators'] if op in expensive_ops]
        if used_expensive_ops:
            issues.append(f"Expensive operators used: {', '.join(used_expensive_ops)}")

        # Unbounded queries
        if not query_analysis['has_limit'] and not query_analysis['has_where_clauses']:
            issues.append("Unbounded query (no limit or where clauses)")

        return issues

    def _suggest_optimizations(self, query_analysis: Dict, issues: List[str]) -> List[str]:
        """Suggest query optimizations"""
        suggestions = []

        # Index suggestions
        if len(query_analysis['where_fields']) > 1:
            fields = query_analysis['where_fields']
            suggestions.append(f"Consider composite index on fields: {', '.join(fields)}")

        if query_analysis['has_order_by'] and query_analysis['where_fields']:
            order_fields = set(query_analysis['order_by_fields'])
            where_fields = set(query_analysis['where_fields'])
            if not order_fields.issubset(where_fields):
                suggestions.append("OrderBy fields should be included in where clauses for optimal indexing")

        # Limit suggestions
        if not query_analysis['has_limit']:
            suggestions.append("Add limit() to prevent large result sets")

        # Pagination suggestions
        if query_analysis['result_count'] > 100 and not query_analysis['has_start_after']:
            suggestions.append("Consider implementing cursor-based pagination")

        # Denormalization suggestions
        if 'array-contains' in query_analysis['where_operators']:
            suggestions.append("Consider denormalizing array fields for better query performance")

        # Caching suggestions
        if query_analysis.get('execution_time_ms', 0) > 1000:
            suggestions.append("Consider caching frequently accessed data")

        return suggestions

    def get_performance_report(self) -> Dict:
        """Generate comprehensive performance report"""
        report = {
            'summary': {
                'total_queries_analyzed': len(self.query_stats),
                'slow_queries_count': len(self.slow_queries),
                'avg_query_time': 0,
                'performance_distribution': {}
            },
            'slow_queries': self.slow_queries[-10:],  # Last 10 slow queries
            'index_suggestions': self.index_suggestions,
            'query_patterns': {},
            'recommendations': []
        }

        # Calculate averages and distributions
        if self.query_stats:
            total_time = sum(stats['total_time'] for stats in self.query_stats.values())
            total_queries = sum(stats['count'] for stats in self.query_stats.values())
            report['summary']['avg_query_time'] = total_time / total_queries if total_queries > 0 else 0

            # Performance distribution
            ratings = [stats.get('performance_rating', 'unknown') for stats in self.query_stats.values()]
            rating_counts = Counter(ratings)
            report['summary']['performance_distribution'] = dict(rating_counts)

        # Analyze query patterns
        pattern_analysis = self._analyze_query_patterns()
        report['query_patterns'] = pattern_analysis

        # Generate recommendations
        recommendations = self._generate_recommendations()
        report['recommendations'] = recommendations

        return report

    def _analyze_query_patterns(self) -> Dict:
        """Analyze common query patterns"""
        patterns = {
            'most_frequent_collections': {},
            'common_where_fields': {},
            'expensive_operations': {},
            'large_result_sets': 0
        }

        # Collection usage
        collection_counts = defaultdict(int)
        field_counts = defaultdict(int)
        operation_counts = defaultdict(int)

        for query_hash, stats in self.query_stats.items():
            sample_query = stats.get('query_sample', {})

            # Collection
            collection = sample_query.get('collection', 'unknown')
            collection_counts[collection] += stats['count']

            # Where fields
            where_clauses = sample_query.get('where', [])
            if isinstance(where_clauses, list):
                for clause in where_clauses:
                    if isinstance(clause, dict):
                        field = clause.get('field')
                        op = clause.get('op', clause.get('operator', '=='))
                        if field:
                            field_counts[field] += stats['count']
                            operation_counts[op] += stats['count']

        patterns['most_frequent_collections'] = dict(collection_counts.most_common(5))
        patterns['common_where_fields'] = dict(field_counts.most_common(10))
        patterns['expensive_operations'] = dict(operation_counts.most_common())

        return patterns

    def _generate_recommendations(self) -> List[str]:
        """Generate optimization recommendations"""
        recommendations = []

        # Analyze slow queries
        if len(self.slow_queries) > 0:
            recommendations.append(f"Address {len(self.slow_queries)} slow queries (>1s execution time)")

        # Check for missing indexes
        patterns = self._analyze_query_patterns()
        common_fields = patterns.get('common_where_fields', {})

        if len(common_fields) > 3:
            top_fields = list(common_fields.keys())[:3]
            recommendations.append(f"Create composite index for frequently queried fields: {', '.join(top_fields)}")

        # Check for expensive operations
        expensive_ops = patterns.get('expensive_operations', {})
        expensive_op_types = ['array-contains', 'in', 'array-contains-any']

        for op in expensive_op_types:
            if op in expensive_ops and expensive_ops[op] > 10:
                recommendations.append(f"Reduce usage of expensive '{op}' operations ({expensive_ops[op]} occurrences)")

        # General recommendations
        if not recommendations:
            recommendations.append("Query performance is generally good")
            recommendations.append("Monitor for new slow queries as data grows")

        return recommendations

    def create_optimized_query(self, collection: str, filters: Dict = None,
                             order_by: List[str] = None, limit: int = None) -> gcp_firestore.Query:
        """
        Create an optimized Firestore query with automatic index suggestions

        Args:
            collection: Collection name
            filters: Dict of field -> value filters
            order_by: List of fields to order by
            limit: Maximum number of results

        Returns:
            Optimized Firestore query
        """
        collection_ref = self.db.collection(collection)
        query = collection_ref

        # Apply filters
        if filters:
            for field, value in filters.items():
                query = query.where(field, '==', value)

        # Apply ordering
        if order_by:
            for field in order_by:
                query = query.order_by(field)

        # Apply limit
        if limit:
            query = query.limit(limit)

        # Analyze and log the query
        query_dict = {
            'collection': collection,
            'where': [{'field': k, 'op': '==', 'value': v} for k, v in (filters or {}).items()],
            'order_by': order_by or [],
            'limit': limit
        }

        # Note: In a real implementation, you'd measure execution time
        # For now, just log the query structure
        logger.info(f"Optimized query created for {collection}: {query_dict}")

        return query

    def batch_write_optimization(self, collection: str, documents: List[Dict],
                               batch_size: int = 500) -> List[str]:
        """
        Optimize batch writes with proper batching and error handling

        Args:
            collection: Target collection
            documents: List of documents to write
            batch_size: Maximum batch size (Firestore limit is 500)

        Returns:
            List of document IDs created/updated
        """
        created_ids = []
        batch_size = min(batch_size, 500)  # Firestore limit

        for i in range(0, len(documents), batch_size):
            batch = self.db.batch()
            batch_docs = documents[i:i + batch_size]

            for doc_data in batch_docs:
                doc_id = doc_data.pop('_id', None)
                doc_ref = self.db.collection(collection).document(doc_id) if doc_id else self.db.collection(collection).document()
                batch.set(doc_ref, doc_data)
                created_ids.append(doc_ref.id)

            # Commit batch
            try:
                batch.commit()
                logger.info(f"Committed batch of {len(batch_docs)} documents to {collection}")
            except Exception as e:
                logger.error(f"Batch write failed: {e}")
                # In production, implement retry logic
                raise

        return created_ids

# Global optimizer instance
firestore_optimizer = FirestoreQueryOptimizer()

def optimize_firestore_query(collection: str, **kwargs):
    """Decorator to optimize Firestore queries"""
    def decorator(func):
        def wrapper(*args, **kwargs_inner):
            start_time = time.time()

            try:
                result = func(*args, **kwargs_inner)

                # Measure execution time
                execution_time = (time.time() - start_time) * 1000  # Convert to ms

                # Analyze query if it's a query operation
                if hasattr(result, '_query') or isinstance(result, list):
                    # This is a simplified analysis - in practice you'd need more context
                    query_dict = {
                        'collection': collection,
                        'filters': kwargs_inner,
                        'limit': kwargs.get('limit')
                    }

                    result_count = len(result) if isinstance(result, list) else 0

                    firestore_optimizer.analyze_query_performance(
                        collection, query_dict, execution_time, result_count
                    )

                return result

            except Exception as e:
                execution_time = (time.time() - start_time) * 1000
                logger.error(f"Query failed after {execution_time:.2f}ms: {e}")
                raise

        return wrapper
    return decorator

__all__ = [
    'FirestoreQueryOptimizer',
    'firestore_optimizer',
    'optimize_firestore_query'
]