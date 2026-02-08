"""
Privacy & GDPR Compliance Routes
Real backend implementation for data export and deletion
"""

from flask import Blueprint, request, send_file, g
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.audit_service import audit_log
from src.firebase_config import db, auth
from src.utils.response_utils import APIResponse
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import logging
import json
import io
import os

# Import firebase_storage from firebase_config module
from src import firebase_config as _firebase_config
firebase_storage = getattr(_firebase_config, 'firebase_storage', None)

# Optional service imports with fallback
try:
    from google.cloud.firestore import FieldFilter
except ImportError:
    FieldFilter = None

try:
    from src.services.data_retention_service import data_retention_service
except ImportError:
    data_retention_service = None

try:
    from src.services.consent_service import consent_service
except ImportError:
    consent_service = None

try:
    from src.services.breach_notification_service import breach_notification_service
except ImportError:
    breach_notification_service = None

privacy_bp = Blueprint('privacy', __name__)
logger = logging.getLogger(__name__)


@privacy_bp.route('/settings/<user_id>', methods=['OPTIONS'])
@privacy_bp.route('/export/<user_id>', methods=['OPTIONS'])
@privacy_bp.route('/delete/<user_id>', methods=['OPTIONS'])
@privacy_bp.route('/retention/status/<user_id>', methods=['OPTIONS'])
@privacy_bp.route('/retention/cleanup/<user_id>', methods=['OPTIONS'])
@privacy_bp.route('/retention/cleanup-all', methods=['OPTIONS'])
@privacy_bp.route('/consent/<user_id>', methods=['OPTIONS'])
@privacy_bp.route('/consent/<user_id>/<consent_type>', methods=['OPTIONS'])
@privacy_bp.route('/consent/validate/<user_id>/<feature>', methods=['OPTIONS'])
@privacy_bp.route('/breach/report', methods=['OPTIONS'])
@privacy_bp.route('/breach/history', methods=['OPTIONS'])
@privacy_bp.route('/hipaa/encryption-status', methods=['OPTIONS'])
@privacy_bp.route('/gdpr/data-residency', methods=['OPTIONS'])
def handle_options(user_id: Optional[str] = None, consent_type: Optional[str] = None, feature: Optional[str] = None):
    """Handle CORS preflight requests."""
    return APIResponse.success()


