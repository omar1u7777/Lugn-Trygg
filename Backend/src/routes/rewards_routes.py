"""
Rewards Routes - User Rewards and Achievements API
Real implementation for gamification rewards system
"""

import logging
import re
from datetime import UTC, datetime, timedelta

from flask import Blueprint, g, request

from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..utils.input_sanitization import sanitize_text
from ..utils.response_utils import APIResponse

try:
    from google.cloud import firestore as gcfirestore  # For atomic reward claims
except Exception:
    gcfirestore = None  # type: ignore

# Validation pattern for user IDs
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,128}$')

rewards_bp = Blueprint("rewards", __name__)
logger = logging.getLogger(__name__)

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


def _default_rewards_data(user_id: str) -> dict:
    """Build a fresh rewards profile for a user with no existing document."""
    return {
        'user_id': user_id,
        'xp': 0,
        'level': 1,
        'badges': [],
        'claimed_rewards': [],
        'achievements': [],
        'premium_until': None,
        'created_at': datetime.now(UTC).isoformat()
    }


def _get_user_rewards(user_id: str):
    """Get user's rewards data"""
    db = _get_db()

    if db:
        doc = db.collection('user_rewards').document(user_id).get()
        if doc.exists:
            return doc.to_dict()
        else:
            # Create new rewards profile
            default_data = _default_rewards_data(user_id)
            db.collection('user_rewards').document(user_id).set(default_data)
            return default_data

    return _default_rewards_data(user_id)


def _calculate_level(xp: int) -> int:
    """Calculate level based on XP"""
    # Level formula: level = sqrt(xp / 100) + 1
    import math
    return int(math.sqrt(xp / 100)) + 1


def _xp_for_next_level(current_level: int) -> int:
    """Calculate XP needed for next level"""
    return (current_level ** 2) * 100


# CORS OPTIONS handler for all endpoints


@rewards_bp.route('/catalog', methods=['GET'])
@AuthService.jwt_required
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
        logger.exception("Failed to get reward catalog: %s", e)
        return APIResponse.error("Failed to retrieve reward catalog", "CATALOG_ERROR", 500)


