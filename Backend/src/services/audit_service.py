import logging
import os
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from cryptography.fernet import Fernet

from ..firebase_config import db

if TYPE_CHECKING:
    from google.cloud.firestore import Client
    _db: Client = db  # type: ignore
else:
    _db = db

logger = logging.getLogger(__name__)

class AuditService:
    def __init__(self):
        # CRITICAL: HIPAA encryption key MUST be set in environment
        self.encryption_key = os.getenv('HIPAA_ENCRYPTION_KEY')
        if not self.encryption_key:
            error_msg = (
                "❌ CRITICAL: HIPAA_ENCRYPTION_KEY environment variable is not set!\n"
                "This key is REQUIRED for HIPAA compliance and data encryption.\n"
                "Generate a secure key with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'\n"
                "Add it to your .env file: HIPAA_ENCRYPTION_KEY=<generated_key>"
            )
            logger.critical(error_msg)
            raise ValueError(error_msg)
        self.cipher = Fernet(self.encryption_key.encode())

    def encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data for HIPAA compliance"""
        return self.cipher.encrypt(data.encode()).decode()

    def decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(encrypted_data.encode()).decode()

    def log_event(self, event_type: str, user_id: str, details: dict[str, Any],
                  ip_address: str | None = None, user_agent: str | None = None) -> None:
        """Log audit event to Firestore with HIPAA compliance"""
        try:
            # Encrypt sensitive details
            encrypted_details = self.encrypt_data(str(details))

            audit_entry = {
                "event_type": event_type,
                "user_id": user_id,
                "details": encrypted_details,
                "timestamp": datetime.now(UTC).isoformat(),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "hipaa_compliant": True
            }

            # Add to audit_logs collection
            doc_ref = _db.collection("audit_logs").document()
            doc_ref.set(audit_entry)

            logger.info("Audit log created: %s for user %s", str(event_type).replace('\n', '').replace('\r', '')[:50], str(user_id).replace('\n', '').replace('\r', '')[:50])

            # Apply retention policy (delete logs older than 7 years for HIPAA)
            self._apply_retention_policy()

        except Exception as e:
            logger.error("Failed to log audit event: %s", str(e).replace('\n', '').replace('\r', '')[:200])

    def _apply_retention_policy(self) -> None:
        """Apply retention policy - delete audit logs older than 7 years (HIPAA requirement)"""
        try:
            retention_date = datetime.now(UTC) - timedelta(days=2555)  # 7 years approx
            retention_iso = retention_date.isoformat()

            # Query and delete old logs using standard Firestore syntax
            old_logs = _db.collection("audit_logs").where("timestamp", "<", retention_iso).stream()
            for doc in old_logs:
                doc.reference.delete()
                logger.info(f"Deleted old audit log: {doc.id}")

        except Exception as e:
            logger.error(f"Failed to apply retention policy: {str(e)}")

    def get_audit_trail(self, user_id: str, limit: int = 100) -> list:
        """Retrieve audit trail for a user (decrypted)"""
        try:
            # Use standard Firestore where() syntax
            logs = _db.collection("audit_logs").where("user_id", "==", user_id)\
                    .order_by("timestamp", direction="DESCENDING").limit(limit).stream()

            audit_trail = []
            for doc in logs:
                data = doc.to_dict()
                # Decrypt details
                try:
                    data["details"] = self.decrypt_data(data["details"])
                except Exception:
                    data["details"] = "Decryption failed"
                audit_trail.append(data)

            return audit_trail

        except Exception as e:
            logger.error(f"Failed to retrieve audit trail: {str(e)}")
            return []

    def log_baa_agreement(self, user_id: str, agreed: bool, version: str = "1.0") -> None:
        """Log BAA agreement acceptance for HIPAA compliance"""
        self.log_event(
            event_type="BAA_AGREEMENT",
            user_id=user_id,
            details={
                "agreed": agreed,
                "version": version,
                "agreement_text": "Business Associate Agreement accepted for HIPAA compliance"
            }
        )

    def encrypt_sensitive_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Encrypt sensitive fields in data dict for HIPAA"""
        sensitive_fields = ["email", "phone", "medical_data", "personal_info"]
        encrypted_data = data.copy()

        for field in sensitive_fields:
            if field in encrypted_data and isinstance(encrypted_data[field], str):
                encrypted_data[field] = self.encrypt_data(encrypted_data[field])

        return encrypted_data

    def decrypt_sensitive_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Decrypt sensitive fields in data dict"""
        sensitive_fields = ["email", "phone", "medical_data", "personal_info"]
        decrypted_data = data.copy()

        for field in sensitive_fields:
            if field in decrypted_data and isinstance(decrypted_data[field], str):
                try:
                    decrypted_data[field] = self.decrypt_data(decrypted_data[field])
                except Exception:
                    logger.warning(f"Failed to decrypt field: {field}")

        return decrypted_data

# Global audit service instance - lazy initialization
_audit_service_instance = None

def get_audit_service():
    """Get or create the global audit service instance (lazy initialization)"""
    global _audit_service_instance
    if _audit_service_instance is None:
        _audit_service_instance = AuditService()
    return _audit_service_instance

# Legacy compatibility - property-like access
class AuditServiceProxy:
    """Proxy to provide lazy initialization for audit_service"""
    def __getattr__(self, name):
        return getattr(get_audit_service(), name)

    def log_event(self, *args, **kwargs):
        return get_audit_service().log_event(*args, **kwargs)

audit_service = AuditServiceProxy()


def audit_log(
    event_type: str,
    user_id: str,
    details: dict[str, Any],
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Global audit logging function."""
    try:
        get_audit_service().log_event(event_type, user_id, details, ip_address, user_agent)
    except Exception as e:
        logger.warning(f"Audit logging failed (non-fatal): {e}")


def log_admin_action(
    admin_id: str,
    action: str,
    metadata: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Specialized helper to record administrative actions."""

    details: dict[str, Any] = {"action": action}
    if metadata:
        details["metadata"] = metadata

    audit_service.log_event(
        event_type="ADMIN_ACTION",
        user_id=admin_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )
