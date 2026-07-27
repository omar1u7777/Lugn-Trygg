"""
Consent Management Service for GDPR Compliance
Manages user consent for data processing and feature access
"""

import logging
from datetime import UTC, datetime
from typing import Any

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

    def check_consent(self, user_id: str, consent_type: str) -> dict[str, Any]:
        """
        Check if user has given consent for a specific type

        Args:
            user_id: User ID to check
            consent_type: Type of consent to check

        Returns:
            Dict with consent status
        """
        try:
            user_doc = db.collection('users').document(user_id).get()  # type: ignore
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

    def grant_consent(self, user_id: str, consent_type: str, version: str | None = None) -> bool:
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
                'granted_at': datetime.now(UTC).isoformat(),
                'version': current_version,
                'withdrawn': False
            }

            # Update user document
            db.collection('users').document(user_id).update({  # type: ignore
                f'consents.{consent_type}': consent_data,
                'updated_at': datetime.now(UTC)
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
            db.collection('users').document(user_id).update({  # type: ignore
                f'consents.{consent_type}.withdrawn': True,
                f'consents.{consent_type}.withdrawn_at': datetime.now(UTC).isoformat(),
                'updated_at': datetime.now(UTC)
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

    def get_user_consents(self, user_id: str) -> dict[str, Any]:
        """Get all consent records for a user"""
        try:
            user_doc = db.collection('users').document(user_id).get()  # type: ignore
            if not user_doc.exists:
                return {'error': 'User not found'}

            user_data = user_doc.to_dict()
            consents = user_data.get('consents', {})

            # Add metadata for each consent type — use already-fetched data, no N+1 reads
            result = {}
            for consent_type, metadata in self.required_consents.items():
                consent_record = consents.get(consent_type, {})
                granted = consent_record.get('granted', False)
                withdrawn = consent_record.get('withdrawn', False)
                result[consent_type] = {
                    **metadata,
                    'status': {
                        'has_consent': granted and not withdrawn,
                        'granted_at': consent_record.get('granted_at'),
                        'version': consent_record.get('version'),
                        'withdrawn': withdrawn,
                    }
                }

            return result

        except Exception as e:
            logger.error(f"Error getting user consents for {user_id}: {str(e)}")
            return {'error': str(e)}

    def validate_feature_access(self, user_id: str, feature: str) -> dict[str, Any]:
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

    def require_consent(self, consent_types: list[str], strict: bool = False):
        """
        Decorator enforcing that the caller has not WITHDRAWN the given consents
        before processing their data (GDPR right to withdraw).

        Semantics (chosen to be enforceable without a data backfill):
        - Explicitly WITHDRAWN consent  → 403 (the actionable enforcement).
        - strict=True: also 403 when consent was never recorded.
        - strict=False (default): a missing record is allowed so pre-existing
          accounts are not locked out; the frontend consent flow prompts them.
        - Consent check raises (Firestore down, etc.) → FAIL OPEN + telemetry,
          so an infra blip can never block every AI/voice request.

        Order: place BELOW @jwt_required so g.user_id is populated.
        """
        from functools import wraps

        def decorator(f):
            @wraps(f)
            def wrapper(*args, **kwargs):
                from flask import g, jsonify, request

                # CORS preflight must never be consent-gated.
                if request.method == 'OPTIONS':
                    return f(*args, **kwargs)

                user_id = getattr(g, 'user_id', None)
                if not user_id:
                    return jsonify({'error': 'Authentication required'}), 401

                for consent_type in consent_types:
                    try:
                        consent_status = self.check_consent(user_id, consent_type)
                    except Exception as consent_err:
                        # Never let a consent-store outage take down the feature.
                        from src.utils.telemetry import telemetry
                        telemetry.degraded(
                            feature="consent_enforcement",
                            reason="consent_check_error",
                            consent_type=consent_type,
                            error=str(consent_err),
                        )
                        continue

                    withdrawn = bool(consent_status.get('withdrawn', False))
                    has_consent = bool(consent_status.get('has_consent', False))
                    has_record = consent_status.get('granted_at') is not None or withdrawn

                    # Block on explicit withdrawal always; on absent record only
                    # in strict mode.
                    should_block = withdrawn or (strict and not has_consent)
                    if not has_record and not strict:
                        should_block = False

                    if should_block:
                        audit_service.log_event(
                            'FEATURE_ACCESS_DENIED',
                            user_id,
                            {
                                'feature': f.__name__,
                                'missing_consent': consent_type,
                                'withdrawn': withdrawn,
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
            return wrapper
        return decorator

# Global instance
consent_service = ConsentService()
