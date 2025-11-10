"""
Complete tests for AuthService - focusing on uncovered code paths
Tests WebAuthn, token operations, and edge cases
"""
import pytest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timezone, timedelta
import jwt
import json
import base64
from src.services.auth_service import AuthService
from src.models.user import User
from firebase_admin import auth, exceptions


class TestRegisterUser:
    """Test register_user method"""
    
    @patch('src.services.auth_service.firebase_auth')
    @patch('src.services.auth_service.db')
    @patch('src.services.auth_service.AuditService')
    def test_register_user_success(self, mock_audit, mock_db, mock_auth):
        """Test successful user registration"""
        # Mock Firebase auth create_user
        mock_firebase_user = Mock()
        mock_firebase_user.uid = 'test-uid-123'
        mock_auth.create_user.return_value = mock_firebase_user
        
        # Mock Firestore
        mock_db.collection.return_value.document.return_value.set.return_value = None
        
        # Mock audit service
        mock_audit_instance = Mock()
        mock_audit.return_value = mock_audit_instance
        
        user, error = AuthService.register_user('test@example.com', 'password123')
        
        assert user is not None
        assert user.uid == 'test-uid-123'
        assert user.email == 'test@example.com'
        assert error is None
        
        # Verify Firebase user creation
        mock_auth.create_user.assert_called_once_with(email='test@example.com', password='password123')
        
        # Verify Firestore save
        mock_db.collection.assert_called_with('users')
    
    @patch('src.services.auth_service.db')
    @patch('src.services.auth_service.firebase_auth')
    def test_register_user_email_already_exists(self, mock_auth, mock_db):
        """Test registration with existing email"""
        # Create a proper exception that inherits from BaseException
        class MockEmailExists(Exception):
            pass
        
        # Use Exception subclass instead of Firebase exception
        mock_auth.create_user.side_effect = MockEmailExists('Email exists')
        mock_auth.EmailAlreadyExistsError = MockEmailExists
        
        user, error = AuthService.register_user('existing@example.com', 'password123')
        
        # General exception handler will catch this
        assert user is None
        assert error is not None


class TestLoginUser:
    """Test login_user method"""
    
    @patch('src.services.auth_service.requests')
    @patch('src.services.auth_service.firebase_auth')
    @patch('src.services.auth_service.db')
    @patch('src.services.auth_service.AuditService')
    def test_login_user_success(self, mock_audit, mock_db, mock_auth, mock_requests):
        """Test successful login"""
        # Mock REST API response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'idToken': 'firebase-id-token',
            'refreshToken': 'firebase-refresh-token'
        }
        mock_requests.post.return_value = mock_response
        
        # Mock Firebase auth methods
        mock_user_record = Mock()
        mock_user_record.uid = 'test-uid-123'
        mock_user_record.email = 'test@example.com'
        mock_auth.verify_id_token.return_value = {'uid': 'test-uid-123'}
        mock_auth.get_user.return_value = mock_user_record
        mock_auth.get_user_by_email.return_value = mock_user_record
        
        # Mock Firestore
        mock_db.collection.return_value.document.return_value.set.return_value = None
        
        # Mock audit service
        mock_audit_instance = Mock()
        mock_audit.return_value = mock_audit_instance
        
        user, error, access_token, refresh_token = AuthService.login_user('test@example.com', 'password123')
        
        assert user is not None
        assert user.uid == 'test-uid-123'
        assert error is None
        assert access_token is not None
        assert refresh_token == 'firebase-refresh-token'
    
    @patch('src.services.auth_service.requests')
    def test_login_user_invalid_credentials(self, mock_requests):
        """Test login with invalid credentials"""
        # Mock REST API failure
        mock_response = Mock()
        mock_response.status_code = 400
        mock_requests.post.return_value = mock_response
        
        user, error, access_token, refresh_token = AuthService.login_user('test@example.com', 'wrongpassword')
        
        assert user is None
        assert error == "Felaktiga inloggningsuppgifter!"
        assert access_token is None
        assert refresh_token is None
    



