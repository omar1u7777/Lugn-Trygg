"""
Rewards Routes - User Rewards and Achievements API
Real implementation for gamification rewards system
"""

from flask import Blueprint, request, g
from datetime import datetime, timedelta, timezone
import uuid
import re
from typing import Optional
from ..services.rate_limiting import rate_limit_by_endpoint
from ..services.auth_service import AuthService
from ..services.audit_service import audit_log
from ..utils.input_sanitization import sanitize_text
from ..utils.response_utils import APIResponse

# Validation pattern for user IDs
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,128}$')

rewards_bp = Blueprint("rewards", __name__)

# Reward definitions
REWARD_CATALOG = {
    'premium_week': {
        'id': 'premium_week',
        'title': '1 Week Premium',
        'description': 'Unlock all premium features for 7 days',
        'cost': 500,
        'type': 'premium_time',
        'value': 7,  # days
        'icon': '⭐',
        'available': True
    },
    'premium_month': {
        'id': 'premium_month',
        'title': '1 Month Premium',
        'description': 'Unlock all premium features for 30 days',
        'cost': 1500,
        'type': 'premium_time',
        'value': 30,
        'icon': '👑',
        'available': True
    },
    'custom_theme': {
        'id': 'custom_theme',
        'title': 'Custom Theme',
        'description': 'Unlock exclusive color themes for the app',
        'cost': 300,
        'type': 'cosmetic',
        'value': 'theme_unlock',
        'icon': '🎨',
        'available': True
    },
    'badge_collector': {
        'id': 'badge_collector',
        'title': 'Badge Collector',
        'description': 'Exclusive badge for dedicated users',
        'cost': 200,
        'type': 'badge',
        'value': 'badge_collector',
        'icon': '🏅',
        'available': True
    },
    'early_adopter': {
        'id': 'early_adopter',
        'title': 'Early Adopter',
        'description': 'Special badge for early users',
        'cost': 0,
        'type': 'badge',
        'value': 'early_adopter',
        'icon': '🚀',
        'available': False  # Earned, not purchased
    },
    'mood_master': {
        'id': 'mood_master',
        'title': 'Mood Master',
        'description': 'Log mood 30 days in a row',
        'cost': 0,
        'type': 'badge',
        'value': 'mood_master',
        'icon': '😊',
        'available': False  # Earned through achievement
    },
    'meditation_guru': {
        'id': 'meditation_guru',
        'title': 'Meditation Guru',
        'description': 'Complete 50 meditations',
        'cost': 0,
        'type': 'badge',
        'value': 'meditation_guru',
        'icon': '🧘',
        'available': False  # Earned through achievement
    }
}

# Achievement definitions for automatic rewards
ACHIEVEMENTS = {
    'first_mood': {
        'id': 'first_mood',
        'title': 'First Step',
        'description': 'Log your first mood',
        'xp_reward': 50,
        'badge': 'first_step',
        'condition': {'type': 'mood_count', 'value': 1}
    },
    'week_streak': {
        'id': 'week_streak',
        'title': 'Week of Wellness',
        'description': 'Log mood 7 days in a row',
        'xp_reward': 200,
        'badge': 'week_warrior',
        'condition': {'type': 'streak', 'value': 7}
    },
    'month_streak': {
        'id': 'month_streak',
        'title': 'Month of Mindfulness',
        'description': 'Log mood 30 days in a row',
        'xp_reward': 1000,
        'badge': 'mood_master',
        'condition': {'type': 'streak', 'value': 30}
    },
    'mood_warrior': {
        'id': 'mood_warrior',
        'title': 'Mood Warrior',
        'description': 'Log 100 mood entries',
        'xp_reward': 500,
        'badge': 'mood_warrior',
        'condition': {'type': 'mood_count', 'value': 100}
    },
    'journal_starter': {
        'id': 'journal_starter',
        'title': 'Journal Starter',
        'description': 'Write your first journal entry',
        'xp_reward': 50,
        'badge': 'journal_starter',
        'condition': {'type': 'journal_count', 'value': 1}
    },
    'referral_hero': {
        'id': 'referral_hero',
        'title': 'Referral Hero',
        'description': 'Invite 5 friends',
        'xp_reward': 500,
        'badge': 'referral_hero',
        'condition': {'type': 'referral_count', 'value': 5}
    }
}


