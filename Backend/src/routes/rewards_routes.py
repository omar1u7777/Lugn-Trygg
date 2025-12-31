"""
Rewards Routes - User Rewards and Achievements API
Real implementation for gamification rewards system
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, timezone
import uuid

rewards_bp = Blueprint("rewards", __name__, url_prefix="/api/rewards")

# Reward definitions
REWARD_CATALOG = {
    'premium_week': {
        'id': 'premium_week',
        'title': '1 Vecka Premium',
        'description': 'Lås upp alla premium-funktioner i 7 dagar',
        'cost': 500,
        'type': 'premium_time',
        'value': 7,  # days
        'icon': '⭐',
        'available': True
    },
    'premium_month': {
        'id': 'premium_month',
        'title': '1 Månad Premium',
        'description': 'Lås upp alla premium-funktioner i 30 dagar',
        'cost': 1500,
        'type': 'premium_time',
        'value': 30,
        'icon': '👑',
        'available': True
    },
    'custom_theme': {
        'id': 'custom_theme',
        'title': 'Anpassat Tema',
        'description': 'Lås upp exklusiva färgteman för appen',
        'cost': 300,
        'type': 'cosmetic',
        'value': 'theme_unlock',
        'icon': '🎨',
        'available': True
    },
    'badge_collector': {
        'id': 'badge_collector',
        'title': 'Badge Samlare',
        'description': 'Exklusiv badge för dedikerade användare',
        'cost': 200,
        'type': 'badge',
        'value': 'badge_collector',
        'icon': '🏅',
        'available': True
    },
    'early_adopter': {
        'id': 'early_adopter',
        'title': 'Early Adopter',
        'description': 'Specialbadge för tidiga användare',
        'cost': 0,
        'type': 'badge',
        'value': 'early_adopter',
        'icon': '🚀',
        'available': False  # Earned, not purchased
    },
    'mood_master': {
        'id': 'mood_master',
        'title': 'Humör Mästare',
        'description': 'Logga humör 30 dagar i rad',
        'cost': 0,
        'type': 'badge',
        'value': 'mood_master',
        'icon': '😊',
        'available': False  # Earned through achievement
    },
    'meditation_guru': {
        'id': 'meditation_guru',
        'title': 'Meditation Guru',
        'description': 'Genomför 50 meditationer',
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
        'title': 'Första Steget',
        'description': 'Logga ditt första humör',
        'xp_reward': 50,
        'badge': 'first_step',
        'condition': {'type': 'mood_count', 'value': 1}
    },
    'week_streak': {
        'id': 'week_streak',
        'title': 'Vecka av Välmående',
        'description': 'Logga humör 7 dagar i rad',
        'xp_reward': 200,
        'badge': 'week_warrior',
        'condition': {'type': 'streak', 'value': 7}
    },
    'month_streak': {
        'id': 'month_streak',
        'title': 'Månad av Mindfulness',
        'description': 'Logga humör 30 dagar i rad',
        'xp_reward': 1000,
        'badge': 'mood_master',
        'condition': {'type': 'streak', 'value': 30}
    },
    'mood_warrior': {
        'id': 'mood_warrior',
        'title': 'Humör Krigare',
        'description': 'Logga 100 humör-poster',
        'xp_reward': 500,
        'badge': 'mood_warrior',
        'condition': {'type': 'mood_count', 'value': 100}
    },
    'journal_starter': {
        'id': 'journal_starter',
        'title': 'Dagboks Startare',
        'description': 'Skriv din första dagboks-post',
        'xp_reward': 50,
        'badge': 'journal_starter',
        'condition': {'type': 'journal_count', 'value': 1}
    },
    'referral_hero': {
        'id': 'referral_hero',
        'title': 'Referral Hjälte',
        'description': 'Bjud in 5 vänner',
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


@rewards_bp.route('/catalog', methods=['GET'])
def get_reward_catalog():
    """Get all available rewards"""
    try:
        # Filter to only purchasable rewards
        purchasable = {k: v for k, v in REWARD_CATALOG.items() if v.get('available', True) and v.get('cost', 0) > 0}
        
        return jsonify({
            'success': True,
            'rewards': list(purchasable.values())
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@rewards_bp.route('/achievements', methods=['GET'])
def get_achievements():
    """Get all achievements"""
    try:
        return jsonify({
            'success': True,
            'achievements': list(ACHIEVEMENTS.values())
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@rewards_bp.route('/user/<user_id>', methods=['GET'])
def get_user_rewards(user_id: str):
    """Get user's rewards profile"""
    try:
        rewards_data = _get_user_rewards(user_id)
        
        # Calculate level info
        xp = rewards_data.get('xp', 0)
        level = _calculate_level(xp)
        next_level_xp = _xp_for_next_level(level)
        current_level_xp = _xp_for_next_level(level - 1) if level > 1 else 0
        progress_xp = xp - current_level_xp
        needed_xp = next_level_xp - current_level_xp
        
        return jsonify({
            'success': True,
            'rewards': {
                'user_id': user_id,
                'xp': xp,
                'level': level,
                'next_level_xp': next_level_xp,
                'progress_xp': progress_xp,
                'needed_xp': needed_xp,
                'progress_percent': (progress_xp / needed_xp * 100) if needed_xp > 0 else 100,
                'badges': rewards_data.get('badges', []),
                'achievements': rewards_data.get('achievements', []),
                'claimed_rewards': rewards_data.get('claimed_rewards', []),
                'premium_until': rewards_data.get('premium_until')
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@rewards_bp.route('/user/<user_id>/add-xp', methods=['POST'])
def add_user_xp(user_id: str):
    """Add XP to user (called by other actions like logging mood)"""
    try:
        data = request.get_json() or {}
        xp_amount = data.get('amount', 0)
        reason = data.get('reason', 'general')
        
        if xp_amount <= 0:
            return jsonify({
                'success': False,
                'error': 'XP amount must be positive'
            }), 400
        
        db = _get_db()
        rewards_data = _get_user_rewards(user_id)
        
        old_xp = rewards_data.get('xp', 0)
        old_level = _calculate_level(old_xp)
        
        new_xp = old_xp + xp_amount
        new_level = _calculate_level(new_xp)
        
        level_up = new_level > old_level
        
        if db:
            db.collection('user_rewards').document(user_id).update({
                'xp': new_xp,
                'level': new_level,
                'last_xp_earned': datetime.now(timezone.utc).isoformat(),
                'last_xp_reason': reason
            })
        
        return jsonify({
            'success': True,
            'xp_added': xp_amount,
            'new_xp': new_xp,
            'new_level': new_level,
            'level_up': level_up,
            'reason': reason
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@rewards_bp.route('/user/<user_id>/claim', methods=['POST'])
def claim_reward(user_id: str):
    """Claim a reward from the catalog"""
    try:
        data = request.get_json() or {}
        reward_id = data.get('reward_id')
        
        if not reward_id:
            return jsonify({
                'success': False,
                'error': 'reward_id is required'
            }), 400
        
        if reward_id not in REWARD_CATALOG:
            return jsonify({
                'success': False,
                'error': 'Reward not found'
            }), 404
        
        reward = REWARD_CATALOG[reward_id]
        
        if not reward.get('available', True):
            return jsonify({
                'success': False,
                'error': 'This reward cannot be purchased'
            }), 400
        
        db = _get_db()
        rewards_data = _get_user_rewards(user_id)
        
        # Check if user has enough XP
        user_xp = rewards_data.get('xp', 0)
        cost = reward.get('cost', 0)
        
        if user_xp < cost:
            return jsonify({
                'success': False,
                'error': f'Not enough XP. Need {cost}, have {user_xp}'
            }), 400
        
        # Check if already claimed (for one-time rewards)
        claimed = rewards_data.get('claimed_rewards', [])
        if reward_id in claimed and reward.get('type') != 'premium_time':
            return jsonify({
                'success': False,
                'error': 'Already claimed this reward'
            }), 400
        
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
            db.collection('user_rewards').document(user_id).update(update_data)
        
        return jsonify({
            'success': True,
            'message': f'Successfully claimed {reward["title"]}',
            'reward': reward,
            'new_xp': new_xp,
            'premium_until': update_data.get('premium_until')
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@rewards_bp.route('/user/<user_id>/check-achievements', methods=['POST'])
def check_achievements(user_id: str):
    """Check and award any earned achievements"""
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
            db.collection('user_rewards').document(user_id).update({
                'achievements': earned_achievements,
                'badges': badges,
                'xp': xp + total_xp_earned,
                'last_achievement': datetime.now(timezone.utc).isoformat()
            })
        
        return jsonify({
            'success': True,
            'new_achievements': [ACHIEVEMENTS[a] for a in new_achievements],
            'total_xp_earned': total_xp_earned,
            'all_achievements': earned_achievements,
            'badges': badges
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@rewards_bp.route('/user/<user_id>/badges', methods=['GET'])
def get_user_badges(user_id: str):
    """Get all badges for a user"""
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
                        'id': badge_id,
                        'title': reward.get('title'),
                        'icon': reward.get('icon'),
                        'description': reward.get('description')
                    })
                    break
            else:
                for ach_id, ach in ACHIEVEMENTS.items():
                    if ach.get('badge') == badge_id:
                        badge_details.append({
                            'id': badge_id,
                            'title': ach.get('title'),
                            'icon': '🏆',
                            'description': ach.get('description')
                        })
                        break
        
        return jsonify({
            'success': True,
            'badges': badge_details
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
