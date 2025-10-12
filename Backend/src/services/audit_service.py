import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from cryptography.fernet import Fernet
import os
from src.firebase_config import db

logger = logging.getLogger(__name__)

class AuditService:
    def __init__(self):
        # Generate or load encryption key for HIPAA compliance
        self.encryption_key = os.getenv('HIPAA_ENCRYPTION_KEY')
        if not self.encryption_key:
            # Generate a new key if not set (in production, this should be securely stored)
            self.encryption_key = Fernet.generate_key().decode()
            logger.warning("HIPAA_ENCRYPTION_KEY not set, generated new key. Store securely!")
        self.cipher = Fernet(self.encryption_key.encode())

    def encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data for HIPAA compliance"""
        return self.cipher.encrypt(data.encode()).decode()

    def decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(encrypted_data.encode()).decode()

    def log_event(self, event_type: str, user_id: str, details: Dict[str, Any],
                  ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> None:
        """Log audit event to Firestore with HIPAA compliance"""
        try:
            # Encrypt sensitive details
            encrypted_details = self.encrypt_data(str(details))

            audit_entry = {
                "event_type": event_type,
                "user_id": user_id,
                "details": encrypted_details,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "hipaa_compliant": True
            }

            # Add to audit_logs collection
            doc_ref = db.collection("audit_logs").document()
            doc_ref.set(audit_entry)

            logger.info(f"Audit log created: {event_type} for user {user_id}")

            # Apply retention policy (delete logs older than 7 years for HIPAA)
            self._apply_retention_policy()

        except Exception as e:
            logger.error(f"Failed to log audit event: {str(e)}")

    def _apply_retention_policy(self) -> None:
        """Apply retention policy - delete audit logs older than 7 years (HIPAA requirement)"""
        try:
            retention_date = datetime.now(timezone.utc) - timedelta(days=2555)  # 7 years approx
            retention_iso = retention_date.isoformat()

            # Query and delete old logs
            old_logs = db.collection("audit_logs").where("timestamp", "<", retention_iso).stream()
            for doc in old_logs:
                doc.reference.delete()
                logger.info(f"Deleted old audit log: {doc.id}")

        except Exception as e:
            logger.error(f"Failed to apply retention policy: {str(e)}")

    def get_audit_trail(self, user_id: str, limit: int = 100) -> list:
        """Retrieve audit trail for a user (decrypted)"""
        try:
            logs = db.collection("audit_logs").where("user_id", "==", user_id)\
                    .order_by("timestamp", direction="DESCENDING").limit(limit).stream()

            audit_trail = []
            for doc in logs:
                data = doc.to_dict()
                # Decrypt details
                try:
                    data["details"] = self.decrypt_data(data["details"])
                except:
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

    def encrypt_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Encrypt sensitive fields in data dict for HIPAA"""
        sensitive_fields = ["email", "phone", "medical_data", "personal_info"]
        encrypted_data = data.copy()

        for field in sensitive_fields:
            if field in encrypted_data and isinstance(encrypted_data[field], str):
                encrypted_data[field] = self.encrypt_data(encrypted_data[field])

        return encrypted_data

    def decrypt_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Decrypt sensitive fields in data dict"""
        sensitive_fields = ["email", "phone", "medical_data", "personal_info"]
        decrypted_data = data.copy()

        for field in sensitive_fields:
            if field in decrypted_data and isinstance(decrypted_data[field], str):
                try:
                    decrypted_data[field] = self.decrypt_data(decrypted_data[field])
                except:
                    logger.warning(f"Failed to decrypt field: {field}")

        return decrypted_data

# Create a global audit service instance
audit_service = AuditService()

def audit_log(event_type: str, user_id: str, details: Dict[str, Any],
              ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> None:
    """Global audit logging function"""
    audit_service.log_event(event_type, user_id, details, ip_address, user_agent)