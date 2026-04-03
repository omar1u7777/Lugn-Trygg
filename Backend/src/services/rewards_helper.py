"""
Rewards Helper Service - auto-award XP for user actions.

Centralises the logic so any blueprint can call ``award_xp()`` without
needing to know about Firestore structure or level calculations.
"""

import logging
from datetime import UTC, datetime

logger = logging.getLogger(__name__)

# XP values for different actions
XP_ACTIONS = {
    "mood_logged": 10,
    "journal_entry": 15,
    "cbt_session": 20,
    "meditation_completed": 15,
    "streak_bonus_3": 25,
    "streak_bonus_7": 50,
    "streak_bonus_30": 150,
    "chatbot_conversation": 5,
    "memory_created": 10,
    "goal_completed": 30,
    "first_mood": 50,        # one-time bonus
    "first_journal": 50,     # one-time bonus
}


def award_xp(user_id: str, action: str, amount: int | None = None) -> dict:
    """
    Award XP to a user for a given action.

    Parameters
    ----------
    user_id : str
        Firebase UID.
    action : str
        Key from XP_ACTIONS or a custom action name.
    amount : int, optional
        Override XP amount. If None, uses XP_ACTIONS lookup (default 10).

    Returns
    -------
    dict with keys: xp_gained, total_xp, level, leveled_up
    """
    xp = amount if amount is not None else XP_ACTIONS.get(action, 10)

    try:
        from ..firebase_config import db

        if db is None:
            raise RuntimeError("Database unavailable")

        rewards_ref = db.collection('user_rewards').document(user_id)
        legacy_rewards_ref = db.collection('users').document(user_id).collection('rewards').document('progress')
        doc = rewards_ref.get()

        if doc.exists:
            data = doc.to_dict() or {}
            current_xp = data.get('xp', data.get('total_xp', 0))
            current_level = data.get('level', 1)
        else:
            legacy_doc = legacy_rewards_ref.get()
            if legacy_doc.exists:
                legacy_data = legacy_doc.to_dict() or {}
                current_xp = legacy_data.get('xp', legacy_data.get('total_xp', 0))
                current_level = legacy_data.get('level', 1)
            else:
                current_xp = 0
                current_level = 1

        new_xp = current_xp + xp
        new_level = _calculate_level(new_xp)
        leveled_up = new_level > current_level

        rewards_ref.set({
            'user_id': user_id,
            'xp': new_xp,
            'total_xp': new_xp,
            'level': new_level,
            'last_action': action,
            'last_awarded_at': datetime.now(UTC).isoformat(),
        }, merge=True)

        # Keep legacy nested rewards document in sync for older code paths.
        legacy_rewards_ref.set({
            'xp': new_xp,
            'total_xp': new_xp,
            'level': new_level,
            'last_action': action,
        }, merge=True)

        # Keep users collection mirrors used by stats/dashboard queries in sync.
        db.collection('users').document(user_id).set({
            'total_xp': new_xp,
            'level': new_level,
        }, merge=True)

        if leveled_up:
            logger.info(f"🎉 User {user_id} leveled up to {new_level}!")

        logger.debug(f"⭐ +{xp} XP to {user_id} for {action} (total={new_xp}, lvl={new_level})")

        return {
            'xp_gained': xp,
            'total_xp': new_xp,
            'level': new_level,
            'leveled_up': leveled_up,
        }

    except Exception as e:
        logger.warning(f"Failed to award XP to {user_id}: {e}")
        return {
            'xp_gained': 0,
            'total_xp': 0,
            'level': 1,
            'leveled_up': False,
            'error': str(e),
        }


def _calculate_level(total_xp: int) -> int:
    """Simple level curve: 100 XP per level with increasing thresholds."""
    level = 1
    xp_needed = 100
    remaining = total_xp
    while remaining >= xp_needed:
        remaining -= xp_needed
        level += 1
        xp_needed = int(xp_needed * 1.15)  # 15% more XP per level
    return level
