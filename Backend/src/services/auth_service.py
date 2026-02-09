import hashlib
import json
import logging
import secrets
from datetime import UTC, datetime
from functools import wraps
from typing import TYPE_CHECKING, Any

import jwt
import requests
from flask import jsonify, request
from google.cloud.firestore_v1.base_query import FieldFilter
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url, options_to_json_dict
from webauthn.helpers.structs import UserVerificationRequirement

from ..firebase_config import (
    auth as firebase_auth,
)
from ..firebase_config import (
    db,
)
from ..utils import convert_email_to_punycode  # Flyttad till utils.py
from .tamper_detection_service import tamper_detection_service

# Type checking imports for Pylance
if TYPE_CHECKING:
    from firebase_admin import auth as _firebase_auth_type
    from google.cloud.firestore import Client as _FirestoreClient

# Runtime type hints with None fallback for lazy initialization
_db: "_FirestoreClient" = db  # type: ignore[assignment]
_auth: "_firebase_auth_type" = firebase_auth  # type: ignore[assignment]
from ..config import (
    ACCESS_TOKEN_EXPIRES,
    FIREBASE_WEB_API_KEY,
    JWT_REFRESH_SECRET_KEY,
    JWT_SECRET_KEY,
    LOCKOUT_DURATION_MINUTES_FIRST,
    LOCKOUT_DURATION_MINUTES_SECOND,
    LOCKOUT_DURATION_MINUTES_THIRD,
    MAX_FAILED_LOGIN_ATTEMPTS,
    REFRESH_TOKEN_EXPIRES,
    WEBAUTHN_ORIGIN,
    WEBAUTHN_RP_ID,
    WEBAUTHN_RP_NAME,
)
from ..models.user import User
from ..services.audit_service import AuditService
from ..utils.error_handling import (
    ValidationError,
    handle_service_errors,
)
from ..utils.password_utils import verify_password as utils_verify_password


# Password reset request model
class ConfirmPasswordResetRequest:
    """Model for password reset confirmation request"""
    def __init__(self, oob_code: str, new_password: str):
        self.oob_code = oob_code
        self.new_password = new_password

logger = logging.getLogger(__name__)

