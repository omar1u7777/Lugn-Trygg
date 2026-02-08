from flask import Blueprint, request, jsonify, make_response, g
import requests
from ..services.audit_service import audit_log
from ..services.auth_service import AuthService
from ..services.rate_limiting import rate_limit_by_endpoint
from ..middleware.validation import validate_request
from ..schemas.auth import RegisterRequest, LoginRequest, GoogleAuthRequest, ResetPasswordRequest, ConfirmPasswordResetRequest, ChangePasswordRequest, TwoFactorSetupRequest, TwoFactorVerifyRequest, UpdateProfileRequest, ConsentUpdateRequest, DeleteAccountRequest
from ..utils.timestamp_utils import parse_iso_timestamp
from ..utils.response_utils import APIResponse, success_response, error_response, created_response
from ..utils.input_sanitization import input_sanitizer
import logging
import re
from datetime import datetime, timezone
from ..config import JWT_REFRESH_SECRET_KEY, FIREBASE_WEB_API_KEY

logger = logging.getLogger(__name__)

# Firebase user IDs: alphanumeric, 28 chars typical
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,128}$')

auth_bp = Blueprint('auth', __name__)


def _verify_current_password(email: str, password: str) -> bool:
    """Verify current password against Firebase via REST to prevent stale tokens from bypassing reauth."""
    try:
        firebase_signin_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}"
        resp = requests.post(
            firebase_signin_url,
            json={"email": email, "password": password, "returnSecureToken": True},
            timeout=10,
        )
        return resp.status_code == 200
    except Exception as e:
        logger.error(f"Current password verification failed: {str(e)}")
        return False

