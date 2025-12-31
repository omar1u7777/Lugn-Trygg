from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services.auth_service import AuthService
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

journal_bp = Blueprint('journal', __name__)

@journal_bp.route('/<user_id>/journal', methods=['GET'])
@AuthService.jwt_required
def get_journal_entries(user_id):
    """Get user's journal entries"""
    try:
        current_user_id = request.user_id

        # Check if user is authorized to access this user's journal
        if user_id != current_user_id:
            return jsonify({'error': 'Unauthorized access to journal'}), 403

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        # Get journal entries from Firestore
        try:
            from google.cloud.firestore import FieldFilter
            journal_ref = db.collection('journal_entries').where(filter=FieldFilter('user_id', '==', user_id)).order_by('created_at', direction='DESCENDING').limit(50)
            journal_docs = journal_ref.stream()
        except TypeError:
            # Fallback for test environments
            journal_ref = db.collection('journal_entries').where('user_id', '==', user_id).order_by('created_at', direction='DESCENDING').limit(50)
            journal_docs = journal_ref.stream()

        entries = []
        for doc in journal_docs:
            data = doc.to_dict()
            entries.append({
                'id': doc.id,
                'content': data.get('content', ''),
                'mood': data.get('mood'),
                'tags': data.get('tags', []),
                'created_at': data.get('created_at'),
                'updated_at': data.get('updated_at')
            })

        return jsonify({'entries': entries}), 200

    except Exception as e:
        logger.error(f"Failed to get journal entries: {str(e)}")
        return jsonify({'error': 'Failed to load journal entries'}), 500

@journal_bp.route('/<user_id>/journal', methods=['POST'])
@AuthService.jwt_required
def save_journal_entry(user_id):
    """Save a new journal entry"""
    try:
        current_user_id = request.user_id

        # Check if user is authorized
        if user_id != current_user_id:
            return jsonify({'error': 'Unauthorized access'}), 403

        # Check if user exists in Firestore
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        data = request.get_json()
        if not data or not data.get('content'):
            return jsonify({'error': 'Content is required'}), 400

        content = data.get('content', '').strip()
        if len(content) < 3:
            return jsonify({'error': 'Content must be at least 3 characters'}), 400
        if len(content) > 5000:
            return jsonify({'error': 'Content must be less than 5000 characters'}), 400

        # Save to Firestore
        entry_data = {
            'user_id': user_id,
            'content': content,
            'mood': data.get('mood'),
            'tags': data.get('tags', []),
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }

        doc_ref = db.collection('journal_entries').document()
        doc_ref.set(entry_data)

        return jsonify({
            'id': doc_ref.id,
            'message': 'Journal entry saved successfully',
            **entry_data
        }), 201

    except Exception as e:
        logger.error(f"Failed to save journal entry: {str(e)}")
        return jsonify({'error': 'Failed to save journal entry'}), 500

@journal_bp.route('/<user_id>/journal/<entry_id>', methods=['PUT'])
@AuthService.jwt_required
def update_journal_entry(user_id, entry_id):
    """Update a journal entry"""
    try:
        current_user_id = request.user_id

        # Check if user is authorized
        if user_id != current_user_id:
            return jsonify({'error': 'Unauthorized access'}), 403

        # Check if user exists
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Check if entry exists and belongs to user
        entry_ref = db.collection('journal_entries').document(entry_id)
        entry_doc = entry_ref.get()

        if not entry_doc.exists:
            return jsonify({'error': 'Journal entry not found'}), 404

        entry_data = entry_doc.to_dict()
        if entry_data.get('user_id') != user_id:
            return jsonify({'error': 'Unauthorized access to journal entry'}), 403

        # Update entry
        update_data = {
            'updated_at': datetime.now(timezone.utc)
        }

        if 'content' in data:
            content = data['content'].strip()
            if len(content) < 3:
                return jsonify({'error': 'Content must be at least 3 characters'}), 400
            if len(content) > 5000:
                return jsonify({'error': 'Content must be less than 5000 characters'}), 400
            update_data['content'] = content

        if 'mood' in data:
            update_data['mood'] = data['mood']

        if 'tags' in data:
            update_data['tags'] = data['tags']

        entry_ref.update(update_data)

        return jsonify({
            'id': entry_id,
            'message': 'Journal entry updated successfully',
            **update_data
        }), 200

    except Exception as e:
        logger.error(f"Failed to update journal entry: {str(e)}")
        return jsonify({'error': 'Failed to update journal entry'}), 500

@journal_bp.route('/<user_id>/journal/<entry_id>', methods=['DELETE'])
@AuthService.jwt_required
def delete_journal_entry(user_id, entry_id):
    """Delete a journal entry"""
    try:
        current_user_id = request.user_id

        # Check if user is authorized
        if user_id != current_user_id:
            return jsonify({'error': 'Unauthorized access'}), 403

        # Check if user exists
        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        # Check if entry exists and belongs to user
        entry_ref = db.collection('journal_entries').document(entry_id)
        entry_doc = entry_ref.get()

        if not entry_doc.exists:
            return jsonify({'error': 'Journal entry not found'}), 404

        entry_data = entry_doc.to_dict()
        if entry_data.get('user_id') != user_id:
            return jsonify({'error': 'Unauthorized access to journal entry'}), 403

        # Delete entry
        entry_ref.delete()

        return jsonify({'message': 'Journal entry deleted successfully'}), 200

    except Exception as e:
        logger.error(f"Failed to delete journal entry: {str(e)}")
        return jsonify({'error': 'Failed to delete journal entry'}), 500