class TestRefreshToken:
    """Test refresh_token method"""
    
    @patch('src.services.auth_service.requests')
    @patch('src.services.auth_service.db')
    def test_refresh_token_success(self, mock_db, mock_requests):
        """Test successful token refresh"""
        # Mock Firestore
        mock_refresh_doc = Mock()
        mock_refresh_doc.exists = True
        mock_refresh_doc.to_dict.return_value = {
            'firebase_refresh_token': 'firebase-refresh-token'
        }
        mock_db.collection.return_value.document.return_value.get.return_value = mock_refresh_doc
        
        # Mock REST API
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'id_token': 'new-id-token'
        }
        mock_requests.post.return_value = mock_response
        
        access_token, error = AuthService.refresh_token('test-uid-123')
        
        assert access_token is not None
        assert error is None
    
    @patch('src.services.auth_service.db')
    def test_refresh_token_not_found(self, mock_db):
        """Test refresh when token doesn't exist"""
        # Mock Firestore - no refresh token
        mock_refresh_doc = Mock()
        mock_refresh_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = mock_refresh_doc
        
        access_token, error = AuthService.refresh_token('test-uid-123')
        
        assert access_token is None
        assert error == "Ogiltigt refresh-token!"
    
    @patch('src.services.auth_service.requests')
    @patch('src.services.auth_service.db')
    def test_refresh_token_invalid(self, mock_db, mock_requests):
        """Test refresh with invalid token"""
        # Mock Firestore
        mock_refresh_doc = Mock()
        mock_refresh_doc.exists = True
        mock_refresh_doc.to_dict.return_value = {
            'firebase_refresh_token': 'invalid-token'
        }
        mock_db.collection.return_value.document.return_value.get.return_value = mock_refresh_doc
        
        # Mock REST API failure
        mock_response = Mock()
        mock_response.status_code = 400
        mock_requests.post.return_value = mock_response
        
        access_token, error = AuthService.refresh_token('test-uid-123')
        
        assert access_token is None
        assert error == "Ogiltigt refresh-token!"
    
    @patch('src.services.auth_service.db')
    def test_refresh_token_exception(self, mock_db):
        """Test refresh with exception"""
        # Mock Firestore to raise exception
        mock_db.collection.side_effect = Exception('Database error')
        
        access_token, error = AuthService.refresh_token('test-uid-123')
        
        assert access_token is None
        assert 'Ett internt fel uppstod vid token-förnyelse' in error


class TestGenerateTokens:
    """Test token generation methods"""
    
    @patch('src.services.auth_service.JWT_SECRET_KEY', 'test-secret')
    @patch('src.services.auth_service.ACCESS_TOKEN_EXPIRES', timedelta(minutes=15))
    def test_generate_access_token(self):
        """Test access token generation"""
        token = AuthService.generate_access_token('test-uid-123')
        
        assert token is not None
        assert isinstance(token, str)
        
        # Verify token can be decoded
        decoded = jwt.decode(token, 'test-secret', algorithms=['HS256'])
        assert decoded['sub'] == 'test-uid-123'
    
    @patch('src.services.auth_service.JWT_REFRESH_SECRET_KEY', 'test-refresh-secret')
    @patch('src.services.auth_service.REFRESH_TOKEN_EXPIRES', timedelta(days=7))
    def test_generate_refresh_token(self):
        """Test refresh token generation"""
        token = AuthService.generate_refresh_token('test-uid-123')
        
        assert token is not None
        assert isinstance(token, str)
        
        # Verify token can be decoded
        decoded = jwt.decode(token, 'test-refresh-secret', algorithms=['HS256'])
        assert decoded['sub'] == 'test-uid-123'


class TestLogout:
    """Test logout method"""
    
    @patch('src.services.auth_service.db')
    @patch('src.services.auth_service.AuditService')
    def test_logout_success(self, mock_audit, mock_db):
        """Test successful logout"""
        # Mock Firestore
        mock_db.collection.return_value.document.return_value.delete.return_value = None
        
        # Mock audit service
        mock_audit_instance = Mock()
        mock_audit.return_value = mock_audit_instance
        
        message, error = AuthService.logout('test-uid-123')
        
        assert message == "Utloggning lyckades!"
        assert error is None
        
        # Verify token deletion
        mock_db.collection.assert_called_with('refresh_tokens')
    
    @patch('src.services.auth_service.db')
    def test_logout_exception(self, mock_db):
        """Test logout with exception"""
        # Mock Firestore to raise exception
        mock_db.collection.side_effect = Exception('Database error')
        
        message, error = AuthService.logout('test-uid-123')
        
        assert message is None
        assert 'Ett internt fel uppstod vid utloggning' in error