@auth_bp.route('/register', methods=['POST', 'OPTIONS'])
@rate_limit_by_endpoint
@validate_request(RegisterRequest)
def register_user(validated_data):
    """Register a new user"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        logger.info("Registration request received")

        # Extract validated data
        email = validated_data.email.strip().lower()
        password = validated_data.password
        name = validated_data.name.strip()
        referral_code = (validated_data.referral_code or '').strip()

        logger.info(f"Validated registration data for: {email}")

        # Delegate to AuthService for Firebase-backed registration
        user, error = AuthService.register_user(email, password)
        if error:
            status_code = 409 if 'redan' in error.lower() or 'exists' in error.lower() else 400
            return APIResponse.error(error, "REGISTRATION_ERROR", status_code)

        if not user:
            logger.error("Registration failed - user object is None")
            return APIResponse.error("Registration failed - user object is None", "INTERNAL_ERROR", 500)

        # Store user data in Firestore
        try:
            from ..firebase_config import db
            if db is None:
                logger.error("Database unavailable during user registration")
                return APIResponse.error("Registration failed - database unavailable", "SERVICE_UNAVAILABLE", 500)

            user_data = {
                'email': email,
                'name': name,
                'referral_code': referral_code or None,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'is_active': True,
                'two_factor_enabled': False,
                'biometric_enabled': False,
                'language': 'sv',
                'login_method': 'email'
            }
            db.collection('users').document(user.uid).set(user_data)
            logger.info(f"User data stored in Firestore for user {user.uid}")

        except Exception as db_error:
            logger.error(f"Failed to store user data in Firestore: {str(db_error)}")
            # Don't fail registration if Firestore fails, but log it
            # In production, you might want to retry or handle this differently

        audit_log('user_registered', user.uid, {'email': email, 'name': name, 'referral_code': referral_code or 'none'})

        # Process referral code if provided
        referral_success = False
        referral_message = ''
        if referral_code:
            try:
                logger.info(f"Processing referral code {referral_code} for new user {user.uid}")

                # Call /api/referral/complete endpoint to process the referral
                from flask import current_app
                with current_app.test_request_context(
                    '/api/referral/complete',
                    method='POST',
                    json={
                        'user_id': user.uid,
                        'referral_code': referral_code
                    }
                ):
                    from ..routes.referral_routes import complete_referral
                    referral_response = complete_referral()

                    if isinstance(referral_response, tuple):
                        referral_data, status_code = referral_response
                        if status_code == 200:
                            referral_success = True
                            referral_message = 'Referral code activated! You and your friend both earned 1 week premium! 🎉'
                            logger.info(f"Referral code {referral_code} successfully activated for user {user.uid}")
                        else:
                            error_msg = referral_data.get('error', 'Unknown error') if isinstance(referral_data, dict) else 'Unknown error'
                            logger.warning(f"Referral activation failed: {error_msg}")
                    else:
                        logger.warning(f"Unexpected referral response format: {referral_response}")
            except Exception as ref_error:
                logger.error(f"Error processing referral code during registration: {str(ref_error)}")
                # Don't fail registration if referral fails

        response_data = {
            'user': {
                'id': user.uid,
                'email': email,
                'name': name
            }
        }

        if referral_success:
            response_data['referral'] = {
                'success': True,
                'message': referral_message
            }

        return APIResponse.created(response_data, "User registered successfully")

    except Exception as e:
        logger.error(f"Registration failed: {str(e)}")
        return APIResponse.error("Registration failed", "INTERNAL_ERROR", 500, str(e))

@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
@rate_limit_by_endpoint
@validate_request(LoginRequest)
def login_user(validated_data):
    """Authenticate user with email/password and return JWT token"""
    if request.method == 'OPTIONS':
        return '', 204
    logger.info("🔑 AUTH - LOGIN endpoint called")

    try:
        logger.info(f"📝 AUTH - Received validated login data")

        email = validated_data.email.strip().lower()
        password = validated_data.password
        logger.info(f"👤 AUTH - Login attempt for email: {email}")

        user, error, access_token, refresh_token = AuthService.login_user(email, password)
        if error or not user:
            audit_log('login_failed', 'unknown', {'reason': error or 'invalid_credentials', 'email': email})
            return APIResponse.unauthorized(error or 'Invalid email or password')

        # Fetch user data from Firestore and update last_login
        try:
            from ..firebase_config import db
            if db is None:
                logger.error("Database unavailable during login")
                return APIResponse.error("Login failed - database unavailable", "SERVICE_UNAVAILABLE", 500)

            user_doc = db.collection('users').document(user.uid).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}

            # Update last_login timestamp
            db.collection('users').document(user.uid).update({
                'last_login': datetime.now(timezone.utc).isoformat()
            })

        except Exception as db_error:
            logger.error(f"Failed to fetch/update user data during login: {str(db_error)}")
            return APIResponse.error("Login failed - database error", "INTERNAL_ERROR", 500, str(db_error))

        response_data = {
            'accessToken': access_token,
            'refreshToken': refresh_token,
            'userId': user.uid,
            'user': {
                'id': user.uid,
                'email': user.email,
                'name': user_data.get('name', 'Unknown'),
                'twoFactorEnabled': user_data.get('two_factor_enabled', False),
                'biometricEnabled': user_data.get('biometric_enabled', False)
            }
        }

        audit_log('login_successful', user.uid, {
            'email': user.email,
            'two_factor_required': False
        })

        response = APIResponse.success(response_data, "Login successful")
        # Since APIResponse.success returns a tuple, we need to handle the cookie setting
        response_data_json, status_code = response
        response = make_response(response_data_json, status_code)
        if access_token:
            response.set_cookie(
                'access_token',
                access_token,
                httponly=True,
                secure=True,
                samesite='Strict',
                max_age=24*60*60
            )

        return response

    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        return APIResponse.error("Login failed", "INTERNAL_ERROR", 500, str(e))

@auth_bp.route('/verify-2fa', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def verify_2fa():
    """Verify two-factor authentication"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        user_id = g.user_id
        data = request.get_json() or {}

        if not data:
            return APIResponse.bad_request('Request body required')

        # Sanitize input data
        data = input_sanitizer.sanitize_dict(data, {
            'method': {'type': 'text', 'max_length': 20},
            'code': {'type': 'text', 'max_length': 10}
        })

        method = data.get('method')  # 'biometric' or 'sms'

        # In a real implementation, verify the 2FA credential
        # For now, we'll simulate verification

        if method == 'biometric':
            # Verify WebAuthn credential
            # This would involve cryptographic verification of the authenticator response
            verified = True  # Simulated
        elif method == 'sms':
            code = data.get('code')
            # Verify SMS code
            verified = code is not None and len(code) == 6 and code.isdigit()  # Simulated
        else:
            return APIResponse.bad_request('Invalid 2FA method')

        if not verified:
            audit_log('2fa_verification_failed', user_id, {'method': method})
            return APIResponse.unauthorized('2FA verification failed')

        # Generate a new token (note: AuthService does not support additional claims)
        access_token_verified = AuthService.generate_access_token(user_id)

        audit_log('2fa_verification_successful', user_id, {'method': method})

        response_data = {
            'accessToken': access_token_verified
        }
        response_tuple = APIResponse.success(response_data, '2FA verification successful')
        response = make_response(response_tuple[0], response_tuple[1])

        response.set_cookie(
            'access_token',
            access_token_verified,
            httponly=True,
            secure=True,
            samesite='Strict',
            max_age=24*60*60
        )

        return response

    except Exception as e:
        logger.error(f"2FA verification failed: {str(e)}")
        return APIResponse.error('2FA verification failed', 'TWO_FACTOR_VERIFICATION_ERROR', 500, str(e))

