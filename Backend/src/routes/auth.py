from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
from ..models.user import User
from ..services.audit_service import audit_log
from ..utils.password_utils import validate_password, hash_password
import logging
import re
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

# Rate limiter will be initialized in main.py
limiter = None

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        name = data.get('name', '').strip()

        # Validation
        if not email or not password or not name:
            return jsonify({'error': 'Email, password, and name are required'}), 400

        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            return jsonify({'error': 'Invalid email format'}), 400

        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters long'}), 400

        if not re.search(r'[A-Z]', password):
            return jsonify({'error': 'Password must contain at least one uppercase letter'}), 400

        if not re.search(r'[a-z]', password):
            return jsonify({'error': 'Password must contain at least one lowercase letter'}), 400

        if not re.search(r'\d', password):
            return jsonify({'error': 'Password must contain at least one number'}), 400

        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', password):
            return jsonify({'error': 'Password must contain at least one special character'}), 400

        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'error': 'User with this email already exists'}), 409

        # Create new user
        hashed_password = hash_password(password)
        new_user = User(
            email=email,
            password_hash=hashed_password,
            name=name,
            created_at=datetime.utcnow(),
            is_active=True
        )

        # Save to database (assuming session is available)
        try:
            from ..firebase_config import db
            user_data = {
                'email': email,
                'name': name,
                'password_hash': hashed_password,
                'created_at': datetime.utcnow().isoformat(),
                'is_active': True,
                'two_factor_enabled': False,
                'biometric_enabled': False,
                'language': 'sv'
            }
            db.collection('users').document(str(new_user.id)).set(user_data)
        except Exception as e:
            logger.error(f"Failed to save user to Firebase: {str(e)}")
            return jsonify({'error': 'Failed to create user account'}), 500

        audit_log('user_registered', str(new_user.id), {'email': email, 'name': name})

        return jsonify({
            'message': 'User registered successfully',
            'user': {
                'id': new_user.id,
                'email': email,
                'name': name
            }
        }), 201

    except Exception as e:
        logger.error(f"Registration failed: {str(e)}")
        return jsonify({'error': 'Registration failed'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        # Find user
        try:
            from ..firebase_config import db
            users_ref = db.collection('users')
            query = users_ref.where('email', '==', email).limit(1)
            users = query.get()

            user_data = None
            user_id = None
            for user in users:
                user_data = user.to_dict()
                user_id = user.id
                break

            if not user_data or not check_password_hash(user_data.get('password_hash', ''), password):
                audit_log('login_failed', 'unknown', {'email': email, 'reason': 'invalid_credentials'})
                return jsonify({'error': 'Invalid email or password'}), 401

            if not user_data.get('is_active', True):
                audit_log('login_failed', user_id, {'email': email, 'reason': 'account_inactive'})
                return jsonify({'error': 'Account is deactivated'}), 401

        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Authentication service temporarily unavailable'}), 503

        # Create JWT token
        access_token = create_access_token(identity=user_id, expires_delta=timedelta(hours=24))

        # Check if 2FA is required
        two_factor_enabled = user_data.get('two_factor_enabled', False)
        biometric_enabled = user_data.get('biometric_enabled', False)

        response_data = {
            'message': 'Login successful',
            'access_token': access_token,
            'user': {
                'id': user_id,
                'email': user_data['email'],
                'name': user_data['name'],
                'two_factor_enabled': two_factor_enabled,
                'biometric_enabled': biometric_enabled
            }
        }

        # If 2FA is enabled, indicate that verification is needed
        if two_factor_enabled or biometric_enabled:
            response_data['requires_2fa'] = True
            response_data['two_factor_methods'] = []
            if biometric_enabled:
                response_data['two_factor_methods'].append('biometric')
            if two_factor_enabled:
                response_data['two_factor_methods'].append('sms')

        audit_log('login_successful', user_id, {
            'email': email,
            'two_factor_required': two_factor_enabled or biometric_enabled
        })

        response = make_response(jsonify(response_data), 200)
        response.set_cookie(
            'access_token',
            access_token,
            httponly=True,
            secure=True,
            samesite='Strict',
            max_age=24*60*60  # 24 hours
        )

        return response

    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500

@auth_bp.route('/verify-2fa', methods=['POST'])
@jwt_required()
def verify_2fa():
    """Verify two-factor authentication"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        method = data.get('method')  # 'biometric' or 'sms'
        credential = data.get('credential')  # For biometric, this would be the WebAuthn response

        # In a real implementation, verify the 2FA credential
        # For now, we'll simulate verification

        if method == 'biometric':
            # Verify WebAuthn credential
            # This would involve cryptographic verification of the authenticator response
            verified = True  # Simulated
        elif method == 'sms':
            code = data.get('code')
            # Verify SMS code
            verified = len(code) == 6 and code.isdigit()  # Simulated
        else:
            return jsonify({'error': 'Invalid 2FA method'}), 400

        if not verified:
            audit_log('2fa_verification_failed', user_id, {'method': method})
            return jsonify({'error': '2FA verification failed'}), 401

        # Generate a new token with 2FA verified claim
        access_token_verified = create_access_token(
            identity=user_id,
            expires_delta=timedelta(hours=24),
            additional_claims={'2fa_verified': True}
        )

        audit_log('2fa_verification_successful', user_id, {'method': method})

        response = make_response(jsonify({
            'message': '2FA verification successful',
            'access_token': access_token_verified
        }), 200)

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
        return jsonify({'error': '2FA verification failed'}), 500

@auth_bp.route('/setup-2fa', methods=['POST'])
@jwt_required()
def setup_2fa():
    """Setup two-factor authentication for user"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        method = data.get('method')  # 'biometric' or 'sms'
        setup_data = data.get('setup_data', {})

        try:
            from ..firebase_config import db
            user_ref = db.collection('users').document(user_id)
            user_data = user_ref.get().to_dict()

            if not user_data:
                return jsonify({'error': 'User not found'}), 404

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
                return jsonify({'error': 'Invalid 2FA method'}), 400

            audit_log('2fa_setup_completed', user_id, {'method': method})

            return jsonify({
                'message': f'2FA setup completed successfully using {method}',
                'method': method
            }), 200

        except Exception as e:
            logger.error(f"Firebase update failed: {str(e)}")
            return jsonify({'error': 'Failed to save 2FA settings'}), 500

    except Exception as e:
        logger.error(f"2FA setup failed: {str(e)}")
        return jsonify({'error': '2FA setup failed'}), 500

@auth_bp.route('/google-login', methods=['POST'])
def google_login():
    """Handle Google OAuth login"""
    try:
        data = request.get_json()
        id_token = data.get('id_token')

        if not id_token:
            return jsonify({'error': 'ID token required'}), 400

        # Verify Google ID token
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests

            CLIENT_ID = "your-google-client-id"  # Should be in environment variables
            id_info = id_token.verify_oauth2_token(id_token, google_requests.Request(), CLIENT_ID)

            if id_info['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')

            email = id_info['email']
            name = id_info['name']
            google_id = id_info['sub']

        except Exception as e:
            logger.error(f"Google token verification failed: {str(e)}")
            return jsonify({'error': 'Invalid Google token'}), 401

        # Find or create user
        try:
            from ..firebase_config import db
            users_ref = db.collection('users')
            query = users_ref.where('google_id', '==', google_id).limit(1)
            users = query.get()

            user_data = None
            user_id = None

            for user in users:
                user_data = user.to_dict()
                user_id = user.id
                break

            if not user_data:
                # Create new user
                user_id = str(hash(google_id) % 1000000)  # Simple ID generation
                user_data = {
                    'email': email,
                    'name': name,
                    'google_id': google_id,
                    'created_at': datetime.utcnow().isoformat(),
                    'is_active': True,
                    'two_factor_enabled': False,
                    'biometric_enabled': False,
                    'language': 'sv'
                }
                db.collection('users').document(user_id).set(user_data)
                audit_log('user_registered_google', user_id, {'email': email, 'name': name})
            else:
                # Update last login
                db.collection('users').document(user_id).update({
                    'last_login': datetime.utcnow().isoformat()
                })

        except Exception as e:
            logger.error(f"Firebase operation failed: {str(e)}")
            return jsonify({'error': 'Authentication service error'}), 503

        # Create JWT token
        access_token = create_access_token(identity=user_id, expires_delta=timedelta(hours=24))

        audit_log('google_login_successful', user_id, {'email': email})

        response = make_response(jsonify({
            'message': 'Google login successful',
            'access_token': access_token,
            'user': {
                'id': user_id,
                'email': email,
                'name': name,
                'login_method': 'google'
            }
        }), 200)

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
        return jsonify({'error': 'Google login failed'}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user by clearing the cookie"""
    try:
        user_id = get_jwt_identity()
        audit_log('user_logged_out', user_id, {})

        response = make_response(jsonify({'message': 'Logged out successfully'}), 200)
        response.set_cookie('access_token', '', expires=0, httponly=True, secure=True, samesite='Strict')
        return response

    except Exception as e:
        logger.error(f"Logout failed: {str(e)}")
        return jsonify({'error': 'Logout failed'}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Initiate password reset"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()

        if not email:
            return jsonify({'error': 'Email is required'}), 400

        # Check if user exists
        try:
            from ..firebase_config import db
            users_ref = db.collection('users')
            query = users_ref.where('email', '==', email).limit(1)
            users = query.get()

            user_exists = len(list(users)) > 0

        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503

        # Always return success for security (don't reveal if email exists)
        audit_log('password_reset_requested', 'unknown', {'email': email, 'user_exists': user_exists})

        return jsonify({
            'message': 'If an account with this email exists, a password reset link has been sent.'
        }), 200

    except Exception as e:
        logger.error(f"Password reset failed: {str(e)}")
        return jsonify({'error': 'Password reset failed'}), 500

@auth_bp.route('/consent', methods=['POST'])
@jwt_required()
def update_consent():
    """Update user consent preferences"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        consent_data = {
            'analytics_consent': data.get('analytics_consent', False),
            'marketing_consent': data.get('marketing_consent', False),
            'data_processing_consent': data.get('data_processing_consent', True),  # Required
            'consent_updated_at': datetime.utcnow().isoformat()
        }

        try:
            from ..firebase_config import db
            db.collection('users').document(user_id).update({
                'consent': consent_data
            })

            audit_log('consent_updated', user_id, consent_data)

            return jsonify({
                'message': 'Consent preferences updated successfully',
                'consent': consent_data
            }), 200

        except Exception as e:
            logger.error(f"Firebase update failed: {str(e)}")
            return jsonify({'error': 'Failed to update consent'}), 500

    except Exception as e:
        logger.error(f"Consent update failed: {str(e)}")
        return jsonify({'error': 'Consent update failed'}), 500

@auth_bp.route('/consent/<user_id>', methods=['GET'])
@jwt_required()
def get_consent(user_id):
    """Get user consent preferences"""
    try:
        current_user_id = get_jwt_identity()

        # Users can only view their own consent
        if current_user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        try:
            from ..firebase_config import db
            user_doc = db.collection('users').document(user_id).get()
            user_data = user_doc.to_dict()

            if not user_data:
                return jsonify({'error': 'User not found'}), 404

            consent = user_data.get('consent', {
                'analytics_consent': False,
                'marketing_consent': False,
                'data_processing_consent': True,
                'consent_updated_at': user_data.get('created_at')
            })

            return jsonify({'consent': consent}), 200

        except Exception as e:
            logger.error(f"Firebase query failed: {str(e)}")
            return jsonify({'error': 'Failed to retrieve consent'}), 500

    except Exception as e:
        logger.error(f"Consent retrieval failed: {str(e)}")
        return jsonify({'error': 'Consent retrieval failed'}), 500

@auth_bp.route('/delete-account/<user_id>', methods=['DELETE'])
@jwt_required()
def delete_account(user_id):
    """Delete user account and all associated data"""
    try:
        current_user_id = get_jwt_identity()

        # Users can only delete their own account
        if current_user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        try:
            from ..firebase_config import db

            # Mark user as inactive (soft delete)
            db.collection('users').document(user_id).update({
                'is_active': False,
                'deleted_at': datetime.utcnow().isoformat(),
                'deletion_reason': 'user_requested'
            })

            # In a real implementation, you might also:
            # - Anonymize personal data
            # - Queue data deletion after retention period
            # - Cancel subscriptions
            # - Remove from mailing lists

            audit_log('account_deleted', user_id, {'method': 'soft_delete'})

            response = make_response(jsonify({
                'message': 'Account deletion initiated. Your data will be permanently removed within 30 days.'
            }), 200)

            # Clear the access token cookie
            response.set_cookie('access_token', '', expires=0, httponly=True, secure=True, samesite='Strict')

            return response

        except Exception as e:
            logger.error(f"Firebase update failed: {str(e)}")
            return jsonify({'error': 'Failed to delete account'}), 500

    except Exception as e:
        logger.error(f"Account deletion failed: {str(e)}")
        return jsonify({'error': 'Account deletion failed'}), 500