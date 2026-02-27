"""
Challenges Routes - Group Challenges API
Real implementation for team-based wellness challenges
"""

import logging
import os
from datetime import UTC, datetime, timedelta

from flask import Blueprint, g, request

try:
    from google.cloud import firestore as gcfirestore  # For atomic updates if available
except Exception:
    gcfirestore = None
from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..utils.input_sanitization import input_sanitizer
from ..utils.response_utils import APIResponse

challenges_bp = Blueprint("challenges", __name__)

logger = logging.getLogger(__name__)
IS_PRODUCTION = os.getenv('FLASK_ENV', 'development').lower() == 'production'
ALLOW_IN_MEMORY = os.getenv('ALLOW_IN_MEMORY_CHALLENGES', 'true').lower() == 'true'
PUBLIC_CHALLENGES_GET = os.getenv('PUBLIC_CHALLENGES_GET', 'false').lower() == 'true'

_get_auth_decorator = (lambda f: f) if PUBLIC_CHALLENGES_GET else AuthService.jwt_required

# In-memory storage (in production, use Firestore)
# This will be replaced with Firebase in production
_challenges_store = {}
_user_challenges = {}
_defaults_initialized = False


def _can_use_memory() -> bool:
    return not IS_PRODUCTION and ALLOW_IN_MEMORY


def _cleanup_expired_challenges():
    """Mark expired challenges inactive and prune very old ones from memory."""
    now = datetime.now(UTC)
    purge_before = now - timedelta(days=30)
    to_delete = []
    deactivated = 0

    for challenge_id, challenge in list(_challenges_store.items()):
        end_date = challenge.get('end_date')
        if not end_date:
            continue

        try:
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            continue

        if end_dt < now:
            if challenge.get('active', True):
                challenge['active'] = False
                deactivated += 1

        if end_dt < purge_before:
            to_delete.append(challenge_id)

    for challenge_id in to_delete:
        _challenges_store.pop(challenge_id, None)

    if deactivated or to_delete:
        logger.info(f"Challenges cleanup (memory): deactivated={deactivated}, purged={len(to_delete)}")


def _cleanup_firestore_expired(db):
    """Mark expired challenges inactive in Firestore (no delete)."""
    try:
        now = datetime.now(UTC)
        marked_inactive = 0
        challenges_ref = db.collection('challenges')
        for doc in challenges_ref.stream():
            data = doc.to_dict() or {}
            end_date = data.get('end_date')
            if not end_date:
                continue

            try:
                end_dt = datetime.fromisoformat(end_date)
            except Exception:
                continue

            if end_dt < now and data.get('active', True):
                doc.reference.update({'active': False})
                marked_inactive += 1

        if marked_inactive:
            logger.info(f"Challenges cleanup (firestore): deactivated={marked_inactive}")
    except Exception as e:
        logger.warning(f"Challenges cleanup (firestore) failed: {e}")


def _seed_firestore_defaults(db):
    """Seed default challenges into Firestore if collection is empty."""
    try:
        existing = list(db.collection('challenges').limit(1).stream())
        if existing:
            return

        for challenge_id, challenge in _challenges_store.items():
            db.collection('challenges').document(challenge_id).set(challenge)

        logger.info("Challenges seeding (firestore): inserted default challenges")
    except Exception as e:
        logger.warning(f"Challenges seeding (firestore) failed: {e}")


def _get_db():
    """Get Firestore database reference"""
    try:
        from ..firebase_config import db
        return db
    except Exception:
        return None


def _to_camel_case_challenge(challenge: dict) -> dict:
    """Convert challenge dict from snake_case to camelCase for frontend."""
    members = challenge.get('members', [])
    camel_members = []
    for m in members:
        camel_members.append({
            'userId': m.get('user_id', ''),
            'username': m.get('username', 'Anonymous'),
            'contribution': m.get('contribution', 0),
            'joinedAt': m.get('joined_at', '')
        })

    return {
        'id': challenge.get('id', ''),
        'title': challenge.get('title', ''),
        'description': challenge.get('description', ''),
        'goal': challenge.get('goal', 0),
        'currentProgress': challenge.get('current_progress', 0),
        'teamSize': challenge.get('team_size', 0),
        'maxTeamSize': challenge.get('max_team_size', 10),
        'startDate': challenge.get('start_date', ''),
        'endDate': challenge.get('end_date', ''),
        'rewardXp': challenge.get('reward_xp', 0),
        'rewardBadge': challenge.get('reward_badge', ''),
        'category': challenge.get('category', 'mood'),
        'difficulty': challenge.get('difficulty', 'medium'),
        'members': camel_members,
        'createdAt': challenge.get('created_at', ''),
        'active': challenge.get('active', True),
        'completed': challenge.get('completed', False),
        'completedAt': challenge.get('completed_at')
    }


