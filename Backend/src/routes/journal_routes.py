from flask import Blueprint, request, g
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import logging
import re

# Absolute imports (project standard)
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.audit_service import audit_log
from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse
from src.firebase_config import db

logger = logging.getLogger(__name__)

# Validation patterns
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,128}$')
ENTRY_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{10,64}$')
# Tags validation: alphanumeric with spaces, max 50 chars per tag
TAG_PATTERN = re.compile(r'^[a-zA-Z0-9åäöÅÄÖ\s-]{1,50}$')

journal_bp = Blueprint('journal', __name__)


def _validate_user_id(user_id: str) -> bool:
    """Validate user_id format"""
    return bool(USER_ID_PATTERN.match(user_id)) if user_id else False


def _validate_entry_id(entry_id: str) -> bool:
    """Validate entry_id format"""
    return bool(ENTRY_ID_PATTERN.match(entry_id)) if entry_id else False


def _validate_tags(tags: list) -> tuple[bool, str]:
    """Validate tags list - returns (is_valid, error_message)"""
    if not isinstance(tags, list):
        return False, "Tags must be a list"
    if len(tags) > 20:
        return False, "Maximum 20 tags allowed"
    for tag in tags:
        if not isinstance(tag, str):
            return False, "Each tag must be a string"
        if not TAG_PATTERN.match(tag):
            return False, f"Invalid tag format: '{tag}'"
    return True, ""


def _validate_mood(mood) -> tuple[bool, str]:
    """Validate mood value - returns (is_valid, error_message)"""
    if mood is None:
        return True, ""
    if not isinstance(mood, (int, float)):
        return False, "Mood must be a number"
    if not 1 <= mood <= 10:
        return False, "Mood must be between 1 and 10"
    return True, ""


# ============================================================================
# OPTIONS Handlers (CORS preflight)
# ============================================================================

@journal_bp.route('/<user_id>/journal', methods=['OPTIONS'])
def journal_options(user_id):
    """Handle CORS preflight for journal endpoints"""
    return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')


@journal_bp.route('/<user_id>/journal/<entry_id>', methods=['OPTIONS'])
def journal_entry_options(user_id, entry_id):
    """Handle CORS preflight for journal entry endpoints"""
    return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