@privacy_bp.route('/settings/<user_id>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_privacy_settings(user_id: str):
    """Get user's privacy settings from Firestore."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Verify user owns this data
        if current_user_id != user_id:
            logger.warning(f"❌ PRIVACY - Unauthorized: {current_user_id[:8]} != {user_id[:8]}")
            return APIResponse.forbidden("Not authorized to view other users' settings")
        
        if db is None:
            return APIResponse.error("Database connection missing", "DB_ERROR", 503)
        
        # Get privacy settings from Firestore
        user_doc = db.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            return APIResponse.not_found("User not found")
        
        user_data = user_doc.to_dict() or {}
        privacy_settings = user_data.get('privacy_settings', {
            'encryptLocalStorage': True,
            'dataRetentionDays': 365,
            'autoDeleteOldData': False,
            'allowAnalytics': True,
            'shareAnonymizedData': False
        })
        
        return APIResponse.success({
            'settings': privacy_settings
        }, "Privacy settings retrieved")
        
    except Exception as e:
        logger.exception(f"Error getting privacy settings: {e}")
        return APIResponse.error("Could not retrieve privacy settings", "FETCH_ERROR", 500)


@privacy_bp.route('/settings/<user_id>', methods=['PUT'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def update_privacy_settings(user_id: str):
    """Update user's privacy settings in Firestore."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Verify user owns this data
        if current_user_id != user_id:
            logger.warning(f"❌ PRIVACY - Unauthorized update: {current_user_id[:8]} != {user_id[:8]}")
            return APIResponse.forbidden("Not authorized to modify other users' settings")
        
        if db is None:
            return APIResponse.error("Database connection missing", "DB_ERROR", 503)
        
        data = request.get_json(silent=True) or {}
        settings = data.get('settings', {})
        
        # Validate settings
        allowed_keys = [
            'encryptLocalStorage',
            'dataRetentionDays',
            'autoDeleteOldData',
            'allowAnalytics',
            'shareAnonymizedData'
        ]
        
        validated_settings = {
            k: v for k, v in settings.items() 
            if k in allowed_keys
        }
        
        # Update in Firestore
        db.collection('users').document(user_id).update({
            'privacy_settings': validated_settings,
            'updated_at': datetime.now(timezone.utc)
        })
        
        logger.info(f"✅ Privacy settings updated for user {user_id[:8]}")
        audit_log('privacy_settings_updated', user_id, validated_settings)
        
        return APIResponse.success({
            'settings': validated_settings
        }, "Privacy settings updated")
        
    except Exception as e:
        logger.exception(f"Error updating privacy settings: {e}")
        return APIResponse.error("Could not update privacy settings", "UPDATE_ERROR", 500)


@privacy_bp.route('/export/<user_id>', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def export_user_data(user_id: str):
    """Export ALL user data (GDPR compliance)."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Verify user owns this data
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized to export other users' data")
        
        if db is None:
            return APIResponse.error("Database connection missing", "DB_ERROR", 503)
        
        logger.info(f"📦 Starting data export for user {user_id[:8]}")
        
        # Collect all user data from Firestore
        export_data: Dict[str, Any] = {
            'exportMetadata': {
                'userId': user_id,
                'exportDate': datetime.now(timezone.utc).isoformat(),
                'exportVersion': '1.0',
                'dataFormat': 'JSON'
            }
        }
        
        # 1. User Profile
        user_doc = db.collection('users').document(user_id).get()
        if user_doc.exists:
            export_data['userProfile'] = user_doc.to_dict() or {}
            logger.info(f"  ✓ User profile collected")
        
        # 2. Mood Entries
        moods_ref = db.collection('users').document(user_id).collection('moods')
        moods = [{**(doc.to_dict() or {}), 'id': doc.id} for doc in moods_ref.stream()]
        export_data['moods'] = moods
        logger.info(f"  ✓ {len(moods)} mood entries collected")
        
        # 3. Memories/Journal Entries
        memories_ref = db.collection('users').document(user_id).collection('memories')
        memories = [{**(doc.to_dict() or {}), 'id': doc.id} for doc in memories_ref.stream()]
        export_data['memories'] = memories
        logger.info(f"  ✓ {len(memories)} memories collected")
        
        # 4. Chat Sessions (AI conversations)
        chat_sessions_ref = db.collection('users').document(user_id).collection('chat_sessions')
        chat_sessions = [{**(doc.to_dict() or {}), 'id': doc.id} for doc in chat_sessions_ref.stream()]
        export_data['chatSessions'] = chat_sessions
        logger.info(f"  ✓ {len(chat_sessions)} chat sessions collected")
        
        # 5. Feedback Submissions
        if FieldFilter is not None:
            feedback_query = db.collection('feedback').where(filter=FieldFilter('user_id', '==', user_id))
        else:
            feedback_query = db.collection('feedback').where('user_id', '==', user_id)
        feedback = [{**(doc.to_dict() or {}), 'id': doc.id} for doc in feedback_query.stream()]
        export_data['feedback'] = feedback
        logger.info(f"  ✓ {len(feedback)} feedback entries collected")
        
        # 6. Achievements/Rewards
        achievements_ref = db.collection('users').document(user_id).collection('achievements')
        achievements = [{**(doc.to_dict() or {}), 'id': doc.id} for doc in achievements_ref.stream()]
        export_data['achievements'] = achievements
        logger.info(f"  ✓ {len(achievements)} achievements collected")
        
        # 7. Referral Data (if any)
        if FieldFilter is not None:
            referral_query = db.collection('referrals').where(filter=FieldFilter('referrer_id', '==', user_id))
        else:
            referral_query = db.collection('referrals').where('referrer_id', '==', user_id)
        referrals = [{**(doc.to_dict() or {}), 'id': doc.id} for doc in referral_query.stream()]
        export_data['referrals'] = referrals
        logger.info(f"  ✓ {len(referrals)} referrals collected")

        # 8. AI Conversations (separate from chat_sessions)
        ai_conversations_ref = db.collection('users').document(user_id).collection('ai_conversations')
        ai_conversations = [{**(doc.to_dict() or {}), 'id': doc.id} for doc in ai_conversations_ref.stream()]
        export_data['aiConversations'] = ai_conversations
        logger.info(f"  ✓ {len(ai_conversations)} AI conversations collected")

        # 9. Journal Entries
        journal_ref = db.collection('users').document(user_id).collection('journal_entries')
        journal_entries = [{**(doc.to_dict() or {}), 'id': doc.id} for doc in journal_ref.stream()]
        export_data['journalEntries'] = journal_entries
        logger.info(f"  ✓ {len(journal_entries)} journal entries collected")

        # 10. Wellness Activities
        wellness_ref = db.collection('users').document(user_id).collection('wellness_activities')
        wellness_activities = [{**(doc.to_dict() or {}), 'id': doc.id} for doc in wellness_ref.stream()]
        export_data['wellnessActivities'] = wellness_activities
        logger.info(f"  ✓ {len(wellness_activities)} wellness activities collected")

        # 11. Notifications
        notifications_ref = db.collection('users').document(user_id).collection('notifications')
        notifications = [{**(doc.to_dict() or {}), 'id': doc.id} for doc in notifications_ref.stream()]
        export_data['notifications'] = notifications
        logger.info(f"  ✓ {len(notifications)} notifications collected")

        # 12. Subscription Data
        subscription_doc = db.collection('subscriptions').document(user_id).get()
        if subscription_doc.exists:
            export_data['subscription'] = subscription_doc.to_dict() or {}
            logger.info(f"  ✓ Subscription data collected")
        
        # Create JSON file
        json_data = json.dumps(export_data, indent=2, default=str, ensure_ascii=False)
        
        # Create in-memory file
        file_buffer = io.BytesIO()
        file_buffer.write(json_data.encode('utf-8'))
        file_buffer.seek(0)
        
        # Generate filename
        export_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        filename = f"lugn-trygg-data-{export_date}.json"
        
        logger.info(f"✅ Data export completed for user {user_id[:8]} - {len(json_data)} bytes")
        audit_log('data_exported', user_id, {'size_bytes': len(json_data)})
        
        # Return file for download
        return send_file(
            file_buffer,
            mimetype='application/json',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.exception(f"Error exporting user data: {e}")
        return APIResponse.error("Could not export data", "EXPORT_ERROR", 500)


@privacy_bp.route('/delete/<user_id>', methods=['DELETE'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def delete_user_data(user_id: str):
    """Delete ALL user data permanently (GDPR compliance)."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Verify user owns this data
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized to delete other users' data")
        
        # Require confirmation parameter
        confirmation = request.args.get('confirm', '').lower()
        if confirmation != 'delete my data':
            return APIResponse.bad_request(
                "Confirmation required. Add: ?confirm=delete my data",
                "CONFIRMATION_REQUIRED"
            )
        
        if db is None:
            return APIResponse.error("Database connection missing", "DB_ERROR", 503)
        
        logger.warning(f"🗑️  Starting PERMANENT data deletion for user {user_id[:8]}")
        
        deletion_summary = {
            'userId': user_id,
            'deletionDate': datetime.now(timezone.utc).isoformat(),
            'deletedCollections': []
        }
        
        # 1. Delete Mood Entries
        moods_ref = db.collection('users').document(user_id).collection('moods')
        deleted_moods = _delete_collection(moods_ref, batch_size=50)
        deletion_summary['deletedCollections'].append({
            'collection': 'moods',
            'count': deleted_moods
        })
        logger.info(f"  ✓ Deleted {deleted_moods} mood entries")
        
        # 2. Delete Memories
        memories_ref = db.collection('users').document(user_id).collection('memories')
        deleted_memories = _delete_collection(memories_ref, batch_size=50)
        deletion_summary['deletedCollections'].append({
            'collection': 'memories',
            'count': deleted_memories
        })
        logger.info(f"  ✓ Deleted {deleted_memories} memories")
        
        # 3. Delete Chat Sessions
        chat_ref = db.collection('users').document(user_id).collection('chat_sessions')
        deleted_chats = _delete_collection(chat_ref, batch_size=50)
        deletion_summary['deletedCollections'].append({
            'collection': 'chat_sessions',
            'count': deleted_chats
        })
        logger.info(f"  ✓ Deleted {deleted_chats} chat sessions")
        
        # 4. Delete Achievements
        achievements_ref = db.collection('users').document(user_id).collection('achievements')
        deleted_achievements = _delete_collection(achievements_ref, batch_size=50)
        deletion_summary['deletedCollections'].append({
            'collection': 'achievements',
            'count': deleted_achievements
        })
        logger.info(f"  ✓ Deleted {deleted_achievements} achievements")
        
        # 5. Delete Feedback
        if FieldFilter is not None:
            feedback_query = db.collection('feedback').where(filter=FieldFilter('user_id', '==', user_id))
        else:
            feedback_query = db.collection('feedback').where('user_id', '==', user_id)
        feedback_docs = list(feedback_query.stream())
        for doc in feedback_docs:
            doc.reference.delete()
        deletion_summary['deletedCollections'].append({
            'collection': 'feedback',
            'count': len(feedback_docs)
        })
        logger.info(f"  ✓ Deleted {len(feedback_docs)} feedback entries")
        
        # 6. Delete Referrals
        if FieldFilter is not None:
            referral_query = db.collection('referrals').where(filter=FieldFilter('referrer_id', '==', user_id))
        else:
            referral_query = db.collection('referrals').where('referrer_id', '==', user_id)
        referral_docs = list(referral_query.stream())
        for doc in referral_docs:
            doc.reference.delete()
        deletion_summary['deletedCollections'].append({
            'collection': 'referrals',
            'count': len(referral_docs)
        })
        logger.info(f"  ✓ Deleted {len(referral_docs)} referrals")

        # 7. Delete AI Conversations
        ai_conversations_ref = db.collection('users').document(user_id).collection('ai_conversations')
        deleted_ai_conversations = _delete_collection(ai_conversations_ref, batch_size=50)
        deletion_summary['deletedCollections'].append({
            'collection': 'ai_conversations',
            'count': deleted_ai_conversations
        })
        logger.info(f"  ✓ Deleted {deleted_ai_conversations} AI conversations")

        # 8. Delete Journal Entries
        journal_ref = db.collection('users').document(user_id).collection('journal_entries')
        deleted_journal = _delete_collection(journal_ref, batch_size=50)
        deletion_summary['deletedCollections'].append({
            'collection': 'journal_entries',
            'count': deleted_journal
        })
        logger.info(f"  ✓ Deleted {deleted_journal} journal entries")

        # 9. Delete Wellness Activities
        wellness_ref = db.collection('users').document(user_id).collection('wellness_activities')
        deleted_wellness = _delete_collection(wellness_ref, batch_size=50)
        deletion_summary['deletedCollections'].append({
            'collection': 'wellness_activities',
            'count': deleted_wellness
        })
        logger.info(f"  ✓ Deleted {deleted_wellness} wellness activities")

        # 10. Delete Notifications
        notifications_ref = db.collection('users').document(user_id).collection('notifications')
        deleted_notifications = _delete_collection(notifications_ref, batch_size=50)
        deletion_summary['deletedCollections'].append({
            'collection': 'notifications',
            'count': deleted_notifications
        })
        logger.info(f"  ✓ Deleted {deleted_notifications} notifications")

        # 11. Delete Subscription
        subscription_doc = db.collection('subscriptions').document(user_id)
        if subscription_doc.get().exists:
            subscription_doc.delete()
            deletion_summary['deletedCollections'].append({
                'collection': 'subscriptions',
                'count': 1
            })
            logger.info(f"  ✓ Deleted subscription")
        
        # 12. Delete User Profile (LAST)
        db.collection('users').document(user_id).delete()
        logger.info(f"  ✓ Deleted user profile")
        
        # 13. Delete Firebase Auth Account
        try:
            if auth is not None:
                auth.delete_user(user_id)
                logger.info(f"  ✓ Deleted Firebase Auth account")
        except Exception as auth_error:
            logger.error(f"  ⚠️  Failed to delete Firebase Auth: {auth_error}")
        
        # Log audit event
        audit_log('account_permanently_deleted', user_id, deletion_summary)
        
        logger.warning(f"✅ PERMANENT deletion completed for user {user_id[:8]}")
        
        return APIResponse.success({
            'summary': deletion_summary
        }, "All your data has been permanently deleted")
        
    except Exception as e:
        logger.exception(f"Error deleting user data: {e}")
        return APIResponse.error("Could not delete data", "DELETE_ERROR", 500)


def _delete_collection(collection_ref, batch_size: int = 50) -> int:
    """Helper to delete all documents in a collection in batches"""
    deleted = 0
    
    while True:
        # Get batch of documents
        docs = list(collection_ref.limit(batch_size).stream())
        
        if not docs:
            break
        
        # Delete batch
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()
        
        deleted += len(docs)
        
        # If batch was smaller than limit, we're done
        if len(docs) < batch_size:
            break
    
    return deleted


@privacy_bp.route('/retention/status/<user_id>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_retention_status(user_id: str):
    """Get data retention status for a user."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Verify user owns this data
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized")

        if data_retention_service is None:
            return APIResponse.error("Data retention service unavailable", "SERVICE_UNAVAILABLE", 503)

        status = data_retention_service.get_retention_status(user_id)

        return APIResponse.success(status, "Retention status retrieved")

    except Exception as e:
        logger.exception(f"Error getting retention status: {e}")
        return APIResponse.error("Could not retrieve retention status", "FETCH_ERROR", 500)


@privacy_bp.route('/retention/cleanup/<user_id>', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def manual_retention_cleanup(user_id: str):
    """Manually trigger data retention cleanup for a user."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Verify user owns this data
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized")

        if data_retention_service is None:
            return APIResponse.error("Data retention service unavailable", "SERVICE_UNAVAILABLE", 503)

        result = data_retention_service.apply_retention_policy(user_id)
        audit_log('manual_retention_cleanup', user_id, result)

        return APIResponse.success(result, "Retention policy applied")

    except Exception as e:
        logger.exception(f"Error during manual retention cleanup: {e}")
        return APIResponse.error("Could not perform retention cleanup", "CLEANUP_ERROR", 500)


@privacy_bp.route('/retention/cleanup-all', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def system_retention_cleanup():
    """System-wide data retention cleanup (admin only)."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Admin role check - verify user is admin
        user_doc = db.collection('users').document(current_user_id).get()  # type: ignore
        if not user_doc.exists or user_doc.to_dict().get('role') != 'admin':
            return APIResponse.forbidden("Admin privileges required")
        
        if data_retention_service is None:
            return APIResponse.error("Data retention service unavailable", "SERVICE_UNAVAILABLE", 503)

        result = data_retention_service.apply_retention_policy()
        audit_log('system_retention_cleanup', current_user_id, result)

        return APIResponse.success(result, "System retention cleanup completed")

    except Exception as e:
        logger.exception(f"Error during system retention cleanup: {e}")
        return APIResponse.error("Could not perform system retention cleanup", "CLEANUP_ERROR", 500)


@privacy_bp.route('/consent/<user_id>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_consents(user_id: str):
    """Get all consent records for a user."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Verify user owns this data
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized")

        if consent_service is None:
            return APIResponse.error("Consent service unavailable", "SERVICE_UNAVAILABLE", 503)

        consents = consent_service.get_user_consents(user_id)

        return APIResponse.success(consents, "Consents retrieved")

    except Exception as e:
        logger.exception(f"Error getting user consents: {e}")
        return APIResponse.error("Could not retrieve consents", "FETCH_ERROR", 500)


@privacy_bp.route('/consent/<user_id>/<consent_type>', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def grant_consent(user_id: str, consent_type: str):
    """Grant consent for a specific type."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Verify user owns this data
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized")

        data = request.get_json(silent=True) or {}
        version = data.get('version', '1.0')

        if consent_service is None:
            return APIResponse.error("Consent service unavailable", "SERVICE_UNAVAILABLE", 503)

        success = consent_service.grant_consent(user_id, consent_type, version)

        if success:
            audit_log('consent_granted', user_id, {'consent_type': consent_type, 'version': version})
            return APIResponse.success({
                'consentType': consent_type,
                'grantedAt': datetime.now(timezone.utc).isoformat()
            }, f"Consent granted for {consent_type}")
        else:
            return APIResponse.bad_request("Could not grant consent", "GRANT_FAILED")

    except Exception as e:
        logger.exception(f"Error granting consent: {e}")
        return APIResponse.error("Could not grant consent", "GRANT_ERROR", 500)


@privacy_bp.route('/consent/<user_id>/<consent_type>', methods=['DELETE'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def withdraw_consent(user_id: str, consent_type: str):
    """Withdraw consent for a specific type."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Verify user owns this data
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized")

        if consent_service is None:
            return APIResponse.error("Consent service unavailable", "SERVICE_UNAVAILABLE", 503)

        success = consent_service.withdraw_consent(user_id, consent_type)

        if success:
            audit_log('consent_withdrawn', user_id, {'consent_type': consent_type})
            return APIResponse.success({
                'consentType': consent_type,
                'withdrawnAt': datetime.now(timezone.utc).isoformat()
            }, f"Consent withdrawn for {consent_type}")
        else:
            return APIResponse.bad_request("Could not withdraw consent", "WITHDRAW_FAILED")

    except Exception as e:
        logger.exception(f"Error withdrawing consent: {e}")
        return APIResponse.error("Could not withdraw consent", "WITHDRAW_ERROR", 500)


@privacy_bp.route('/consent/validate/<user_id>/<feature>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def validate_feature_access(user_id: str, feature: str):
    """Validate if user has required consents for a feature."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Verify user owns this data
        if current_user_id != user_id:
            return APIResponse.forbidden("Not authorized")

        if consent_service is None:
            return APIResponse.error("Consent service unavailable", "SERVICE_UNAVAILABLE", 503)

        validation = consent_service.validate_feature_access(user_id, feature)

        return APIResponse.success(validation, "Feature access validated")

    except Exception as e:
        logger.exception(f"Error validating feature access: {e}")
        return APIResponse.error("Could not validate feature access", "VALIDATION_ERROR", 500)


@privacy_bp.route('/breach/report', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def report_potential_breach():
    """Report a potential data breach for HIPAA compliance."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        data = request.get_json(silent=True) or {}

        incident_details = {
            'reported_by': current_user_id,
            'incident_type': data.get('incident_type', 'unknown'),
            'description': data.get('description', ''),
            'affected_users': data.get('affected_users', 0),
            'data_types': data.get('data_types', []),
            'breach_type': data.get('breach_type', 'unknown'),
            'detected_at': data.get('detected_at', datetime.now(timezone.utc).isoformat()),
            'reported_at': datetime.now(timezone.utc).isoformat()
        }

        if breach_notification_service is None:
            return APIResponse.error("Breach notification service unavailable", "SERVICE_UNAVAILABLE", 503)

        assessment = breach_notification_service.detect_potential_breach(incident_details)
        audit_log('potential_breach_reported', current_user_id, incident_details)

        return APIResponse.success({
            'assessment': assessment,
            'reported': True,
            'breachId': assessment.get('breach_id', 'N/A')
        }, "Potential incident reported")

    except Exception as e:
        logger.exception(f"Error reporting breach: {e}")
        return APIResponse.error("Could not report incident", "REPORT_ERROR", 500)


@privacy_bp.route('/breach/history', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_breach_history():
    """Get breach notification history (admin only)."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        # Admin role check - verify user is admin
        user_doc = db.collection('users').document(current_user_id).get()  # type: ignore
        if not user_doc.exists or user_doc.to_dict().get('role') != 'admin':
            return APIResponse.forbidden("Admin privileges required")
        
        limit = min(int(request.args.get('limit', 50)), 100)  # Cap at 100

        if breach_notification_service is None:
            return APIResponse.error("Breach notification service unavailable", "SERVICE_UNAVAILABLE", 503)

        history = breach_notification_service.get_breach_history(limit)

        return APIResponse.success({
            'breachHistory': history,
            'totalCount': len(history)
        }, "Incident history retrieved")

    except ValueError:
        return APIResponse.bad_request("Invalid value for limit", "INVALID_LIMIT")
    except Exception as e:
        logger.exception(f"Error getting breach history: {e}")
        return APIResponse.error("Could not retrieve incident history", "FETCH_ERROR", 500)


@privacy_bp.route('/hipaa/encryption-status', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_encryption_status():
    """Check HIPAA encryption compliance status."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        
        if breach_notification_service is None:
            return APIResponse.error("Breach notification service unavailable", "SERVICE_UNAVAILABLE", 503)

        status = breach_notification_service.validate_encryption_compliance()

        return APIResponse.success(status, "Encryption status retrieved")

    except Exception as e:
        logger.exception(f"Error checking encryption status: {e}")
        return APIResponse.error("Could not check encryption status", "CHECK_ERROR", 500)


@privacy_bp.route('/gdpr/data-residency', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_data_residency_status():
    """Check GDPR data residency compliance status."""
    try:
        current_user_id = g.get('user_id')
        if not current_user_id:
            return APIResponse.unauthorized("Authentication required")
        # Check Firebase configuration for EU residency
        project_id = os.getenv("FIREBASE_PROJECT_ID_EU", os.getenv("FIREBASE_PROJECT_ID", "unknown"))
        database_url = os.getenv("FIREBASE_DATABASE_URL", "")
        storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET", "")

        eu_compliant = {
            'projectInEu': 'europe-west' in project_id or project_id.endswith('-eu'),
            'databaseInEu': 'europe-west' in database_url,
            'storageInEu': 'europe-west' in storage_bucket,
            'overallCompliant': False
        }

        eu_compliant['overallCompliant'] = all([
            eu_compliant['projectInEu'],
            eu_compliant['databaseInEu'],
            eu_compliant['storageInEu']
        ])

        status = {
            'gdprDataResidency': {
                'compliant': eu_compliant['overallCompliant'],
                'projectId': project_id,
                'databaseUrl': database_url,
                'storageBucket': storage_bucket,
                'details': eu_compliant
            },
            'recommendations': []
        }

        if not eu_compliant['overallCompliant']:
            status['recommendations'] = [
                "Set FIREBASE_PROJECT_ID_EU environment variable to EU project",
                "Ensure FIREBASE_DATABASE_URL contains 'europe-west' region",
                "Ensure FIREBASE_STORAGE_BUCKET contains 'europe-west' region"
            ]

        return APIResponse.success(status, "Data residency status retrieved")

    except Exception as e:
        logger.exception(f"Error checking data residency status: {e}")
        return APIResponse.error("Could not check data residency status", "CHECK_ERROR", 500)
