"""
Firestore Index Management and Optimization
Automatic index creation, monitoring, and performance optimization
"""

import json
import time
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timedelta, timezone
import logging
from firebase_admin import firestore
from google.cloud import firestore as gcp_firestore
from google.api_core.exceptions import AlreadyExists, NotFound

logger = logging.getLogger(__name__)

class FirestoreIndexManager:
    """Manages Firestore indexes for optimal query performance"""

    def __init__(self, project_id: str = None):
        self.project_id = project_id
        self.indexes: Dict[str, Dict] = {}
        self.pending_indexes: List[Dict] = []
        self.index_usage_stats: Dict[str, Dict] = {}

        # Common index patterns for Lugn & Trygg
        self.common_indexes = {
            'users': [
                {'fields': ['email'], 'type': 'single'},
                {'fields': ['subscription', 'created_at'], 'type': 'composite'},
                {'fields': ['last_login'], 'type': 'single'},
                {'fields': ['language', 'subscription'], 'type': 'composite'},
            ],
            'moods': [
                {'fields': ['user_id', 'timestamp'], 'type': 'composite'},
                {'fields': ['user_id', 'mood_value'], 'type': 'composite'},
                {'fields': ['timestamp'], 'type': 'single'},
                {'fields': ['category', 'timestamp'], 'type': 'composite'},
                {'fields': ['user_id', 'category', 'timestamp'], 'type': 'composite'},
                {'fields': ['triggers'], 'type': 'array'},
            ],
            'memories': [
                {'fields': ['user_id', 'uploaded_at'], 'type': 'composite'},
                {'fields': ['tags'], 'type': 'array'},
                {'fields': ['mime_type', 'uploaded_at'], 'type': 'composite'},
            ],
            'ai_stories': [
                {'fields': ['user_id', 'created_at'], 'type': 'composite'},
                {'fields': ['mood_themes'], 'type': 'array'},
            ],
            'subscriptions': [
                {'fields': ['user_id', 'status'], 'type': 'composite'},
                {'fields': ['status', 'current_period_end'], 'type': 'composite'},
                {'fields': ['plan', 'created_at'], 'type': 'composite'},
            ],
            'audit_logs': [
                {'fields': ['user_id', 'timestamp'], 'type': 'composite'},
                {'fields': ['event_type', 'timestamp'], 'type': 'composite'},
                {'fields': ['timestamp'], 'type': 'single'},
            ]
        }

    def create_recommended_indexes(self) -> List[Dict]:
        """Create recommended indexes for all collections"""
        indexes_to_create = []

        for collection, index_specs in self.common_indexes.items():
            for spec in index_specs:
                index_def = self._create_index_definition(collection, spec)
                if index_def:
                    indexes_to_create.append(index_def)

        return indexes_to_create

    def _create_index_definition(self, collection: str, spec: Dict) -> Optional[Dict]:
        """Create Firestore index definition"""
        fields = spec['fields']
        index_type = spec.get('type', 'composite')

        if index_type == 'single':
            # Single field index (automatic in Firestore)
            return None
        elif index_type == 'composite':
            # Composite index
            index_def = {
                'collection': collection,
                'fields': []
            }

            for field in fields:
                index_def['fields'].append({
                    'fieldPath': field,
                    'order': 'ASCENDING'
                })

            return index_def
        elif index_type == 'array':
            # Array contains index
            return {
                'collection': collection,
                'fields': [
                    {
                        'fieldPath': fields[0],
                        'arrayConfig': 'CONTAINS'
                    }
                ]
            }

        return None

    def generate_firestore_indexes_json(self) -> str:
        """Generate firestore.indexes.json content"""
        indexes = self.create_recommended_indexes()

        firestore_indexes = {
            'indexes': indexes,
            'fieldOverrides': []
        }

        return json.dumps(firestore_indexes, indent=2)

    def analyze_query_for_indexes(self, collection: str, query_conditions: List[Dict],
                                order_by: List[str] = None) -> List[Dict]:
        """
        Analyze a query and suggest required indexes

        Args:
            collection: Collection name
            query_conditions: List of where conditions [{'field': 'name', 'op': '=='}]
            order_by: List of order by fields

        Returns:
            List of suggested indexes
        """
        suggested_indexes = []

        # Extract fields from where conditions
        where_fields = []
        has_array_ops = False

        for condition in query_conditions:
            field = condition.get('field')
            op = condition.get('op', '==')

            if field:
                where_fields.append(field)

                # Check for array operations
                if op in ['array-contains', 'array-contains-any', 'in']:
                    has_array_ops = True

        # Create composite index for where fields
        if len(where_fields) > 1:
            composite_index = self._create_index_definition(collection, {
                'fields': where_fields,
                'type': 'composite'
            })
            if composite_index:
                suggested_indexes.append(composite_index)

        # Create index for order by fields if not covered by where
        if order_by:
            order_fields = [f for f in order_by if f not in where_fields]
            if order_fields:
                order_index = self._create_index_definition(collection, {
                    'fields': where_fields + order_fields,
                    'type': 'composite'
                })
                if order_index:
                    suggested_indexes.append(order_index)

        # Array indexes if needed
        if has_array_ops:
            for field in where_fields:
                array_index = self._create_index_definition(collection, {
                    'fields': [field],
                    'type': 'array'
                })
                if array_index:
                    suggested_indexes.append(array_index)

        return suggested_indexes

    def monitor_index_usage(self, collection: str, query_hash: str,
                          execution_time: float, result_count: int):
        """Monitor index usage patterns"""
        if query_hash not in self.index_usage_stats:
            self.index_usage_stats[query_hash] = {
                'collection': collection,
                'usage_count': 0,
                'total_time': 0,
                'avg_time': 0,
                'last_used': None,
                'performance_trend': []
            }

        stats = self.index_usage_stats[query_hash]
        stats['usage_count'] += 1
        stats['total_time'] += execution_time
        stats['avg_time'] = stats['total_time'] / stats['usage_count']
        stats['last_used'] = datetime.now(timezone.utc)
        stats['performance_trend'].append({
            'timestamp': datetime.now(timezone.utc),
            'execution_time': execution_time,
            'result_count': result_count
        })

        # Keep only last 100 performance points
        if len(stats['performance_trend']) > 100:
            stats['performance_trend'] = stats['performance_trend'][-100:]

    def get_index_performance_report(self) -> Dict[str, Any]:
        """Generate index performance report"""
        report = {
            'total_indexes_tracked': len(self.index_usage_stats),
            'most_used_indexes': {},
            'slowest_queries': {},
            'performance_trends': {},
            'optimization_suggestions': []
        }

        # Most used indexes
        usage_counts = {}
        for query_hash, stats in self.index_usage_stats.items():
            usage_counts[query_hash] = stats['usage_count']

        most_used = sorted(usage_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        report['most_used_indexes'] = {k: v for k, v in most_used}

        # Slowest queries (avg time > 1s)
        slow_queries = {}
        for query_hash, stats in self.index_usage_stats.items():
            if stats['avg_time'] > 1000:  # > 1 second
                slow_queries[query_hash] = {
                    'avg_time': stats['avg_time'],
                    'usage_count': stats['usage_count'],
                    'collection': stats['collection']
                }

        report['slowest_queries'] = dict(sorted(slow_queries.items(),
                                              key=lambda x: x[1]['avg_time'],
                                              reverse=True)[:10])

        # Performance trends
        for query_hash, stats in self.index_usage_stats.items():
            trend = stats['performance_trend'][-10:]  # Last 10 executions
            if len(trend) >= 2:
                times = [p['execution_time'] for p in trend]
                avg_time = sum(times) / len(times)
                report['performance_trends'][query_hash] = {
                    'avg_time': avg_time,
                    'trend': 'improving' if times[-1] < times[0] else 'degrading',
                    'sample_size': len(trend)
                }

        # Generate optimization suggestions
        report['optimization_suggestions'] = self._generate_index_optimizations()

        return report

    def _generate_index_optimizations(self) -> List[str]:
        """Generate index optimization suggestions"""
        suggestions = []

        # Check for frequently slow queries
        slow_count = sum(1 for stats in self.index_usage_stats.values() if stats['avg_time'] > 1000)
        if slow_count > 0:
            suggestions.append(f"Optimize {slow_count} slow queries (avg > 1s)")

        # Check for unused indexes (low usage)
        low_usage = [k for k, v in self.index_usage_stats.items() if v['usage_count'] < 5]
        if low_usage:
            suggestions.append(f"Consider removing {len(low_usage)} low-usage indexes")

        # Check for performance degradation
        degrading = []
        for query_hash, trend in self.get_index_performance_report()['performance_trends'].items():
            if trend['trend'] == 'degrading':
                degrading.append(query_hash)

        if degrading:
            suggestions.append(f"Address {len(degrading)} queries with degrading performance")

        # General suggestions
        if not suggestions:
            suggestions.append("Index performance is optimal")
            suggestions.append("Continue monitoring for new query patterns")

        return suggestions

    def create_collection_group_indexes(self) -> List[Dict]:
        """Create collection group indexes for subcollections"""
        # These are useful for queries across subcollections
        group_indexes = [
            {
                'collectionGroup': 'user_activities',
                'fields': [
                    {'fieldPath': 'user_id', 'order': 'ASCENDING'},
                    {'fieldPath': 'timestamp', 'order': 'DESCENDING'}
                ]
            },
            {
                'collectionGroup': 'audit_events',
                'fields': [
                    {'fieldPath': 'timestamp', 'order': 'DESCENDING'},
                    {'fieldPath': 'event_type', 'order': 'ASCENDING'}
                ]
            }
        ]

        return group_indexes

    def generate_index_deployment_script(self) -> str:
        """Generate Firebase CLI commands for index deployment"""
        indexes = self.create_recommended_indexes()
        group_indexes = self.create_collection_group_indexes()

        script_lines = [
            '#!/bin/bash',
            '# Firestore Index Deployment Script',
            '# Run this script to deploy all recommended indexes',
            '',
            'echo "🚀 Deploying Firestore indexes..."',
            '',
            '# Deploy regular indexes',
            'firebase deploy --only firestore:indexes',
            '',
            '# Alternative: Deploy specific indexes',
            '# firebase firestore:indexes'
        ]

        # Add verification commands
        script_lines.extend([
            '',
            'echo "✅ Index deployment completed"',
            'echo "📊 Verifying indexes..."',
            '',
            '# Check index status',
            'firebase firestore:indexes:list'
        ])

        return '\n'.join(script_lines)

    def export_indexes_for_firebase_cli(self, filename: str = 'firestore.indexes.json'):
        """Export indexes in Firebase CLI format"""
        all_indexes = self.create_recommended_indexes()
        group_indexes = self.create_collection_group_indexes()

        firebase_indexes = {
            'indexes': all_indexes,
            'fieldOverrides': []
        }

        # Add collection group indexes
        for group_index in group_indexes:
            firebase_indexes['indexes'].append(group_index)

        with open(filename, 'w') as f:
            json.dump(firebase_indexes, f, indent=2)

        logger.info(f"✅ Exported {len(firebase_indexes['indexes'])} indexes to {filename}")
        return filename

# Global index manager
index_manager = FirestoreIndexManager()

def auto_create_indexes_for_query(collection: str, query_conditions: List[Dict],
                                order_by: List[str] = None) -> List[Dict]:
    """Automatically create indexes for a query"""
    return index_manager.analyze_query_for_indexes(collection, query_conditions, order_by)

def get_index_performance_report() -> Dict[str, Any]:
    """Get comprehensive index performance report"""
    return index_manager.get_index_performance_report()

__all__ = [
    'FirestoreIndexManager',
    'index_manager',
    'auto_create_indexes_for_query',
    'get_index_performance_report'
]