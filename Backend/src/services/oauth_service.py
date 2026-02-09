"""
OAuth Service for Health Integrations
Handles OAuth 2.0 flows for Google Fit, Fitbit, Samsung Health, etc.
"""
import logging
import os
import secrets
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

import requests

logger = logging.getLogger(__name__)

# Best practice: Define timeout for OAuth requests to prevent hanging
OAUTH_REQUEST_TIMEOUT = 30  # seconds

class OAuthService:
    """Service for handling OAuth 2.0 authentication with health platforms"""

    def __init__(self):
        # Google Fit Configuration
        self.google_fit_config = {
            'client_id': os.getenv('GOOGLE_FIT_CLIENT_ID'),
            'client_secret': os.getenv('GOOGLE_FIT_CLIENT_SECRET'),
            'redirect_uri': os.getenv('GOOGLE_FIT_REDIRECT_URI'),
            'scopes': os.getenv('GOOGLE_FIT_SCOPES', '').split(','),
            'auth_url': 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_url': 'https://oauth2.googleapis.com/token',
            'api_base': 'https://www.googleapis.com/fitness/v1'
        }

        # Fitbit Configuration
        self.fitbit_config = {
            'client_id': os.getenv('FITBIT_CLIENT_ID'),
            'client_secret': os.getenv('FITBIT_CLIENT_SECRET'),
            'redirect_uri': os.getenv('FITBIT_REDIRECT_URI'),
            'scopes': os.getenv('FITBIT_SCOPES', 'activity heartrate sleep').split(','),
            'auth_url': 'https://www.fitbit.com/oauth2/authorize',
            'token_url': 'https://api.fitbit.com/oauth2/token',
            'api_base': 'https://api.fitbit.com/1/user/-'
        }

        # Samsung Health Configuration
        self.samsung_config = {
            'client_id': os.getenv('SAMSUNG_HEALTH_CLIENT_ID'),
            'client_secret': os.getenv('SAMSUNG_HEALTH_CLIENT_SECRET'),
            'redirect_uri': os.getenv('SAMSUNG_HEALTH_REDIRECT_URI'),
            'auth_url': 'https://us.account.samsung.com/accounts/v1/SAML/authorize',
            'token_url': 'https://us.account.samsung.com/accounts/v1/oauth2/token',
            'api_base': 'https://us.shealth.samsung.com'
        }

        # Withings Configuration (optional)
        self.withings_config = {
            'client_id': os.getenv('WITHINGS_CLIENT_ID'),
            'client_secret': os.getenv('WITHINGS_CLIENT_SECRET'),
            'redirect_uri': os.getenv('WITHINGS_REDIRECT_URI'),
            'auth_url': 'https://account.withings.com/oauth2_user/authorize2',
            'token_url': 'https://wbsapi.withings.net/v2/oauth2',
            'api_base': 'https://wbsapi.withings.net'
        }

        # State storage using Redis with in-memory fallback
        self._redis_client = None
        try:
            from ..redis_config import get_redis_client
            self._redis_client = get_redis_client()
            logger.info("OAuth state storage: Redis")
        except Exception:
            logger.warning("OAuth state storage: in-memory fallback (states lost on restart)")
        self._memory_states: dict[str, Any] = {}

    def _set_state(self, state: str, data: dict[str, Any], ttl: int = 600) -> None:
        """Store OAuth state with 10-minute TTL."""
        import json as _json
        if self._redis_client:
            try:
                self._redis_client.setex(f"oauth_state:{state}", ttl, _json.dumps(data))
                return
            except Exception:
                pass
        self._memory_states[state] = data

    def _get_state(self, state: str) -> dict[str, Any] | None:
        """Retrieve OAuth state."""
        import json as _json
        if self._redis_client:
            try:
                raw = self._redis_client.get(f"oauth_state:{state}")
                if raw:
                    return _json.loads(raw)
                return None
            except Exception:
                pass
        return self._memory_states.get(state)

    def _delete_state(self, state: str) -> None:
        """Delete OAuth state."""
        if self._redis_client:
            try:
                self._redis_client.delete(f"oauth_state:{state}")
            except Exception:
                pass
        self._memory_states.pop(state, None)

    def get_authorization_url(self, provider: str, user_id: str) -> dict[str, str]:
        """
        Generate OAuth authorization URL for a provider

        Args:
            provider: 'google_fit', 'fitbit', 'samsung', or 'withings'
            user_id: User identifier

        Returns:
            Dictionary with authorization URL and state
        """
        try:
            config = self._get_provider_config(provider)
            if not config:
                raise ValueError(f"Unsupported provider: {provider}")

            # Generate state for CSRF protection
            state = secrets.token_urlsafe(32)
            self._set_state(state, {
                'user_id': user_id,
                'provider': provider,
                'created_at': datetime.now(UTC).isoformat()
            })

            # Build authorization URL
            params = {
                'client_id': config['client_id'],
                'redirect_uri': config['redirect_uri'],
                'response_type': 'code',
                'state': state
            }

            # Add scopes based on provider
            if provider == 'google_fit':
                params['scope'] = ' '.join(config['scopes'])
                params['access_type'] = 'offline'
                params['prompt'] = 'consent'
            elif provider == 'fitbit':
                params['scope'] = ' '.join(config['scopes'])
            elif provider == 'samsung':
                params['scope'] = 'samsung.shealth.read'
            elif provider == 'withings':
                params['scope'] = 'user.metrics'

            auth_url = f"{config['auth_url']}?{urlencode(params)}"

            logger.info(f"Generated OAuth URL for {provider} - user: {user_id}")

            return {
                'authorization_url': auth_url,
                'state': state,
                'provider': provider
            }

        except Exception as e:
            logger.error(f"Error generating OAuth URL for {provider}: {str(e)}")
            raise

    def exchange_code_for_token(self, provider: str, code: str, state: str) -> dict[str, Any]:
        """
        Exchange authorization code for access token

        Args:
            provider: 'google_fit', 'fitbit', 'samsung', or 'withings'
            code: Authorization code from callback
            state: State parameter for verification

        Returns:
            Token data including access_token, refresh_token, expires_in
        """
        try:
            # Verify state
            stored_state = self._get_state(state)
            if not stored_state:
                raise ValueError("Invalid state parameter")

            state_data = stored_state
            if state_data['provider'] != provider:
                raise ValueError("Provider mismatch")

            config = self._get_provider_config(provider)
            if not config:
                raise ValueError(f"Unsupported provider: {provider}")

            # Prepare token request
            data = {
                'client_id': config['client_id'],
                'client_secret': config['client_secret'],
                'code': code,
                'redirect_uri': config['redirect_uri'],
                'grant_type': 'authorization_code'
            }

            # Make token request
            response = requests.post(
                config['token_url'],
                data=data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=OAUTH_REQUEST_TIMEOUT
            )

            if response.status_code != 200:
                logger.error(f"Token exchange failed for {provider}: {response.text}")
                raise Exception(f"Failed to exchange code for token: {response.status_code}")

            token_data = response.json()

            # Add metadata
            token_data['provider'] = provider
            token_data['user_id'] = state_data['user_id']
            token_data['obtained_at'] = datetime.now(UTC).isoformat()

            # Clean up state
            self._delete_state(state)

            logger.info(f"Successfully exchanged code for token - {provider} - user: {state_data['user_id']}")

            return token_data

        except Exception as e:
            logger.error(f"Error exchanging code for token ({provider}): {str(e)}")
            raise

    def refresh_access_token(self, provider: str, refresh_token: str) -> dict[str, Any]:
        """
        Refresh an expired access token

        Args:
            provider: 'google_fit', 'fitbit', 'samsung', or 'withings'
            refresh_token: Refresh token

        Returns:
            New token data
        """
        try:
            config = self._get_provider_config(provider)
            if not config:
                raise ValueError(f"Unsupported provider: {provider}")

            data = {
                'client_id': config['client_id'],
                'client_secret': config['client_secret'],
                'refresh_token': refresh_token,
                'grant_type': 'refresh_token'
            }

            response = requests.post(
                config['token_url'],
                data=data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=OAUTH_REQUEST_TIMEOUT
            )

            if response.status_code != 200:
                logger.error(f"Token refresh failed for {provider}: {response.text}")
                raise Exception(f"Failed to refresh token: {response.status_code}")

            token_data = response.json()
            token_data['provider'] = provider
            token_data['refreshed_at'] = datetime.now(UTC).isoformat()

            logger.info(f"Successfully refreshed token for {provider}")

            return token_data

        except Exception as e:
            logger.error(f"Error refreshing token ({provider}): {str(e)}")
            raise

    def revoke_token(self, provider: str, token: str) -> bool:
        """
        Revoke an access token

        Args:
            provider: 'google_fit', 'fitbit', 'samsung', or 'withings'
            token: Access token to revoke

        Returns:
            True if successful
        """
        try:
            if provider == 'google_fit':
                revoke_url = 'https://oauth2.googleapis.com/revoke'
                response = requests.post(revoke_url, params={'token': token}, timeout=OAUTH_REQUEST_TIMEOUT)
            elif provider == 'fitbit':
                config = self._get_provider_config(provider)
                if not config:
                    logger.error(f"Invalid provider config for {provider}")
                    return False
                revoke_url = 'https://api.fitbit.com/oauth2/revoke'
                response = requests.post(
                    revoke_url,
                    data={'token': token},
                    auth=(config['client_id'], config['client_secret']),
                    timeout=OAUTH_REQUEST_TIMEOUT
                )
            else:
                logger.warning(f"Token revocation not implemented for {provider}")
                return True

            logger.info(f"Revoked token for {provider}")
            return response.status_code == 200

        except Exception as e:
            logger.error(f"Error revoking token ({provider}): {str(e)}")
            return False

    def _get_provider_config(self, provider: str) -> dict[str, Any] | None:
        """Get configuration for a specific provider"""
        configs = {
            'google_fit': self.google_fit_config,
            'fitbit': self.fitbit_config,
            'samsung': self.samsung_config,
            'withings': self.withings_config
        }
        return configs.get(provider)

    def validate_config(self, provider: str) -> bool:
        """Check if OAuth configuration is complete for a provider"""
        config = self._get_provider_config(provider)
        if not config:
            return False

        required_keys = ['client_id', 'client_secret', 'redirect_uri']
        return all(config.get(key) for key in required_keys)

# Singleton instance
oauth_service = OAuthService()
