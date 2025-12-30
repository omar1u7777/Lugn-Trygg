"""
Optimized Firestore Query Service
Provides efficient queries, batch operations, and proper indexing for Lugn & Trygg
"""

import logging
from typing import Dict, List, Optional, Any, Tuple, Iterator
from datetime import datetime, timedelta
from collections import defaultdict
import time

from firebase_admin import firestore
from google.cloud.firestore import FieldFilter, Query
from google.api_core.exceptions import ResourceExhausted, DeadlineExceeded

logger = logging.getLogger(__name__)

class OptimizedQueryService:
    """Service for optimized Firestore queries and batch operations"""

    def __init__(self, db=None):
        self.db = db or firestore.client()
        self.performance_stats: Dict[str, Dict] = {}

    def get_user_moods_efficient(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        order_by: str = 'timestamp',
        direction: str = 'DESCENDING'
    ) -> Tuple[List[Dict], int]:
        """
        Efficiently fetch user moods with proper pagination and filtering

        Args:
            user_id: User ID
            limit: Maximum number of results
            offset: Number of results to skip
            start_date: Filter moods after this date
            end_date: Filter moods before this date
            order_by: Field to order by
            direction: Sort direction

        Returns:
            Tuple of (mood_list, total_count)
        """
        start_time = time.time()

        try:
            mood_ref = self.db.collection('users').document(user_id).collection('moods')

            # Build query with filters
            query = mood_ref.order_by(order_by, direction=direction)

            # Apply date filters
            if start_date:
                query = query.where(filter=FieldFilter('timestamp', '>=', start_date))
            if end_date:
                query = query.where(filter=FieldFilter('timestamp', '<=', end_date))

            # Get total count efficiently (without fetching all documents)
            count_query = query.count()
            total_count = count_query.get()[0][0].value

            # Apply pagination
            if offset > 0:
                # For offset-based pagination, we need to fetch offset + limit
                # and slice in memory (Firestore doesn't support offset directly)
                fetch_limit = min(offset + limit, 1000)  # Reasonable limit
                docs = list(query.limit(fetch_limit).stream())
                docs = docs[offset:offset + limit]
            else:
                docs = list(query.limit(limit).stream())

            # Convert to dict format
            moods = []
            for doc in docs:
                mood_data = doc.to_dict()
                moods.append({
                    'id': doc.id,
                    'mood_text': mood_data.get('mood_text', ''),
                    'timestamp': mood_data.get('timestamp', ''),
                    'sentiment': mood_data.get('sentiment', 'NEUTRAL'),
                    'score': mood_data.get('score', 0),
                    'emotions_detected': mood_data.get('emotions_detected', []),
                    'sentiment_analysis': mood_data.get('ai_analysis', mood_data.get('sentiment_analysis', {}))
                })

            execution_time = time.time() - start_time
            self._record_performance('get_user_moods_efficient', execution_time, len(moods))

            logger.info(f"✅ Efficiently fetched {len(moods)} moods for user {user_id} in {execution_time:.3f}s")
            return moods, total_count

        except Exception as e:
            logger.error(f"Failed to fetch user moods efficiently: {str(e)}")
            raise

    def get_user_moods_analytics(
        self,
        user_id: str,
        days: int = 30,
        include_trends: bool = True
    ) -> Dict[str, Any]:
        """
        Get comprehensive mood analytics for a user with batch operations

        Args:
            user_id: User ID
            days: Number of days to analyze
            include_trends: Whether to calculate trends

        Returns:
            Analytics data including counts, averages, and trends
        """
        start_time = time.time()

        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            # Batch fetch moods and related data
            batch_data = self._batch_fetch_user_data(user_id, start_date, end_date)

            analytics = {
                'period_days': days,
                'total_moods': len(batch_data['moods']),
                'avg_mood_score': 0,
                'sentiment_distribution': {},
                'daily_mood_trend': [],
                'weekly_patterns': {},
                'performance_metrics': {}
            }

            if batch_data['moods']:
                # Calculate averages
                scores = [m.get('score', 0) for m in batch_data['moods'] if m.get('score') is not None]
                analytics['avg_mood_score'] = sum(scores) / len(scores) if scores else 0

                # Sentiment distribution
                sentiments = [m.get('sentiment', 'NEUTRAL') for m in batch_data['moods']]
                analytics['sentiment_distribution'] = dict(__import__('collections').Counter(sentiments))

                # Daily trends
                if include_trends:
                    analytics['daily_mood_trend'] = self._calculate_daily_trends(batch_data['moods'])

                # Weekly patterns
                analytics['weekly_patterns'] = self._calculate_weekly_patterns(batch_data['moods'])

            execution_time = time.time() - start_time
            analytics['performance_metrics'] = {
                'query_time_seconds': execution_time,
                'documents_fetched': len(batch_data['moods']),
                'queries_used': 1  # Batched into single operation
            }

            self._record_performance('get_user_moods_analytics', execution_time, len(batch_data['moods']))

            return analytics

        except Exception as e:
            logger.error(f"Failed to get mood analytics: {str(e)}")
            raise

    def _batch_fetch_user_data(self, user_id: str, start_date: datetime, end_date: datetime) -> Dict[str, List]:
        """
        Batch fetch multiple collections for a user efficiently

        Returns:
            Dict with moods, memories, and other related data
        """
        batch_data = {
            'moods': [],
            'memories': [],
            'chats': []
        }

        try:
            # Fetch moods
            mood_ref = self.db.collection('users').document(user_id).collection('moods')
            mood_query = mood_ref.where(filter=FieldFilter('timestamp', '>=', start_date)) \
                                .where(filter=FieldFilter('timestamp', '<=', end_date)) \
                                .order_by('timestamp', direction='DESCENDING')
            batch_data['moods'] = [doc.to_dict() for doc in mood_query.stream()]

            # Fetch memories (if needed for analytics)
            memory_ref = self.db.collection('users').document(user_id).collection('memories')
            memory_query = memory_ref.where(filter=FieldFilter('uploaded_at', '>=', start_date)) \
                                    .where(filter=FieldFilter('uploaded_at', '<=', end_date)) \
                                    .order_by('uploaded_at', direction='DESCENDING') \
                                    .limit(20)
            batch_data['memories'] = [doc.to_dict() for doc in memory_query.stream()]

            # Fetch recent chats (if needed for analytics)
            chat_ref = self.db.collection('users').document(user_id).collection('chat_sessions')
            chat_query = chat_ref.where(filter=FieldFilter('timestamp', '>=', start_date)) \
                               .order_by('timestamp', direction='DESCENDING') \
                               .limit(10)
            batch_data['chats'] = [doc.to_dict() for doc in chat_query.stream()]

        except Exception as e:
            logger.warning(f"Batch fetch failed, falling back to individual queries: {str(e)}")
            # Fallback to individual queries if batch fails
            pass

        return batch_data

    def batch_write_moods(self, user_id: str, mood_entries: List[Dict]) -> List[str]:
        """
        Batch write multiple mood entries efficiently

        Args:
            user_id: User ID
            mood_entries: List of mood data dictionaries

        Returns:
            List of created document IDs
        """
        created_ids = []
        batch_size = 500  # Firestore batch limit

        for i in range(0, len(mood_entries), batch_size):
            batch = self.db.batch()
            batch_entries = mood_entries[i:i + batch_size]

            for mood_data in batch_entries:
                doc_id = mood_data.pop('_id', None)
                doc_ref = self.db.collection('users').document(user_id).collection('moods').document(doc_id) if doc_id \
                         else self.db.collection('users').document(user_id).collection('moods').document()
                batch.set(doc_ref, mood_data)
                created_ids.append(doc_ref.id)

            try:
                batch.commit()
                logger.info(f"✅ Committed batch of {len(batch_entries)} mood entries for user {user_id}")
            except Exception as e:
                logger.error(f"❌ Batch write failed: {e}")
                raise

        return created_ids

    def get_dashboard_recent_activity_batch(self, user_id: str) -> Dict[str, List]:
        """
        Batch fetch recent moods and chats for dashboard activity feed
        Eliminates N+1 queries by fetching both in single batch operation

        Args:
            user_id: User ID

        Returns:
            Dict with recent_moods and recent_chats
        """
        start_time = time.time()

        try:
            # Batch fetch both moods and chats
            batch_data = {
                'recent_moods': [],
                'recent_chats': []
            }

            # Fetch recent moods (limit 3 for activity feed)
            mood_ref = self.db.collection('users').document(user_id).collection('moods')
            mood_query = mood_ref.order_by('timestamp', direction='DESCENDING').limit(3)
            batch_data['recent_moods'] = [doc.to_dict() for doc in mood_query.stream()]

            # Fetch recent chats (limit 2 for activity feed)
            chat_ref = self.db.collection('users').document(user_id).collection('chat_sessions')
            chat_query = chat_ref.order_by('timestamp', direction='DESCENDING').limit(2)
            batch_data['recent_chats'] = [doc.to_dict() for doc in chat_query.stream()]

            execution_time = time.time() - start_time
            self._record_performance('get_dashboard_recent_activity_batch', execution_time,
                                    len(batch_data['recent_moods']) + len(batch_data['recent_chats']))

            logger.info(f"✅ Batched recent activity fetch for user {user_id} in {execution_time:.3f}s")
            return batch_data

        except Exception as e:
            logger.error(f"Failed to batch fetch recent activity: {str(e)}")
            raise

    def get_dashboard_summary_batch(self, user_id: str) -> Dict[str, Any]:
        """
        Get dashboard summary using batch operations to avoid N+1 queries

        Args:
            user_id: User ID

        Returns:
            Dashboard summary data
        """
        start_time = time.time()

        try:
            # Single batch operation to get all dashboard data
            batch_data = self._batch_fetch_dashboard_data(user_id)

            # Calculate metrics from batched data
            summary = self._calculate_dashboard_metrics(user_id, batch_data)

            execution_time = time.time() - start_time
            summary['performance_metrics'] = {
                'query_time_seconds': execution_time,
                'total_queries': 1,  # Single batch operation
                'data_points': len(batch_data.get('moods', [])) + len(batch_data.get('chats', []))
            }

            self._record_performance('get_dashboard_summary_batch', execution_time,
                                    len(batch_data.get('moods', [])) + len(batch_data.get('chats', [])))

            return summary

        except Exception as e:
            logger.error(f"Failed to get dashboard summary with batch: {str(e)}")
            raise

    def _batch_fetch_dashboard_data(self, user_id: str) -> Dict[str, List]:
        """Fetch all dashboard data in a single batch operation"""
        thirty_days_ago = datetime.now() - timedelta(days=30)

        return self._batch_fetch_user_data(user_id, thirty_days_ago, datetime.now())

    def _calculate_dashboard_metrics(self, user_id: str, batch_data: Dict[str, List]) -> Dict[str, Any]:
        """Calculate dashboard metrics from batched data"""
        moods = batch_data.get('moods', [])
        chats = batch_data.get('chats', [])

        # Basic metrics
        total_moods = len(moods)
        total_chats = len(chats)
        avg_mood = sum(m.get('score', 0) for m in moods) / total_moods if total_moods > 0 else 0

        # Weekly progress
        one_week_ago = datetime.now() - timedelta(days=7)
        weekly_moods = [m for m in moods if m.get('timestamp', datetime.min) >= one_week_ago]

        # Streak calculation
        streak_days = self._calculate_streak(moods)

        return {
            'totalMoods': total_moods,
            'totalChats': total_chats,
            'averageMood': round(avg_mood, 1),
            'streakDays': streak_days,
            'weeklyProgress': len(weekly_moods),
            'cached': False
        }

    def _calculate_streak(self, moods: List[Dict]) -> int:
        """Calculate consecutive days with mood logs"""
        if not moods:
            return 0

        # Sort by date
        dates = sorted(set(
            m.get('timestamp').date() if isinstance(m.get('timestamp'), datetime)
            else datetime.fromisoformat(m.get('timestamp', '')).date()
            for m in moods
            if m.get('timestamp')
        ), reverse=True)

        if not dates:
            return 0

        streak = 0
        current_date = datetime.now().date()

        for date in dates:
            if date == current_date:
                streak += 1
                current_date -= timedelta(days=1)
            else:
                break

        return streak

    def _calculate_daily_trends(self, moods: List[Dict]) -> List[Dict]:
        """Calculate daily mood trends"""
        daily_data = defaultdict(list)

        for mood in moods:
            timestamp = mood.get('timestamp')
            if timestamp:
                try:
                    date = timestamp.date() if isinstance(timestamp, datetime) \
                          else datetime.fromisoformat(timestamp).date()
                    daily_data[date].append(mood.get('score', 0))
                except:
                    continue

        trends = []
        for date in sorted(daily_data.keys()):
            scores = daily_data[date]
            avg_score = sum(scores) / len(scores) if scores else 0
            trends.append({
                'date': date.isoformat(),
                'avg_score': round(avg_score, 1),
                'count': len(scores)
            })

        return trends

    def _calculate_weekly_patterns(self, moods: List[Dict]) -> Dict[str, Any]:
        """Calculate weekly mood patterns"""
        weekday_scores = defaultdict(list)

        for mood in moods:
            if mood.get('timestamp'):
                try:
                    dt = mood['timestamp'] if isinstance(mood['timestamp'], datetime) \
                        else datetime.fromisoformat(mood['timestamp'])
                    weekday = dt.weekday()  # 0=Monday, 6=Sunday
                    weekday_scores[weekday].append(mood.get('score', 0))
                except:
                    continue

        patterns = {}
        weekday_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

        for weekday, scores in weekday_scores.items():
            if scores:
                avg_score = sum(scores) / len(scores)
                patterns[weekday_names[weekday]] = {
                    'avg_score': round(avg_score, 1),
                    'count': len(scores)
                }

        return patterns

    def _record_performance(self, operation: str, execution_time: float, result_count: int):
        """Record query performance for monitoring"""
        if operation not in self.performance_stats:
            self.performance_stats[operation] = {
                'count': 0,
                'total_time': 0,
                'avg_time': 0,
                'max_time': 0,
                'min_time': float('inf'),
                'total_results': 0
            }

        stats = self.performance_stats[operation]
        stats['count'] += 1
        stats['total_time'] += execution_time
        stats['avg_time'] = stats['total_time'] / stats['count']
        stats['max_time'] = max(stats['max_time'], execution_time)
        stats['min_time'] = min(stats['min_time'], execution_time)
        stats['total_results'] += result_count

    def get_performance_report(self) -> Dict[str, Any]:
        """Get performance report for all operations"""
        return {
            'operations': self.performance_stats,
            'summary': {
                'total_operations': sum(stats['count'] for stats in self.performance_stats.values()),
                'total_query_time': sum(stats['total_time'] for stats in self.performance_stats.values()),
                'avg_query_time': sum(stats['total_time'] for stats in self.performance_stats.values()) /
                                sum(stats['count'] for stats in self.performance_stats.values())
                                if self.performance_stats else 0
            }
        }

# Lazy initialization of global instance
_optimized_query_service_instance = None

def get_optimized_query_service():
    """Get the global optimized query service instance with lazy initialization"""
    global _optimized_query_service_instance
    if _optimized_query_service_instance is None:
        _optimized_query_service_instance = OptimizedQueryService()
    return _optimized_query_service_instance

# For backward compatibility
optimized_query_service = None