class AuthService:
    @staticmethod
    @handle_service_errors
    def register_user(email: str, password: str) -> User:
        """
        Register a new user in Firebase Authentication

        Args:
            email: User's email address
            password: User's password

        Returns:
            User object on success

        Raises:
            ValidationError: If email or password is invalid
            ServiceError: If registration fails
        """
        # Validate required fields
        if not email or not password:
            raise ValidationError("Email and password are required")

        # Create user in Firebase Authentication
        firebase_user = _auth.create_user(email=email, password=password)

        # Convert email to Punycode
        punycode_email = convert_email_to_punycode(email)

        # Save user data in Firestore
        user_data = {
            "email": email,
            "email_punycode": punycode_email,
            "created_at": datetime.now(UTC).isoformat(),
            "last_login": None
        }

        _db.collection("users").document(firebase_user.uid).set(user_data)

        user = User(uid=str(firebase_user.uid), email=str(email))
        logger.info(f"✅ User registered with UID: {firebase_user.uid}")

        # Audit log
        AuthService._audit_log("USER_REGISTER", str(firebase_user.uid), {"email": email})

        return user

    @staticmethod
    def verify_user_identity(user_id: str) -> tuple[User | None, str | None]:
        """Verify user identity for account changes"""
        try:
            # Get user record from Firebase Auth
            user_record = _auth.get_user(user_id)
            user = User(uid=str(user_record.uid), email=str(user_record.email))
            return user, None

        except Exception as e:
            logger.error(f"User verification failed for user {user_id}: {str(e)}")
            return None, "User could not be verified"

    @staticmethod
    def login_user(email: str, password: str) -> tuple[User | None, str | None, str | None, str | None]:
        """
        Login user with email and password

        Args:
            email: User's email address
            password: User's password

        Returns:
            Tuple of (user, error, access_token, refresh_token)
        """
        logger.info(f"🔐 DEBUG: Starting login attempt for email: {email}")
        try:
            # Check for account lockout
            is_locked, lockout_message = AuthService.check_account_lockout(email)
            if is_locked:
                logger.warning(f"🚫 Login attempt blocked for locked account: {email}")
                logger.info(f"🔐 DEBUG: Account lockout detected for {email}")

                # Record security event for locked account access attempt
                tamper_detection_service.record_event(
                    event_type='LOCKED_ACCOUNT_ACCESS',
                    message=f'Login attempt on locked account: {email}',
                    severity='high',
                    metadata={
                        'email': email,
                        'ip': request.remote_addr if request else 'unknown',
                        'lockout_message': lockout_message
                    }
                )

                return None, lockout_message, None, None
            logger.info(f"🔐 DEBUG: No account lockout for {email}")

            # Sign in using Firebase REST API (Admin SDK doesn't support password auth)
            firebase_signin_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}"
            signin_response = requests.post(firebase_signin_url, json={
                "email": email,
                "password": password,
                "returnSecureToken": True
            }, timeout=10)

            if signin_response.status_code != 200:
                error_data = signin_response.json()
                error_message = error_data.get("error", {}).get("message", "UNKNOWN_ERROR")
                logger.warning(f"Firebase login failed: {error_message}")
                raise Exception(f"Firebase auth failed: {error_message}")

            signin_data = signin_response.json()
            user_uid = signin_data.get("localId")
            user_email = signin_data.get("email")

            if not user_uid:
                raise Exception("No user ID returned from Firebase")

            # Reset failed attempts on successful login
            AuthService.reset_failed_attempts(email)

            # Generate tokens
            access_token = AuthService.generate_access_token(user_uid)
            refresh_token = AuthService.generate_refresh_token(user_uid)

            # Store refresh token
            _db.collection("refresh_tokens").document(user_uid).set({
                "jwt_refresh_token": refresh_token,
                "created_at": datetime.now(UTC).isoformat()
            }, merge=True)

            user = User(uid=str(user_uid), email=str(user_email))
            logger.info(f"✅ Login successful for user: {user_uid}")

            # Audit log
            AuthService._audit_log("USER_LOGIN", str(user_uid), {"email": email})

            return user, None, access_token, refresh_token

        except Exception as e:
            # Record failed attempt
            AuthService.record_failed_attempt(email)

            # Record security event for failed login
            tamper_detection_service.record_event(
                event_type='FAILED_LOGIN',
                message=f'Failed login attempt for: {email}',
                severity='low',
                metadata={
                    'email': email,
                    'ip': request.remote_addr if request else 'unknown',
                    'error': str(e)[:100]
                }
            )

            logger.exception(f"🔥 Login failed for {email}: {str(e)}")
            return None, "Invalid email or password", None, None

    @staticmethod
    def login_with_id_token(id_token: str) -> tuple[User | None, str | None, str | None, str | None]:
        """Verifierar Firebase ID-token och genererar JWT tokens med account lockout protection"""
        email = None
        try:
            # Extract email from token for lockout check (safe since we only use it for logging)
            try:
                import base64
                if id_token and '.' in id_token:
                    header, payload, signature = id_token.split('.')
                    payload += '=' * (4 - len(payload) % 4)
                    decoded_payload = base64.urlsafe_b64decode(payload)
                    token_data = json.loads(decoded_payload)
                    email = token_data.get('email')
            except Exception:
                email = None

            # Check for account lockout before token verification
            if email:
                is_locked, lockout_message = AuthService.check_account_lockout(email)
                if is_locked:
                    logger.warning(f"🚫 Login attempt blocked for locked account: {email}")

                    # Record security event for locked account access attempt
                    tamper_detection_service.record_event(
                        event_type='LOCKED_ACCOUNT_ACCESS',
                        message=f'ID token login attempt on locked account: {email}',
                        severity='high',
                        metadata={
                            'email': email,
                            'ip': request.remote_addr if request else 'unknown',
                            'lockout_message': lockout_message
                        }
                    )

                    return None, f"Account is locked out due to too many failed attempts. {lockout_message}", None, None

            # Verify ID token with Firebase Admin SDK
            decoded_token = _auth.verify_id_token(id_token)
            user_id = decoded_token['uid']
            email = decoded_token.get('email')

            # Get user data from Firebase Authentication
            user_record = _auth.get_user(user_id)

            # Reset failed attempts on successful login
            if email:
                AuthService.reset_failed_attempts(email)

            # Generate JWT access token
            access_token = AuthService.generate_access_token(user_id)

            # Generate JWT refresh token
            refresh_token = AuthService.generate_refresh_token(user_id)

            # Save refresh token in Firestore
            _db.collection("refresh_tokens").document(user_id).set({
                "jwt_refresh_token": refresh_token,
                "created_at": datetime.now(UTC).isoformat()
            }, merge=True)

            user = User(uid=str(user_record.uid), email=str(user_record.email))
            logger.info(f"✅ Login successful for user with UID: {user_record.uid}")

            # Audit log
            AuthService._audit_log("USER_LOGIN", str(user_record.uid), {"email": str(user_record.email)})

            return user, None, access_token, refresh_token

        except Exception as e:
            # Try to extract email from unverified token for failed attempt logging
            # This is safe because we only use it for logging, not security decisions
            try:
                import base64
                if id_token and '.' in id_token:
                    header, payload, signature = id_token.split('.')
                    payload += '=' * (4 - len(payload) % 4)
                    decoded_payload = base64.urlsafe_b64decode(payload)
                    token_data = json.loads(decoded_payload)
                    unverified_email = token_data.get('email')
                    if unverified_email:
                        AuthService.record_failed_attempt(unverified_email)
            except Exception:
                # If we can't extract email, just log without recording failed attempt
                pass

            logger.exception(f"🔥 ID token verification failed: {str(e)}")
            return None, "Invalid ID token", None, None


    @staticmethod
    def refresh_token(user_id: str) -> tuple[str | None, str | None]:
        """Renew access token using our own JWT refresh token"""
        try:
            # Get our JWT refresh token from Firestore
            refresh_doc = _db.collection("refresh_tokens").document(user_id).get()
            if not refresh_doc.exists:
                logger.warning(f"⛔ No refresh token found for UID: {user_id}")
                return None, "Invalid refresh token"

            refresh_data = refresh_doc.to_dict()
            if not refresh_data:
                logger.warning(f"⛔ Empty refresh token data for UID: {user_id}")
                return None, "Invalid refresh token"

            jwt_refresh_token = refresh_data.get("jwt_refresh_token")

            if not jwt_refresh_token:
                logger.warning(f"⛔ No JWT refresh token found for UID: {user_id}")
                return None, "Invalid refresh token"

            # Verify our JWT refresh token
            try:
                payload = jwt.decode(jwt_refresh_token, JWT_REFRESH_SECRET_KEY, algorithms=["HS256"])
                token_user_id = payload.get("sub")

                if token_user_id != user_id:
                    logger.warning(f"⛔ Refresh token user_id mismatch: expected {user_id}, got {token_user_id}")
                    return None, "Invalid refresh token"

            except jwt.ExpiredSignatureError:
                logger.warning("⛔ Refresh token has expired")
                return None, "Refresh token has expired"
            except jwt.InvalidTokenError as e:
                logger.warning(f"⛔ Invalid refresh token: {str(e)}")
                return None, "Invalid refresh token"

            # Generate a new JWT access token
            new_access_token = AuthService.generate_access_token(user_id)

            logger.info(f"✅ Access token renewed for user: {user_id}")
            return new_access_token, None

        except Exception as e:
            logger.exception(f"🔥 Token renewal failed: {str(e)}")
            return None, "Internal error during token renewal"

    @staticmethod
    def generate_access_token(user_id: str) -> str:
        """Generate JWT access token"""
        return jwt.encode({
            "sub": user_id,
            "exp": datetime.now(UTC) + ACCESS_TOKEN_EXPIRES
        }, JWT_SECRET_KEY, algorithm="HS256")

    @staticmethod
    def generate_refresh_token(user_id: str) -> str:
        """Generate JWT refresh token"""
        return jwt.encode({
            "sub": user_id,
            "exp": datetime.now(UTC) + REFRESH_TOKEN_EXPIRES
        }, JWT_REFRESH_SECRET_KEY, algorithm="HS256")

    @staticmethod
    def logout(user_id: str) -> tuple[str | None, str | None]:
        """Remove refresh token on logout"""
        try:
            _db.collection("refresh_tokens").document(user_id).delete()
            logger.info(f"✅ User with UID: {user_id} has been logged out successfully.")

            # Audit log
            AuthService._audit_log("USER_LOGOUT", user_id, {})

            return "Logout successful", None
        except Exception as e:
            logger.exception(f"🔥 Error during logout: {str(e)}")
            return None, f"Internal error during logout: {str(e)}"

    @staticmethod
    def verify_token(token: str) -> tuple[str | None, str | None]:
        """Verify JWT token and return user_id if valid"""
        # CRITICAL FIX: Enhanced token validation with security checks
        try:
            # CRITICAL FIX: Validate token format before decoding
            if not token or len(token) < 20:
                logger.warning("⚠️ Invalid token format (too short)")
                return None, "Invalid token format"

            # CRITICAL FIX: Validate token structure (JWT has 3 parts separated by dots)
            if token.count('.') != 2:
                logger.warning("⚠️ Invalid token structure")
                return None, "Invalid token format"

            # Decode and verify token
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("sub")

            if not user_id:
                logger.warning("⚠️ Token missing user_id (sub claim)")
                return None, "Invalid token content"

            # CRITICAL FIX: Validate user_id format (should be alphanumeric)
            if not isinstance(user_id, str) or len(user_id) < 10:
                logger.warning(f"⚠️ Invalid user_id format: {user_id}")
                return None, "Invalid user ID in token"

            return user_id, None

        except jwt.ExpiredSignatureError:
            logger.warning("⚠️ Token expired")
            return None, "Token has expired"
        except jwt.InvalidTokenError as e:
            logger.warning(f"⚠️ Invalid token: {str(e)}")
            return None, "Invalid token"
        except Exception as e:
            logger.exception(f"🔥 Token verification failed: {str(e)}")
            return None, "Internal error during token verification"

    @staticmethod
    def jwt_required(f):
        """Decorator requiring valid JWT token - OPTIMIZED for performance"""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import g, request

            # Fast-path for OPTIONS preflight requests
            if request.method == 'OPTIONS':
                return ('', 204)

            # Get and validate authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return jsonify({"error": "Missing or invalid Authorization header"}), 401

            token = auth_header.split(" ")[1]
            user_id, error = AuthService.verify_token(token)
            if error:
                return jsonify({"error": error}), 401

            # Set user_id in Flask g context
            g.user_id = user_id

            return f(*args, **kwargs)
        return decorated_function

    # WebAuthn 2FA Methods
    @staticmethod
    def generate_webauthn_challenge(user_id: str) -> dict[str, Any]:
        """Generate WebAuthn challenge for registration using proper WebAuthn library"""
        try:
            # Generate registration options using webauthn library
            registration_options = generate_registration_options(
                rp_id=WEBAUTHN_RP_ID,
                rp_name=WEBAUTHN_RP_NAME,
                user_id=user_id.encode('utf-8'),
                user_name=user_id,
                user_display_name=user_id
            )

            # Store challenge temporarily
            challenge_b64 = bytes_to_base64url(registration_options.challenge)
            _db.collection("webauthn_challenges").document(user_id).set({
                "challenge": challenge_b64,
                "created_at": datetime.now(UTC).isoformat(),
                "type": "registration"
            })

            # Convert to dict for JSON response
            options_dict = options_to_json_dict(registration_options)
            return options_dict

        except Exception as e:
            logger.error(f"Failed to generate WebAuthn challenge: {str(e)}")
            raise

    @staticmethod
    def register_webauthn_credential(user_id: str, credential_data: dict[str, Any]) -> bool:
        """Register WebAuthn credential with full cryptographic verification"""
        try:
            # Get stored challenge
            challenge_doc = _db.collection("webauthn_challenges").document(user_id).get()
            if not challenge_doc.exists:
                logger.warning(f"No challenge found for user {user_id}")
                return False

            challenge_data = challenge_doc.to_dict()
            if not challenge_data:
                logger.warning(f"Empty challenge data for user {user_id}")
                return False

            stored_challenge_b64 = challenge_data.get("challenge")
            if not stored_challenge_b64:
                logger.warning(f"No challenge stored for user {user_id}")
                return False

            # Convert stored challenge back to bytes
            expected_challenge = base64url_to_bytes(stored_challenge_b64)

            # Verify the registration response using webauthn library
            verification = verify_registration_response(
                credential=credential_data,
                expected_challenge=expected_challenge,
                expected_origin=WEBAUTHN_ORIGIN,
                expected_rp_id=WEBAUTHN_RP_ID,
                require_user_verification=False
            )

            # Store verified credential
            credential_id_b64 = bytes_to_base64url(verification.credential_id)
            public_key_b64 = bytes_to_base64url(verification.credential_public_key)

            _db.collection("webauthn_credentials").document(credential_id_b64).set({
                "user_id": user_id,
                "credential_id": credential_id_b64,
                "public_key": public_key_b64,
                "sign_count": verification.sign_count,
                "created_at": datetime.now(UTC).isoformat()
            })

            # Clean up challenge
            _db.collection("webauthn_challenges").document(user_id).delete()

            # Audit log
            audit_service = AuditService()
            audit_service.log_event("WEBAUTHN_REGISTER", user_id, {"credential_id": credential_id_b64})

            logger.info(f"WebAuthn credential registered successfully for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"WebAuthn registration failed: {str(e)}")
            return False

    @staticmethod
    def authenticate_webauthn(user_id: str) -> dict[str, Any] | None:
        """Generate WebAuthn authentication options"""
        try:
            # Get stored credentials for this user
            credentials_query = _db.collection("webauthn_credentials").where(filter=FieldFilter("user_id", "==", user_id)).stream()
            credential_ids = []
            for doc in credentials_query:
                cred_data = doc.to_dict()
                credential_ids.append(base64url_to_bytes(cred_data["credential_id"]))

            if not credential_ids:
                logger.warning(f"No WebAuthn credentials found for user {user_id}")
                return None

            # Generate authentication options using webauthn library
            auth_options = generate_authentication_options(
                rp_id=WEBAUTHN_RP_ID,
                challenge=secrets.token_bytes(32),
                allow_credentials=credential_ids,
                user_verification=UserVerificationRequirement.PREFERRED
            )

            # Store challenge temporarily
            challenge_b64 = bytes_to_base64url(auth_options.challenge)
            _db.collection("webauthn_challenges").document(user_id).set({
                "challenge": challenge_b64,
                "created_at": datetime.now(UTC).isoformat(),
                "type": "authentication"
            })

            # Convert to dict for JSON response
            options_dict = options_to_json_dict(auth_options)
            return options_dict

        except Exception as e:
            logger.error(f"WebAuthn auth challenge generation failed: {str(e)}")
            return None

    @staticmethod
    def verify_webauthn_assertion(user_id: str, assertion_data: dict[str, Any]) -> bool:
        """Verify WebAuthn assertion with full cryptographic verification"""
        try:
            # Get stored challenge
            challenge_doc = _db.collection("webauthn_challenges").document(user_id).get()
            if not challenge_doc.exists:
                logger.warning(f"No challenge found for user {user_id}")
                return False

            challenge_data = challenge_doc.to_dict()
            if not challenge_data:
                logger.warning(f"Empty challenge data for user {user_id}")
                return False

            stored_challenge_b64 = challenge_data.get("challenge")
            if not stored_challenge_b64:
                logger.warning(f"No challenge stored for user {user_id}")
                return False

            # Get the credential being used
            credential_id_b64 = assertion_data.get("id")
            if not credential_id_b64:
                logger.warning("No credential ID in assertion")
                return False

            # Get stored credential
            credential_doc = _db.collection("webauthn_credentials").document(credential_id_b64).get()
            if not credential_doc.exists:
                logger.warning(f"Credential {credential_id_b64} not found")
                return False

            cred_data = credential_doc.to_dict()
            if not cred_data:
                logger.warning(f"Empty credential data for {credential_id_b64}")
                return False

            if cred_data.get("user_id") != user_id:
                logger.warning(f"Credential does not belong to user {user_id}")
                return False

            # Convert stored data back to bytes
            expected_challenge = base64url_to_bytes(stored_challenge_b64)
            credential_public_key = base64url_to_bytes(cred_data["public_key"])
            base64url_to_bytes(cred_data["credential_id"])

            # Verify the authentication response using webauthn library
            verification = verify_authentication_response(
                credential=assertion_data,
                expected_challenge=expected_challenge,
                expected_origin=WEBAUTHN_ORIGIN,
                expected_rp_id=WEBAUTHN_RP_ID,
                credential_public_key=credential_public_key,
                credential_current_sign_count=cred_data.get("sign_count", 0),
                require_user_verification=False
            )

            # Update sign count
            _db.collection("webauthn_credentials").document(credential_id_b64).update({
                "sign_count": verification.new_sign_count,
                "last_used": datetime.now(UTC).isoformat()
            })

            # Clean up challenge
            _db.collection("webauthn_challenges").document(user_id).delete()

            # Audit log
            audit_service = AuditService()
            audit_service.log_event("WEBAUTHN_AUTH", user_id, {"success": True, "credential_id": credential_id_b64})

            logger.info(f"WebAuthn authentication successful for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"WebAuthn assertion verification failed: {str(e)}")
            return False

    # Account Lockout Methods
    @staticmethod
    def check_account_lockout(email: str) -> tuple[bool, str | None]:
        """Check if account is currently locked out"""
        try:
            # Get failed attempts document
            doc_ref = _db.collection("failed_login_attempts").document(email)
            doc = doc_ref.get()

            if not doc.exists:
                return False, None

            data = doc.to_dict()
            if not data:
                return False, None

            lockout_until = data.get("lockout_until")

            if lockout_until:
                # Parse the lockout_until timestamp
                from ..utils.timestamp_utils import parse_iso_timestamp
                lockout_time = parse_iso_timestamp(lockout_until, default_to_now=False)
                current_time = datetime.now(UTC)

                if current_time < lockout_time:
                    remaining_minutes = int((lockout_time - current_time).total_seconds() / 60)
                    return True, f"Account is locked out. Try again in {remaining_minutes} minutes."
                else:
                    # Lockout has expired, reset attempts
                    AuthService.reset_failed_attempts(email)
                    return False, None

            return False, None

        except Exception as e:
            logger.error(f"Error checking account lockout for {email}: {str(e)}")
            return False, None

    @staticmethod
    def record_failed_attempt(email: str):
        """Record a failed login attempt"""
        try:
            doc_ref = _db.collection("failed_login_attempts").document(email)
            doc = doc_ref.get()

            current_time = datetime.now(UTC).isoformat()

            attempt_count = 1
            if doc.exists:
                data = doc.to_dict()
                if data:
                    attempt_count = data.get("attempt_count", 0) + 1
                else:
                    attempt_count = 1
                last_attempt = current_time

                # Calculate lockout duration based on attempt count
                lockout_until = None
                if attempt_count >= MAX_FAILED_LOGIN_ATTEMPTS:
                    if attempt_count < MAX_FAILED_LOGIN_ATTEMPTS * 2:
                        lockout_minutes = LOCKOUT_DURATION_MINUTES_FIRST
                    elif attempt_count < MAX_FAILED_LOGIN_ATTEMPTS * 3:
                        lockout_minutes = LOCKOUT_DURATION_MINUTES_SECOND
                    else:
                        lockout_minutes = LOCKOUT_DURATION_MINUTES_THIRD

                    from datetime import timedelta
                    lockout_until = (datetime.now(UTC) + timedelta(minutes=lockout_minutes)).isoformat()

                doc_ref.update({
                    "attempt_count": attempt_count,
                    "last_attempt": last_attempt,
                    "lockout_until": lockout_until
                })
            else:
                doc_ref.set({
                    "email": email,
                    "attempt_count": 1,
                    "last_attempt": current_time,
                    "lockout_until": None,
                    "created_at": current_time
                })

            logger.warning(f"Failed login attempt recorded for {email}, count: {attempt_count}")

        except Exception as e:
            logger.error(f"Error recording failed attempt for {email}: {str(e)}")

    @staticmethod
    def reset_failed_attempts(email: str):
        """Reset failed attempts after successful login"""
        try:
            doc_ref = _db.collection("failed_login_attempts").document(email)
            doc_ref.delete()
            logger.info(f"Failed attempts reset for {email}")
        except Exception as e:
            logger.error(f"Error resetting failed attempts for {email}: {str(e)}")

    # Password Reset Token Methods
    @staticmethod
    def generate_password_reset_token(user_id: str) -> str:
        """Generate a secure password reset token"""
        import secrets
        from datetime import datetime, timedelta

        # Generate a cryptographically secure random token
        token = secrets.token_urlsafe(32)

        # Create token hash for storage (never store plain token)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        # Store token in database with expiry (1 hour)
        expiry = (datetime.now(UTC) + timedelta(hours=1)).isoformat()

        try:
            _db.collection('password_reset_tokens').document(token_hash).set({
                'user_id': user_id,
                'created_at': datetime.now(UTC).isoformat(),
                'expires_at': expiry,
                'used': False
            })
            logger.info(f"Password reset token created for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to store password reset token: {str(e)}")
            raise

        return token

    @staticmethod
    def verify_password_reset_token(token: str) -> tuple[str | None, str | None]:
        """Verify a password reset token and return user_id if valid"""

        # Hash the provided token
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        try:
            # Get token from database
            token_doc = _db.collection('password_reset_tokens').document(token_hash).get()

            if not token_doc.exists:
                logger.warning("Password reset token not found")
                return None, "Invalid or expired reset token"

            token_data = token_doc.to_dict()
            if not token_data:
                logger.warning("Empty password reset token data")
                return None, "Invalid reset token"

            # Check if token is used
            if token_data.get('used', False):
                logger.warning("Password reset token already used")
                return None, "Reset token has already been used"

            # Check expiry
            expires_at = token_data.get('expires_at')
            if expires_at:
                from ..utils.timestamp_utils import parse_iso_timestamp
                expiry_time = parse_iso_timestamp(expires_at, default_to_now=False)
                current_time = datetime.now(UTC)

                if current_time > expiry_time:
                    logger.warning("Password reset token expired")
                    return None, "Reset token has expired"

            user_id = token_data.get('user_id')
            if not user_id:
                logger.error("Password reset token missing user_id")
                return None, "Invalid reset token"

            # Mark token as used
            _db.collection('password_reset_tokens').document(token_hash).update({
                'used': True,
                'used_at': datetime.now(UTC).isoformat()
            })

            logger.info(f"Password reset token verified for user {user_id}")
            return user_id, None

        except Exception as e:
            logger.error(f"Failed to verify password reset token: {str(e)}")
            return None, "Token verification failed"

    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """
        Verify a password against its hash using bcrypt

        Args:
            password: Plain text password
            hashed: Hashed password

        Returns:
            bool: True if password matches hash, False otherwise
        """
        return utils_verify_password(password, hashed)

    # Audit Integration
    @staticmethod
    def _audit_log(event_type: str, user_id: str, details: dict[str, Any]):
        """Internal audit logging"""
        try:
            from flask import request
            audit_service = AuditService()
            audit_service.log_event(event_type, user_id, details,
                                   ip_address=request.remote_addr if request else None,
                                   user_agent=request.headers.get("User-Agent") if request else None)
        except Exception as e:
            logger.error(f"Audit logging failed: {str(e)}")