def _init_default_challenges():
    """Initialize default challenges if none exist"""
    global _defaults_initialized
    if _defaults_initialized:
        return

    now = datetime.now(UTC)
    _challenges_store.update({
        'mood-marathon-weekly': {
            'id': 'mood-marathon-weekly',
            'title': '7-Dagars Humör Marathon',
            'description': 'Logga humör tillsammans - nå 100 kollektiva poster på 7 dagar',
            'goal': 100,
            'current_progress': 0,
            'team_size': 0,
            'max_team_size': 10,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=7)).isoformat(),
            'reward_xp': 500,
            'reward_badge': 'mood_marathon_champion',
            'category': 'mood',
            'difficulty': 'medium',
            'members': [],
            'created_at': now.isoformat(),
            'active': True
        },
        'meditation-masters': {
            'id': 'meditation-masters',
            'title': 'Meditations Mästare',
            'description': 'Genomför 50 meditationer tillsammans denna vecka',
            'goal': 50,
            'current_progress': 0,
            'team_size': 0,
            'max_team_size': 8,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=7)).isoformat(),
            'reward_xp': 300,
            'reward_badge': 'zen_master',
            'category': 'meditation',
            'difficulty': 'hard',
            'members': [],
            'created_at': now.isoformat(),
            'active': True
        },
        'journal-journey': {
            'id': 'journal-journey',
            'title': 'Dagboksresan',
            'description': 'Skriv 30 dagboksinlägg tillsammans på 10 dagar',
            'goal': 30,
            'current_progress': 0,
            'team_size': 0,
            'max_team_size': 6,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=10)).isoformat(),
            'reward_xp': 200,
            'reward_badge': 'journal_writer',
            'category': 'journal',
            'difficulty': 'easy',
            'members': [],
            'created_at': now.isoformat(),
            'active': True
        },
        'streak-warriors': {
            'id': 'streak-warriors',
            'title': 'Streak Krigare',
            'description': 'Håll en 7-dagars streak tillsammans som team',
            'goal': 7,
            'current_progress': 0,
            'team_size': 0,
            'max_team_size': 5,
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=14)).isoformat(),
            'reward_xp': 400,
            'reward_badge': 'streak_warrior',
            'category': 'streak',
            'difficulty': 'medium',
            'members': [],
            'created_at': now.isoformat(),
            'active': True
        }
    })
    _defaults_initialized = True


def init_challenges_defaults():
    """Initialize defaults at app startup (called from main.py)."""
    _init_default_challenges()
    _cleanup_expired_challenges()

    db = _get_db()
    if db:
        _seed_firestore_defaults(db)
        _cleanup_firestore_expired(db)


@challenges_bp.route('', methods=['GET', 'OPTIONS'])
@_get_auth_decorator
@rate_limit_by_endpoint
def get_challenges():
    """Get all active challenges"""
    if request.method == 'OPTIONS':
        return APIResponse.success({'status': 'ok'})
    try:
        _cleanup_expired_challenges()

        db = _get_db()
        if db:
            _cleanup_firestore_expired(db)
            challenges_ref = db.collection('challenges')
            challenges = []
            for doc in challenges_ref.where('active', '==', True).stream():
                challenge_data = doc.to_dict()
                challenge_data['id'] = doc.id
                challenges.append(_to_camel_case_challenge(challenge_data))

            return APIResponse.success({
                'challenges': challenges,
                'source': 'firestore'
            })

        if not _can_use_memory():
            return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

        challenges = [_to_camel_case_challenge(c) for c in _challenges_store.values()]
        return APIResponse.success({
            'challenges': challenges,
            'source': 'memory'
        })

    except Exception as e:
        logger.error(f"Failed to get challenges: {e}")
        return APIResponse.error("Failed to retrieve challenges", "CHALLENGES_ERROR", 500)


