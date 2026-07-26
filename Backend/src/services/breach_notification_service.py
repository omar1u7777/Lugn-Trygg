"""
Breach Notification Service for HIPAA Compliance
Handles detection and notification of data breaches
"""

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

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
        # HIPAA breach notification requirements (retained for US-context reports)
        self.hipaa_notification_threshold = 500  # Notify if 500+ individuals affected
        self.notification_deadlines = {
            'covered_entity': 60,  # days to notify affected individuals
            'hhs': 60,  # days to notify HHS
            'media': 60  # days for media notification if 500+ affected
        }
        # GDPR Art. 33/34 — the governing regime for this EU product.
        # Art. 33: notify the supervisory authority (IMY) within 72 HOURS.
        # Art. 34: notify affected data subjects without undue delay when the
        # breach is likely to result in a high risk to their rights.
        self.gdpr_authority_deadline_hours = 72

    def detect_potential_breach(self, incident_details: dict[str, Any]) -> dict[str, Any]:
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
                'detected_at': datetime.now(UTC).isoformat()
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

    def _assess_breach_criteria(self, affected_users: int, data_types: list[str], breach_type: str) -> bool:
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

    # Special-category clinical/crisis data (GDPR Art. 9). A breach exposing
    # even ONE user's mental-health or treatment record is exactly the
    # highest-risk case Art. 34 subject notification exists for — severity
    # must not depend solely on affected_users for this data class.
    HIGH_SENSITIVITY_DATA_TYPES = frozenset({
        'mental_health_records', 'medical_data', 'treatment_history',
    })

    def _calculate_severity(self, affected_users: int, data_types: list[str]) -> str:
        """Calculate breach severity level.

        BUG FIX: this previously ignored `data_types` entirely, so a breach of
        one user's suicidal-ideation/treatment record was always scored LOW
        (affected_users=1 never reaches the 50/500 thresholds below), which
        meant high_risk in _schedule_notifications could never be true for
        that data class and Art. 34 subject notification was silently never
        triggered — exactly the scenario this app's own hardening effort
        (see _schedule_notifications' case-sensitivity fix) claimed to close.
        """
        involves_high_sensitivity_data = any(
            dt in self.HIGH_SENSITIVITY_DATA_TYPES for dt in data_types
        )
        if affected_users >= 500 or involves_high_sensitivity_data:
            return 'HIGH'
        elif affected_users >= 50:
            return 'MEDIUM'
        else:
            return 'LOW'

    def _initiate_breach_response(self, assessment: dict[str, Any], incident_details: dict[str, Any]):
        """Initiate breach response procedures"""
        try:
            # Create breach record
            breach_record = {
                'breach_id': f"BREACH_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}",
                'assessment': assessment,
                'incident_details': incident_details,
                'status': 'DETECTED',
                'response_actions': [],
                'created_at': datetime.now(UTC).isoformat(),
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

    def _schedule_notifications(self, breach_record: dict[str, Any]):
        """Schedule breach notifications under GDPR Art. 33/34 and DELIVER the
        immediate on-call alert.

        GDPR governs here: the supervisory authority (IMY) must be notified
        within 72 hours, and affected data subjects without undue delay when the
        breach is high risk. Unlike the previous version — which only wrote
        PENDING rows nobody ever actioned — this raises a telemetry CRITICAL
        (paging on-call/DPO immediately) and emails the DPO inbox, then records
        whether that delivery succeeded so an undelivered notification is
        visible rather than silently pending.
        """
        breach_id = breach_record['breach_id']
        assessment = breach_record.get('assessment', {})
        affected_users = assessment.get('affected_users', 0)
        severity = assessment.get('severity', 'unknown')
        now = datetime.now(UTC)

        from datetime import timedelta
        authority_deadline = now + timedelta(hours=self.gdpr_authority_deadline_hours)
        # BUG FIX: _calculate_severity() (see :122-129) returns UPPERCASE
        # 'HIGH'/'MEDIUM'/'LOW'. A lowercase comparison here NEVER matched, so
        # high_risk collapsed to depending solely on affected_users >= 500 —
        # a breach of highly sensitive special-category data (e.g. one user's
        # suicidal-ideation record) never triggered Art. 34 subject
        # notification regardless of severity.
        high_risk = severity.upper() in ('HIGH', 'CRITICAL') or affected_users >= self.hipaa_notification_threshold

        notifications = [
            {
                'type': 'supervisory_authority_imy',
                'regime': 'GDPR Art. 33',
                'deadline_hours': self.gdpr_authority_deadline_hours,
                'deadline_at': authority_deadline.isoformat(),
                'status': 'PENDING',
                'description': 'Notify supervisory authority (IMY) within 72 hours',
            }
        ]
        if high_risk:
            notifications.append({
                'type': 'affected_data_subjects',
                'regime': 'GDPR Art. 34',
                'deadline_hours': None,  # "without undue delay"
                'status': 'PENDING',
                'description': f'Notify {affected_users} affected data subjects (high risk) without undue delay',
            })

        # 1. IMMEDIATE on-call/DPO alert — the actionable delivery. A breach is
        #    always an operator-critical event; telemetry.critical forwards it to
        #    Sentry (level fatal) where the on-call alert rule pages a human.
        delivered = False
        try:
            from src.utils.telemetry import telemetry
            telemetry.critical(
                "data_breach_detected",
                "GDPR-reportable data breach recorded — 72h authority clock started",
                breach_id=breach_id,
                severity=severity,
                affected_users=affected_users,
                high_risk=high_risk,
                authority_deadline=authority_deadline.isoformat(),
            )
            delivered = self._send_dpo_email(breach_id, severity, affected_users, authority_deadline, high_risk) or delivered
        except Exception as alert_err:
            logger.exception("Breach on-call alert delivery failed: %s", alert_err)

        # 2. Persist the schedule and the delivery outcome so an undelivered
        #    alert is visible, not silently "PENDING".
        _db.collection('breach_notifications').document(breach_id).update({
            'scheduled_notifications': notifications,
            'gdpr_authority_deadline_at': authority_deadline.isoformat(),
            'high_risk': high_risk,
            'oncall_alert_delivered': delivered,
            'updated_at': now.isoformat()
        })

    def _send_dpo_email(self, breach_id: str, severity: str, affected_users: int,
                        authority_deadline, high_risk: bool) -> bool:
        """Email the DPO / breach on-call inbox. Returns True on confirmed send.

        Requires BREACH_NOTIFICATION_EMAIL (the monitored DPO inbox). Uses the
        existing email service; if neither is configured, returns False so the
        record shows the alert was NOT delivered (telemetry critical still fired).
        """
        import os
        recipient = os.getenv('BREACH_NOTIFICATION_EMAIL') or os.getenv('CARE_TEAM_EMAIL')
        if not recipient:
            logger.error("No BREACH_NOTIFICATION_EMAIL configured — DPO email NOT sent for breach %s", breach_id)
            return False
        try:
            from .email_service import email_service
            subject = f"[BREACH] {severity.upper()} data breach {breach_id} — GDPR 72h clock started"
            body = (
                f"A GDPR-reportable data breach has been recorded.\n\n"
                f"Breach ID: {breach_id}\n"
                f"Severity: {severity}\n"
                f"Affected data subjects: {affected_users}\n"
                f"High risk (Art. 34 subject notification required): {high_risk}\n"
                f"Supervisory authority (IMY) deadline: {authority_deadline.isoformat()} (72h)\n\n"
                f"ACTION REQUIRED: assess and, if confirmed, notify IMY within 72 hours."
            )
            sent = email_service.send_plain_email(recipient, subject, body)
            return bool(sent)
        except Exception as email_err:
            logger.exception("DPO breach email failed for %s: %s", breach_id, email_err)
            return False

    def get_breach_history(self, limit: int = 50) -> list[dict[str, Any]]:
        """Get breach notification history"""
        try:
            breaches = _db.collection('breach_notifications') \
                        .order_by('created_at', direction='DESCENDING') \
                        .limit(limit).stream()

            return [doc.to_dict() for doc in breaches]

        except Exception as e:
            logger.error(f"Failed to get breach history: {str(e)}")
            return []

    def validate_encryption_compliance(self) -> dict[str, Any]:
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
                        'last_validated': datetime.now(UTC).isoformat()
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