class TestVerifyToken:
    """Test verify_token method"""
    
    @patch('src.services.auth_service.JWT_SECRET_KEY', 'test-secret')
    def test_verify_token_success(self):
        """Test successful token verification"""
        # Generate a valid token
        token = jwt.encode({
            'sub': 'test-uid-123',
            'exp': datetime.now(timezone.utc) + timedelta(hours=1)
        }, 'test-secret', algorithm='HS256')
        
        user_id, error = AuthService.verify_token(token)
        
        assert user_id == 'test-uid-123'
        assert error is None
    
    def test_verify_token_mock_access_token(self):
        """Test verification of mock-access-token"""
        user_id, error = AuthService.verify_token('mock-access-token')
        
        assert user_id == 'test-uid-123'
        assert error is None
    
    def test_verify_token_test_token(self):
        """Test verification of test-token"""
        user_id, error = AuthService.verify_token('test-token')
        
        assert user_id == 'test-user-id'
        assert error is None
    
    @patch('src.services.auth_service.JWT_SECRET_KEY', 'test-secret')
    def test_verify_token_expired(self):
        """Test verification of expired token"""
        # Generate an expired token
        token = jwt.encode({
            'sub': 'test-uid-123',
            'exp': datetime.now(timezone.utc) - timedelta(hours=1)
        }, 'test-secret', algorithm='HS256')
        
        user_id, error = AuthService.verify_token(token)
        
        assert user_id is None
        assert error == "Token har gått ut!"
    
    @patch('src.services.auth_service.JWT_SECRET_KEY', 'test-secret')
    def test_verify_token_invalid(self):
        """Test verification of invalid token"""
        user_id, error = AuthService.verify_token('invalid-token')
        
        assert user_id is None
        assert error == "Ogiltigt token!"
    
    @patch('src.services.auth_service.JWT_SECRET_KEY', 'test-secret')
    def test_verify_token_missing_sub(self):
        """Test verification of token without sub claim"""
        # Generate token without 'sub'
        token = jwt.encode({
            'exp': datetime.now(timezone.utc) + timedelta(hours=1)
        }, 'test-secret', algorithm='HS256')
        
        user_id, error = AuthService.verify_token(token)
        
        assert user_id is None
        assert error == "Ogiltigt token-innehåll!"


class TestWebAuthnChallenge:
    """Test WebAuthn challenge generation"""
    
    @patch('src.services.auth_service.db')
    @patch('src.services.auth_service.secrets')
    def test_generate_webauthn_challenge(self, mock_secrets, mock_db):
        """Test WebAuthn challenge generation"""
        mock_secrets.token_bytes.return_value = b'challenge123456789012345678901234'
        mock_db.collection.return_value.document.return_value.set.return_value = None
        
        result = AuthService.generate_webauthn_challenge('test-uid-123')
        
        assert 'challenge' in result
        assert 'rp' in result
        assert 'user' in result
        assert result['user']['id'] == 'test-uid-123'
        assert result['timeout'] == 60000
        
        # Verify challenge is stored
        mock_db.collection.assert_called_with('webauthn_challenges')


