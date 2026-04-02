"""
Mood Statistics Routes - Comprehensive mood analytics
Provides statistics, trends, and insights for user mood data
"""

import logging
from datetime import UTC, datetime, timedelta

from flask import Blueprint, g, request

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
                score = mood_data.get('score') or 5  # Default to 5 (neutral) if missing/zero
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
            # Threshold of 0.5 on 1-10 scale = meaningful change (5%)
            recent_trend = 'stable'
            if len(sentiment_scores) >= 4:
                half = max(len(sentiment_scores) // 2, 1)
                recent_avg = sum(sentiment_scores[:half]) / half
                previous_avg = sum(sentiment_scores[half:half * 2]) / half if len(sentiment_scores) >= half * 2 else recent_avg

                if recent_avg > previous_avg + 0.5:
                    recent_trend = 'improving'
                elif recent_avg < previous_avg - 0.5:
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


# ============================================================================
# Daily Analytics Endpoint
# ============================================================================

@mood_stats_bp.route('/daily', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_daily_analytics():
    """
    Get detailed daily mood analytics for the last N days.
    Returns per-day averages, hour-of-day distribution, tag frequency,
    and day-of-week patterns.

    Query params:
        days: Number of days to analyze (7-90, default 30)
    """
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.forbidden('User ID missing from context')

        try:
            days = max(7, min(90, int(request.args.get('days', 30))))
        except (ValueError, TypeError):
            return APIResponse.bad_request('Invalid days parameter — must be an integer between 7 and 90')
        cutoff = datetime.now(UTC) - timedelta(days=days)
        cutoff_iso = cutoff.isoformat()

        mood_ref = db.collection('users').document(user_id).collection('moods')
        try:
            mood_docs = list(
                mood_ref.where('timestamp', '>=', cutoff_iso)
                .order_by('timestamp', direction='DESCENDING')
                .limit(500)
                .stream()
            )
        except Exception:
            mood_docs = list(mood_ref.order_by('timestamp', direction='DESCENDING').limit(500).stream())
            mood_docs = [d for d in mood_docs if (d.to_dict() or {}).get('timestamp', '') >= cutoff_iso]

        if not mood_docs:
            return APIResponse.success({
                'days': days,
                'totalEntries': 0,
                'dailyAverages': [],
                'hourlyDistribution': [None] * 24,
                'dayOfWeekAverages': [None] * 7,
                'tagFrequency': [],
                'intensityDistribution': {'low': 0, 'medium': 0, 'high': 0},
            }, 'No mood data in the selected period')

        # Aggregate data
        from collections import defaultdict
        daily: dict = defaultdict(list)
        hourly: dict = defaultdict(list)
        dow: dict = defaultdict(list)  # day of week (0=Monday)
        tag_counts: dict = defaultdict(int)
        intensity_dist = {'low': 0, 'medium': 0, 'high': 0}

        for doc in mood_docs:
            data = doc.to_dict() or {}
            score = data.get('score') or 5
            ts_raw = data.get('timestamp', '')
            tags = data.get('tags') or []

            # Parse timestamp
            try:
                if isinstance(ts_raw, str):
                    ts = datetime.fromisoformat(ts_raw.replace('Z', '+00:00'))
                elif hasattr(ts_raw, 'isoformat'):
                    ts = ts_raw
                else:
                    ts = datetime.now(UTC)
            except Exception:
                ts = datetime.now(UTC)

            date_key = ts.strftime('%Y-%m-%d')
            daily[date_key].append(score)
            hourly[ts.hour].append(score)
            dow[ts.weekday()].append(score)

            for tag in (tags if isinstance(tags, list) else []):
                if tag:
                    tag_counts[str(tag)] += 1

            # Intensity based on score
            if score <= 3:
                intensity_dist['low'] += 1
            elif score <= 6:
                intensity_dist['medium'] += 1
            else:
                intensity_dist['high'] += 1

        # Build per-day series (fill missing days with None)
        daily_averages = []
        for i in range(days - 1, -1, -1):
            day = (datetime.now(UTC) - timedelta(days=i)).strftime('%Y-%m-%d')
            scores = daily.get(day)
            daily_averages.append({
                'date': day,
                'average': round(sum(scores) / len(scores), 2) if scores else None,
                'count': len(scores) if scores else 0,
            })

        # Per-hour averages (0-23)
        hourly_distribution = []
        for h in range(24):
            scores = hourly.get(h)
            hourly_distribution.append(round(sum(scores) / len(scores), 2) if scores else None)

        # Day-of-week averages (0=Monday … 6=Sunday)
        DOW_LABELS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']
        dow_averages = []
        for d in range(7):
            scores = dow.get(d)
            dow_averages.append({
                'day': DOW_LABELS[d],
                'average': round(sum(scores) / len(scores), 2) if scores else None,
                'count': len(scores) if scores else 0,
            })

        # Top tags by frequency
        top_tags = sorted(
            [{'tag': t, 'count': c} for t, c in tag_counts.items()],
            key=lambda x: x['count'],
            reverse=True
        )[:20]

        total_entries = sum(len(v) for v in daily.values())

        return APIResponse.success({
            'days': days,
            'totalEntries': total_entries,
            'dailyAverages': daily_averages,
            'hourlyDistribution': hourly_distribution,
            'dayOfWeekAverages': dow_averages,
            'tagFrequency': top_tags,
            'intensityDistribution': intensity_dist,
        }, f'Daily analytics for {days} days')

    except Exception as e:
        logger.error(f'Failed to get daily analytics: {e}', exc_info=True)
        return APIResponse.error('Failed to fetch daily analytics')


# ============================================================================
# Monthly Analytics Endpoint
# ============================================================================

@mood_stats_bp.route('/monthly', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_monthly_analytics():
    """
    Get monthly mood analytics for the last N months.
    Returns per-month averages and month-over-month comparison.

    Query params:
        months: Number of months to analyze (1-12, default 6)
    """
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.forbidden('User ID missing from context')

        try:
            months = max(1, min(12, int(request.args.get('months', 6))))
        except (ValueError, TypeError):
            return APIResponse.bad_request('Invalid months parameter — must be an integer between 1 and 12')
        # Go back 'months' calendar months from the start of this month
        now = datetime.now(UTC)
        cutoff = (now.replace(day=1) - timedelta(days=1)).replace(
            day=1
        ) - timedelta(days=28 * (months - 1))
        cutoff = cutoff.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        cutoff_iso = cutoff.isoformat()

        mood_ref = db.collection('users').document(user_id).collection('moods')
        try:
            mood_docs = list(
                mood_ref.where('timestamp', '>=', cutoff_iso)
                .order_by('timestamp', direction='DESCENDING')
                .limit(1000)
                .stream()
            )
        except Exception:
            mood_docs = list(mood_ref.order_by('timestamp', direction='DESCENDING').limit(1000).stream())
            mood_docs = [d for d in mood_docs if (d.to_dict() or {}).get('timestamp', '') >= cutoff_iso]

        if not mood_docs:
            return APIResponse.success({
                'months': months,
                'totalEntries': 0,
                'monthlyData': [],
                'overallTrend': 'stable',
            }, 'No mood data in the selected period')

        from collections import defaultdict
        monthly: dict = defaultdict(list)

        MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

        for doc in mood_docs:
            data = doc.to_dict() or {}
            score = data.get('score') or 5
            ts_raw = data.get('timestamp', '')
            try:
                if isinstance(ts_raw, str):
                    ts = datetime.fromisoformat(ts_raw.replace('Z', '+00:00'))
                elif hasattr(ts_raw, 'isoformat'):
                    ts = ts_raw
                else:
                    ts = datetime.now(UTC)
            except Exception:
                ts = datetime.now(UTC)

            month_key = ts.strftime('%Y-%m')
            monthly[month_key].append(score)

        # Build ordered monthly series
        monthly_data = []
        for i in range(months - 1, -1, -1):
            # Calculate month offset
            target = now.month - i
            target_year = now.year + (target - 1) // 12
            target_month = ((target - 1) % 12) + 1
            key = f'{target_year:04d}-{target_month:02d}'
            scores = monthly.get(key)
            monthly_data.append({
                'month': key,
                'label': f"{MONTH_LABELS[target_month - 1]} {target_year}",
                'average': round(sum(scores) / len(scores), 2) if scores else None,
                'count': len(scores) if scores else 0,
            })

        # Overall trend: compare first half vs second half
        filled = [m for m in monthly_data if m['average'] is not None]
        overall_trend = 'stable'
        if len(filled) >= 2:
            mid = len(filled) // 2
            first_avg = sum(m['average'] for m in filled[:mid]) / mid
            last_avg = sum(m['average'] for m in filled[mid:]) / (len(filled) - mid)
            if last_avg > first_avg + 0.5:
                overall_trend = 'improving'
            elif last_avg < first_avg - 0.5:
                overall_trend = 'declining'

        total_entries = sum(len(v) for v in monthly.values())

        return APIResponse.success({
            'months': months,
            'totalEntries': total_entries,
            'monthlyData': monthly_data,
            'overallTrend': overall_trend,
        }, f'Monthly analytics for {months} months')

    except Exception as e:
        logger.error(f'Failed to get monthly analytics: {e}', exc_info=True)
        return APIResponse.error('Failed to fetch monthly analytics')

