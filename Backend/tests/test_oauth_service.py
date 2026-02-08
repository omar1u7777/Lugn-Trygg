"""
Tests for OAuth Service
Tests OAuth 2.0 flows for health integrations (Google Fit, Fitbit, Samsung Health, Withings)
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
import secrets
from src.services.oauth_service import OAuthService, oauth_service


class TestOAuthServiceInit:
    """Test OAuthService initialization"""
    
    def test_init_creates_configurations(self):
        """Test that init creates all provider configurations"""
        service = OAuthService()
        
        assert hasattr(service, 'google_fit_config')
        assert hasattr(service, 'fitbit_config')
        assert hasattr(service, 'samsung_config')
        assert hasattr(service, 'withings_config')
        assert hasattr(service, 'oauth_states')
    
    def test_init_google_fit_config_structure(self):
        """Test Google Fit configuration structure"""
        service = OAuthService()
        config = service.google_fit_config
        
        assert 'client_id' in config
        assert 'client_secret' in config
        assert 'redirect_uri' in config
        assert 'scopes' in config
        assert 'auth_url' in config
        assert 'token_url' in config
        assert 'api_base' in config
        assert config['auth_url'] == 'https://accounts.google.com/o/oauth2/v2/auth'
        assert config['token_url'] == 'https://oauth2.googleapis.com/token'
    
    def test_init_fitbit_config_structure(self):
        """Test Fitbit configuration structure"""
        service = OAuthService()
        config = service.fitbit_config
        
        assert 'client_id' in config
        assert 'auth_url' in config
        assert config['auth_url'] == 'https://www.fitbit.com/oauth2/authorize'
        assert config['token_url'] == 'https://api.fitbit.com/oauth2/token'
    
    def test_init_samsung_config_structure(self):
        """Test Samsung Health configuration structure"""
        service = OAuthService()
        config = service.samsung_config
        
        assert 'client_id' in config
        assert 'auth_url' in config
        assert 'us.account.samsung.com' in config['auth_url']
    
    def test_init_withings_config_structure(self):
        """Test Withings configuration structure"""
        service = OAuthService()
        config = service.withings_config
        
        assert 'client_id' in config
        assert 'auth_url' in config
        assert 'account.withings.com' in config['auth_url']
    
    def test_init_oauth_states_empty(self):
        """Test that oauth_states starts empty"""
        service = OAuthService()
        assert service.oauth_states == {}


class TestGetAuthorizationUrl:
    """Test get_authorization_url method"""
    
    @pytest.fixture
    def service(self):
        """Create OAuthService instance"""
        service = OAuthService()
        # Set test configuration directly
        service.google_fit_config['client_id'] = 'test_client_id'
        service.google_fit_config['client_secret'] = 'test_secret'
        service.google_fit_config['redirect_uri'] = 'http://localhost:5000/callback'
        service.google_fit_config['scopes'] = ['fitness.activity.read', 'fitness.heart_rate.read']
        
        service.fitbit_config['client_id'] = 'fitbit_client'
        service.fitbit_config['client_secret'] = 'fitbit_secret'
        service.fitbit_config['redirect_uri'] = 'http://localhost:5000/fitbit/callback'
        
        return service
    
    def test_get_authorization_url_google_fit(self, service):
        """Test generating authorization URL for Google Fit"""
        result = service.get_authorization_url('google_fit', 'user123')
        
        assert 'authorization_url' in result
        assert 'state' in result
        assert 'provider' in result
        assert result['provider'] == 'google_fit'
        assert 'accounts.google.com/o/oauth2/v2/auth' in result['authorization_url']
        assert 'client_id=test_client_id' in result['authorization_url']
        assert 'redirect_uri=http' in result['authorization_url']
        assert 'response_type=code' in result['authorization_url']
        assert 'access_type=offline' in result['authorization_url']
        assert 'prompt=consent' in result['authorization_url']
    
    def test_get_authorization_url_fitbit(self, service):
        """Test generating authorization URL for Fitbit"""
        result = service.get_authorization_url('fitbit', 'user456')
        
        assert 'authorization_url' in result
        assert result['provider'] == 'fitbit'
        assert 'fitbit.com/oauth2/authorize' in result['authorization_url']
        assert 'client_id=fitbit_client' in result['authorization_url']
    
    def test_get_authorization_url_samsung(self, service):
        """Test generating authorization URL for Samsung Health"""
        service.samsung_config['client_id'] = 'samsung_client'
        service.samsung_config['client_secret'] = 'samsung_secret'
        service.samsung_config['redirect_uri'] = 'http://localhost:5000/samsung/callback'
        
        result = service.get_authorization_url('samsung', 'user789')
        
        assert 'authorization_url' in result
        assert result['provider'] == 'samsung'
        assert 'samsung.com' in result['authorization_url']
        assert 'scope=samsung.shealth.read' in result['authorization_url']
    
    def test_get_authorization_url_withings(self, service):
        """Test generating authorization URL for Withings"""
        service.withings_config['client_id'] = 'withings_client'
        service.withings_config['client_secret'] = 'withings_secret'
        service.withings_config['redirect_uri'] = 'http://localhost:5000/withings/callback'
        
        result = service.get_authorization_url('withings', 'user999')
        
        assert 'authorization_url' in result
        assert result['provider'] == 'withings'
        assert 'withings.com' in result['authorization_url']
        assert 'scope=user.metrics' in result['authorization_url']
    
    def test_get_authorization_url_stores_state(self, service):
        """Test that state is stored for CSRF protection"""
        result = service.get_authorization_url('google_fit', 'user123')
        state = result['state']
        
        assert state in service.oauth_states
        assert service.oauth_states[state]['user_id'] == 'user123'
        assert service.oauth_states[state]['provider'] == 'google_fit'
        assert 'created_at' in service.oauth_states[state]
    
    def test_get_authorization_url_unsupported_provider(self, service):
        """Test error handling for unsupported provider"""
        with pytest.raises(ValueError, match="Unsupported provider"):
            service.get_authorization_url('invalid_provider', 'user123')
    
    def test_get_authorization_url_state_is_secure(self, service):
        """Test that generated state is cryptographically secure"""
        result = service.get_authorization_url('google_fit', 'user123')
        state = result['state']
        
        # State should be URL-safe and long enough
        assert len(state) > 20
        assert state.replace('-', '').replace('_', '').isalnum()


class TestExchangeCodeForToken:
    def test_exchange_code_for_token_unsupported_provider(self, service):
        """Test error handling for unsupported provider (line 145 coverage)"""
        # Setup state with a provider that is not supported by config
        unsupported_provider = 'not_supported'
        state = 'unsupported_state'
        service.oauth_states[state] = {
            'user_id': 'user999',
            'provider': unsupported_provider,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        # Call with the same unsupported provider
        with pytest.raises(ValueError, match="Unsupported provider"):
            service.exchange_code_for_token(unsupported_provider, 'code', state)
    """Test exchange_code_for_token method"""
    
    @pytest.fixture
    def service(self):
        """Create OAuthService instance"""
        service = OAuthService()
        # Set test configuration
        service.google_fit_config['client_id'] = 'test_client'
        service.google_fit_config['client_secret'] = 'test_secret'
        service.google_fit_config['redirect_uri'] = 'http://localhost:5000/callback'
        
        service.fitbit_config['client_id'] = 'fitbit_client'
        service.fitbit_config['client_secret'] = 'fitbit_secret'
        service.fitbit_config['redirect_uri'] = 'http://localhost:5000/callback'
        
        return service
    
    @patch('src.services.oauth_service.requests.post')
    def test_exchange_code_for_token_success(self, mock_post, service):
        """Test successful token exchange"""
        # Setup state
        state = 'test_state_123'
        service.oauth_states[state] = {
            'user_id': 'user123',
            'provider': 'google_fit',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'access_token': 'access_token_123',
            'refresh_token': 'refresh_token_456',
            'expires_in': 3600,
            'token_type': 'Bearer'
        }
        mock_post.return_value = mock_response
        
        result = service.exchange_code_for_token('google_fit', 'auth_code_789', state)
        
        assert result['access_token'] == 'access_token_123'
        assert result['refresh_token'] == 'refresh_token_456'
        assert result['provider'] == 'google_fit'
        assert result['user_id'] == 'user123'
        assert 'obtained_at' in result
        
        # State should be cleaned up
        assert state not in service.oauth_states
    
    def test_exchange_code_for_token_invalid_state(self, service):
        """Test error handling for invalid state"""
        with pytest.raises(ValueError, match="Invalid state parameter"):
            service.exchange_code_for_token('google_fit', 'code', 'invalid_state')
    
    def test_exchange_code_for_token_provider_mismatch(self, service):
        """Test error handling for provider mismatch"""
        state = 'test_state_456'
        service.oauth_states[state] = {
            'user_id': 'user123',
            'provider': 'fitbit',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        with pytest.raises(ValueError, match="Provider mismatch"):
            service.exchange_code_for_token('google_fit', 'code', state)
    
    @patch('src.services.oauth_service.requests.post')
    def test_exchange_code_for_token_api_error(self, mock_post, service):
        """Test error handling for API errors"""
        state = 'test_state_789'
        service.oauth_states[state] = {
            'user_id': 'user123',
            'provider': 'google_fit',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.text = 'Invalid grant'
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception, match="Failed to exchange code for token"):
            service.exchange_code_for_token('google_fit', 'invalid_code', state)
    
    @patch('src.services.oauth_service.requests.post')
    def test_exchange_code_for_token_fitbit(self, mock_post, service):
        """Test token exchange for Fitbit"""
        state = 'fitbit_state'
        service.oauth_states[state] = {
            'user_id': 'user456',
            'provider': 'fitbit',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'access_token': 'fitbit_access',
            'refresh_token': 'fitbit_refresh',
            'expires_in': 28800
        }
        mock_post.return_value = mock_response
        
        result = service.exchange_code_for_token('fitbit', 'fitbit_code', state)
        
        assert result['access_token'] == 'fitbit_access'
        assert result['provider'] == 'fitbit'
        assert result['user_id'] == 'user456'


class TestRefreshAccessToken:
    """Test refresh_access_token method"""
    
    @pytest.fixture
    def service(self):
        """Create OAuthService instance"""
        service = OAuthService()
        # Set test configuration
        service.google_fit_config['client_id'] = 'test_client'
        service.google_fit_config['client_secret'] = 'test_secret'
        
        service.fitbit_config['client_id'] = 'fitbit_client'
        service.fitbit_config['client_secret'] = 'fitbit_secret'
        
        return service
    
    @patch('src.services.oauth_service.requests.post')
    def test_refresh_access_token_success(self, mock_post, service):
        """Test successful token refresh"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'access_token': 'new_access_token',
            'expires_in': 3600,
            'token_type': 'Bearer'
        }
        mock_post.return_value = mock_response
        
        result = service.refresh_access_token('google_fit', 'old_refresh_token')
        
        assert result['access_token'] == 'new_access_token'
        assert result['provider'] == 'google_fit'
        assert 'refreshed_at' in result
        
        # Verify request was made correctly
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[1]['data']['grant_type'] == 'refresh_token'
        assert call_args[1]['data']['refresh_token'] == 'old_refresh_token'
    
    @patch('src.services.oauth_service.requests.post')
    def test_refresh_access_token_fitbit(self, mock_post, service):
        """Test token refresh for Fitbit"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'access_token': 'new_fitbit_token',
            'expires_in': 28800
        }
        mock_post.return_value = mock_response
        
        result = service.refresh_access_token('fitbit', 'fitbit_refresh')
        
        assert result['access_token'] == 'new_fitbit_token'
        assert result['provider'] == 'fitbit'
    
    @patch('src.services.oauth_service.requests.post')
    def test_refresh_access_token_api_error(self, mock_post, service):
        """Test error handling for refresh failures"""
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.text = 'Invalid refresh token'
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception, match="Failed to refresh token"):
            service.refresh_access_token('google_fit', 'invalid_refresh')
    
    def test_refresh_access_token_unsupported_provider(self, service):
        """Test error handling for unsupported provider"""
        with pytest.raises(ValueError, match="Unsupported provider"):
            service.refresh_access_token('invalid_provider', 'refresh_token')


class TestRevokeToken:
    """Test revoke_token method"""
    
    @pytest.fixture
    def service(self):
        """Create OAuthService instance"""
        service = OAuthService()
        # Set test configuration
        service.fitbit_config['client_id'] = 'fitbit_client'
        service.fitbit_config['client_secret'] = 'fitbit_secret'
        return service
    
    @patch('src.services.oauth_service.requests.post')
    def test_revoke_token_google_fit_success(self, mock_post, service):
        """Test successful token revocation for Google Fit"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response
        
        result = service.revoke_token('google_fit', 'token_to_revoke')
        
        assert result is True
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert 'oauth2.googleapis.com/revoke' in call_args[0][0]
    
    @patch('src.services.oauth_service.requests.post')
    def test_revoke_token_fitbit_success(self, mock_post, service):
        """Test successful token revocation for Fitbit"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response
        
        result = service.revoke_token('fitbit', 'fitbit_token')
        
        assert result is True
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert 'api.fitbit.com/oauth2/revoke' in call_args[0][0]
    
    def test_revoke_token_unsupported_provider(self, service):
        """Test revocation for provider without revoke endpoint"""
        result = service.revoke_token('samsung', 'samsung_token')
        
        # Should return True (silent success) for unsupported providers
        assert result is True
    
    @patch('src.services.oauth_service.requests.post')
    def test_revoke_token_api_error(self, mock_post, service):
        """Test error handling for revocation failures"""
        mock_response = Mock()
        mock_response.status_code = 400
        mock_post.return_value = mock_response
        
        result = service.revoke_token('google_fit', 'invalid_token')
        
        assert result is False
    
    @patch('src.services.oauth_service.requests.post')
    def test_revoke_token_exception(self, mock_post, service):
        """Test exception handling during revocation"""
        mock_post.side_effect = Exception("Network error")
        
        result = service.revoke_token('google_fit', 'token')
        
        assert result is False


class TestGetProviderConfig:
    """Test _get_provider_config method"""
    
    @pytest.fixture
    def service(self):
        """Create OAuthService instance"""
        return OAuthService()
    
    def test_get_provider_config_google_fit(self, service):
        """Test getting Google Fit configuration"""
        config = service._get_provider_config('google_fit')
        
        assert config is not None
        assert config == service.google_fit_config
    
    def test_get_provider_config_fitbit(self, service):
        """Test getting Fitbit configuration"""
        config = service._get_provider_config('fitbit')
        
        assert config is not None
        assert config == service.fitbit_config
    
    def test_get_provider_config_samsung(self, service):
        """Test getting Samsung Health configuration"""
        config = service._get_provider_config('samsung')
        
        assert config is not None
        assert config == service.samsung_config
    
    def test_get_provider_config_withings(self, service):
        """Test getting Withings configuration"""
        config = service._get_provider_config('withings')
        
        assert config is not None
        assert config == service.withings_config
    
    def test_get_provider_config_invalid(self, service):
        """Test getting configuration for invalid provider"""
        config = service._get_provider_config('invalid_provider')
        
        assert config is None


class TestValidateConfig:
    """Test validate_config method"""
    
    @pytest.fixture
    def service(self):
        """Create OAuthService instance"""
        return OAuthService()
    
    def test_validate_config_complete(self, service):
        """Test validation of complete configuration"""
        service.google_fit_config['client_id'] = 'test_client'
        service.google_fit_config['client_secret'] = 'test_secret'
        service.google_fit_config['redirect_uri'] = 'http://localhost:5000/callback'
        
        result = service.validate_config('google_fit')
        
        assert result is True
    
    def test_validate_config_incomplete(self, service):
        """Test validation of incomplete configuration"""
        service.google_fit_config['client_id'] = 'test_client'
        service.google_fit_config['client_secret'] = ''
        service.google_fit_config['redirect_uri'] = ''
        
        result = service.validate_config('google_fit')
        
        assert result is False
    
    def test_validate_config_invalid_provider(self, service):
        """Test validation for invalid provider"""
        result = service.validate_config('invalid_provider')
        
        assert result is False
    
    def test_validate_config_missing_all_values(self, service):
        """Test validation when all values are missing"""
        service.fitbit_config['client_id'] = ''
        service.fitbit_config['client_secret'] = ''
        service.fitbit_config['redirect_uri'] = ''
        
        result = service.validate_config('fitbit')
        
        assert result is False


class TestSingletonInstance:
    """Test oauth_service singleton"""
    
    def test_singleton_instance_exists(self):
        """Test that singleton instance is created"""
        assert oauth_service is not None
        assert isinstance(oauth_service, OAuthService)
    
    def test_singleton_instance_is_ready(self):
        """Test that singleton instance is properly initialized"""
        assert hasattr(oauth_service, 'google_fit_config')
        assert hasattr(oauth_service, 'oauth_states')
        assert oauth_service.oauth_states == {}


class TestEdgeCases:
    """Test edge cases and error scenarios"""
    
    @pytest.fixture
    def service(self):
        """Create OAuthService instance"""
        return OAuthService()
    
    def test_get_authorization_url_with_empty_user_id(self, service):
        """Test authorization URL generation with empty user_id"""
        result = service.get_authorization_url('google_fit', '')
        
        # Should still work, empty string is a valid user_id
        assert 'authorization_url' in result
        assert service.oauth_states[result['state']]['user_id'] == ''
    
    def test_multiple_states_can_coexist(self, service):
        """Test that multiple OAuth states can exist simultaneously"""
        result1 = service.get_authorization_url('google_fit', 'user1')
        result2 = service.get_authorization_url('fitbit', 'user2')
        result3 = service.get_authorization_url('samsung', 'user3')
        
        assert len(service.oauth_states) == 3
        assert result1['state'] != result2['state'] != result3['state']
    
    @patch('src.services.oauth_service.requests.post')
    def test_token_exchange_cleans_up_state_on_success(self, mock_post, service):
        """Test that state is cleaned up after successful token exchange"""
        state = 'cleanup_test'
        service.oauth_states[state] = {
            'user_id': 'user123',
            'provider': 'google_fit',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'access_token': 'token'}
        mock_post.return_value = mock_response
        
        service.exchange_code_for_token('google_fit', 'code', state)
        
        assert state not in service.oauth_states
    
    @patch('src.services.oauth_service.requests.post')
    def test_token_exchange_preserves_state_on_error(self, mock_post, service):
        """Test that state is preserved when token exchange fails"""
        state = 'error_test'
        service.oauth_states[state] = {
            'user_id': 'user123',
            'provider': 'google_fit',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.text = 'Error'
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception):
            service.exchange_code_for_token('google_fit', 'code', state)
        
        # State should still exist after error
        assert state in service.oauth_states