class TestRegisterWebAuthnCredential:
    """Test WebAuthn credential registration"""
    
    @patch('src.services.auth_service.db')
    @patch('src.services.auth_service.AuditService')
    def test_register_webauthn_credential_success(self, mock_audit, mock_db):
        """Test successful WebAuthn credential registration"""
        # Mock challenge document
        mock_challenge_doc = Mock()
        mock_challenge_doc.exists = True
        challenge_b64 = base64.b64encode(b'test-challenge').decode()
        mock_challenge_doc.to_dict.return_value = {
            'challenge': challenge_b64
        }
        
        # Mock Firestore calls
        mock_collection = Mock()
        mock_collection.document.return_value.get.return_value = mock_challenge_doc
        mock_collection.document.return_value.set.return_value = None
        mock_collection.document.return_value.delete.return_value = None
        
        def collection_side_effect(name):
            return mock_collection
        
        mock_db.collection.side_effect = collection_side_effect
        
        # Create credential data
        client_data = {
            'challenge': challenge_b64,
            'origin': 'http://localhost',
            'type': 'webauthn.create'
        }
        client_data_json = json.dumps(client_data)
        client_data_b64 = base64.b64encode(client_data_json.encode()).decode()
        
        credential_data = {
            'id': 'credential-123',
            'response': {
                'clientDataJSON': client_data_b64,
                'publicKey': 'public-key-data'
            }
        }
        
        # Mock audit service
        mock_audit_instance = Mock()
        mock_audit.return_value = mock_audit_instance
        
        result = AuthService.register_webauthn_credential('test-uid-123', credential_data)
        
        assert result is True
    
    @patch('src.services.auth_service.db')
    def test_register_webauthn_credential_no_challenge(self, mock_db):
        """Test registration when challenge doesn't exist"""
        # Mock challenge document doesn't exist
        mock_challenge_doc = Mock()
        mock_challenge_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = mock_challenge_doc
        
        credential_data = {'id': 'credential-123'}
        
        result = AuthService.register_webauthn_credential('test-uid-123', credential_data)
        
        assert result is False
    
    @patch('src.services.auth_service.db')
    def test_register_webauthn_credential_challenge_mismatch(self, mock_db):
        """Test registration with challenge mismatch"""
        # Mock challenge document
        mock_challenge_doc = Mock()
        mock_challenge_doc.exists = True
        mock_challenge_doc.to_dict.return_value = {
            'challenge': base64.b64encode(b'stored-challenge').decode()
        }
        mock_db.collection.return_value.document.return_value.get.return_value = mock_challenge_doc
        
        # Create credential with different challenge
        client_data = {
            'challenge': base64.b64encode(b'different-challenge').decode(),
            'origin': 'http://localhost',
            'type': 'webauthn.create'
        }
        client_data_b64 = base64.b64encode(json.dumps(client_data).encode()).decode()
        
        credential_data = {
            'id': 'credential-123',
            'response': {
                'clientDataJSON': client_data_b64,
                'publicKey': 'public-key'
            }
        }
        
        result = AuthService.register_webauthn_credential('test-uid-123', credential_data)
        
        assert result is False
    
    @patch('src.services.auth_service.db')
    def test_register_webauthn_credential_exception(self, mock_db):
        """Test registration with exception"""
        mock_db.collection.side_effect = Exception('Database error')
        
        result = AuthService.register_webauthn_credential('test-uid-123', {})
        
        assert result is False


class TestAuthenticateWebAuthn:
    """Test WebAuthn authentication"""
    
    @patch('src.services.auth_service.db')
    @patch('src.services.auth_service.secrets')
    def test_authenticate_webauthn_success(self, mock_secrets, mock_db):
        """Test successful WebAuthn authentication challenge generation"""
        mock_secrets.token_bytes.return_value = b'auth-challenge-1234567890123456'
        
        # Mock credentials query
        mock_credential_doc1 = Mock()
        mock_credential_doc1.to_dict.return_value = {'credential_id': 'cred-1'}
        mock_credential_doc2 = Mock()
        mock_credential_doc2.to_dict.return_value = {'credential_id': 'cred-2'}
        
        mock_collection = Mock()
        mock_collection.document.return_value.set.return_value = None
        mock_collection.where.return_value.stream.return_value = [mock_credential_doc1, mock_credential_doc2]
        mock_db.collection.return_value = mock_collection
        
        result = AuthService.authenticate_webauthn('test-uid-123', {})
        
        assert result is not None
        assert 'challenge' in result
        assert 'allowCredentials' in result
        assert len(result['allowCredentials']) == 2
        assert result['timeout'] == 60000
    
    @patch('src.services.auth_service.db')
    def test_authenticate_webauthn_exception(self, mock_db):
        """Test WebAuthn authentication with exception"""
        mock_db.collection.side_effect = Exception('Database error')
        
        result = AuthService.authenticate_webauthn('test-uid-123', {})
        
        assert result is None


class TestVerifyWebAuthnAssertion:
    """Test WebAuthn assertion verification"""
    
    @patch('src.services.auth_service.db')
    @patch('src.services.auth_service.AuditService')
    def test_verify_webauthn_assertion_success(self, mock_audit, mock_db):
        """Test successful WebAuthn assertion verification"""
        # Mock challenge document
        mock_challenge_doc = Mock()
        mock_challenge_doc.exists = True
        challenge_b64 = base64.b64encode(b'auth-challenge').decode()
        mock_challenge_doc.to_dict.return_value = {
            'challenge': challenge_b64
        }
        
        mock_collection = Mock()
        mock_collection.document.return_value.get.return_value = mock_challenge_doc
        mock_collection.document.return_value.delete.return_value = None
        mock_db.collection.return_value = mock_collection
        
        # Create assertion data
        client_data = {
            'challenge': challenge_b64,
            'origin': 'http://localhost',
            'type': 'webauthn.get'
        }
        client_data_b64 = base64.b64encode(json.dumps(client_data).encode()).decode()
        
        assertion_data = {
            'response': {
                'clientDataJSON': client_data_b64
            }
        }
        
        # Mock audit service
        mock_audit_instance = Mock()
        mock_audit.return_value = mock_audit_instance
        
        result = AuthService.verify_webauthn_assertion('test-uid-123', assertion_data)
        
        assert result is True
    
    @patch('src.services.auth_service.db')
    def test_verify_webauthn_assertion_no_challenge(self, mock_db):
        """Test assertion verification when challenge doesn't exist"""
        mock_challenge_doc = Mock()
        mock_challenge_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = mock_challenge_doc
        
        result = AuthService.verify_webauthn_assertion('test-uid-123', {})
        
        assert result is False
    
    @patch('src.services.auth_service.db')
    def test_verify_webauthn_assertion_challenge_mismatch(self, mock_db):
        """Test assertion verification with challenge mismatch"""
        # Mock stored challenge
        mock_challenge_doc = Mock()
        mock_challenge_doc.exists = True
        mock_challenge_doc.to_dict.return_value = {
            'challenge': base64.b64encode(b'stored-challenge').decode()
        }
        mock_db.collection.return_value.document.return_value.get.return_value = mock_challenge_doc
        
        # Create assertion with different challenge
        client_data = {
            'challenge': base64.b64encode(b'different-challenge').decode(),
            'origin': 'http://localhost'
        }
        client_data_b64 = base64.b64encode(json.dumps(client_data).encode()).decode()
        
        assertion_data = {
            'response': {
                'clientDataJSON': client_data_b64
            }
        }
        
        result = AuthService.verify_webauthn_assertion('test-uid-123', assertion_data)
        
        assert result is False
    
    @patch('src.services.auth_service.db')
    def test_verify_webauthn_assertion_exception(self, mock_db):
        """Test assertion verification with exception"""
        mock_db.collection.side_effect = Exception('Database error')
        
        result = AuthService.verify_webauthn_assertion('test-uid-123', {})
        
        assert result is False


class TestAuditLog:
    """Test _audit_log internal method"""
    
    @patch('src.services.auth_service.AuditService')
    def test_audit_log_without_request(self, mock_audit):
        """Test audit logging without request context"""
        mock_audit_instance = Mock()
        mock_audit.return_value = mock_audit_instance
        
        # Patch request to None to avoid request context
        with patch('src.services.auth_service.request', None):
            AuthService._audit_log('TEST_EVENT', 'test-uid-123', {})
        
        mock_audit_instance.log_event.assert_called_once_with(
            'TEST_EVENT',
            'test-uid-123',
            {},
            ip_address=None,
            user_agent=None
        )
    
    @patch('src.services.auth_service.AuditService')
    def test_audit_log_exception(self, mock_audit):
        """Test audit logging with exception"""
        mock_audit.side_effect = Exception('Audit service error')
        
        # Should not raise exception, just log error
        try:
            with patch('src.services.auth_service.request', None):
                AuthService._audit_log('TEST_EVENT', 'test-uid-123', {})
        except Exception:
            pytest.fail('_audit_log should not raise exception')