@journal_bp.route('/<user_id>/journal', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_journal_entries(user_id):
    """Get user's journal entries"""
    try:
        current_user_id: Optional[str] = g.get('user_id')

        # Validate user_id format
        if not _validate_user_id(user_id):
            logger.warning(f"Invalid user_id format attempted: {user_id[:50] if user_id else 'None'}")
            return APIResponse.bad_request('Invalid user ID format')

        # Check if user is authorized to access this user's journal
        if user_id != current_user_id:
            audit_log(
                event_type="UNAUTHORIZED_JOURNAL_ACCESS",
                user_id=current_user_id or "unknown",
                details={"attempted_user_id": user_id, "action": "read"}
            )
            return APIResponse.forbidden('Unauthorized access to journal')

        # Check if user exists in Firestore
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return APIResponse.not_found('User not found')
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return APIResponse.error('Service temporarily unavailable', status_code=503)

        # Get limit parameter with validation
        try:
            limit = min(int(request.args.get('limit', 50)), 100)  # Max 100 entries
            if limit < 1:
                limit = 50
        except (ValueError, TypeError):
            limit = 50

        # Get journal entries from Firestore
        try:
            from google.cloud.firestore import FieldFilter
            journal_ref = db.collection('journal_entries').where(
                filter=FieldFilter('user_id', '==', user_id)
            ).order_by('created_at', direction='DESCENDING').limit(limit)
            journal_docs = journal_ref.stream()
        except TypeError:
            # Fallback for test environments
            journal_ref = db.collection('journal_entries').where(
                'user_id', '==', user_id
            ).order_by('created_at', direction='DESCENDING').limit(limit)
            journal_docs = journal_ref.stream()

        entries = []
        for doc in journal_docs:
            data = doc.to_dict()
            entries.append({
                'id': doc.id,
                'content': data.get('content', ''),
                'mood': data.get('mood'),
                'tags': data.get('tags', []),
                'createdAt': data.get('created_at').isoformat() if data.get('created_at') else None,
                'updatedAt': data.get('updated_at').isoformat() if data.get('updated_at') else None
            })

        return APIResponse.success(
            data={'entries': entries},
            message=f'Retrieved {len(entries)} journal entries'
        )

    except Exception as e:
        logger.error(f"Failed to get journal entries: {str(e)}")
        return APIResponse.error('Failed to load journal entries')

@journal_bp.route('/<user_id>/journal', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def save_journal_entry(user_id):
    """Save a new journal entry"""
    try:
        current_user_id: Optional[str] = g.get('user_id')

        # Validate user_id format
        if not _validate_user_id(user_id):
            logger.warning(f"Invalid user_id format attempted: {user_id[:50] if user_id else 'None'}")
            return APIResponse.bad_request('Invalid user ID format')

        # Check if user is authorized
        if user_id != current_user_id:
            audit_log(
                event_type="UNAUTHORIZED_JOURNAL_ACCESS",
                user_id=current_user_id or "unknown",
                details={"attempted_user_id": user_id, "action": "create"}
            )
            return APIResponse.forbidden('Unauthorized access')

        # Check if user exists in Firestore
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return APIResponse.not_found('User not found')
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return APIResponse.error('Service temporarily unavailable', status_code=503)

        data = request.get_json()
        if not data or not data.get('content'):
            return APIResponse.bad_request('Content is required')

        # Sanitize and validate content
        content = input_sanitizer.sanitize(data.get('content', '')).strip()
        if len(content) < 3:
            return APIResponse.bad_request('Content must be at least 3 characters')
        if len(content) > 5000:
            return APIResponse.bad_request('Content must be less than 5000 characters')

        # Validate mood if provided
        mood = data.get('mood')
        is_valid_mood, mood_error = _validate_mood(mood)
        if not is_valid_mood:
            return APIResponse.bad_request(mood_error)

        # Validate and sanitize tags if provided
        tags = data.get('tags', [])
        if tags:
            is_valid_tags, tags_error = _validate_tags(tags)
            if not is_valid_tags:
                return APIResponse.bad_request(tags_error)
            # Sanitize each tag
            tags = [input_sanitizer.sanitize(tag).strip() for tag in tags]

        # Save to Firestore
        now = datetime.now(timezone.utc)
        entry_data = {
            'user_id': user_id,
            'content': content,
            'mood': mood,
            'tags': tags,
            'created_at': now,
            'updated_at': now
        }

        doc_ref = db.collection('journal_entries').document()
        doc_ref.set(entry_data)

        # Audit log for journal creation
        audit_log(
            event_type="JOURNAL_ENTRY_CREATED",
            user_id=user_id,
            details={
                "entry_id": doc_ref.id,
                "content_length": len(content),
                "has_mood": mood is not None,
                "tags_count": len(tags)
            }
        )

        return APIResponse.created(
            data={
                'id': doc_ref.id,
                'content': content,
                'mood': mood,
                'tags': tags,
                'createdAt': now.isoformat(),
                'updatedAt': now.isoformat()
            },
            message='Journal entry saved successfully'
        )

    except Exception as e:
        logger.error(f"Failed to save journal entry: {str(e)}")
        return APIResponse.error('Failed to save journal entry')

@journal_bp.route('/<user_id>/journal/<entry_id>', methods=['PUT'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def update_journal_entry(user_id, entry_id):
    """Update a journal entry"""
    try:
        current_user_id: Optional[str] = g.get('user_id')

        # Validate user_id and entry_id format
        if not _validate_user_id(user_id):
            logger.warning(f"Invalid user_id format attempted: {user_id[:50] if user_id else 'None'}")
            return APIResponse.bad_request('Invalid user ID format')

        if not _validate_entry_id(entry_id):
            logger.warning(f"Invalid entry_id format attempted: {entry_id[:50] if entry_id else 'None'}")
            return APIResponse.bad_request('Invalid entry ID format')

        # Check if user is authorized
        if user_id != current_user_id:
            audit_log(
                event_type="UNAUTHORIZED_JOURNAL_ACCESS",
                user_id=current_user_id or "unknown",
                details={"attempted_user_id": user_id, "entry_id": entry_id, "action": "update"}
            )
            return APIResponse.forbidden('Unauthorized access')

        # Check if user exists
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return APIResponse.not_found('User not found')
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return APIResponse.error('Service temporarily unavailable', status_code=503)

        data = request.get_json()
        if not data:
            return APIResponse.bad_request('No data provided')

        # Check if entry exists and belongs to user
        entry_ref = db.collection('journal_entries').document(entry_id)
        entry_doc = entry_ref.get()

        if not entry_doc.exists:
            return APIResponse.not_found('Journal entry not found')

        existing_entry_data = entry_doc.to_dict()
        if existing_entry_data.get('user_id') != user_id:
            audit_log(
                event_type="UNAUTHORIZED_JOURNAL_ACCESS",
                user_id=current_user_id or "unknown",
                details={"entry_id": entry_id, "action": "update", "reason": "entry_belongs_to_other_user"}
            )
            return APIResponse.forbidden('Unauthorized access to journal entry')

        # Update entry with validation
        now = datetime.now(timezone.utc)
        update_data: Dict[str, Any] = {
            'updated_at': now
        }
        changes_made: list[str] = []

        if 'content' in data:
            content = input_sanitizer.sanitize(data['content']).strip()
            if len(content) < 3:
                return APIResponse.bad_request('Content must be at least 3 characters')
            if len(content) > 5000:
                return APIResponse.bad_request('Content must be less than 5000 characters')
            update_data['content'] = content
            changes_made.append('content')

        if 'mood' in data:
            is_valid_mood, mood_error = _validate_mood(data['mood'])
            if not is_valid_mood:
                return APIResponse.bad_request(mood_error)
            update_data['mood'] = data['mood']
            changes_made.append('mood')

        if 'tags' in data:
            tags = data['tags']
            is_valid_tags, tags_error = _validate_tags(tags)
            if not is_valid_tags:
                return APIResponse.bad_request(tags_error)
            update_data['tags'] = [input_sanitizer.sanitize(tag).strip() for tag in tags]
            changes_made.append('tags')

        entry_ref.update(update_data)

        # Audit log for journal update
        audit_log(
            event_type="JOURNAL_ENTRY_UPDATED",
            user_id=user_id,
            details={
                "entry_id": entry_id,
                "fields_updated": changes_made
            }
        )

        return APIResponse.success(
            data={
                'id': entry_id,
                'content': update_data.get('content', existing_entry_data.get('content')),
                'mood': update_data.get('mood', existing_entry_data.get('mood')),
                'tags': update_data.get('tags', existing_entry_data.get('tags', [])),
                'updatedAt': now.isoformat()
            },
            message='Journal entry updated successfully'
        )

    except Exception as e:
        logger.error(f"Failed to update journal entry: {str(e)}")
        return APIResponse.error('Failed to update journal entry')


@journal_bp.route('/<user_id>/journal/<entry_id>', methods=['DELETE'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def delete_journal_entry(user_id, entry_id):
    """Delete a journal entry"""
    try:
        current_user_id: Optional[str] = g.get('user_id')

        # Validate user_id and entry_id format
        if not _validate_user_id(user_id):
            logger.warning(f"Invalid user_id format attempted: {user_id[:50] if user_id else 'None'}")
            return APIResponse.bad_request('Invalid user ID format')

        if not _validate_entry_id(entry_id):
            logger.warning(f"Invalid entry_id format attempted: {entry_id[:50] if entry_id else 'None'}")
            return APIResponse.bad_request('Invalid entry ID format')

        # Check if user is authorized
        if user_id != current_user_id:
            audit_log(
                event_type="UNAUTHORIZED_JOURNAL_ACCESS",
                user_id=current_user_id or "unknown",
                details={"attempted_user_id": user_id, "entry_id": entry_id, "action": "delete"}
            )
            return APIResponse.forbidden('Unauthorized access')

        # Check if user exists
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return APIResponse.not_found('User not found')
        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return APIResponse.error('Service temporarily unavailable', status_code=503)

        # Check if entry exists and belongs to user
        entry_ref = db.collection('journal_entries').document(entry_id)
        entry_doc = entry_ref.get()

        if not entry_doc.exists:
            return APIResponse.not_found('Journal entry not found')

        existing_entry_data = entry_doc.to_dict()
        if existing_entry_data.get('user_id') != user_id:
            audit_log(
                event_type="UNAUTHORIZED_JOURNAL_ACCESS",
                user_id=current_user_id or "unknown",
                details={"entry_id": entry_id, "action": "delete", "reason": "entry_belongs_to_other_user"}
            )
            return APIResponse.forbidden('Unauthorized access to journal entry')

        # Delete entry
        entry_ref.delete()

        # Audit log for journal deletion
        audit_log(
            event_type="JOURNAL_ENTRY_DELETED",
            user_id=user_id,
            details={
                "entry_id": entry_id,
                "content_length": len(existing_entry_data.get('content', '')),
                "had_mood": existing_entry_data.get('mood') is not None
            }
        )

        return APIResponse.success(
            data={'id': entry_id},
            message='Journal entry deleted successfully'
        )

    except Exception as e:
        logger.error(f"Failed to delete journal entry: {str(e)}")
        return APIResponse.error('Failed to delete journal entry')