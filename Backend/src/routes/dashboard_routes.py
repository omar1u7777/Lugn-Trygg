"""
Dashboard Routes - Optimized Endpoints for Dashboard Data
Provides batched, cached data for frontend Dashboard component
"""

from flask import Blueprint, jsonify, request
from functools import wraps
from datetime import datetime, timedelta
import time
from firebase_admin import firestore

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

# Simple in-memory cache (production: use Redis)
_cache = {}
CACHE_TTL = 300  # 5 minutes


def cached(ttl=CACHE_TTL):
    """Cache decorator for dashboard endpoints"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Generate cache key from function name and args
            cache_key = f"{f.__name__}:{request.view_args.get('user_id', 'anonymous')}"
            
            # Check cache
            if cache_key in _cache:
                data, timestamp = _cache[cache_key]
                if time.time() - timestamp < ttl:
                    print(f"✅ Cache hit for {cache_key}")
                    return jsonify({**data, "cached": True}), 200
            
            # Call function and cache result
            result = f(*args, **kwargs)
            if isinstance(result, tuple):
                response_data, status_code = result
                if status_code == 200 and hasattr(response_data, 'get_json'):
                    _cache[cache_key] = (response_data.get_json(), time.time())
            
            return result
        return wrapper
    return decorator


@dashboard_bp.route('/<user_id>/summary', methods=['GET'])
@cached(ttl=300)  # 5 minutes
def get_dashboard_summary(user_id: str):
    """
    Batched dashboard summary endpoint - returns all data in one call
    Reduces frontend API calls from 3+ to 1
    """
    try:
        start_time = time.time()
        db = firestore.client()
        
        # Get user data
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({"error": "User not found"}), 404
        
        user_data = user_doc.to_dict()
        
        # Get mood data (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        moods_ref = db.collection("moods").where("userId", "==", user_id)
        moods_query = moods_ref.where("timestamp", ">=", thirty_days_ago).order_by("timestamp", direction=firestore.Query.DESCENDING).limit(100)
        moods = [doc.to_dict() for doc in moods_query.stream()]
        
        # Get chat history (last 10 sessions)
        chats_ref = db.collection("chat_sessions").where("userId", "==", user_id)
        chats = [doc.to_dict() for doc in chats_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(10).stream()]
        
        # Calculate statistics
        total_moods = len(moods)
        average_mood = sum(mood.get("score", 0) for mood in moods) / total_moods if total_moods > 0 else 0
        
        # Calculate weekly stats
        one_week_ago = datetime.utcnow() - timedelta(days=7)
        weekly_moods = [m for m in moods if m.get("timestamp", datetime.min) >= one_week_ago]
        weekly_progress = len(weekly_moods)
        weekly_goal = user_data.get("weekly_goal", 7)
        
        # Calculate streak
        streak_days = calculate_streak(moods)
        
        # Recent activity (last 5 items)
        recent_activity = []
        for mood in moods[:3]:
            recent_activity.append({
                "id": f"mood-{mood.get('id', '')}",
                "type": "mood",
                "timestamp": mood.get("timestamp").isoformat() if mood.get("timestamp") else None,
                "description": f"Logged mood: {mood.get('mood', 'Unknown')} ({mood.get('score', 0)}/10)"
            })
        
        for chat in chats[:2]:
            recent_activity.append({
                "id": f"chat-{chat.get('id', '')}",
                "type": "chat",
                "timestamp": chat.get("timestamp").isoformat() if chat.get("timestamp") else None,
                "description": "Chat session with AI therapist"
            })
        
        # Sort by timestamp and take top 5
        recent_activity.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        recent_activity = recent_activity[:5]
        
        response_time = (time.time() - start_time) * 1000
        
        return jsonify({
            "totalMoods": total_moods,
            "totalChats": len(chats),
            "averageMood": round(average_mood, 1),
            "streakDays": streak_days,
            "weeklyGoal": weekly_goal,
            "weeklyProgress": weekly_progress,
            "recentActivity": recent_activity,
            "cached": False,
            "responseTime": round(response_time, 2)
        }), 200
        
    except Exception as e:
        print(f"❌ Dashboard summary error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@dashboard_bp.route('/<user_id>/quick-stats', methods=['GET'])
@cached(ttl=60)  # 1 minute for real-time stats
def get_quick_stats(user_id: str):
    """
    Ultra-fast endpoint for real-time dashboard stats
    Only fetches essential counts
    """
    try:
        db = firestore.client()
        
        # Get counts efficiently
        moods_count_query = db.collection("moods").where("userId", "==", user_id).count()
        chats_count_query = db.collection("chat_sessions").where("userId", "==", user_id).count()
        
        moods_count = moods_count_query.get()
        chats_count = chats_count_query.get()
        
        return jsonify({
            "totalMoods": moods_count[0][0].value if moods_count else 0,
            "totalChats": chats_count[0][0].value if chats_count else 0,
            "cached": False
        }), 200
        
    except Exception as e:
        print(f"❌ Quick stats error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@dashboard_bp.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Clear dashboard cache (admin/development use)"""
    global _cache
    _cache = {}
    return jsonify({"message": "Cache cleared", "timestamp": datetime.utcnow().isoformat()}), 200


def calculate_streak(moods: list) -> int:
    """Calculate consecutive days with mood logs"""
    if not moods:
        return 0
    
    # Sort moods by date - filter out None values
    dates_set = {
        mood.get("timestamp").date()
        for mood in moods
        if mood.get("timestamp") is not None
    }
    dates = sorted(dates_set, reverse=True)
    
    if not dates:
        return 0
    
    # Count consecutive days from today
    streak = 0
    current_date = datetime.utcnow().date()
    
    for date in dates:
        if date == current_date:
            streak += 1
            current_date -= timedelta(days=1)
        else:
            break
    
    return streak