@challenges_bp.route('/<challenge_id>', methods=['GET', 'OPTIONS'])
@_get_auth_decorator
@rate_limit_by_endpoint
def get_challenge(challenge_id: str):
    """Get a specific challenge by ID"""
    if request.method == 'OPTIONS':
        return APIResponse.success({'status': 'ok'})
    try:
        _cleanup_expired_challenges()

        db = _get_db()
        if db:
            _cleanup_firestore_expired(db)
            doc = db.collection('challenges').document(challenge_id).get()
            if doc.exists:
                challenge_data = doc.to_dict()
                challenge_data['id'] = doc.id
                return APIResponse.success({
                    'challenge': _to_camel_case_challenge(challenge_data)
                })

        if not _can_use_memory():
            return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

        if challenge_id in _challenges_store:
            return APIResponse.success({
                'challenge': _to_camel_case_challenge(_challenges_store[challenge_id])
            })

        return APIResponse.not_found('Challenge not found')

    except Exception as e:
        logger.error(f"Failed to get challenge {challenge_id}: {e}")
        return APIResponse.error("Failed to retrieve challenge", "CHALLENGES_ERROR", 500)


@challenges_bp.route('/<challenge_id>/join', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def join_challenge(challenge_id: str):
    """Join a challenge"""
    try:
        user_id = g.user_id
        data = request.get_json() or {}
        username = data.get('username', 'Anonymous')
        username = input_sanitizer.sanitize(username, content_type='text', max_length=80) or 'Anonymous'

        _cleanup_expired_challenges()

        db = _get_db()
        now = datetime.now(UTC)

        member_data = {
            'user_id': user_id,
            'username': username,
            'contribution': 0,
            'joined_at': now.isoformat()
        }

        if db:
            _cleanup_firestore_expired(db)
            challenge_ref = db.collection('challenges').document(challenge_id)
            user_challenges_ref = db.collection('user_challenges').document(user_id)

            def _txn(transaction):
                snapshot = transaction.get(challenge_ref)
                if not snapshot.exists:
                    if challenge_id in _challenges_store:
                        transaction.set(challenge_ref, _challenges_store[challenge_id])
                        snapshot = transaction.get(challenge_ref)
                    else:
                        raise ValueError('404:Challenge not found')

                challenge_data = snapshot.to_dict() or {}
                members = challenge_data.get('members', [])

                if any(m.get('user_id') == user_id for m in members):
                    raise ValueError('400:Already joined this challenge')

                if len(members) >= challenge_data.get('max_team_size', 10):
                    raise ValueError('400:Challenge is full')

                if gcfirestore:
                    transaction.update(challenge_ref, {
                        'members': gcfirestore.ArrayUnion([member_data]),
                        'team_size': len(members) + 1
                    })
                else:
                    members.append(member_data)
                    transaction.update(challenge_ref, {
                        'members': members,
                        'team_size': len(members)
                    })

                transaction.set(user_challenges_ref, {
                    'challenges': {challenge_id: {'joined_at': now.isoformat()}}
                }, merge=True)

            try:
                db.run_transaction(_txn)
            except ValueError as ve:
                msg = str(ve)
                if msg.startswith('404:'):
                    return APIResponse.not_found(msg.split(':', 1)[1])
                if msg.startswith('400:'):
                    return APIResponse.bad_request(msg.split(':', 1)[1])
                logger.error(f"Join transaction failed (custom): {msg}")
                return APIResponse.error('Join failed')
            except Exception as e:
                logger.error(f"Join transaction failed: {e}")
                return APIResponse.error('Join failed')

            logger.info(f"User {user_id} joined challenge {challenge_id} (firestore)")
            audit_log('challenge_joined', user_id, {'challengeId': challenge_id, 'source': 'firestore'})
            return APIResponse.success({
                'message': 'Successfully joined challenge',
                'challengeId': challenge_id
            })

        if not _can_use_memory():
            return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

        # Fallback to in-memory
        _init_default_challenges()
        if challenge_id not in _challenges_store:
            return APIResponse.not_found('Challenge not found')

        challenge = _challenges_store[challenge_id]
        members = challenge.get('members', [])

        if any(m.get('user_id') == user_id for m in members):
            return APIResponse.bad_request('Already joined this challenge')

        if len(members) >= challenge.get('max_team_size', 10):
            return APIResponse.bad_request('Challenge is full')

        members.append(member_data)
        challenge['members'] = members
        challenge['team_size'] = len(members)

        # Track user's challenges
        if user_id not in _user_challenges:
            _user_challenges[user_id] = {}
        _user_challenges[user_id][challenge_id] = {'joined_at': now.isoformat()}

        logger.info(f"User {user_id} joined challenge {challenge_id} (memory)")
        audit_log('challenge_joined', user_id, {'challengeId': challenge_id, 'source': 'memory'})

        return APIResponse.success({
            'message': 'Successfully joined challenge',
            'challengeId': challenge_id
        })

    except Exception as e:
        logger.exception("Failed to join challenge: %s", e)
        return APIResponse.error("Failed to join challenge", "JOIN_ERROR", 500)


@challenges_bp.route('/<challenge_id>/leave', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def leave_challenge(challenge_id: str):
    """Leave a challenge"""
    try:
        user_id = g.user_id

        _cleanup_expired_challenges()

        db = _get_db()

        if db:
            _cleanup_firestore_expired(db)
            challenge_ref = db.collection('challenges').document(challenge_id)
            doc = challenge_ref.get()

            if not doc.exists:
                return APIResponse.not_found('Challenge not found')

            challenge_data = doc.to_dict()
            members = challenge_data.get('members', [])

            # Remove user from members
            members = [m for m in members if m.get('user_id') != user_id]

            challenge_ref.update({
                'members': members,
                'team_size': len(members)
            })

            logger.info(f"User {user_id} left challenge {challenge_id} (firestore)")
            audit_log('challenge_left', user_id, {'challengeId': challenge_id, 'source': 'firestore'})

            return APIResponse.success({'message': 'Successfully left challenge'})

        if not _can_use_memory():
            return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

        # Fallback to in-memory
        _init_default_challenges()
        if challenge_id in _challenges_store:
            challenge = _challenges_store[challenge_id]
            members = challenge.get('members', [])
            challenge['members'] = [m for m in members if m.get('user_id') != user_id]
            challenge['team_size'] = len(challenge['members'])

        logger.info(f"User {user_id} left challenge {challenge_id} (memory)")
        audit_log('challenge_left', user_id, {'challengeId': challenge_id, 'source': 'memory'})

        return APIResponse.success({'message': 'Successfully left challenge'})

    except Exception as e:
        logger.exception("Failed to leave challenge: %s", e)
        return APIResponse.error("Failed to leave challenge", "LEAVE_ERROR", 500)


@challenges_bp.route('/<challenge_id>/contribute', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def contribute_to_challenge(challenge_id: str):
    """Add contribution to a challenge (called when user logs mood, meditates, etc.)"""
    try:
        user_id = g.user_id
        data = request.get_json() or {}
        contribution_type = (data.get('type') or 'mood').strip().lower()
        amount = data.get('amount', 1)

        allowed_types = {'mood', 'meditation', 'journal', 'streak'}
        if contribution_type not in allowed_types:
            return APIResponse.bad_request('Invalid contribution type')

        try:
            amount = int(amount)
        except (TypeError, ValueError):
            return APIResponse.bad_request('Invalid amount')

        if amount < 1:
            amount = 1
        if amount > 50:
            amount = 50

        _cleanup_expired_challenges()

        db = _get_db()

        if db:
            _cleanup_firestore_expired(db)
            challenge_ref = db.collection('challenges').document(challenge_id)
            doc = challenge_ref.get()

            if not doc.exists:
                return APIResponse.not_found('Challenge not found')

            challenge_data = doc.to_dict()

            # Check if user is a member
            members = challenge_data.get('members', [])
            member_index = next((i for i, m in enumerate(members) if m.get('user_id') == user_id), -1)

            if member_index == -1:
                return APIResponse.bad_request('User is not a member of this challenge')

            # Check if challenge category matches contribution type
            if challenge_data.get('category') != contribution_type:
                return APIResponse.bad_request(f'This challenge is for {challenge_data.get("category")}, not {contribution_type}')

            # Update contribution
            members[member_index]['contribution'] = members[member_index].get('contribution', 0) + amount

            # Update overall progress
            new_progress = challenge_data.get('current_progress', 0) + amount
            goal = challenge_data.get('goal', 100)

            # Check if challenge completed
            completed = new_progress >= goal

            challenge_ref.update({
                'members': members,
                'current_progress': new_progress,
                'completed': completed,
                'completed_at': datetime.now(UTC).isoformat() if completed else None
            })

            logger.info(f"User {user_id} contributed {amount} to {challenge_id} (firestore)")
            audit_log('challenge_contribution', user_id, {
                'challengeId': challenge_id,
                'amount': amount,
                'newProgress': new_progress,
                'completed': completed,
                'source': 'firestore'
            })

            return APIResponse.success({
                'message': 'Contribution added',
                'newProgress': new_progress,
                'goal': goal,
                'completed': completed,
                'userContribution': members[member_index]['contribution']
            })

        if not _can_use_memory():
            return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

        # Fallback to in-memory
        _init_default_challenges()
        if challenge_id in _challenges_store:
            challenge = _challenges_store[challenge_id]
            members = challenge.get('members', [])

            member_index = next((i for i, m in enumerate(members) if m.get('user_id') == user_id), -1)
            if member_index == -1:
                return APIResponse.bad_request('User is not a member of this challenge')

            members[member_index]['contribution'] = members[member_index].get('contribution', 0) + amount
            challenge['current_progress'] = challenge.get('current_progress', 0) + amount

            logger.info(f"User {user_id} contributed {amount} to {challenge_id} (memory)")
            audit_log('challenge_contribution', user_id, {
                'challengeId': challenge_id,
                'amount': amount,
                'newProgress': challenge['current_progress'],
                'source': 'memory'
            })

            return APIResponse.success({
                'message': 'Contribution added',
                'newProgress': challenge['current_progress'],
                'goal': challenge.get('goal', 100)
            })

        return APIResponse.not_found('Challenge not found')

    except Exception as e:
        logger.exception("Failed to contribute to challenge: %s", e)
        return APIResponse.error("Failed to contribute to challenge", "CONTRIBUTE_ERROR", 500)


@challenges_bp.route('/user/<user_id>', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_challenges(user_id: str):
    """Get all challenges a user is participating in"""
    if request.method == 'OPTIONS':
        return APIResponse.success({'status': 'ok'})
    try:
        # Users can only see their own challenges
        if g.user_id != user_id:
            return APIResponse.forbidden('Unauthorized')

        _cleanup_expired_challenges()

        db = _get_db()
        user_challenges = []

        if db:
            _cleanup_firestore_expired(db)
            # Get all challenges where user is a member
            challenges_ref = db.collection('challenges')
            for doc in challenges_ref.where('active', '==', True).stream():
                challenge_data = doc.to_dict()
                members = challenge_data.get('members', [])

                if any(m.get('user_id') == user_id for m in members):
                    challenge_data['id'] = doc.id
                    user_challenges.append(_to_camel_case_challenge(challenge_data))

            return APIResponse.success({'challenges': user_challenges})

        if not _can_use_memory():
            return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

        # Fallback to in-memory
        _init_default_challenges()
        for _challenge_id, challenge in _challenges_store.items():
            members = challenge.get('members', [])
            if any(m.get('user_id') == user_id for m in members):
                user_challenges.append(_to_camel_case_challenge(challenge))

        return APIResponse.success({'challenges': user_challenges})

    except Exception as e:
        logger.exception("Failed to get user challenges: %s", e)
        return APIResponse.error("Failed to retrieve user challenges", "CHALLENGES_ERROR", 500)


@challenges_bp.route('/maintenance/cleanup', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def run_challenges_cleanup():
    """Trigger cleanup for scheduler/ops."""
    try:
        _cleanup_expired_challenges()
        db = _get_db()
        if db:
            _cleanup_firestore_expired(db)
        return APIResponse.success({'message': 'Cleanup completed'})
    except Exception as e:
        logger.error(f"Challenges maintenance cleanup failed: {e}")
        return APIResponse.error("Cleanup failed", "MAINTENANCE_ERROR", 500)