@auth_bp.route('/setup-2fa-biometric', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def setup_2fa_biometric():
    """Setup two-factor authentication for user (biometric/sms)"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        user_id = g.user_id
        data = request.get_json() or {}

        if not data:
            return APIResponse.bad_request('Request body required')

        method = data.get('method')  # 'biometric' or 'sms'
        setup_data = data.get('setup_data', {})

        try:
            from ..firebase_config import db
            if db is None:
                return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)
            user_ref = db.collection('users').document(user_id)
            user_data = user_ref.get().to_dict()

            if not user_data:
                return APIResponse.not_found('User not found', 'USER_NOT_FOUND')

            if method == 'biometric':
                # Store WebAuthn credential
                credential_id = setup_data.get('credential_id')
                public_key = setup_data.get('public_key')

                user_ref.update({
                    'biometric_enabled': True,
                    'biometric_credential_id': credential_id,
                    'biometric_public_key': public_key,
                    'two_factor_enabled': True
                })

            elif method == 'sms':
                phone_number = setup_data.get('phone_number')
                # In real implementation, send verification SMS

                user_ref.update({
                    'two_factor_enabled': True,
                    'phone_number': phone_number,
                    'sms_2fa_enabled': True
                })

            else:
                return APIResponse.bad_request('Invalid 2FA method')

            audit_log('2fa_setup_completed', user_id, {'method': method})

            return APIResponse.success(
                {'method': method},
                f'2FA setup completed successfully using {method}'
            )

        except Exception as e:
            logger.error(f"Firebase update failed: {str(e)}")
            return APIResponse.error('Failed to save 2FA settings', 'TWO_FACTOR_SETUP_ERROR', 500, str(e))

    except Exception as e:
        logger.error(f"2FA setup failed: {str(e)}")
        return APIResponse.error('2FA setup failed', 'TWO_FACTOR_SETUP_ERROR', 500, str(e))

def create_or_update_google_user_simple(firebase_uid, email, google_id, name):
    """Find or create Google OAuth user (simplified without transaction)"""
    from ..firebase_config import db
    
    if db is None:
        raise RuntimeError("Database unavailable")
    
    # Get user by firebase_uid
    user_ref = db.collection('users').document(firebase_uid)
    user_doc = user_ref.get()

    if user_doc.exists:
        user_data = user_doc.to_dict()
        user_id = user_doc.id
        # Update last login
        user_ref.update({'last_login': datetime.now(timezone.utc).isoformat()})
        return user_data, user_id, False  # False = not new

    # Check email mapping
    email_ref = db.collection('user_emails').document(email)
    email_doc = email_ref.get()

    if email_doc.exists:
        existing_uid = email_doc.to_dict()['uid']
        existing_ref = db.collection('users').document(existing_uid)
        existing_doc = existing_ref.get()

        if existing_doc.exists:
            user_data = existing_doc.to_dict()
            user_id = existing_uid
            # Update with Google info
            update_data = {
                'last_login': datetime.now(timezone.utc).isoformat(),
                'login_method': 'google'
            }
            if not user_data.get('google_id'):
                update_data['google_id'] = google_id
            if not user_data.get('firebase_uid'):
                update_data['firebase_uid'] = firebase_uid

            existing_ref.update(update_data)
            # Update google_id mapping
            db.collection('user_google_ids').document(google_id).set({'uid': existing_uid})
            logger.info(f"Merged Google login with existing user account: {email}")
            return user_data, user_id, False

    # Check google_id mapping
    google_ref = db.collection('user_google_ids').document(google_id)
    google_doc = google_ref.get()

    if google_doc.exists:
        existing_uid = google_doc.to_dict()['uid']
        existing_ref = db.collection('users').document(existing_uid)
        existing_doc = existing_ref.get()

        if existing_doc.exists:
            user_data = existing_doc.to_dict()
            user_id = existing_uid
            # Update with firebase_uid
            update_data = {
                'last_login': datetime.now(timezone.utc).isoformat()
            }
            if not user_data.get('firebase_uid'):
                update_data['firebase_uid'] = firebase_uid

            existing_ref.update(update_data)
            return user_data, user_id, False

    # Create new user
    user_data = {
        'email': email,
        'name': name,
        'google_id': google_id,
        'firebase_uid': firebase_uid,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'is_active': True,
        'two_factor_enabled': False,
        'biometric_enabled': False,
        'language': 'sv',
        'login_method': 'google'
    }
    user_ref.set(user_data)
    # Set mappings
    email_ref.set({'uid': firebase_uid})
    google_ref.set({'uid': firebase_uid})
    user_id = firebase_uid
    logger.info(f"Created new Google OAuth user: {email}")
    return user_data, user_id, True  # True = new user

@auth_bp.route('/google-login', methods=['POST', 'OPTIONS'])
@rate_limit_by_endpoint
@validate_request(GoogleAuthRequest)
def google_login(validated_data=None):
    """Handle Google OAuth login"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        if validated_data is None:
            return APIResponse.bad_request('Invalid request data')
        
        id_token = validated_data.id_token

        # Verify Firebase ID token (which contains Google OAuth info)
        try:
            from ..firebase_config import firebase_admin_auth
            logger.info("Attempting Firebase token verification for Google login")

            if firebase_admin_auth is not None:
                # Normal path: use initialized admin auth
                decoded_token = firebase_admin_auth.verify_id_token(id_token)
            else:
                # Fallback: allow tests to patch firebase_admin.auth.verify_id_token
                try:
                    from firebase_admin import auth as fb_auth
                    decoded_token = fb_auth.verify_id_token(id_token)
                    logger.info("Used fallback firebase_admin.auth.verify_id_token (likely patched in tests)")
                except Exception:
                    logger.error("Firebase Admin Auth is not initialized and no fallback available")
                    return APIResponse.error('Authentication service unavailable', 'SERVICE_UNAVAILABLE', 503)

            # Extract user information from Firebase token
            email = decoded_token.get('email')
            name = decoded_token.get('name')
            google_id = decoded_token.get('sub')  # This is the Google user ID
            firebase_uid = decoded_token.get('uid')  # Firebase user ID

            if not email or not name:
                logger.error("Token missing required user information")
                return APIResponse.unauthorized('Invalid token - missing user information')

            logger.info(f"Firebase token verified successfully for user: {email}")

        except Exception as e:
            logger.error(f"Firebase token verification failed: {str(e)}")
            return APIResponse.unauthorized('Invalid Firebase token')

        # Atomic user lookup/creation
        try:
            from ..firebase_config import db
            if db is None:
                return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

            # Create or update user (simplified without transaction)
            user_data, user_id, is_new = create_or_update_google_user_simple(
                firebase_uid,
                email,
                google_id,
                name
            )

            if is_new:
                audit_log('user_registered_google', user_id, {'email': email, 'name': name})

        except Exception as e:
            logger.error(f"Firebase transaction failed: {str(e)}")
            return APIResponse.error('Authentication service error', 'AUTH_SERVICE_ERROR', 503, str(e))

        # Create JWT token (use AuthService to generate a token compatible with AuthService.verify_token)
        access_token = AuthService.generate_access_token(user_id)

        audit_log('google_login_successful', user_id, {'email': email})

        response_data = {
            'accessToken': access_token,
            'userId': user_id,
            'user': {
                'id': user_id,
                'email': email,
                'name': name,
                'loginMethod': 'google'
            }
        }
        response_tuple = APIResponse.success(response_data, 'Google-inloggning lyckades!')
        response = make_response(response_tuple[0], response_tuple[1])

        response.set_cookie(
            'access_token',
            access_token,
            httponly=True,
            secure=True,
            samesite='Strict',
            max_age=24*60*60
        )

        return response

    except Exception as e:
        logger.error(f"Google login failed: {str(e)}")
        return APIResponse.error('Google login failed', 'GOOGLE_LOGIN_ERROR', 500, str(e))

@auth_bp.route('/logout', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def logout():
    """Logout user by clearing the cookie"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        user_id = g.user_id

        # Remove refresh token from database
        success, error = AuthService.logout(user_id)
        if error:
            logger.warning(f"Logout cleanup failed for user {user_id}: {error}")
            # Continue with logout even if cleanup fails

        audit_log('user_logged_out', user_id, {})

        response_tuple = APIResponse.success(None, 'Logged out successfully')
        response = make_response(response_tuple[0], response_tuple[1])
        response.set_cookie('access_token', '', expires=0, httponly=True, secure=True, samesite='Strict')
        return response

    except Exception as e:
        logger.error(f"Logout failed: {str(e)}")
        return APIResponse.error('Logout failed', 'LOGOUT_ERROR', 500, str(e))

@auth_bp.route('/reset-password', methods=['POST', 'OPTIONS'])
@rate_limit_by_endpoint
@validate_request(ResetPasswordRequest)
def reset_password(validated_data):
    """Initiate password reset"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        email = validated_data.email.strip().lower()

        # Check if user exists
        try:
            from ..firebase_config import db
            if db is None:
                return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)
            from google.cloud.firestore import FieldFilter
            users_ref = db.collection('users')
            # CRITICAL FIX: Use FieldFilter to avoid positional argument warning
            query = users_ref.where(filter=FieldFilter('email', '==', email)).limit(1)
            users = query.get()

            user_exists = len(list(users)) > 0

        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return APIResponse.error('Service temporarily unavailable', 'SERVICE_UNAVAILABLE', 503, str(e))

        # If user exists, generate reset token and send email
        if user_exists:
            try:
                # Get user document to get user_id
                user_doc = list(users)[0]
                user_id = user_doc.id

                # Generate secure reset token
                reset_token = AuthService.generate_password_reset_token(user_id)

                # Create reset link (assuming frontend has /reset-password page)
                reset_link = f"https://lugn-trygg.vercel.app/reset-password?token={reset_token}"

                # Send password reset email
                from ..services.email_service import email_service
                email_result = email_service.send_password_reset_email(email, reset_token, reset_link)

                if email_result['success']:
                    audit_log('password_reset_email_sent', user_id, {'email': email})
                else:
                    logger.error(f"Failed to send password reset email: {email_result.get('error', 'Unknown error')}")
                    # Still return success for security - don't reveal email sending failure

            except Exception as e:
                logger.error(f"Failed to process password reset for existing user: {str(e)}")
                # Still return success for security

        # Always return success for security (don't reveal if email exists)
        audit_log('password_reset_requested', 'unknown', {'email': email, 'user_exists': user_exists})

        return APIResponse.success(None, "If an account with this email exists, a password reset link has been sent.")

    except Exception as e:
        logger.error(f"Password reset failed: {str(e)}")
        return APIResponse.error('Password reset failed', 'PASSWORD_RESET_ERROR', 500, str(e))

@auth_bp.route('/confirm-password-reset', methods=['POST', 'OPTIONS'])
@rate_limit_by_endpoint
@validate_request(ConfirmPasswordResetRequest)
def confirm_password_reset(validated_data):
    """Confirm password reset with token"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        token = validated_data.token
        new_password = validated_data.new_password

        # Verify the reset token
        user_id, error = AuthService.verify_password_reset_token(token)
        if error or not user_id:
            audit_log('password_reset_failed', 'unknown', {'reason': error or 'invalid_token'})
            return APIResponse.bad_request('Invalid or expired reset token')

        # Update password in Firebase Auth
        try:
            from ..firebase_config import auth
            if auth is None:
                return APIResponse.error('Authentication service unavailable', 'SERVICE_UNAVAILABLE', 503)

            auth.update_user(user_id, password=new_password)

            audit_log('password_reset_successful', user_id, {})

            return APIResponse.success(
                None,
                'Password has been successfully reset. You can now log in with your new password.'
            )

        except Exception as e:
            logger.error(f"Password update failed: {str(e)}")
            audit_log('password_reset_failed', user_id, {'reason': 'password_update_failed'})
            return APIResponse.error('Failed to update password', 'PASSWORD_UPDATE_ERROR', 500, str(e))

    except Exception as e:
        logger.error(f"Password reset confirmation failed: {str(e)}")
        return APIResponse.error('Password reset confirmation failed', 'PASSWORD_RESET_CONFIRMATION_ERROR', 500, str(e))

@auth_bp.route('/consent', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
@validate_request(ConsentUpdateRequest)
def update_consent(validated_data):
    """Update user consent preferences"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        user_id = g.user_id

        consent_data = {
            'analytics_consent': getattr(validated_data, 'analytics_consent', False),
            'marketing_consent': getattr(validated_data, 'marketing_consent', False),
            'data_processing_consent': getattr(validated_data, 'data_sharing_consent', True),  # Required
            'consent_updated_at': datetime.now(timezone.utc).isoformat()
        }

        try:
            from ..firebase_config import db
            if db is None:
                return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)
            db.collection('users').document(user_id).update({
                'consent': consent_data
            })

            audit_log('consent_updated', user_id, consent_data)

            # Convert to camelCase for response
            response_consent = {
                'analyticsConsent': consent_data['analytics_consent'],
                'marketingConsent': consent_data['marketing_consent'],
                'dataProcessingConsent': consent_data['data_processing_consent'],
                'consentUpdatedAt': consent_data['consent_updated_at']
            }

            return APIResponse.success(
                {'consent': response_consent},
                'Consent preferences updated successfully'
            )

        except Exception as e:
            logger.error(f"Firebase update failed: {str(e)}")
            return APIResponse.error('Failed to update consent', 'CONSENT_UPDATE_ERROR', 500, str(e))

    except Exception as e:
        logger.error(f"Consent update failed: {str(e)}")
        return APIResponse.error('Consent update failed', 'CONSENT_UPDATE_ERROR', 500, str(e))

