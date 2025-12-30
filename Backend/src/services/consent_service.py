"""
Consent Management Service for GDPR Compliance
Manages user consent for data processing and feature access
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from ..firebase_config import db
from .audit_service import audit_service

logger = logging.getLogger(__name__)

class ConsentService:
    """Service for managing user consent and data processing permissions"""

    def __init__(self):
        # Required consents for different features
        self.required_consents = {
            'terms_of_service': {
                'required': True,
                'description': 'Terms of Service acceptance',
                'version': '1.0'
            },
            'privacy_policy': {
                'required': True,
                'description': 'Privacy Policy acceptance',
                'version': '1.0'
            },
            'data_processing': {
                'required': True,
                'description': 'General data processing consent',
                'version': '1.0'
            },
            'ai_processing': {
                'required': True,
                'description': 'AI analysis of mood and voice data',
                'version': '1.0'
            },
            'voice_processing': {
                'required': True,
                'description': 'Voice recording and emotion analysis',
                'version': '1.0'
            },
            'analytics': {
                'required': False,
                'description': 'Usage analytics and improvement data',
                'version': '1.0'
            },
            'marketing': {
                'required': False,
                'description': 'Marketing communications and updates',
                'version': '1.0'
            }
        }

    def check_consent(self, user_id: str, consent_type: str) -> Dict[str, Any]:
        """
        Check if user has given consent for a specific type

        Args:
            user_id: User ID to check
            consent_type: Type of consent to check

        Returns:
            Dict with consent status
        """
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return {
                    'has_consent': False,
                    'error': 'User not found'
                }

            user_data = user_doc.to_dict()
            consents = user_data.get('consents', {})

            consent_record = consents.get(consent_type)
            if not consent_record:
                return {
                    'has_consent': False,
                    'granted_at': None,
                    'version': None
                }

            # Check if consent is still valid (not withdrawn)
            granted = consent_record.get('granted', False)
            granted_at = consent_record.get('granted_at')
            version = consent_record.get('version')
            withdrawn = consent_record.get('withdrawn', False)

            return {
                'has_consent': granted and not withdrawn,
                'granted_at': granted_at,
                'version': version,
                'withdrawn': withdrawn
            }

        except Exception as e:
            logger.error(f"Error checking consent for user {user_id}: {str(e)}")
            return {
                'has_consent': False,
                'error': str(e)
            }

    def grant_consent(self, user_id: str, consent_type: str, version: str = None) -> bool:
        """
        Grant consent for a specific type

        Args:
            user_id: User ID
            consent_type: Type of consent
            version: Version of terms/consent

        Returns:
            Success status
        """
        try:
            if consent_type not in self.required_consents:
                logger.warning(f"Unknown consent type: {consent_type}")
                return False

            current_version = version or self.required_consents[consent_type]['version']

            consent_data = {
                'granted': True,
                'granted_at': datetime.now(timezone.utc).isoformat(),
                'version': current_version,
                'withdrawn': False
            }

            # Update user document
            db.collection('users').document(user_id).update({
                f'consents.{consent_type}': consent_data,
                'updated_at': datetime.now(timezone.utc)
            })

            # Audit log
            audit_service.log_event(
                'CONSENT_GRANTED',
                user_id,
                {
                    'consent_type': consent_type,
                    'version': current_version
                }
            )

            logger.info(f"Consent granted for user {user_id}: {consent_type} v{current_version}")
            return True

        except Exception as e:
            logger.error(f"Error granting consent for user {user_id}: {str(e)}")
            return False

    def withdraw_consent(self, user_id: str, consent_type: str) -> bool:
        """
        Withdraw consent for a specific type

        Args:
            user_id: User ID
            consent_type: Type of consent

        Returns:
            Success status
        """
        try:
            # Update consent record
            db.collection('users').document(user_id).update({
                f'consents.{consent_type}.withdrawn': True,
                f'consents.{consent_type}.withdrawn_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc)
            })

            # Audit log
            audit_service.log_event(
                'CONSENT_WITHDRAWN',
                user_id,
                {
                    'consent_type': consent_type
                }
            )

            logger.info(f"Consent withdrawn for user {user_id}: {consent_type}")
            return True

        except Exception as e:
            logger.error(f"Error withdrawing consent for user {user_id}: {str(e)}")
            return False

    def get_user_consents(self, user_id: str) -> Dict[str, Any]:
        """Get all consent records for a user"""
        try:
            user_doc = db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return {'error': 'User not found'}

            user_data = user_doc.to_dict()
            consents = user_data.get('consents', {})

            # Add metadata for each consent type
            result = {}
            for consent_type, metadata in self.required_consents.items():
                consent_record = consents.get(consent_type, {})
                result[consent_type] = {
                    **metadata,
                    'status': self.check_consent(user_id, consent_type)
                }

            return result

        except Exception as e:
            logger.error(f"Error getting user consents for {user_id}: {str(e)}")
            return {'error': str(e)}

    def validate_feature_access(self, user_id: str, feature: str) -> Dict[str, Any]:
        """
        Validate if user has required consents for a feature

        Args:
            user_id: User ID
            feature: Feature name

        Returns:
            Dict with access status and missing consents
        """
        # Map features to required consents
        feature_requirements = {
            'mood_logging': ['terms_of_service', 'privacy_policy', 'data_processing'],
            'voice_analysis': ['terms_of_service', 'privacy_policy', 'data_processing', 'voice_processing'],
            'ai_insights': ['terms_of_service', 'privacy_policy', 'data_processing', 'ai_processing'],
            'analytics': ['analytics'],
            'marketing': ['marketing']
        }

        required_consents = feature_requirements.get(feature, [])
        if not required_consents:
            return {
                'access_granted': True,
                'feature': feature,
                'required_consents': []
            }

        missing_consents = []
        for consent_type in required_consents:
            consent_status = self.check_consent(user_id, consent_type)
            if not consent_status.get('has_consent', False):
                missing_consents.append({
                    'type': consent_type,
                    'description': self.required_consents[consent_type]['description']
                })

        return {
            'access_granted': len(missing_consents) == 0,
            'feature': feature,
            'required_consents': required_consents,
            'missing_consents': missing_consents
        }

    def require_consent(self, consent_types: List[str]):
        """
        Decorator to require specific consents for route access

        Args:
            consent_types: List of consent types required
        """
        def decorator(f):
            def wrapper(*args, **kwargs):
                from flask import g, request, jsonify

                user_id = getattr(g, 'user_id', None)
                if not user_id:
                    return jsonify({'error': 'Authentication required'}), 401

                # Check all required consents
                for consent_type in consent_types:
                    consent_status = self.check_consent(user_id, consent_type)
                    if not consent_status.get('has_consent', False):
                        # Audit failed access attempt
                        audit_service.log_event(
                            'FEATURE_ACCESS_DENIED',
                            user_id,
                            {
                                'feature': f.__name__,
                                'missing_consent': consent_type,
                                'endpoint': request.endpoint
                            }
                        )

                        return jsonify({
                            'error': 'Consent required',
                            'message': f'Access to this feature requires {consent_type} consent',
                            'consent_type': consent_type,
                            'description': self.required_consents[consent_type]['description']
                        }), 403

                return f(*args, **kwargs)
            wrapper.__name__ = f.__name__
            return wrapper
        return decorator

# Global instance
consent_service = ConsentService()