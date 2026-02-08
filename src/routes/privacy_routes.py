"""
Privacy & GDPR Compliance Routes
Real backend implementation for data export and deletion
"""

from flask import Blueprint, request, jsonify, send_file
from ..services.auth_service import AuthService
from ..firebase_config import db, auth, firebase_storage as storage
from datetime import datetime, timezone
import logging
import json
import io
from typing import Dict, List, Any

privacy_bp = Blueprint('privacy', __name__)
logger = logging.getLogger(__name__)


@privacy_bp.route('/settings/<user_id>', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
def get_privacy_settings(user_id: str):
    """Get user's privacy settings from Firestore"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Verify user owns this data
        from flask import g
        logger.info(f"🔒 PRIVACY - GET settings: user_id={user_id}, g.user_id={g.user_id}")
        if g.user_id != user_id:
            logger.warning(f"❌ PRIVACY - Unauthorized: {g.user_id} != {user_id}")
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get privacy settings from Firestore
        user_doc = db.collection('users').document(user_id).get()
        logger.info(f"📄 PRIVACY - User doc exists: {user_doc.exists}")
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        privacy_settings = user_data.get('privacy_settings', {
            'encryptLocalStorage': True,
            'dataRetentionDays': 365,
            'autoDeleteOldData': False,
            'allowAnalytics': True,
            'shareAnonymizedData': False
        })
        
        return jsonify({
            'settings': privacy_settings
        }), 200
        
    except Exception as e:
        logger.exception(f"Error getting privacy settings: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/settings/<user_id>', methods=['PUT', 'OPTIONS'])
@AuthService.jwt_required
def update_privacy_settings(user_id: str):
    """Update user's privacy settings in Firestore"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Verify user owns this data
        from flask import g
        logger.info(f"🔒 PRIVACY - UPDATE settings: user_id={user_id}, g.user_id={g.user_id}")
        if g.user_id != user_id:
            logger.warning(f"❌ PRIVACY - Unauthorized: {g.user_id} != {user_id}")
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        settings = data.get('settings', {})
        logger.info(f"⚙️ PRIVACY - New settings: {settings}")
        
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
        
        logger.info(f"✅ Privacy settings updated for user {user_id}")
        
        return jsonify({
            'message': 'Privacy settings updated successfully',
            'settings': validated_settings
        }), 200
        
    except Exception as e:
        logger.exception(f"Error updating privacy settings: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/export/<user_id>', methods=['POST'])
@AuthService.jwt_required
def export_user_data(user_id: str):
    """Export ALL user data (GDPR compliance)"""
    try:
        # Verify user owns this data
        from flask import g
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        logger.info(f"📦 Starting data export for user {user_id}")
        
        # Collect all user data from Firestore
        export_data: Dict[str, Any] = {
            'export_metadata': {
                'user_id': user_id,
                'export_date': datetime.now(timezone.utc).isoformat(),
                'export_version': '1.0',
                'data_format': 'JSON'
            }
        }
        
        # 1. User Profile
        user_doc = db.collection('users').document(user_id).get()
        if user_doc.exists:
            export_data['user_profile'] = user_doc.to_dict()
            logger.info(f"  ✓ User profile collected")
        
        # 2. Mood Entries
        moods_ref = db.collection('users').document(user_id).collection('moods')
        moods = [{**doc.to_dict(), 'id': doc.id} for doc in moods_ref.stream()]
        export_data['moods'] = moods
        logger.info(f"  ✓ {len(moods)} mood entries collected")
        
        # 3. Memories/Journal Entries
        memories_ref = db.collection('users').document(user_id).collection('memories')
        memories = [{**doc.to_dict(), 'id': doc.id} for doc in memories_ref.stream()]
        export_data['memories'] = memories
        logger.info(f"  ✓ {len(memories)} memories collected")
        
        # 4. Chat Sessions (AI conversations)
        chat_sessions_ref = db.collection('users').document(user_id).collection('chat_sessions')
        chat_sessions = [{**doc.to_dict(), 'id': doc.id} for doc in chat_sessions_ref.stream()]
        export_data['chat_sessions'] = chat_sessions
        logger.info(f"  ✓ {len(chat_sessions)} chat sessions collected")
        
        # 5. Feedback Submissions
        # CRITICAL FIX: Use FieldFilter to avoid positional argument warning
        from google.cloud.firestore import FieldFilter
        feedback_query = db.collection('feedback').where(filter=FieldFilter('user_id', '==', user_id))
        feedback = [{**doc.to_dict(), 'id': doc.id} for doc in feedback_query.stream()]
        export_data['feedback'] = feedback
        logger.info(f"  ✓ {len(feedback)} feedback entries collected")
        
        # 6. Achievements/Rewards
        achievements_ref = db.collection('users').document(user_id).collection('achievements')
        achievements = [{**doc.to_dict(), 'id': doc.id} for doc in achievements_ref.stream()]
        export_data['achievements'] = achievements
        logger.info(f"  ✓ {len(achievements)} achievements collected")
        
        # 7. Referral Data (if any)
        referral_query = db.collection('referrals').where(filter=FieldFilter('referrer_id', '==', user_id))
        referrals = [{**doc.to_dict(), 'id': doc.id} for doc in referral_query.stream()]
        export_data['referrals'] = referrals
        logger.info(f"  ✓ {len(referrals)} referrals collected")

        # 8. AI Conversations (separate from chat_sessions)
        ai_conversations_ref = db.collection('users').document(user_id).collection('ai_conversations')
        ai_conversations = [{**doc.to_dict(), 'id': doc.id} for doc in ai_conversations_ref.stream()]
        export_data['ai_conversations'] = ai_conversations
        logger.info(f"  ✓ {len(ai_conversations)} AI conversations collected")

        # 9. Journal Entries
        journal_ref = db.collection('users').document(user_id).collection('journal_entries')
        journal_entries = [{**doc.to_dict(), 'id': doc.id} for doc in journal_ref.stream()]
        export_data['journal_entries'] = journal_entries
        logger.info(f"  ✓ {len(journal_entries)} journal entries collected")

        # 10. Wellness Activities
        wellness_ref = db.collection('users').document(user_id).collection('wellness_activities')
        wellness_activities = [{**doc.to_dict(), 'id': doc.id} for doc in wellness_ref.stream()]
        export_data['wellness_activities'] = wellness_activities
        logger.info(f"  ✓ {len(wellness_activities)} wellness activities collected")

        # 11. Notifications
        notifications_ref = db.collection('users').document(user_id).collection('notifications')
        notifications = [{**doc.to_dict(), 'id': doc.id} for doc in notifications_ref.stream()]
        export_data['notifications'] = notifications
        logger.info(f"  ✓ {len(notifications)} notifications collected")

        # 12. Subscription Data
        subscription_doc = db.collection('subscriptions').document(user_id).get()
        if subscription_doc.exists:
            export_data['subscription'] = subscription_doc.to_dict()
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
        
        logger.info(f"✅ Data export completed for user {user_id} - {len(json_data)} bytes")
        
        # Return file for download
        return send_file(
            file_buffer,
            mimetype='application/json',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.exception(f"Error exporting user data: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/delete/<user_id>', methods=['DELETE'])
@AuthService.jwt_required
def delete_user_data(user_id: str):
    """Delete ALL user data permanently (GDPR compliance)"""
    try:
        # Verify user owns this data
        from flask import g
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Require confirmation parameter
        confirmation = request.args.get('confirm', '').lower()
        if confirmation != 'delete my data':
            return jsonify({
                'error': 'Confirmation required',
                'message': 'Add query parameter: ?confirm=delete my data'
            }), 400
        
        logger.warning(f"🗑️  Starting PERMANENT data deletion for user {user_id}")
        
        deletion_summary = {
            'user_id': user_id,
            'deletion_date': datetime.now(timezone.utc).isoformat(),
            'deleted_collections': []
        }
        
        # 1. Delete Mood Entries
        moods_ref = db.collection('users').document(user_id).collection('moods')
        deleted_moods = _delete_collection(moods_ref, batch_size=50)
        deletion_summary['deleted_collections'].append({
            'collection': 'moods',
            'count': deleted_moods
        })
        logger.info(f"  ✓ Deleted {deleted_moods} mood entries")
        
        # 2. Delete Memories
        memories_ref = db.collection('users').document(user_id).collection('memories')
        deleted_memories = _delete_collection(memories_ref, batch_size=50)
        deletion_summary['deleted_collections'].append({
            'collection': 'memories',
            'count': deleted_memories
        })
        logger.info(f"  ✓ Deleted {deleted_memories} memories")
        
        # 3. Delete Chat Sessions
        chat_ref = db.collection('users').document(user_id).collection('chat_sessions')
        deleted_chats = _delete_collection(chat_ref, batch_size=50)
        deletion_summary['deleted_collections'].append({
            'collection': 'chat_sessions',
            'count': deleted_chats
        })
        logger.info(f"  ✓ Deleted {deleted_chats} chat sessions")
        
        # 4. Delete Achievements
        achievements_ref = db.collection('users').document(user_id).collection('achievements')
        deleted_achievements = _delete_collection(achievements_ref, batch_size=50)
        deletion_summary['deleted_collections'].append({
            'collection': 'achievements',
            'count': deleted_achievements
        })
        logger.info(f"  ✓ Deleted {deleted_achievements} achievements")
        
        # 5. Delete Feedback
        # CRITICAL FIX: Use FieldFilter to avoid positional argument warning
        from google.cloud.firestore import FieldFilter
        feedback_query = db.collection('feedback').where(filter=FieldFilter('user_id', '==', user_id))
        feedback_docs = list(feedback_query.stream())
        for doc in feedback_docs:
            doc.reference.delete()
        deletion_summary['deleted_collections'].append({
            'collection': 'feedback',
            'count': len(feedback_docs)
        })
        logger.info(f"  ✓ Deleted {len(feedback_docs)} feedback entries")
        
        # 6. Delete Referrals
        referral_query = db.collection('referrals').where(filter=FieldFilter('referrer_id', '==', user_id))
        referral_docs = list(referral_query.stream())
        for doc in referral_docs:
            doc.reference.delete()
        deletion_summary['deleted_collections'].append({
            'collection': 'referrals',
            'count': len(referral_docs)
        })
        logger.info(f"  ✓ Deleted {len(referral_docs)} referrals")

        # 7. Delete AI Conversations
        ai_conversations_ref = db.collection('users').document(user_id).collection('ai_conversations')
        deleted_ai_conversations = _delete_collection(ai_conversations_ref, batch_size=50)
        deletion_summary['deleted_collections'].append({
            'collection': 'ai_conversations',
            'count': deleted_ai_conversations
        })
        logger.info(f"  ✓ Deleted {deleted_ai_conversations} AI conversations")

        # 8. Delete Journal Entries
        journal_ref = db.collection('users').document(user_id).collection('journal_entries')
        deleted_journal = _delete_collection(journal_ref, batch_size=50)
        deletion_summary['deleted_collections'].append({
            'collection': 'journal_entries',
            'count': deleted_journal
        })
        logger.info(f"  ✓ Deleted {deleted_journal} journal entries")

        # 9. Delete Wellness Activities
        wellness_ref = db.collection('users').document(user_id).collection('wellness_activities')
        deleted_wellness = _delete_collection(wellness_ref, batch_size=50)
        deletion_summary['deleted_collections'].append({
            'collection': 'wellness_activities',
            'count': deleted_wellness
        })
        logger.info(f"  ✓ Deleted {deleted_wellness} wellness activities")

        # 10. Delete Notifications
        notifications_ref = db.collection('users').document(user_id).collection('notifications')
        deleted_notifications = _delete_collection(notifications_ref, batch_size=50)
        deletion_summary['deleted_collections'].append({
            'collection': 'notifications',
            'count': deleted_notifications
        })
        logger.info(f"  ✓ Deleted {deleted_notifications} notifications")

        # 11. Delete Subscription
        subscription_doc = db.collection('subscriptions').document(user_id)
        if subscription_doc.get().exists:
            subscription_doc.delete()
            deletion_summary['deleted_collections'].append({
                'collection': 'subscriptions',
                'count': 1
            })
            logger.info(f"  ✓ Deleted subscription")
        
        # 8. Delete User Profile (LAST)
        db.collection('users').document(user_id).delete()
        logger.info(f"  ✓ Deleted user profile")
        
        # 9. Delete Firebase Auth Account
        try:
            auth.delete_user(user_id)
            logger.info(f"  ✓ Deleted Firebase Auth account")
        except Exception as auth_error:
            logger.error(f"  ⚠️  Failed to delete Firebase Auth: {auth_error}")
        
        # Log audit event
        from ..services.audit_service import audit_log
        audit_log('account_permanently_deleted', user_id, deletion_summary)
        
        logger.warning(f"✅ PERMANENT deletion completed for user {user_id}")
        
        return jsonify({
            'message': 'All your data has been permanently deleted',
            'summary': deletion_summary
        }), 200
        
    except Exception as e:
        logger.exception(f"Error deleting user data: {e}")
        return jsonify({'error': 'Internal server error'}), 500


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
def get_retention_status(user_id: str):
    """Get data retention status for a user"""
    try:
        # Verify user owns this data
        from flask import g
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        from ..services.data_retention_service import data_retention_service
        status = data_retention_service.get_retention_status(user_id)

        return jsonify(status), 200

    except Exception as e:
        logger.exception(f"Error getting retention status: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/retention/cleanup/<user_id>', methods=['POST'])
@AuthService.jwt_required
def manual_retention_cleanup(user_id: str):
    """Manually trigger data retention cleanup for a user"""
    try:
        # Verify user owns this data
        from flask import g
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        from ..services.data_retention_service import data_retention_service
        result = data_retention_service.apply_retention_policy(user_id)

        return jsonify(result), 200

    except Exception as e:
        logger.exception(f"Error during manual retention cleanup: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/retention/cleanup-all', methods=['POST'])
@AuthService.jwt_required
def system_retention_cleanup():
    """System-wide data retention cleanup (admin only)"""
    try:
        # TODO: Add admin role check
        from flask import g
        # For now, allow any authenticated user (should be restricted to admins)

        from ..services.data_retention_service import data_retention_service
        result = data_retention_service.apply_retention_policy()

        return jsonify(result), 200

    except Exception as e:
        logger.exception(f"Error during system retention cleanup: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/consent/<user_id>', methods=['GET'])
@AuthService.jwt_required
def get_user_consents(user_id: str):
    """Get all consent records for a user"""
    try:
        # Verify user owns this data
        from flask import g
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        from ..services.consent_service import consent_service
        consents = consent_service.get_user_consents(user_id)

        return jsonify(consents), 200

    except Exception as e:
        logger.exception(f"Error getting user consents: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/consent/<user_id>/<consent_type>', methods=['POST'])
@AuthService.jwt_required
def grant_consent(user_id: str, consent_type: str):
    """Grant consent for a specific type"""
    try:
        # Verify user owns this data
        from flask import g
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json() or {}
        version = data.get('version')

        from ..services.consent_service import consent_service
        success = consent_service.grant_consent(user_id, consent_type, version)

        if success:
            return jsonify({
                'message': f'Consent granted for {consent_type}',
                'consent_type': consent_type,
                'granted_at': datetime.now(timezone.utc).isoformat()
            }), 200
        else:
            return jsonify({'error': 'Failed to grant consent'}), 400

    except Exception as e:
        logger.exception(f"Error granting consent: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/consent/<user_id>/<consent_type>', methods=['DELETE'])
@AuthService.jwt_required
def withdraw_consent(user_id: str, consent_type: str):
    """Withdraw consent for a specific type"""
    try:
        # Verify user owns this data
        from flask import g
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        from ..services.consent_service import consent_service
        success = consent_service.withdraw_consent(user_id, consent_type)

        if success:
            return jsonify({
                'message': f'Consent withdrawn for {consent_type}',
                'consent_type': consent_type,
                'withdrawn_at': datetime.now(timezone.utc).isoformat()
            }), 200
        else:
            return jsonify({'error': 'Failed to withdraw consent'}), 400

    except Exception as e:
        logger.exception(f"Error withdrawing consent: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/consent/validate/<user_id>/<feature>', methods=['GET'])
@AuthService.jwt_required
def validate_feature_access(user_id: str, feature: str):
    """Validate if user has required consents for a feature"""
    try:
        # Verify user owns this data
        from flask import g
        if g.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        from ..services.consent_service import consent_service
        validation = consent_service.validate_feature_access(user_id, feature)

        return jsonify(validation), 200

    except Exception as e:
        logger.exception(f"Error validating feature access: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/breach/report', methods=['POST'])
@AuthService.jwt_required
def report_potential_breach():
    """Report a potential data breach for HIPAA compliance"""
    try:
        from flask import g
        data = request.get_json() or {}

        incident_details = {
            'reported_by': g.user_id,
            'incident_type': data.get('incident_type', 'unknown'),
            'description': data.get('description', ''),
            'affected_users': data.get('affected_users', 0),
            'data_types': data.get('data_types', []),
            'breach_type': data.get('breach_type', 'unknown'),
            'detected_at': data.get('detected_at', datetime.now(timezone.utc).isoformat()),
            'reported_at': datetime.now(timezone.utc).isoformat()
        }

        from ..services.breach_notification_service import breach_notification_service
        assessment = breach_notification_service.detect_potential_breach(incident_details)

        return jsonify({
            'assessment': assessment,
            'reported': True,
            'breach_id': assessment.get('breach_id', 'N/A')
        }), 200

    except Exception as e:
        logger.exception(f"Error reporting breach: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/breach/history', methods=['GET'])
@AuthService.jwt_required
def get_breach_history():
    """Get breach notification history (admin only)"""
    try:
        # TODO: Add admin role check
        from flask import g

        limit = int(request.args.get('limit', 50))

        from ..services.breach_notification_service import breach_notification_service
        history = breach_notification_service.get_breach_history(limit)

        return jsonify({
            'breach_history': history,
            'total_count': len(history)
        }), 200

    except Exception as e:
        logger.exception(f"Error getting breach history: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/hipaa/encryption-status', methods=['GET'])
@AuthService.jwt_required
def get_encryption_status():
    """Check HIPAA encryption compliance status"""
    try:
        from ..services.breach_notification_service import breach_notification_service
        status = breach_notification_service.validate_encryption_compliance()

        return jsonify(status), 200

    except Exception as e:
        logger.exception(f"Error checking encryption status: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@privacy_bp.route('/gdpr/data-residency', methods=['GET'])
@AuthService.jwt_required
def get_data_residency_status():
    """Check GDPR data residency compliance status"""
    try:
        import os

        # Check Firebase configuration for EU residency
        project_id = os.getenv("FIREBASE_PROJECT_ID_EU", os.getenv("FIREBASE_PROJECT_ID", "unknown"))
        database_url = os.getenv("FIREBASE_DATABASE_URL", "")
        storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET", "")

        eu_compliant = {
            'project_in_eu': 'europe-west' in project_id or project_id.endswith('-eu'),
            'database_in_eu': 'europe-west' in database_url,
            'storage_in_eu': 'europe-west' in storage_bucket,
            'overall_compliant': False
        }

        eu_compliant['overall_compliant'] = all([
            eu_compliant['project_in_eu'],
            eu_compliant['database_in_eu'],
            eu_compliant['storage_in_eu']
        ])

        status = {
            'gdpr_data_residency': {
                'compliant': eu_compliant['overall_compliant'],
                'project_id': project_id,
                'database_url': database_url,
                'storage_bucket': storage_bucket,
                'details': eu_compliant
            },
            'recommendations': []
        }

        if not eu_compliant['overall_compliant']:
            status['recommendations'] = [
                "Set FIREBASE_PROJECT_ID_EU environment variable to EU project",
                "Ensure FIREBASE_DATABASE_URL contains 'europe-west' region",
                "Ensure FIREBASE_STORAGE_BUCKET contains 'europe-west' region"
            ]

        return jsonify(status), 200

    except Exception as e:
        logger.exception(f"Error checking data residency status: {e}")
        return jsonify({'error': 'Internal server error'}), 500