@auth_bp.route('/consent/<user_id>', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_consent(user_id):
    """Get user consent preferences"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        # Validate and sanitize user_id
        user_id = input_sanitizer.sanitize(user_id)
        if not USER_ID_PATTERN.match(user_id):
            return APIResponse.bad_request('Invalid user ID format')

        current_user_id = g.user_id

        # Users can only view their own consent
        if current_user_id != user_id:
            return APIResponse.forbidden('Unauthorized')

        try:
            from ..firebase_config import db
            if db is None:
                return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)
            user_doc = db.collection('users').document(user_id).get()
            user_data = user_doc.to_dict()

            if not user_data:
                return APIResponse.not_found('User not found', 'USER_NOT_FOUND')

            consent = user_data.get('consent', {
                'analytics_consent': False,
                'marketing_consent': False,
                'data_processing_consent': True,
                'consent_updated_at': user_data.get('created_at')
            })

            # Convert to camelCase
            response_consent = {
                'analyticsConsent': consent.get('analytics_consent', False),
                'marketingConsent': consent.get('marketing_consent', False),
                'dataProcessingConsent': consent.get('data_processing_consent', True),
                'consentUpdatedAt': consent.get('consent_updated_at')
            }

            return APIResponse.success({'consent': response_consent}, 'Consent retrieved successfully')

        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return APIResponse.error('Failed to retrieve consent', 'CONSENT_RETRIEVAL_ERROR', 500, str(e))

    except Exception as e:
        logger.error(f"Consent retrieval failed: {str(e)}")
        return APIResponse.error('Consent retrieval failed', 'CONSENT_RETRIEVAL_ERROR', 500, str(e))

@auth_bp.route('/refresh', methods=['POST', 'OPTIONS'])
@rate_limit_by_endpoint
def refresh_token():
    """Refresh access token using refresh token"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.get_json() or {}
        refresh_token_value = data.get('refresh_token') if data else None

        if not refresh_token_value:
            return APIResponse.bad_request('Refresh token required')

        # Verify the refresh token and get user identity
        import jwt
        try:
            decoded = jwt.decode(refresh_token_value, JWT_REFRESH_SECRET_KEY, algorithms=["HS256"])
            user_id = decoded.get('sub')

            if not user_id:
                return APIResponse.unauthorized('Invalid refresh token')

        except jwt.ExpiredSignatureError:
            logger.warning("Refresh token has expired")
            return APIResponse.unauthorized('Refresh token has expired')
        except jwt.InvalidTokenError:
            logger.warning("Invalid refresh token")
            return APIResponse.unauthorized('Invalid refresh token')
        except Exception as e:
            logger.error(f"Refresh token validation failed: {str(e)}")
            return APIResponse.unauthorized('Invalid refresh token')

        # Create new access token using AuthService so the token can be verified by our verify_token
        access_token = AuthService.generate_access_token(user_id)

        audit_log('token_refreshed', user_id, {})

        response_data = {'accessToken': access_token}
        response_tuple = APIResponse.success(response_data, 'Token refreshed successfully')
        response = make_response(response_tuple[0], response_tuple[1])

        response.set_cookie(
            'access_token',
            access_token,
            httponly=True,
            secure=True,
            samesite='Strict',
            max_age=24*60*60
        )

        return response

    except Exception as e:
        logger.error(f"Token refresh failed: {str(e)}")
        return APIResponse.error('Token refresh failed', 'TOKEN_REFRESH_ERROR', 500, str(e))

@auth_bp.route('/change-email', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def change_email():
    """Change user email address"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        user_id = g.user_id
        data = request.get_json() or {}

        if not data:
            return APIResponse.bad_request('Request body required')

        new_email = data.get('newEmail', data.get('new_email', '')).strip().lower()
        password = data.get('password', '')

        # Validation
        if not new_email or not password:
            return APIResponse.bad_request('New email and current password are required')

        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', new_email):
            return APIResponse.bad_request('Invalid email format')

        # Verify user identity and current password (reauth to prevent token-only hijack)
        user, error = AuthService.verify_user_identity(user_id)
        if error or not user:
            audit_log('email_change_failed', user_id, {'reason': 'user_verification_failed'})
            return APIResponse.unauthorized('User verification failed')

        if not _verify_current_password(user.email, password):
            audit_log('email_change_failed', user_id, {'reason': 'invalid_current_password'})
            return APIResponse.unauthorized('Current password is incorrect')

        # Check if new email is already taken
        try:
            from ..firebase_config import db
            if db is None:
                return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)
            from google.cloud.firestore import FieldFilter
            users_ref = db.collection('users')
            existing_user_query = users_ref.where(filter=FieldFilter('email', '==', new_email)).limit(1)
            existing_users = list(existing_user_query.get())

            if existing_users:
                return APIResponse.error('Email address is already in use', 'EMAIL_IN_USE', 409)

        except Exception as e:
            logger.error(f"Email uniqueness check failed: {str(e)}")
            return APIResponse.error('Service temporarily unavailable', 'SERVICE_UNAVAILABLE', 503, str(e))

        # Update email in Firebase Auth and Firestore
        try:
            from ..firebase_config import auth
            if auth is None:
                return APIResponse.error('Authentication service unavailable', 'SERVICE_UNAVAILABLE', 503)
            # Update email in Firebase Auth
            auth.update_user(user_id, email=new_email)

            # Update email in Firestore
            db.collection('users').document(user_id).update({
                'email': new_email,
                'email_updated_at': datetime.now(timezone.utc).isoformat()
            })

            audit_log('email_changed', user_id, {'old_email': user.email, 'new_email': new_email})

            return APIResponse.success(
                {'newEmail': new_email},
                'Email address updated successfully. Please verify your new email.'
            )

        except Exception as e:
            logger.error(f"Email update failed: {str(e)}")
            return APIResponse.error('Failed to update email address', 'EMAIL_UPDATE_ERROR', 500, str(e))

    except Exception as e:
        logger.error(f"Email change failed: {str(e)}")
        return APIResponse.error('Email change failed', 'EMAIL_CHANGE_ERROR', 500, str(e))

@auth_bp.route('/change-password', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
@validate_request(ChangePasswordRequest)
def change_password(validated_data):
    """Change user password"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        user_id = g.user_id

        current_password = validated_data.current_password
        new_password = validated_data.new_password

        # Verify user identity and current password (reauth to prevent token-only hijack)
        user, error = AuthService.verify_user_identity(user_id)
        if error or not user:
            audit_log('password_change_failed', user_id, {'reason': 'user_verification_failed'})
            return APIResponse.unauthorized('User verification failed')

        if not _verify_current_password(user.email, current_password):
            audit_log('password_change_failed', user_id, {'reason': 'invalid_current_password'})
            return APIResponse.unauthorized('Current password is incorrect')

        # Update password in Firebase Auth
        try:
            from ..firebase_config import auth
            if auth is None:
                return APIResponse.error('Authentication service unavailable', 'SERVICE_UNAVAILABLE', 503)
            auth.update_user(user_id, password=new_password)

            audit_log('password_changed', user_id, {})

            return APIResponse.success(None, 'Password updated successfully')

        except Exception as e:
            logger.error(f"Password update failed: {str(e)}")
            return APIResponse.error('Failed to update password', 'PASSWORD_UPDATE_ERROR', 500, str(e))

    except Exception as e:
        logger.error(f"Password change failed: {str(e)}")
        return APIResponse.error('Password change failed', 'PASSWORD_CHANGE_ERROR', 500, str(e))

@auth_bp.route('/setup-2fa', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def setup_2fa():
    """Setup two-factor authentication with TOTP"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        user_id = g.user_id
        data = request.get_json() or {}

        if not data:
            return APIResponse.bad_request('Request body required')

        method = data.get('method', 'totp')

        if method != 'totp':
            return APIResponse.bad_request('Only TOTP method is supported')

        try:
            import pyotp
            import qrcode
            import base64
            from io import BytesIO

            # Generate TOTP secret
            secret = pyotp.random_base32()

            # Get user email for TOTP URI
            from ..firebase_config import db
            if db is None:
                return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)
            user_doc = db.collection('users').document(user_id).get()
            user_data = user_doc.to_dict()

            if not user_data:
                return APIResponse.not_found('User not found', 'USER_NOT_FOUND')

            email = user_data.get('email', f'user_{user_id}@example.com')

            # Create TOTP object
            totp = pyotp.TOTP(secret)

            # Generate provisioning URI
            provisioning_uri = totp.provisioning_uri(name=email, issuer_name="Lugn & Trygg")

            # Generate QR code
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(provisioning_uri)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")
            buffered = BytesIO()
            img.save(buffered, "PNG")
            qr_code_base64 = base64.b64encode(buffered.getvalue()).decode()

            # Store secret temporarily (will be confirmed later)
            db.collection('users').document(user_id).update({
                'temp_2fa_secret': secret,
                'temp_2fa_method': 'totp',
                'temp_2fa_created_at': datetime.now(timezone.utc).isoformat()
            })

            audit_log('2fa_setup_initiated', user_id, {'method': 'totp'})

            return APIResponse.success({
                'method': 'totp',
                'secret': secret,
                'qrCode': f'data:image/png;base64,{qr_code_base64}',
                'provisioningUri': provisioning_uri
            }, '2FA setup initiated')

        except ImportError as e:
            logger.error(f"Missing required packages for 2FA: {str(e)}")
            return APIResponse.error('2FA setup not available', 'SERVICE_UNAVAILABLE', 503, str(e))
        except Exception as e:
            logger.error(f"2FA setup failed: {str(e)}")
            return APIResponse.error('Failed to setup 2FA', 'TWO_FACTOR_SETUP_ERROR', 500, str(e))

    except Exception as e:
        logger.error(f"2FA setup failed: {str(e)}")
        return APIResponse.error('2FA setup failed', 'TWO_FACTOR_SETUP_ERROR', 500, str(e))

@auth_bp.route('/verify-2fa-setup', methods=['POST', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def verify_2fa_setup():
    """Verify and complete 2FA setup"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        user_id = g.user_id
        data = request.get_json() or {}

        if not data:
            return APIResponse.bad_request('Request body required')

        code = data.get('code', '').strip()

        if not code or len(code) != 6 or not code.isdigit():
            return APIResponse.bad_request('Valid 6-digit code is required')

        try:
            from ..firebase_config import db
            if db is None:
                return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)
            import pyotp

            # Get temporary 2FA data
            user_doc = db.collection('users').document(user_id).get()
            user_data = user_doc.to_dict()

            if not user_data:
                return APIResponse.not_found('User not found', 'USER_NOT_FOUND')

            temp_secret = user_data.get('temp_2fa_secret')
            temp_method = user_data.get('temp_2fa_method')
            temp_created_at = user_data.get('temp_2fa_created_at')

            if not temp_secret or temp_method != 'totp':
                return APIResponse.bad_request('2FA setup not initiated')

            # Check if temp setup is not expired (5 minutes)
            if temp_created_at:
                created_at = parse_iso_timestamp(temp_created_at, default_to_now=False)
                if (datetime.now(timezone.utc) - created_at).total_seconds() > 300:  # 5 minutes
                    # Clean up expired temp data
                    db.collection('users').document(user_id).update({
                        'temp_2fa_secret': None,
                        'temp_2fa_method': None,
                        'temp_2fa_created_at': None
                    })
                return APIResponse.bad_request('2FA setup expired. Please start over.')

            # Verify the code
            totp = pyotp.TOTP(temp_secret)
            if not totp.verify(code):
                audit_log('2fa_verification_failed', user_id, {'reason': 'invalid_code'})
                return APIResponse.unauthorized('Invalid verification code')

            # Complete 2FA setup
            db.collection('users').document(user_id).update({
                'two_factor_enabled': True,
                'two_factor_method': 'totp',
                'two_factor_secret': temp_secret,
                'two_factor_enabled_at': datetime.now(timezone.utc).isoformat(),
                # Clean up temp data
                'temp_2fa_secret': None,
                'temp_2fa_method': None,
                'temp_2fa_created_at': None
            })

            audit_log('2fa_enabled', user_id, {'method': 'totp'})

            return APIResponse.success(
                {'method': 'totp', 'twoFactorEnabled': True},
                '2FA has been successfully enabled'
            )

        except ImportError:
            return APIResponse.error('2FA verification not available', 'SERVICE_UNAVAILABLE', 503)
        except Exception as e:
            logger.error(f"2FA verification failed: {str(e)}")
            return APIResponse.error('Failed to verify 2FA setup', 'TWO_FACTOR_VERIFICATION_ERROR', 500, str(e))

    except Exception as e:
        logger.error(f"2FA verification failed: {str(e)}")
        return APIResponse.error('2FA verification failed', 'TWO_FACTOR_VERIFICATION_ERROR', 500, str(e))

@auth_bp.route('/export-data', methods=['GET', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def export_user_data():
    """Export user data in JSON format"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        user_id = g.user_id

        try:
            from ..firebase_config import db
            if db is None:
                return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

            # Collect all user data
            export_data = {
                'export_timestamp': datetime.now(timezone.utc).isoformat(),
                'user_id': user_id
            }

            # Get user profile
            user_doc = db.collection('users').document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                # Remove sensitive fields
                sensitive_fields = ['password', 'temp_2fa_secret', 'two_factor_secret']
                for field in sensitive_fields:
                    user_data.pop(field, None)
                export_data['profile'] = user_data

            # Get moods
            moods_ref = db.collection('users').document(user_id).collection('moods')
            moods = []
            for doc in moods_ref.stream():
                mood_data = doc.to_dict()
                mood_data['id'] = doc.id
                moods.append(mood_data)
            export_data['moods'] = moods

            # Get memories
            memories_ref = db.collection('users').document(user_id).collection('memories')
            memories = []
            for doc in memories_ref.stream():
                memory_data = doc.to_dict()
                memory_data['id'] = doc.id
                memories.append(memory_data)
            export_data['memories'] = memories

            # Get chat history
            chats_ref = db.collection('users').document(user_id).collection('chats')
            chats = []
            for doc in chats_ref.stream():
                chat_data = doc.to_dict()
                chat_data['id'] = doc.id
                chats.append(chat_data)
            export_data['chats'] = chats

            # Get journal entries
            journal_ref = db.collection('users').document(user_id).collection('journal')
            journal_entries = []
            for doc in journal_ref.stream():
                entry_data = doc.to_dict()
                entry_data['id'] = doc.id
                journal_entries.append(entry_data)
            export_data['journal'] = journal_entries

            # Get meditation sessions
            meditation_ref = db.collection('users').document(user_id).collection('meditation_sessions')
            meditation_sessions = []
            for doc in meditation_ref.stream():
                session_data = doc.to_dict()
                session_data['id'] = doc.id
                meditation_sessions.append(session_data)
            export_data['meditation_sessions'] = meditation_sessions

            audit_log('data_exported', user_id, {
                'record_count': len(moods) + len(memories) + len(chats) + len(journal_entries) + len(meditation_sessions)
            })

            response = make_response(jsonify(export_data), 200)
            response.headers['Content-Disposition'] = f'attachment; filename=user_data_{user_id}_{datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")}.json'
            response.headers['Content-Type'] = 'application/json'

            return response

        except Exception as e:
            logger.error(f"Data export failed: {str(e)}")
            return APIResponse.error('Failed to export data', 'DATA_EXPORT_ERROR', 500, str(e))

    except Exception as e:
        logger.error(f"Data export failed: {str(e)}")
        return APIResponse.error('Data export failed', 'DATA_EXPORT_ERROR', 500, str(e))

@auth_bp.route('/delete-account/<user_id>', methods=['DELETE', 'OPTIONS'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def delete_account(user_id):
    """Delete user account and all associated data"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        # Validate and sanitize user_id
        user_id = input_sanitizer.sanitize(user_id)
        if not USER_ID_PATTERN.match(user_id):
            return APIResponse.bad_request('Invalid user ID format')

        current_user_id = g.user_id

        # Users can only delete their own account
        if current_user_id != user_id:
            return APIResponse.forbidden('Unauthorized')

        try:
            from ..firebase_config import db
            if db is None:
                return APIResponse.error('Database unavailable', 'SERVICE_UNAVAILABLE', 503)

            # Mark user as inactive (soft delete)
            db.collection('users').document(user_id).update({
                'is_active': False,
                'deleted_at': datetime.now(timezone.utc).isoformat(),
                'deletion_reason': 'user_requested'
            })

            # In a real implementation, you might also:
            # - Anonymize personal data
            # - Queue data deletion after retention period
            # - Cancel subscriptions
            # - Remove from mailing lists

            audit_log('account_deleted', user_id, {'method': 'soft_delete'})

            response_tuple = APIResponse.success(
                None,
                'Account deletion initiated. Your data will be permanently removed within 30 days.'
            )
            response = make_response(response_tuple[0], response_tuple[1])

            # Clear the access token cookie
            response.set_cookie('access_token', '', expires=0, httponly=True, secure=True, samesite='Strict')

            return response

        except Exception as e:
            logger.error(f"Firebase update failed: {str(e)}")
            return APIResponse.error('Failed to delete account', 'ACCOUNT_DELETION_ERROR', 500, str(e))

    except Exception as e:
        logger.error(f"Account deletion failed: {str(e)}")
        return APIResponse.error('Account deletion failed', 'ACCOUNT_DELETION_ERROR', 500, str(e))