def _get_db():
    """Get Firestore database reference"""
    try:
        from ..firebase_config import db
        return db
    except Exception:
        return None


def _get_user_rewards(user_id: str):
    """Get user's rewards data"""
    db = _get_db()
    
    default_data = {
        'user_id': user_id,
        'xp': 0,
        'level': 1,
        'badges': [],
        'claimed_rewards': [],
        'achievements': [],
        'premium_until': None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    if db:
        doc = db.collection('user_rewards').document(user_id).get()
        if doc.exists:
            return doc.to_dict()
        else:
            # Create new rewards profile
            db.collection('user_rewards').document(user_id).set(default_data)
            return default_data
    
    return default_data


def _calculate_level(xp: int) -> int:
    """Calculate level based on XP"""
    # Level formula: level = sqrt(xp / 100) + 1
    import math
    return int(math.sqrt(xp / 100)) + 1


def _xp_for_next_level(current_level: int) -> int:
    """Calculate XP needed for next level"""
    return (current_level ** 2) * 100


# CORS OPTIONS handler for all endpoints
@rewards_bp.route('/catalog', methods=['OPTIONS'])
@rewards_bp.route('/achievements', methods=['OPTIONS'])
@rewards_bp.route('/profile', methods=['OPTIONS'])
@rewards_bp.route('/add-xp', methods=['OPTIONS'])
@rewards_bp.route('/claim', methods=['OPTIONS'])
@rewards_bp.route('/check-achievements', methods=['OPTIONS'])
@rewards_bp.route('/badges', methods=['OPTIONS'])
def handle_options():
    """Handle CORS preflight requests"""
    return APIResponse.success()


@rewards_bp.route('/catalog', methods=['GET'])
@rate_limit_by_endpoint
def get_reward_catalog():
    """Get all available rewards"""
    try:
        # Filter to only purchasable rewards
        purchasable = {k: v for k, v in REWARD_CATALOG.items() if v.get('available', True) and v.get('cost', 0) > 0}
        
        return APIResponse.success({
            "rewards": list(purchasable.values())
        }, "Reward catalog retrieved")
    except Exception as e:
        return APIResponse.error(str(e), "CATALOG_ERROR", 500)


@rewards_bp.route('/achievements', methods=['GET'])
@rate_limit_by_endpoint
def get_achievements():
    """Get all achievements"""
    try:
        return APIResponse.success({
            "achievements": list(ACHIEVEMENTS.values())
        }, "Achievements retrieved")
    except Exception as e:
        return APIResponse.error(str(e), "ACHIEVEMENTS_ERROR", 500)


@rewards_bp.route('/profile', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_rewards():
    """Get user's rewards profile"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")
    
    try:
        rewards_data = _get_user_rewards(user_id)
        
        # Calculate level info
        xp = rewards_data.get('xp', 0)
        level = _calculate_level(xp)
        next_level_xp = _xp_for_next_level(level)
        current_level_xp = _xp_for_next_level(level - 1) if level > 1 else 0
        progress_xp = xp - current_level_xp
        needed_xp = next_level_xp - current_level_xp
        
        return APIResponse.success({
            "rewards": {
                "userId": user_id,
                "xp": xp,
                "level": level,
                "nextLevelXp": next_level_xp,
                "progressXp": progress_xp,
                "neededXp": needed_xp,
                "progressPercent": (progress_xp / needed_xp * 100) if needed_xp > 0 else 100,
                "badges": rewards_data.get('badges', []),
                "achievements": rewards_data.get('achievements', []),
                "claimedRewards": rewards_data.get('claimed_rewards', []),
                "premiumUntil": rewards_data.get('premium_until')
            }
        }, "User rewards retrieved")
    except Exception as e:
        return APIResponse.error(str(e), "REWARDS_ERROR", 500)


@rewards_bp.route('/add-xp', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def add_user_xp():
    """Add XP to user (called by other actions like logging mood)"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    try:
        data = request.get_json() or {}
        xp_amount = data.get('amount', 0)
        reason = sanitize_text(data.get('reason', 'general'), max_length=100)
        
        if xp_amount <= 0:
            return APIResponse.bad_request("XP amount must be positive")
        
        db = _get_db()
        rewards_data = _get_user_rewards(user_id)
        
        old_xp = rewards_data.get('xp', 0)
        old_level = _calculate_level(old_xp)
        
        new_xp = old_xp + xp_amount
        new_level = _calculate_level(new_xp)
        
        level_up = new_level > old_level
        
        if db:
            db.collection('user_rewards').document(user_id).update({  # type: ignore
                'xp': new_xp,
                'level': new_level,
                'last_xp_earned': datetime.now(timezone.utc).isoformat(),
                'last_xp_reason': reason
            })
        
        audit_log("XP_ADDED", user_id, {"amount": xp_amount, "reason": reason, "levelUp": level_up})
        
        return APIResponse.success({
            "xpAdded": xp_amount,
            "newXp": new_xp,
            "newLevel": new_level,
            "levelUp": level_up,
            "reason": reason
        }, "XP added successfully")
        
    except Exception as e:
        return APIResponse.error(str(e), "XP_ERROR", 500)


@rewards_bp.route('/claim', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def claim_reward():
    """Claim a reward from the catalog"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    try:
        data = request.get_json() or {}
        reward_id = sanitize_text(data.get('reward_id', ''), max_length=50)
        
        if not reward_id:
            return APIResponse.bad_request("reward_id is required")
        
        if reward_id not in REWARD_CATALOG:
            return APIResponse.not_found("Reward not found")
        
        reward = REWARD_CATALOG[reward_id]
        
        if not reward.get('available', True):
            return APIResponse.bad_request("This reward cannot be purchased")
        
        db = _get_db()
        rewards_data = _get_user_rewards(user_id)
        
        # Check if user has enough XP
        user_xp = rewards_data.get('xp', 0)
        cost = reward.get('cost', 0)
        
        if user_xp < cost:
            return APIResponse.error(
                f"Not enough XP. Need {cost}, have {user_xp}",
                "INSUFFICIENT_XP",
                400,
                {"needed": cost, "have": user_xp}
            )
        
        # Check if already claimed (for one-time rewards)
        claimed = rewards_data.get('claimed_rewards', [])
        if reward_id in claimed and reward.get('type') != 'premium_time':
            return APIResponse.bad_request("Already claimed this reward")
        
        # Deduct XP and add reward
        new_xp = user_xp - cost
        claimed.append(reward_id)
        
        update_data = {
            'xp': new_xp,
            'claimed_rewards': claimed,
            'last_claim': datetime.now(timezone.utc).isoformat()
        }
        
        # Handle premium time rewards
        if reward.get('type') == 'premium_time':
            current_premium = rewards_data.get('premium_until')
            if current_premium:
                # Extend existing premium
                premium_date = datetime.fromisoformat(current_premium)
                if premium_date.tzinfo is None:
                    premium_date = premium_date.replace(tzinfo=timezone.utc)
                if premium_date < datetime.now(timezone.utc):
                    premium_date = datetime.now(timezone.utc)
                new_premium = premium_date + timedelta(days=reward.get('value', 7))
            else:
                new_premium = datetime.now(timezone.utc) + timedelta(days=reward.get('value', 7))
            
            update_data['premium_until'] = new_premium.isoformat()
        
        # Handle badge rewards
        if reward.get('type') == 'badge':
            badges = rewards_data.get('badges', [])
            if reward.get('value') not in badges:
                badges.append(reward.get('value'))
                update_data['badges'] = badges
        
        if db:
            db.collection('user_rewards').document(user_id).update(update_data)  # type: ignore
        
        audit_log("REWARD_CLAIMED", user_id, {"rewardId": reward_id, "cost": cost})
        
        return APIResponse.success({
            "message": f"Successfully claimed {reward['title']}",
            "reward": reward,
            "newXp": new_xp,
            "premiumUntil": update_data.get('premium_until')
        }, "Reward claimed successfully")
        
    except Exception as e:
        return APIResponse.error(str(e), "CLAIM_ERROR", 500)


@rewards_bp.route('/check-achievements', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def check_achievements():
    """Check and award any earned achievements"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    try:
        data = request.get_json() or {}
        
        # Stats to check against
        mood_count = data.get('mood_count', 0)
        streak = data.get('streak', 0)
        journal_count = data.get('journal_count', 0)
        referral_count = data.get('referral_count', 0)
        meditation_count = data.get('meditation_count', 0)
        
        db = _get_db()
        rewards_data = _get_user_rewards(user_id)
        earned_achievements = rewards_data.get('achievements', [])
        badges = rewards_data.get('badges', [])
        xp = rewards_data.get('xp', 0)
        
        new_achievements = []
        total_xp_earned = 0
        
        for achievement_id, achievement in ACHIEVEMENTS.items():
            if achievement_id in earned_achievements:
                continue  # Already earned
            
            condition = achievement.get('condition', {})
            earned = False
            
            if condition.get('type') == 'mood_count' and mood_count >= condition.get('value', 0):
                earned = True
            elif condition.get('type') == 'streak' and streak >= condition.get('value', 0):
                earned = True
            elif condition.get('type') == 'journal_count' and journal_count >= condition.get('value', 0):
                earned = True
            elif condition.get('type') == 'referral_count' and referral_count >= condition.get('value', 0):
                earned = True
            elif condition.get('type') == 'meditation_count' and meditation_count >= condition.get('value', 0):
                earned = True
            
            if earned:
                new_achievements.append(achievement_id)
                earned_achievements.append(achievement_id)
                total_xp_earned += achievement.get('xp_reward', 0)
                
                badge = achievement.get('badge')
                if badge and badge not in badges:
                    badges.append(badge)
        
        if new_achievements and db:
            db.collection('user_rewards').document(user_id).update({  # type: ignore
                'achievements': earned_achievements,
                'badges': badges,
                'xp': xp + total_xp_earned,
                'last_achievement': datetime.now(timezone.utc).isoformat()
            })
            
            audit_log("ACHIEVEMENTS_EARNED", user_id, {
                "achievements": new_achievements,
                "xpEarned": total_xp_earned
            })
        
        return APIResponse.success({
            "newAchievements": [ACHIEVEMENTS[a] for a in new_achievements],
            "totalXpEarned": total_xp_earned,
            "allAchievements": earned_achievements,
            "badges": badges
        }, "Achievements checked")
        
    except Exception as e:
        return APIResponse.error(str(e), "ACHIEVEMENTS_ERROR", 500)


@rewards_bp.route('/badges', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_badges():
    """Get all badges for a user"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    try:
        rewards_data = _get_user_rewards(user_id)
        user_badges = rewards_data.get('badges', [])
        
        # Get badge details
        badge_details = []
        for badge_id in user_badges:
            # Find badge in rewards or achievements
            for reward_id, reward in REWARD_CATALOG.items():
                if reward.get('value') == badge_id:
                    badge_details.append({
                        "id": badge_id,
                        "title": reward.get('title'),
                        "icon": reward.get('icon'),
                        "description": reward.get('description')
                    })
                    break
            else:
                for ach_id, ach in ACHIEVEMENTS.items():
                    if ach.get('badge') == badge_id:
                        badge_details.append({
                            "id": badge_id,
                            "title": ach.get('title'),
                            "icon": "🏆",
                            "description": ach.get('description')
                        })
                        break
        
        return APIResponse.success({
            "badges": badge_details
        }, "User badges retrieved")
        
    except Exception as e:
        return APIResponse.error(str(e), "BADGES_ERROR", 500)
