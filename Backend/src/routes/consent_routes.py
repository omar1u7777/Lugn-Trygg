"""
Consent Management Routes
Handles user consent for GDPR compliance with proper frontend integration
"""

from flask import Blueprint, request, g
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.audit_service import audit_log
from src.services.consent_service import consent_service
from src.utils.response_utils import APIResponse
from datetime import datetime, timezone
import logging

consent_bp = Blueprint('consent', __name__)
logger = logging.getLogger(__name__)


# Mapping from frontend consent types to backend consent types
CONSENT_TYPE_MAPPING = {
    'dataProcessing': 'data_processing',
    'aiAnalysis': 'ai_processing',
    'storage': 'data_processing',  # Storage is part of data processing
    'marketing': 'marketing',
    'analytics': 'analytics',
    'termsOfService': 'terms_of_service',
    'privacyPolicy': 'privacy_policy',
    'voiceProcessing': 'voice_processing'
}


@consent_bp.route('', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def grant_bulk_consents():
    """
    Grant multiple consents at once (used by ConsentModal)
    POST /api/consent
    Body: {
        "analytics_consent": bool,
        "marketing_consent": bool,
        "data_processing_consent": bool,
        "ai_analysis_consent": bool,
        "terms_of_service": bool,
        "privacy_policy": bool
    }
    """
    try:
        user_id = g.user_id
        data = request.get_json(silent=True) or {}
        
        # Map frontend consent names to backend consent types
        consent_mapping = {
            'analytics_consent': 'analytics',
            'marketing_consent': 'marketing',
            'data_processing_consent': 'data_processing',
            'ai_analysis_consent': 'ai_processing',
            'terms_of_service': 'terms_of_service',
            'privacy_policy': 'privacy_policy',
            'voice_processing_consent': 'voice_processing'
        }
        
        granted_consents = []
        failed_consents = []
        
        # Process each consent
        for frontend_key, backend_type in consent_mapping.items():
            consent_value = data.get(frontend_key)
            
            # Only process if explicitly provided
            if consent_value is not None:
                if consent_value:  # Grant consent
                    success = consent_service.grant_consent(
                        user_id, 
                        backend_type, 
                        version='1.0'
                    )
                    if success:
                        granted_consents.append(backend_type)
                    else:
                        failed_consents.append(backend_type)
                else:  # Explicitly denied - withdraw if exists
                    consent_service.withdraw_consent(user_id, backend_type)
        
        # Audit log
        audit_log(
            'BULK_CONSENT_UPDATE',
            user_id,
            {
                'granted': granted_consents,
                'failed': failed_consents,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
        )
        
        logger.info(f"💚 Bulk consent update for user {user_id}: {len(granted_consents)} granted, {len(failed_consents)} failed")
        
        return APIResponse.success({
            'granted': granted_consents,
            'failed': failed_consents,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, "Consents updated successfully")
        
    except Exception as e:
        logger.exception(f"Error granting bulk consents: {e}")
        return APIResponse.error("Could not update consents", "CONSENT_ERROR", 500)


@consent_bp.route('', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_user_consents():
    """
    Get all consent records for current user
    GET /api/consent
    """
    try:
        user_id = g.user_id
        consents = consent_service.get_user_consents(user_id)
        
        if 'error' in consents:
            return APIResponse.error(consents['error'], "FETCH_ERROR", 404)
        
        logger.info(f"📋 User {user_id} fetched consents")
        return APIResponse.success(consents, "Consents retrieved")
        
    except Exception as e:
        logger.exception(f"Error getting user consents: {e}")
        return APIResponse.error("Could not retrieve consents", "FETCH_ERROR", 500)


@consent_bp.route('/<consent_type>', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def grant_consent(consent_type: str):
    """
    Grant consent for a specific type
    POST /api/consent/<consent_type>
    Body: { "version": "1.0" } (optional)
    """
    try:
        user_id = g.user_id
        data = request.get_json(silent=True) or {}
        version = data.get('version', '1.0')
        
        # Map frontend consent type to backend if needed
        backend_type = CONSENT_TYPE_MAPPING.get(consent_type, consent_type)
        
        success = consent_service.grant_consent(user_id, backend_type, version)
        
        if success:
            audit_log(
                'CONSENT_GRANTED', 
                user_id, 
                {'consent_type': backend_type, 'version': version}
            )
            
            logger.info(f"✅ Consent granted: {backend_type} for user {user_id}")
            
            return APIResponse.success({
                'consent_type': backend_type,
                'granted_at': datetime.now(timezone.utc).isoformat(),
                'version': version
            }, f"Consent granted for {backend_type}")
        else:
            return APIResponse.bad_request("Could not grant consent", "GRANT_FAILED")
            
    except Exception as e:
        logger.exception(f"Error granting consent: {e}")
        return APIResponse.error("Could not grant consent", "GRANT_ERROR", 500)


@consent_bp.route('/<consent_type>', methods=['DELETE'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def withdraw_consent(consent_type: str):
    """
    Withdraw consent for a specific type
    DELETE /api/consent/<consent_type>
    """
    try:
        user_id = g.user_id
        
        # Map frontend consent type to backend if needed
        backend_type = CONSENT_TYPE_MAPPING.get(consent_type, consent_type)
        
        success = consent_service.withdraw_consent(user_id, backend_type)
        
        if success:
            audit_log(
                'CONSENT_WITHDRAWN',
                user_id,
                {'consent_type': backend_type}
            )
            
            logger.info(f"🚫 Consent withdrawn: {backend_type} for user {user_id}")
            
            return APIResponse.success({
                'consent_type': backend_type,
                'withdrawn_at': datetime.now(timezone.utc).isoformat()
            }, f"Consent withdrawn for {backend_type}")
        else:
            return APIResponse.bad_request("Could not withdraw consent", "WITHDRAW_FAILED")
            
    except Exception as e:
        logger.exception(f"Error withdrawing consent: {e}")
        return APIResponse.error("Could not withdraw consent", "WITHDRAW_ERROR", 500)


@consent_bp.route('/validate/<feature>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def validate_feature_access(feature: str):
    """
    Validate if user has required consents for a feature
    GET /api/consent/validate/<feature>
    """
    try:
        user_id = g.user_id
        validation = consent_service.validate_feature_access(user_id, feature)
        
        logger.info(f"🔍 Feature access validation for {feature}: {validation.get('access_granted', False)}")
        
        return APIResponse.success(validation, "Feature access validated")
        
    except Exception as e:
        logger.exception(f"Error validating feature access: {e}")
        return APIResponse.error("Could not validate feature access", "VALIDATION_ERROR", 500)


@consent_bp.route('/check/<consent_type>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def check_consent(consent_type: str):
    """
    Check if user has given consent for a specific type
    GET /api/consent/check/<consent_type>
    """
    try:
        user_id = g.user_id
        
        # Map frontend consent type to backend if needed
        backend_type = CONSENT_TYPE_MAPPING.get(consent_type, consent_type)
        
        consent_status = consent_service.check_consent(user_id, backend_type)
        
        return APIResponse.success({
            'consent_type': backend_type,
            **consent_status
        }, "Consent status retrieved")
        
    except Exception as e:
        logger.exception(f"Error checking consent: {e}")
        return APIResponse.error("Could not check consent", "CHECK_ERROR", 500)
