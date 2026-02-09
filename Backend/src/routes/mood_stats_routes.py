"""
Mood Statistics Routes - Comprehensive mood analytics
Provides statistics, trends, and insights for user mood data
"""

import logging
from datetime import UTC, datetime, timedelta

from flask import Blueprint, g

# Absolute imports (project standard)
from src.firebase_config import db
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

mood_stats_bp = Blueprint('mood_stats', __name__)


# ============================================================================
# OPTIONS Handler (CORS preflight)
# ============================================================================

@mood_stats_bp.route('/statistics', methods=['OPTIONS'])
def mood_stats_options():
    """Handle CORS preflight for statistics endpoint"""
    return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')


# ============================================================================
# Statistics Endpoint
# ============================================================================

@mood_stats_bp.route('/statistics', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_mood_statistics():
    """Get comprehensive mood statistics for the user"""
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.forbidden("User ID missing from context")

        # Check if user exists in Firestore
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return APIResponse.not_found("User not found")
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return APIResponse.error("Service temporarily unavailable", status_code=503)

        # Fetch all mood entries for the user
        try:
            mood_ref = db.collection('users').document(user_id).collection('moods')
            mood_docs = list(mood_ref.order_by('timestamp', direction='DESCENDING').stream())

            if not mood_docs:
                return APIResponse.success({
                    'totalMoods': 0,
                    'averageSentiment': 0,
                    'currentStreak': 0,
                    'longestStreak': 0,
                    'positivePercentage': 0,
                    'negativePercentage': 0,
                    'neutralPercentage': 0,
                    'bestDay': None,
                    'worstDay': None,
                    'recentTrend': 'stable'
                }, "No mood data available")

            # Calculate statistics
            total_moods = len(mood_docs)
            sentiment_scores = []
            positive_count = 0
            negative_count = 0
            neutral_count = 0

            # Track streaks (consecutive days with moods logged)
            dates_logged = set()
            mood_by_date = {}

            for doc in mood_docs:
                mood_data = doc.to_dict()

                # Sentiment analysis
                sentiment = mood_data.get('sentiment', 'NEUTRAL')
                score = mood_data.get('score', 0)
                sentiment_scores.append(score)

                if sentiment == 'POSITIVE':
                    positive_count += 1
                elif sentiment == 'NEGATIVE':
                    negative_count += 1
                else:
                    neutral_count += 1

                # Track dates for streak calculation
                timestamp = mood_data.get('timestamp', '')
                if timestamp:
                    if isinstance(timestamp, str):
                        date_key = timestamp[:10]  # YYYY-MM-DD
                    else:
                        date_key = timestamp.strftime('%Y-%m-%d')
                    dates_logged.add(date_key)

                    # Store mood score by date for best/worst day
                    if date_key not in mood_by_date:
                        mood_by_date[date_key] = []
                    mood_by_date[date_key].append(score)

            # Calculate average sentiment
            average_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0

            # Calculate percentages
            positive_percentage = (positive_count / total_moods * 100) if total_moods > 0 else 0
            negative_percentage = (negative_count / total_moods * 100) if total_moods > 0 else 0
            neutral_percentage = (neutral_count / total_moods * 100) if total_moods > 0 else 0

            # Calculate current and longest streak
            sorted_dates = sorted(dates_logged, reverse=True)
            current_streak = 0
            longest_streak = 0
            temp_streak = 0

            if sorted_dates:
                # Check current streak (from today backwards)
                today = datetime.now(UTC).date()
                current_date = today

                for _ in range(len(sorted_dates)):
                    date_str = current_date.strftime('%Y-%m-%d')
                    if date_str in dates_logged:
                        current_streak += 1
                        current_date -= timedelta(days=1)
                    else:
                        break

                # Calculate longest streak
                for i in range(len(sorted_dates)):
                    current_date_obj = datetime.strptime(sorted_dates[i], '%Y-%m-%d').date()

                    if i == 0:
                        temp_streak = 1
                    else:
                        prev_date_obj = datetime.strptime(sorted_dates[i-1], '%Y-%m-%d').date()
                        days_diff = (prev_date_obj - current_date_obj).days

                        if days_diff == 1:
                            temp_streak += 1
                        else:
                            longest_streak = max(longest_streak, temp_streak)
                            temp_streak = 1

                longest_streak = max(longest_streak, temp_streak)

            # Find best and worst days
            best_day = None
            worst_day = None
            if mood_by_date:
                avg_by_date = {date: sum(scores) / len(scores) for date, scores in mood_by_date.items()}
                best_day = max(avg_by_date, key=lambda x: avg_by_date[x])
                worst_day = min(avg_by_date, key=lambda x: avg_by_date[x])

            # Calculate recent trend (last 7 days vs previous 7 days)
            recent_trend = 'stable'
            if len(sentiment_scores) >= 14:
                recent_avg = sum(sentiment_scores[:7]) / 7
                previous_avg = sum(sentiment_scores[7:14]) / 7

                if recent_avg > previous_avg + 0.1:
                    recent_trend = 'improving'
                elif recent_avg < previous_avg - 0.1:
                    recent_trend = 'declining'

            logger.info(f"📊 Mood statistics calculated for user {user_id}: {total_moods} moods, avg {average_sentiment:.2f}")

            return APIResponse.success({
                'totalMoods': total_moods,
                'averageSentiment': round(average_sentiment, 2),
                'currentStreak': current_streak,
                'longestStreak': longest_streak,
                'positivePercentage': round(positive_percentage, 1),
                'negativePercentage': round(negative_percentage, 1),
                'neutralPercentage': round(neutral_percentage, 1),
                'bestDay': best_day,
                'worstDay': worst_day,
                'recentTrend': recent_trend
            }, f"Statistics calculated for {total_moods} mood logs")

        except Exception as db_error:
            logger.error(f"Failed to calculate mood statistics: {str(db_error)}", exc_info=True)
            return APIResponse.error("Failed to calculate statistics")

    except Exception as e:
        logger.error(f"Failed to get mood statistics: {str(e)}", exc_info=True)
        return APIResponse.error("Failed to fetch statistics")