@rewards_bp.route('/achievements', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_achievements():
    """Get all achievements"""
    try:
        return APIResponse.success({
            "achievements": list(ACHIEVEMENTS.values())
        }, "Achievements retrieved")
    except Exception as e:
        logger.exception("Failed to get achievements: %s", e)
        return APIResponse.error("Failed to retrieve achievements", "ACHIEVEMENTS_ERROR", 500)


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
        logger.exception("Failed to get user rewards: %s", e)
        return APIResponse.error("Failed to retrieve user rewards", "REWARDS_ERROR", 500)


@rewards_bp.route('/claim', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def claim_reward():
    """Claim a reward from the catalog"""
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    try:
        data = request.get_json(silent=True) or {}
        reward_id = sanitize_text(data.get('reward_id', ''), max_length=50)

        if not reward_id:
            return APIResponse.bad_request("reward_id is required")

        if reward_id not in REWARD_CATALOG:
            return APIResponse.not_found("Reward not found")

        reward = REWARD_CATALOG[reward_id]

        if not reward.get('available', True):
            return APIResponse.bad_request("This reward cannot be purchased")

        cost = reward.get('cost', 0)
        db = _get_db()

        def _build_update(rewards_data: dict) -> dict:
            """Validate XP/claim state against `rewards_data` and compute the
            fields to persist. Raises ValueError('XP:<have>') or
            ValueError('CLAIMED') on failure so the transactional and
            fallback paths below share one validation path."""
            user_xp = rewards_data.get('xp', 0)
            if user_xp < cost:
                raise ValueError(f"XP:{user_xp}")

            claimed = list(rewards_data.get('claimed_rewards', []))
            if reward_id in claimed and reward.get('type') != 'premium_time':
                raise ValueError("CLAIMED")

            new_xp = user_xp - cost
            claimed.append(reward_id)

            update_data = {
                'xp': new_xp,
                'claimed_rewards': claimed,
                'last_claim': datetime.now(UTC).isoformat()
            }

            # Handle premium time rewards
            if reward.get('type') == 'premium_time':
                current_premium = rewards_data.get('premium_until')
                if current_premium:
                    # Extend existing premium
                    premium_date = datetime.fromisoformat(current_premium)
                    if premium_date.tzinfo is None:
                        premium_date = premium_date.replace(tzinfo=UTC)
                    if premium_date < datetime.now(UTC):
                        premium_date = datetime.now(UTC)
                    new_premium = premium_date + timedelta(days=reward.get('value', 7))
                else:
                    new_premium = datetime.now(UTC) + timedelta(days=reward.get('value', 7))

                update_data['premium_until'] = new_premium.isoformat()

            # Handle badge rewards
            if reward.get('type') == 'badge':
                badges = list(rewards_data.get('badges', []))
                if reward.get('value') not in badges:
                    badges.append(reward.get('value'))
                    update_data['badges'] = badges

            return update_data

        def _subscription_sync_payload(end_date: str) -> dict:
            # SYNC: Also update the user's subscription in the users collection
            # so subscription_service.get_plan_context() recognises the premium status
            return {
                'subscription': {
                    'plan': 'premium',
                    'status': 'active',
                    'source': 'xp_reward',
                    'end_date': end_date,
                    'updated_at': datetime.now(UTC).isoformat(),
                }
            }

        # Read-check-deduct must be atomic: without a transaction, two
        # concurrent claim requests can both read the same XP balance and
        # both pass the sufficiency check, letting a user claim more rewards
        # (including premium_time, which also grants a premium subscription)
        # than their XP actually covers.
        if db and gcfirestore is not None:
            rewards_ref = db.collection('user_rewards').document(user_id)  # type: ignore
            users_ref = db.collection('users').document(user_id)  # type: ignore

            @gcfirestore.transactional
            def _txn(transaction):
                snapshot = transaction.get(rewards_ref)
                if snapshot.exists:
                    rewards_data = snapshot.to_dict() or {}
                    doc_exists = True
                else:
                    rewards_data = _default_rewards_data(user_id)
                    doc_exists = False

                update_data = _build_update(rewards_data)

                if doc_exists:
                    transaction.update(rewards_ref, update_data)
                else:
                    transaction.set(rewards_ref, {**rewards_data, **update_data})

                if update_data.get('premium_until'):
                    transaction.set(
                        users_ref,
                        _subscription_sync_payload(update_data['premium_until']),
                        merge=True
                    )

                return update_data

            try:
                update_data = _txn(db.transaction())  # type: ignore
            except ValueError as ve:
                msg = str(ve)
                if msg == "CLAIMED":
                    return APIResponse.bad_request("Already claimed this reward")
                have = int(msg.split(":", 1)[1])
                return APIResponse.error(
                    f"Not enough XP. Need {cost}, have {have}",
                    "INSUFFICIENT_XP",
                    400,
                    {"needed": cost, "have": have}
                )
        else:
            rewards_data = _get_user_rewards(user_id) if db else _default_rewards_data(user_id)
            try:
                update_data = _build_update(rewards_data)
            except ValueError as ve:
                msg = str(ve)
                if msg == "CLAIMED":
                    return APIResponse.bad_request("Already claimed this reward")
                have = int(msg.split(":", 1)[1])
                return APIResponse.error(
                    f"Not enough XP. Need {cost}, have {have}",
                    "INSUFFICIENT_XP",
                    400,
                    {"needed": cost, "have": have}
                )

            if db:
                db.collection('user_rewards').document(user_id).update(update_data)  # type: ignore
                if update_data.get('premium_until'):
                    db.collection('users').document(user_id).set(  # type: ignore
                        _subscription_sync_payload(update_data['premium_until']),
                        merge=True
                    )

        audit_log("REWARD_CLAIMED", user_id, {"rewardId": reward_id, "cost": cost})

        return APIResponse.success({
            "message": f"Successfully claimed {reward['title']}",
            "reward": reward,
            "newXp": update_data['xp'],
            "premiumUntil": update_data.get('premium_until')
        }, "Reward claimed successfully")

    except Exception as e:
        logger.exception("Failed to claim reward: %s", e)
        return APIResponse.error("Failed to claim reward", "CLAIM_ERROR", 500)


# The longest streak any achievement asks for is 30 days; reading a few months
# of timestamps covers it with room for several entries per day.
STREAK_LOOKBACK_ENTRIES = 400

# Bounds for the client's UTC offset: the furthest real offsets are -12:00 and
# +14:00. The offset only decides where a day boundary falls, so a forged one
# shifts a streak by at most a day; it cannot invent days nobody logged.
_MAX_TZ_OFFSET_MINUTES = 14 * 60


class ProgressUnavailable(RuntimeError):
    """A counter could not be read, so achievements cannot be judged."""


def _aggregate_count(query) -> int:
    """Run a count() aggregation; both result shapes the client returns."""
    result = query.count().get()
    try:
        return int(result[0][0].value)
    except (IndexError, TypeError, AttributeError):
        return int(result[0].value)


def _parse_tz_offset(raw) -> int:
    """Minutes EAST of UTC (the inverse of JS getTimezoneOffset). 0 if absent."""
    try:
        offset = int(raw)
    except (TypeError, ValueError):
        return 0
    return max(-_MAX_TZ_OFFSET_MINUTES, min(_MAX_TZ_OFFSET_MINUTES, offset))


def _current_streak(timestamps, tz_offset_minutes: int, now: datetime | None = None) -> int:
    """Consecutive local days with at least one entry, ending today.

    No entry yet today does not break the streak; the day is not over. This
    matches the rule the rewards page shows the user.
    """
    tz_shift = timedelta(minutes=tz_offset_minutes)
    logged_days = set()
    for ts in timestamps:
        try:
            moment = ts if isinstance(ts, datetime) else datetime.fromisoformat(str(ts))
        except ValueError:
            continue
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=UTC)
        logged_days.add((moment.astimezone(UTC) + tz_shift).date())

    today = ((now or datetime.now(UTC)) + tz_shift).date()
    streak = 0
    day = today
    if day not in logged_days:
        day -= timedelta(days=1)
    while day in logged_days:
        streak += 1
        day -= timedelta(days=1)
    return streak


def _server_side_progress(db, user_id: str, tz_offset_minutes: int) -> dict:
    """Every counter an achievement condition reads, computed from stored data.

    These used to come from the request body. Anyone could POST
    {"mood_count": 100} and collect the XP, and XP buys premium_time. The
    honest client was wrong too: it sent the length of one page of moods,
    capped at 50, so "Mood Warrior — Log 100 mood entries" could never unlock.
    """
    try:
        from google.cloud.firestore import FieldFilter

        user_ref = db.collection('users').document(user_id)
        moods_ref = user_ref.collection('moods')

        recent = (
            moods_ref.order_by('timestamp', direction='DESCENDING')
            .limit(STREAK_LOOKBACK_ENTRIES)
            .select(['timestamp'])
            .stream()
        )
        timestamps = [(d.to_dict() or {}).get('timestamp') for d in recent]

        referral_doc = db.collection('referrals').document(user_id).get()
        referral_data = (referral_doc.to_dict() or {}) if referral_doc.exists else {}

        return {
            'mood_count': _aggregate_count(moods_ref),
            'streak': _current_streak([t for t in timestamps if t], tz_offset_minutes),
            'journal_count': _aggregate_count(
                db.collection('journal_entries').where(filter=FieldFilter('user_id', '==', user_id))
            ),
            'referral_count': int(referral_data.get('successful_referrals', 0) or 0),
            'meditation_count': _aggregate_count(user_ref.collection('meditation_sessions')),
        }
    except Exception as e:
        raise ProgressUnavailable(str(e)) from e


def _newly_earned(progress: dict, already_earned) -> list[str]:
    """Achievement ids whose condition `progress` meets and are not yet held."""
    earned = []
    for achievement_id, achievement in ACHIEVEMENTS.items():
        if achievement_id in already_earned:
            continue
        condition = achievement.get('condition', {})
        if progress.get(condition.get('type'), 0) >= condition.get('value', 0):
            earned.append(achievement_id)
    return earned


@rewards_bp.route('/check-achievements', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def check_achievements():
    """Award any achievements the user's stored activity has earned.

    The body may carry `tz_offset_minutes` (minutes east of UTC) so a streak's
    days match the user's calendar. Counters sent by older clients are ignored.
    """
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")

    db = _get_db()
    if db is None or gcfirestore is None:
        return APIResponse.error("Achievements unavailable", "SERVICE_UNAVAILABLE", 503)

    try:
        data = request.get_json(silent=True) or {}
        tz_offset = _parse_tz_offset(data.get('tz_offset_minutes'))

        try:
            progress = _server_side_progress(db, user_id, tz_offset)
        except ProgressUnavailable as e:
            # Judging on a counter that failed to load would read as zero and
            # quietly withhold an earned achievement. Say so instead.
            logger.warning("Achievement progress unavailable for %s: %s", user_id[:12], e)
            return APIResponse.error("Could not read progress", "PROGRESS_UNAVAILABLE", 503)

        rewards_ref = db.collection('user_rewards').document(user_id)
        users_ref = db.collection('users').document(user_id)

        # Read-decide-write in one transaction: two concurrent checks used to
        # read the same achievement list, both find the achievement missing,
        # and both credit its XP.
        @gcfirestore.transactional
        def _award(transaction):
            snapshot = rewards_ref.get(transaction=transaction)
            if snapshot.exists:
                rewards_data = snapshot.to_dict() or {}
            else:
                rewards_data = _default_rewards_data(user_id)

            earned = list(rewards_data.get('achievements', []))
            badges = list(rewards_data.get('badges', []))
            new_ids = _newly_earned(progress, earned)
            if not new_ids:
                return [], 0, earned, badges

            xp_gained = 0
            for achievement_id in new_ids:
                achievement = ACHIEVEMENTS[achievement_id]
                earned.append(achievement_id)
                xp_gained += achievement.get('xp_reward', 0)
                badge = achievement.get('badge')
                if badge and badge not in badges:
                    badges.append(badge)

            new_xp = rewards_data.get('xp', 0) + xp_gained
            update = {
                'achievements': earned,
                'badges': badges,
                'xp': new_xp,
                'level': _calculate_level(new_xp),
                'last_achievement': datetime.now(UTC).isoformat(),
            }
            if snapshot.exists:
                transaction.update(rewards_ref, update)
            else:
                transaction.set(rewards_ref, {**rewards_data, **update})
            # The leaderboard reads users.total_xp; achievement XP never
            # reached it, so the board and the rewards page disagreed.
            transaction.set(users_ref, {'total_xp': new_xp, 'level': update['level']}, merge=True)
            return new_ids, xp_gained, earned, badges

        new_achievements, total_xp_earned, earned_achievements, badges = _award(db.transaction())

        if new_achievements:
            audit_log("ACHIEVEMENTS_EARNED", user_id, {
                "achievements": new_achievements,
                "xpEarned": total_xp_earned
            })

        return APIResponse.success({
            "newAchievements": [ACHIEVEMENTS[a] for a in new_achievements],
            "totalXpEarned": total_xp_earned,
            "allAchievements": earned_achievements,
            "badges": badges,
            "progress": progress,
        }, "Achievements checked")

    except Exception as e:
        logger.exception("Failed to check achievements: %s", e)
        return APIResponse.error("Failed to check achievements", "ACHIEVEMENTS_ERROR", 500)


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
            for _reward_id, reward in REWARD_CATALOG.items():
                if reward.get('value') == badge_id:
                    badge_details.append({
                        "id": badge_id,
                        "title": reward.get('title'),
                        "icon": reward.get('icon'),
                        "description": reward.get('description')
                    })
                    break
            else:
                for _ach_id, ach in ACHIEVEMENTS.items():
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
        logger.exception("Failed to get badges: %s", e)
        return APIResponse.error("Failed to retrieve badges", "BADGES_ERROR", 500)
