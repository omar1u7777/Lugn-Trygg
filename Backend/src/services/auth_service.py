from typing import Tuple, Optional, Dict, Any
from datetime import datetime, timezone
import logging
import jwt
import requests
import secrets
import hashlib
import base64
import json
from functools import wraps
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response
)
from webauthn.helpers import (
    base64url_to_bytes,
    bytes_to_base64url,
    options_to_json_dict
)
from flask import request, jsonify
from ..utils import convert_email_to_punycode  # Flyttad till utils.py
from ..firebase_config import (
    auth as firebase_auth,
    db,
)
from ..models.user import User
from ..services.audit_service import AuditService
from ..config import (
    JWT_SECRET_KEY,
    JWT_REFRESH_SECRET_KEY,
    ACCESS_TOKEN_EXPIRES,
    REFRESH_TOKEN_EXPIRES,
    FIREBASE_WEB_API_KEY,
    WEBAUTHN_RP_ID,
    WEBAUTHN_RP_NAME,
    WEBAUTHN_ORIGIN,
    MAX_FAILED_LOGIN_ATTEMPTS,
    LOCKOUT_DURATION_MINUTES_FIRST,
    LOCKOUT_DURATION_MINUTES_SECOND,
    LOCKOUT_DURATION_MINUTES_THIRD
)
from ..utils.error_handling import (
    handle_service_errors,
    ServiceError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ERROR_MESSAGES
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
        firebase_user = firebase_auth.create_user(email=email, password=password)

        # Convert email to Punycode
        punycode_email = convert_email_to_punycode(email)

        # Save user data in Firestore
        user_data = {
            "email": email,
            "email_punycode": punycode_email,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None
        }

        db.collection("users").document(firebase_user.uid).set(user_data)

        user = User(uid=str(firebase_user.uid), email=str(email))
        logger.info(f"✅ User registered with UID: {firebase_user.uid}")

        # Audit log
        AuthService._audit_log("USER_REGISTER", str(firebase_user.uid), {"email": email})

        return user

    @staticmethod
    def verify_user_identity(user_id: str) -> Tuple[Optional[User], Optional[str]]:
        """Verify user identity for account changes"""
        try:
            # Get user record from Firebase Auth
            user_record = firebase_auth.get_user(user_id)
            user = User(uid=str(user_record.uid), email=str(user_record.email))
            return user, None

        except Exception as e:
            logger.error(f"User verification failed for user {user_id}: {str(e)}")
            return None, "Användare kunde inte verifieras!"

    @staticmethod
    def login_user(email: str, password: str) -> Tuple[Optional[User], Optional[str], Optional[str], Optional[str]]:
        """
        Login user with email and password

        Args:
            email: User's email address
            password: User's password

        Returns:
            Tuple of (user, error, access_token, refresh_token)
        """
        try:
            # Check for account lockout
            is_locked, lockout_message = AuthService.check_account_lockout(email)
            if is_locked:
                logger.warning(f"🚫 Login attempt blocked for locked account: {email}")
                return None, lockout_message, None, None

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
            db.collection("refresh_tokens").document(user_uid).set({
                "jwt_refresh_token": refresh_token,
                "created_at": datetime.now(timezone.utc).isoformat()
            }, merge=True)

            user = User(uid=str(user_uid), email=str(user_email))
            logger.info(f"✅ Login successful for user: {user_uid}")

            # Audit log
            AuthService._audit_log("USER_LOGIN", str(user_uid), {"email": email})

            return user, None, access_token, refresh_token

        except Exception as e:
            # Record failed attempt
            AuthService.record_failed_attempt(email)

            logger.exception(f"🔥 Login failed for {email}: {str(e)}")
            return None, "Invalid email or password", None, None

    @staticmethod
    def login_with_id_token(id_token: str) -> Tuple[Optional[User], Optional[str], Optional[str], Optional[str]]:
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
                    return None, f"Account is locked out due to too many failed attempts. {lockout_message}", None, None

            # Verifiera ID-token med Firebase Admin SDK
            decoded_token = firebase_auth.verify_id_token(id_token)
            user_id = decoded_token['uid']
            email = decoded_token.get('email')

            # Hämta användardata från Firebase Authentication
            user_record = firebase_auth.get_user(user_id)

            # Reset failed attempts on successful login
            if email:
                AuthService.reset_failed_attempts(email)

            # Generera JWT access-token
            access_token = AuthService.generate_access_token(user_id)

            # Generera JWT refresh-token
            refresh_token = AuthService.generate_refresh_token(user_id)

            # Spara refresh-token i Firestore
            db.collection("refresh_tokens").document(user_id).set({
                "jwt_refresh_token": refresh_token,
                "created_at": datetime.now(timezone.utc).isoformat()
            }, merge=True)

            user = User(uid=str(user_record.uid), email=str(user_record.email))
            logger.info(f"✅ Inloggning lyckades för användare med UID: {user_record.uid}")

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

            logger.exception(f"🔥 Fel vid ID-token-verifiering: {str(e)}")
            return None, "Ogiltigt ID-token!", None, None


    @staticmethod
    def refresh_token(user_id: str) -> Tuple[Optional[str], Optional[str]]:
        """Förnyar access-token med hjälp av vår egen JWT refresh-token"""
        try:
            # Hämta vår JWT refresh-token från Firestore
            refresh_doc = db.collection("refresh_tokens").document(user_id).get()
            if not refresh_doc.exists:
                logger.warning(f"⛔ Ingen refresh-token hittades för UID: {user_id}")
                return None, "Ogiltigt refresh-token!"

            refresh_data = refresh_doc.to_dict()
            jwt_refresh_token = refresh_data.get("jwt_refresh_token")

            if not jwt_refresh_token:
                logger.warning(f"⛔ Ingen JWT refresh-token hittades för UID: {user_id}")
                return None, "Ogiltigt refresh-token!"

            # Verifiera vår JWT refresh-token
            try:
                payload = jwt.decode(jwt_refresh_token, JWT_REFRESH_SECRET_KEY, algorithms=["HS256"])
                token_user_id = payload.get("sub")

                if token_user_id != user_id:
                    logger.warning(f"⛔ Refresh-token user_id mismatch: expected {user_id}, got {token_user_id}")
                    return None, "Ogiltigt refresh-token!"

            except jwt.ExpiredSignatureError:
                logger.warning("⛔ Refresh-token har gått ut")
                return None, "Refresh-token har gått ut!"
            except jwt.InvalidTokenError as e:
                logger.warning(f"⛔ Ogiltigt refresh-token: {str(e)}")
                return None, "Ogiltigt refresh-token!"

            # Generera ett nytt JWT access-token
            new_access_token = AuthService.generate_access_token(user_id)

            logger.info(f"✅ Access-token förnyad för användare: {user_id}")
            return new_access_token, None

        except Exception as e:
            logger.exception(f"🔥 Fel vid förnyelse av token: {str(e)}")
            return None, "Ett internt fel uppstod vid token-förnyelse."

    @staticmethod
    def generate_access_token(user_id: str) -> str:
        """Genererar JWT access-token"""
        return jwt.encode({
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRES
        }, JWT_SECRET_KEY, algorithm="HS256")

    @staticmethod
    def generate_refresh_token(user_id: str) -> str:
        """Genererar JWT refresh-token"""
        return jwt.encode({
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + REFRESH_TOKEN_EXPIRES
        }, JWT_REFRESH_SECRET_KEY, algorithm="HS256")

    @staticmethod
    def logout(user_id: str) -> Tuple[Optional[str], Optional[str]]:
        """Tar bort refresh-token vid utloggning"""
        try:
            db.collection("refresh_tokens").document(user_id).delete()
            logger.info(f"✅ Användare med UID: {user_id} har loggats ut framgångsrikt.")

            # Audit log
            AuthService._audit_log("USER_LOGOUT", user_id, {})

            return "Utloggning lyckades!", None
        except Exception as e:
            logger.exception(f"🔥 Fel vid utloggning: {str(e)}")
            return None, f"Ett internt fel uppstod vid utloggning: {str(e)}"

    @staticmethod
    def verify_token(token: str) -> Tuple[Optional[str], Optional[str]]:
        """Verifierar JWT-token och returnerar user_id om giltig"""
        # CRITICAL FIX: Enhanced token validation with security checks
        try:
            # CRITICAL FIX: Validate token format before decoding
            if not token or len(token) < 20:
                logger.warning("⚠️ Invalid token format (too short)")
                return None, "Ogiltigt token-format!"
            
            # CRITICAL FIX: Validate token structure (JWT has 3 parts separated by dots)
            if token.count('.') != 2:
                logger.warning("⚠️ Invalid token structure")
                return None, "Ogiltigt token-format!"
            
            # Decode and verify token
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("sub")
            
            if not user_id:
                logger.warning("⚠️ Token missing user_id (sub claim)")
                return None, "Ogiltigt token-innehåll!"
            
            # CRITICAL FIX: Validate user_id format (should be alphanumeric)
            if not isinstance(user_id, str) or len(user_id) < 10:
                logger.warning(f"⚠️ Invalid user_id format: {user_id}")
                return None, "Ogiltigt användar-ID i token!"
            
            return user_id, None
            
        except jwt.ExpiredSignatureError:
            logger.warning("⚠️ Token expired")
            return None, "Token har gått ut!"
        except jwt.InvalidTokenError as e:
            logger.warning(f"⚠️ Invalid token: {str(e)}")
            return None, "Ogiltigt token!"
        except Exception as e:
            logger.exception(f"🔥 Fel vid token-verifiering: {str(e)}")
            return None, "Ett internt fel uppstod vid token-verifiering."

    @staticmethod
    def jwt_required(f):
        """Dekorator för att kräva giltig JWT-token - OPTIMIZED for performance"""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import request, g
            
            # Fast-path for OPTIONS preflight requests
            if request.method == 'OPTIONS':
                return ('', 204)
            
            # Get and validate authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return jsonify({"error": "Authorization header saknas eller är ogiltig!"}), 401

            token = auth_header.split(" ")[1]
            user_id, error = AuthService.verify_token(token)
            if error:
                return jsonify({"error": error}), 401

            # Set user_id in both g and request for compatibility
            g.user_id = user_id
            request.user_id = user_id
            
            return f(*args, **kwargs)
        return decorated_function

    # WebAuthn 2FA Methods
    @staticmethod
    def generate_webauthn_challenge(user_id: str) -> Dict[str, Any]:
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
            db.collection("webauthn_challenges").document(user_id).set({
                "challenge": challenge_b64,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "type": "registration"
            })

            # Convert to dict for JSON response
            options_dict = options_to_json_dict(registration_options)
            return options_dict

        except Exception as e:
            logger.error(f"Failed to generate WebAuthn challenge: {str(e)}")
            raise

    @staticmethod
    def register_webauthn_credential(user_id: str, credential_data: Dict[str, Any]) -> bool:
        """Register WebAuthn credential with full cryptographic verification"""
        try:
            # Get stored challenge
            challenge_doc = db.collection("webauthn_challenges").document(user_id).get()
            if not challenge_doc.exists:
                logger.warning(f"No challenge found for user {user_id}")
                return False

            challenge_data = challenge_doc.to_dict()
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

            db.collection("webauthn_credentials").document(credential_id_b64).set({
                "user_id": user_id,
                "credential_id": credential_id_b64,
                "public_key": public_key_b64,
                "sign_count": verification.sign_count,
                "created_at": datetime.now(timezone.utc).isoformat()
            })

            # Clean up challenge
            db.collection("webauthn_challenges").document(user_id).delete()

            # Audit log
            audit_service = AuditService()
            audit_service.log_event("WEBAUTHN_REGISTER", user_id, {"credential_id": credential_id_b64})

            logger.info(f"WebAuthn credential registered successfully for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"WebAuthn registration failed: {str(e)}")
            return False

    @staticmethod
    def authenticate_webauthn(user_id: str) -> Optional[Dict[str, Any]]:
        """Generate WebAuthn authentication options"""
        try:
            # Get stored credentials for this user
            from firebase_admin.firestore import FieldFilter
            credentials_query = db.collection("webauthn_credentials").where(filter=FieldFilter("user_id", "==", user_id)).stream()
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
                user_verification="preferred"
            )

            # Store challenge temporarily
            challenge_b64 = bytes_to_base64url(auth_options.challenge)
            db.collection("webauthn_challenges").document(user_id).set({
                "challenge": challenge_b64,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "type": "authentication"
            })

            # Convert to dict for JSON response
            options_dict = options_to_json_dict(auth_options)
            return options_dict

        except Exception as e:
            logger.error(f"WebAuthn auth challenge generation failed: {str(e)}")
            return None

    @staticmethod
    def verify_webauthn_assertion(user_id: str, assertion_data: Dict[str, Any]) -> bool:
        """Verify WebAuthn assertion with full cryptographic verification"""
        try:
            # Get stored challenge
            challenge_doc = db.collection("webauthn_challenges").document(user_id).get()
            if not challenge_doc.exists:
                logger.warning(f"No challenge found for user {user_id}")
                return False

            challenge_data = challenge_doc.to_dict()
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
            credential_doc = db.collection("webauthn_credentials").document(credential_id_b64).get()
            if not credential_doc.exists:
                logger.warning(f"Credential {credential_id_b64} not found")
                return False

            cred_data = credential_doc.to_dict()
            if cred_data.get("user_id") != user_id:
                logger.warning(f"Credential does not belong to user {user_id}")
                return False

            # Convert stored data back to bytes
            expected_challenge = base64url_to_bytes(stored_challenge_b64)
            credential_public_key = base64url_to_bytes(cred_data["public_key"])
            credential_id = base64url_to_bytes(cred_data["credential_id"])

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
            db.collection("webauthn_credentials").document(credential_id_b64).update({
                "sign_count": verification.new_sign_count,
                "last_used": datetime.now(timezone.utc).isoformat()
            })

            # Clean up challenge
            db.collection("webauthn_challenges").document(user_id).delete()

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
    def check_account_lockout(email: str) -> Tuple[bool, Optional[str]]:
        """Check if account is currently locked out"""
        try:
            # Get failed attempts document
            doc_ref = db.collection("failed_login_attempts").document(email)
            doc = doc_ref.get()

            if not doc.exists:
                return False, None

            data = doc.to_dict()
            lockout_until = data.get("lockout_until")

            if lockout_until:
                # Parse the lockout_until timestamp
                from ..utils.timestamp_utils import parse_iso_timestamp
                lockout_time = parse_iso_timestamp(lockout_until, default_to_now=False)
                current_time = datetime.now(timezone.utc)

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
            doc_ref = db.collection("failed_login_attempts").document(email)
            doc = doc_ref.get()

            current_time = datetime.now(timezone.utc).isoformat()

            attempt_count = 1
            if doc.exists:
                data = doc.to_dict()
                attempt_count = data.get("attempt_count", 0) + 1
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
                    lockout_until = (datetime.now(timezone.utc) + timedelta(minutes=lockout_minutes)).isoformat()

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
            doc_ref = db.collection("failed_login_attempts").document(email)
            doc_ref.delete()
            logger.info(f"Failed attempts reset for {email}")
        except Exception as e:
            logger.error(f"Error resetting failed attempts for {email}: {str(e)}")

    # Password Reset Token Methods
    @staticmethod
    def generate_password_reset_token(user_id: str) -> str:
        """Generate a secure password reset token"""
        import secrets
        import hashlib
        from datetime import datetime, timedelta

        # Generate a cryptographically secure random token
        token = secrets.token_urlsafe(32)

        # Create token hash for storage (never store plain token)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        # Store token in database with expiry (1 hour)
        expiry = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

        try:
            db.collection('password_reset_tokens').document(token_hash).set({
                'user_id': user_id,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'expires_at': expiry,
                'used': False
            })
            logger.info(f"Password reset token created for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to store password reset token: {str(e)}")
            raise

        return token

    @staticmethod
    def verify_password_reset_token(token: str) -> Tuple[Optional[str], Optional[str]]:
        """Verify a password reset token and return user_id if valid"""
        import hashlib

        # Hash the provided token
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        try:
            # Get token from database
            token_doc = db.collection('password_reset_tokens').document(token_hash).get()

            if not token_doc.exists:
                logger.warning("Password reset token not found")
                return None, "Invalid or expired reset token"

            token_data = token_doc.to_dict()

            # Check if token is used
            if token_data.get('used', False):
                logger.warning("Password reset token already used")
                return None, "Reset token has already been used"

            # Check expiry
            expires_at = token_data.get('expires_at')
            if expires_at:
                from ..utils.timestamp_utils import parse_iso_timestamp
                expiry_time = parse_iso_timestamp(expires_at, default_to_now=False)
                current_time = datetime.now(timezone.utc)

                if current_time > expiry_time:
                    logger.warning("Password reset token expired")
                    return None, "Reset token has expired"

            user_id = token_data.get('user_id')
            if not user_id:
                logger.error("Password reset token missing user_id")
                return None, "Invalid reset token"

            # Mark token as used
            db.collection('password_reset_tokens').document(token_hash).update({
                'used': True,
                'used_at': datetime.now(timezone.utc).isoformat()
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
    def _audit_log(event_type: str, user_id: str, details: Dict[str, Any]):
        """Internal audit logging"""
        try:
            from flask import request
            audit_service = AuditService()
            audit_service.log_event(event_type, user_id, details,
                                   ip_address=request.remote_addr if request else None,
                                   user_agent=request.headers.get("User-Agent") if request else None)
        except Exception as e:
            logger.error(f"Audit logging failed: {str(e)}")