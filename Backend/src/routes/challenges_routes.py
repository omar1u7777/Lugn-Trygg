"""
Challenges Routes - Group Challenges API
Real implementation for team-based wellness challenges
"""

from flask import Blueprint, request, jsonify, g
from datetime import datetime, timedelta, timezone
import uuid

challenges_bp = Blueprint("challenges", __name__, url_prefix="/api/challenges")

# In-memory storage (in production, use Firestore)
# This will be replaced with Firebase in production
_challenges_store = {}
_user_challenges = {}


def _get_db():
    """Get Firestore database reference"""
    try:
        from ..firebase_config import db
        return db
    except Exception:
        return None


def _init_default_challenges():
    """Initialize default challenges if none exist"""
    if not _challenges_store:
        now = datetime.now(timezone.utc)
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


@challenges_bp.route('', methods=['GET'])
def get_challenges():
    """Get all active challenges"""
    try:
        _init_default_challenges()
        
        db = _get_db()
        if db:
            # Try to get from Firestore
            challenges_ref = db.collection('challenges')
            challenges = []
            for doc in challenges_ref.where('active', '==', True).stream():
                challenge_data = doc.to_dict()
                challenge_data['id'] = doc.id
                challenges.append(challenge_data)
            
            if challenges:
                return jsonify({
                    'success': True,
                    'challenges': challenges,
                    'source': 'firestore'
                })
        
        # Fallback to in-memory
        challenges = list(_challenges_store.values())
        return jsonify({
            'success': True,
            'challenges': challenges,
            'source': 'memory'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@challenges_bp.route('/<challenge_id>', methods=['GET'])
def get_challenge(challenge_id: str):
    """Get a specific challenge by ID"""
    try:
        _init_default_challenges()
        
        db = _get_db()
        if db:
            doc = db.collection('challenges').document(challenge_id).get()
            if doc.exists:
                challenge_data = doc.to_dict()
                challenge_data['id'] = doc.id
                return jsonify({
                    'success': True,
                    'challenge': challenge_data
                })
        
        # Fallback to in-memory
        if challenge_id in _challenges_store:
            return jsonify({
                'success': True,
                'challenge': _challenges_store[challenge_id]
            })
        
        return jsonify({
            'success': False,
            'error': 'Challenge not found'
        }), 404
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@challenges_bp.route('/<challenge_id>/join', methods=['POST'])
def join_challenge(challenge_id: str):
    """Join a challenge"""
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id')
        username = data.get('username', 'Anonymous')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'user_id is required'
            }), 400
        
        _init_default_challenges()
        
        db = _get_db()
        now = datetime.now(timezone.utc)
        
        member_data = {
            'user_id': user_id,
            'username': username,
            'contribution': 0,
            'joined_at': now.isoformat()
        }
        
        if db:
            # Update in Firestore
            challenge_ref = db.collection('challenges').document(challenge_id)
            doc = challenge_ref.get()
            
            if not doc.exists:
                # Create from default
                if challenge_id in _challenges_store:
                    challenge_ref.set(_challenges_store[challenge_id])
                else:
                    return jsonify({
                        'success': False,
                        'error': 'Challenge not found'
                    }), 404
            
            challenge_data = challenge_ref.get().to_dict()
            
            # Check if already joined
            members = challenge_data.get('members', [])
            if any(m.get('user_id') == user_id for m in members):
                return jsonify({
                    'success': False,
                    'error': 'Already joined this challenge'
                }), 400
            
            # Check max team size
            if len(members) >= challenge_data.get('max_team_size', 10):
                return jsonify({
                    'success': False,
                    'error': 'Challenge is full'
                }), 400
            
            # Add member
            members.append(member_data)
            challenge_ref.update({
                'members': members,
                'team_size': len(members)
            })
            
            # Track user's challenges
            user_challenges_ref = db.collection('user_challenges').document(user_id)
            user_challenges_ref.set({
                'challenges': {challenge_id: {'joined_at': now.isoformat()}}
            }, merge=True)
            
            return jsonify({
                'success': True,
                'message': 'Successfully joined challenge',
                'challenge_id': challenge_id
            })
        
        # Fallback to in-memory
        if challenge_id not in _challenges_store:
            return jsonify({
                'success': False,
                'error': 'Challenge not found'
            }), 404
        
        challenge = _challenges_store[challenge_id]
        members = challenge.get('members', [])
        
        if any(m.get('user_id') == user_id for m in members):
            return jsonify({
                'success': False,
                'error': 'Already joined this challenge'
            }), 400
        
        if len(members) >= challenge.get('max_team_size', 10):
            return jsonify({
                'success': False,
                'error': 'Challenge is full'
            }), 400
        
        members.append(member_data)
        challenge['members'] = members
        challenge['team_size'] = len(members)
        
        # Track user's challenges
        if user_id not in _user_challenges:
            _user_challenges[user_id] = {}
        _user_challenges[user_id][challenge_id] = {'joined_at': now.isoformat()}
        
        return jsonify({
            'success': True,
            'message': 'Successfully joined challenge',
            'challenge_id': challenge_id
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@challenges_bp.route('/<challenge_id>/leave', methods=['POST'])
def leave_challenge(challenge_id: str):
    """Leave a challenge"""
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'user_id is required'
            }), 400
        
        db = _get_db()
        
        if db:
            challenge_ref = db.collection('challenges').document(challenge_id)
            doc = challenge_ref.get()
            
            if not doc.exists:
                return jsonify({
                    'success': False,
                    'error': 'Challenge not found'
                }), 404
            
            challenge_data = doc.to_dict()
            members = challenge_data.get('members', [])
            
            # Remove user from members
            members = [m for m in members if m.get('user_id') != user_id]
            
            challenge_ref.update({
                'members': members,
                'team_size': len(members)
            })
            
            return jsonify({
                'success': True,
                'message': 'Successfully left challenge'
            })
        
        # Fallback to in-memory
        if challenge_id in _challenges_store:
            challenge = _challenges_store[challenge_id]
            members = challenge.get('members', [])
            challenge['members'] = [m for m in members if m.get('user_id') != user_id]
            challenge['team_size'] = len(challenge['members'])
        
        return jsonify({
            'success': True,
            'message': 'Successfully left challenge'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@challenges_bp.route('/<challenge_id>/contribute', methods=['POST'])
def contribute_to_challenge(challenge_id: str):
    """Add contribution to a challenge (called when user logs mood, meditates, etc.)"""
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id')
        contribution_type = data.get('type', 'mood')  # mood, meditation, journal, streak
        amount = data.get('amount', 1)
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'user_id is required'
            }), 400
        
        db = _get_db()
        
        if db:
            challenge_ref = db.collection('challenges').document(challenge_id)
            doc = challenge_ref.get()
            
            if not doc.exists:
                return jsonify({
                    'success': False,
                    'error': 'Challenge not found'
                }), 404
            
            challenge_data = doc.to_dict()
            
            # Check if user is a member
            members = challenge_data.get('members', [])
            member_index = next((i for i, m in enumerate(members) if m.get('user_id') == user_id), -1)
            
            if member_index == -1:
                return jsonify({
                    'success': False,
                    'error': 'User is not a member of this challenge'
                }), 400
            
            # Check if challenge category matches contribution type
            if challenge_data.get('category') != contribution_type:
                return jsonify({
                    'success': False,
                    'error': f'This challenge is for {challenge_data.get("category")}, not {contribution_type}'
                }), 400
            
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
                'completed_at': datetime.now(timezone.utc).isoformat() if completed else None
            })
            
            return jsonify({
                'success': True,
                'message': 'Contribution added',
                'new_progress': new_progress,
                'goal': goal,
                'completed': completed,
                'user_contribution': members[member_index]['contribution']
            })
        
        # Fallback to in-memory
        if challenge_id in _challenges_store:
            challenge = _challenges_store[challenge_id]
            members = challenge.get('members', [])
            
            member_index = next((i for i, m in enumerate(members) if m.get('user_id') == user_id), -1)
            if member_index == -1:
                return jsonify({
                    'success': False,
                    'error': 'User is not a member of this challenge'
                }), 400
            
            members[member_index]['contribution'] = members[member_index].get('contribution', 0) + amount
            challenge['current_progress'] = challenge.get('current_progress', 0) + amount
            
            return jsonify({
                'success': True,
                'message': 'Contribution added',
                'new_progress': challenge['current_progress'],
                'goal': challenge.get('goal', 100)
            })
        
        return jsonify({
            'success': False,
            'error': 'Challenge not found'
        }), 404
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@challenges_bp.route('/user/<user_id>', methods=['GET'])
def get_user_challenges(user_id: str):
    """Get all challenges a user is participating in"""
    try:
        _init_default_challenges()
        
        db = _get_db()
        user_challenges = []
        
        if db:
            # Get all challenges where user is a member
            challenges_ref = db.collection('challenges')
            for doc in challenges_ref.where('active', '==', True).stream():
                challenge_data = doc.to_dict()
                members = challenge_data.get('members', [])
                
                if any(m.get('user_id') == user_id for m in members):
                    challenge_data['id'] = doc.id
                    user_challenges.append(challenge_data)
            
            return jsonify({
                'success': True,
                'challenges': user_challenges
            })
        
        # Fallback to in-memory
        for challenge_id, challenge in _challenges_store.items():
            members = challenge.get('members', [])
            if any(m.get('user_id') == user_id for m in members):
                user_challenges.append(challenge)
        
        return jsonify({
            'success': True,
            'challenges': user_challenges
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
