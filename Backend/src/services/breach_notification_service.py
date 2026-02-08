"""
Breach Notification Service for HIPAA Compliance
Handles detection and notification of data breaches
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, TYPE_CHECKING
from ..firebase_config import db
from .audit_service import audit_service

# Type checking for Pylance
if TYPE_CHECKING:
    from google.cloud.firestore import Client as _FirestoreClient

# Runtime type alias for db with None fallback
_db: "_FirestoreClient" = db  # type: ignore[assignment]

logger = logging.getLogger(__name__)

class BreachNotificationService:
    """Service for handling HIPAA breach notifications"""

    def __init__(self):
        # HIPAA breach notification requirements
        self.hipaa_notification_threshold = 500  # Notify if 500+ individuals affected
        self.notification_deadlines = {
            'covered_entity': 60,  # days to notify affected individuals
            'hhs': 60,  # days to notify HHS
            'media': 60  # days for media notification if 500+ affected
        }

    def detect_potential_breach(self, incident_details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detect and assess potential data breaches

        Args:
            incident_details: Details about the potential breach

        Returns:
            Breach assessment and notification requirements
        """
        try:
            # Assess breach severity
            affected_users = incident_details.get('affected_users', 0)
            data_types = incident_details.get('data_types', [])
            breach_type = incident_details.get('breach_type', 'unknown')

            # Determine if this constitutes a breach under HIPAA
            is_breach = self._assess_breach_criteria(affected_users, data_types, breach_type)

            assessment = {
                'is_breach': is_breach,
                'severity': self._calculate_severity(affected_users, data_types),
                'affected_users': affected_users,
                'data_types': data_types,
                'breach_type': breach_type,
                'requires_notification': is_breach,
                'notification_deadlines': self.notification_deadlines if is_breach else {},
                'detected_at': datetime.now(timezone.utc).isoformat()
            }

            # Log the breach detection
            audit_service.log_event(
                'BREACH_DETECTED' if is_breach else 'POTENTIAL_INCIDENT_DETECTED',
                'SYSTEM',
                {
                    'assessment': assessment,
                    'incident_details': incident_details
                }
            )

            if is_breach:
                logger.critical(f"🚨 HIPAA BREACH DETECTED: {assessment}")
                self._initiate_breach_response(assessment, incident_details)
            else:
                logger.info(f"Potential incident detected but not a breach: {assessment}")

            return assessment

        except Exception as e:
            logger.error(f"Error in breach detection: {str(e)}")
            return {
                'error': str(e),
                'is_breach': False,
                'requires_notification': False
            }

    def _assess_breach_criteria(self, affected_users: int, data_types: List[str], breach_type: str) -> bool:
        """
        Assess if incident meets HIPAA breach criteria

        HIPAA defines a breach as:
        - Unauthorized acquisition, access, use, or disclosure of PHI
        - That compromises the security or privacy of the PHI
        """
        # Any unauthorized access to PHI is a breach unless:
        # - The individual accessed is authorized
        # - The information is de-identified
        # - The covered entity has a good faith belief that access was not successful

        # For this implementation, any unauthorized access to sensitive data is considered a breach
        sensitive_data_types = [
            'medical_data', 'mental_health_records', 'voice_data',
            'personal_info', 'contact_info', 'treatment_history'
        ]

        has_sensitive_data = any(data_type in sensitive_data_types for data_type in data_types)

        # Any breach involving sensitive data is a breach
        if has_sensitive_data and breach_type in ['unauthorized_access', 'data_exposure', 'system_compromise']:
            return True

        return False

    def _calculate_severity(self, affected_users: int, data_types: List[str]) -> str:
        """Calculate breach severity level"""
        if affected_users >= 500:
            return 'HIGH'
        elif affected_users >= 50:
            return 'MEDIUM'
        else:
            return 'LOW'

    def _initiate_breach_response(self, assessment: Dict[str, Any], incident_details: Dict[str, Any]):
        """Initiate breach response procedures"""
        try:
            # Create breach record
            breach_record = {
                'breach_id': f"BREACH_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
                'assessment': assessment,
                'incident_details': incident_details,
                'status': 'DETECTED',
                'response_actions': [],
                'created_at': datetime.now(timezone.utc).isoformat(),
                'notifications_sent': [],
                'compliance_status': 'IN_PROGRESS'
            }

            # Store breach record
            doc_ref = _db.collection('breach_notifications').document(breach_record['breach_id'])
            doc_ref.set(breach_record)

            # Log breach response initiation
            audit_service.log_event(
                'BREACH_RESPONSE_INITIATED',
                'SYSTEM',
                {
                    'breach_id': breach_record['breach_id'],
                    'severity': assessment.get('severity'),
                    'affected_users': assessment.get('affected_users')
                }
            )

            # Schedule notifications (in a real implementation, this would trigger email/SMS alerts)
            self._schedule_notifications(breach_record)

            logger.critical(f"🚨 Breach response initiated: {breach_record['breach_id']}")

        except Exception as e:
            logger.error(f"Failed to initiate breach response: {str(e)}")

    def _schedule_notifications(self, breach_record: Dict[str, Any]):
        """Schedule breach notifications according to HIPAA requirements"""
        breach_id = breach_record['breach_id']
        severity = breach_record['assessment'].get('severity', 'LOW')
        affected_users = breach_record['assessment'].get('affected_users', 0)

        notifications = []

        # Always notify affected individuals within 60 days
        notifications.append({
            'type': 'affected_individuals',
            'deadline_days': self.notification_deadlines['covered_entity'],
            'status': 'PENDING',
            'description': f'Notify {affected_users} affected individuals'
        })

        # Notify HHS within 60 days
        notifications.append({
            'type': 'hhs',
            'deadline_days': self.notification_deadlines['hhs'],
            'status': 'PENDING',
            'description': 'Notify Department of Health and Human Services'
        })

        # Notify media if 500+ individuals affected
        if affected_users >= self.hipaa_notification_threshold:
            notifications.append({
                'type': 'media',
                'deadline_days': self.notification_deadlines['media'],
                'status': 'PENDING',
                'description': 'Notify media outlets'
            })

        # Update breach record with notifications
        _db.collection('breach_notifications').document(breach_id).update({
            'scheduled_notifications': notifications,
            'updated_at': datetime.now(timezone.utc).isoformat()
        })

    def get_breach_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get breach notification history"""
        try:
            breaches = _db.collection('breach_notifications') \
                        .order_by('created_at', direction='DESCENDING') \
                        .limit(limit).stream()

            return [doc.to_dict() for doc in breaches]

        except Exception as e:
            logger.error(f"Failed to get breach history: {str(e)}")
            return []

    def validate_encryption_compliance(self) -> Dict[str, Any]:
        """
        Validate that data encryption is properly implemented
        Required for HIPAA compliance
        """
        try:
            # Check if encryption key is set
            import os
            encryption_key = os.getenv('HIPAA_ENCRYPTION_KEY')

            if not encryption_key:
                return {
                    'compliant': False,
                    'issues': ['HIPAA_ENCRYPTION_KEY environment variable not set'],
                    'recommendations': ['Set HIPAA_ENCRYPTION_KEY environment variable with a secure Fernet key']
                }

            # Test encryption/decryption
            try:
                from cryptography.fernet import Fernet
                cipher = Fernet(encryption_key.encode())

                test_data = "HIPAA compliance test"
                encrypted = cipher.encrypt(test_data.encode())
                decrypted = cipher.decrypt(encrypted).decode()

                if decrypted == test_data:
                    return {
                        'compliant': True,
                        'encryption_method': 'Fernet (AES 128)',
                        'key_strength': 'Strong',
                        'last_validated': datetime.now(timezone.utc).isoformat()
                    }
                else:
                    return {
                        'compliant': False,
                        'issues': ['Encryption/decryption test failed'],
                        'recommendations': ['Regenerate HIPAA_ENCRYPTION_KEY']
                    }

            except Exception as e:
                return {
                    'compliant': False,
                    'issues': [f'Encryption validation failed: {str(e)}'],
                    'recommendations': ['Check cryptography library installation and key format']
                }

        except Exception as e:
            logger.error(f"Encryption compliance validation failed: {str(e)}")
            return {
                'compliant': False,
                'issues': [f'Validation error: {str(e)}'],
                'recommendations': ['Contact system administrator']
            }

# Global instance
breach_notification_service = BreachNotificationService()