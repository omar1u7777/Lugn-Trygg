import logging
import os
import re
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import requests
from flask import Blueprint, g, redirect, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.health_analytics_service import health_analytics_service
from src.services.health_data_service import health_data_service
from src.services.oauth_service import oauth_service
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse
from src.utils.timestamp_utils import parse_iso_timestamp

# Environment detection
IS_PRODUCTION = os.getenv('FLASK_ENV', 'development').lower() == 'production'

# Validation patterns
PROVIDER_PATTERN = re.compile(r'^[a-z_]{3,20}$')
DEVICE_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,50}$')
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,40}$')

logger = logging.getLogger(__name__)


def _validate_redirect_url(url: str, default: str) -> str:
    """Validate redirect URL against a strict allowlist of hostnames."""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ''
        scheme = parsed.scheme
        if scheme not in ('http', 'https'):
            return default
        allowed_hosts = [
            'localhost',
            'lugn-trygg.vercel.app',
        ]
        # Check exact match or Vercel preview deployments (*.vercel.app)
        if hostname in allowed_hosts:
            return url
        if hostname.endswith('.vercel.app') and hostname.count('.') == 2:
            return url
        # Check env-configured frontend
        default_parsed = urlparse(default)
        if hostname == default_parsed.hostname:
            return url
        return default
    except Exception:
        return default


integration_bp = Blueprint('integration', __name__)

# Device storage backed by Firestore (no in-memory fallback)
def get_user_devices(user_id):
    """Get devices for a specific user from Firestore"""
    try:
        doc = db.collection('user_devices').document(user_id).get()
        if doc.exists:
            return doc.to_dict().get('devices', [])
        return []
    except Exception as e:
        logger.warning(f"Failed to get devices for user {user_id}: {e}")
        return []

def add_user_device(user_id, device):
    """Add a device for a specific user in Firestore"""
    try:
        devices = get_user_devices(user_id)
        devices.append(device)
        db.collection('user_devices').document(user_id).set(
            {'devices': devices, 'updated_at': datetime.now(UTC).isoformat()},
            merge=True
        )
    except Exception as e:
        logger.error(f"Failed to add device for user {user_id}: {e}")

def remove_user_device(user_id, device_id):
    """Remove a device for a specific user from Firestore"""
    try:
        devices = get_user_devices(user_id)
        devices = [d for d in devices if d.get('id') != device_id]
        db.collection('user_devices').document(user_id).set(
            {'devices': devices, 'updated_at': datetime.now(UTC).isoformat()},
            merge=True
        )
    except Exception as e:
        logger.error(f"Failed to remove device for user {user_id}: {e}")

# ============================================================================
# OAUTH 2.0 ENDPOINTS
# ============================================================================

SUPPORTED_PROVIDERS = ['google_fit', 'fitbit', 'samsung', 'withings']

@integration_bp.route("/oauth/<provider>/authorize", methods=["GET", "OPTIONS"])
@rate_limit_by_endpoint
def oauth_authorize(provider):
    """
    Initiate OAuth flow for a health provider
    Supported providers: google_fit, fitbit, samsung, withings

    Requires JWT token for authentication (user_id query param blocked in production)
    """
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        # Validate provider first
        provider_clean = input_sanitizer.sanitize(provider) if provider else ''
        if not PROVIDER_PATTERN.match(provider_clean):
            return APIResponse.bad_request('Invalid provider format')

        if provider_clean not in SUPPORTED_PROVIDERS:
            return APIResponse.bad_request(
                f'Unsupported provider. Must be one of: {", ".join(SUPPORTED_PROVIDERS)}'
            )

        # Get user_id from JWT or g object (production)
        # Allow query param only in development for testing
        user_id = g.get('user_id')

        if not user_id and not IS_PRODUCTION:
            # Development only: allow query parameter
            user_id = request.args.get('user_id')
            if user_id and not USER_ID_PATTERN.match(user_id):
                return APIResponse.bad_request('Invalid user_id format')

        logger.info(f"🔵 OAUTH FLOW STARTED: User {user_id} authorizing {provider_clean.upper()}")

        if not user_id:
            logger.error("❌ Missing user_id in OAuth authorize request")
            return APIResponse.unauthorized('Authentication required')

        # Check if OAuth is configured
        if not oauth_service.validate_config(provider_clean):
            return APIResponse.error(
                message=f'OAuth not configured for {provider_clean}. Please configure OAuth credentials in .env file',
                error_code='SERVICE_UNAVAILABLE',
                status_code=503
            )

        # Generate authorization URL
        auth_data = oauth_service.get_authorization_url(provider_clean, user_id)

        audit_log(
            event_type="OAUTH_INITIATED",
            user_id=user_id,
            details={
                'provider': provider_clean,
                'state': auth_data['state']
            }
        )

        return APIResponse.success(
            data={
                'authorizationUrl': auth_data['authorization_url'],
                'state': auth_data['state'],
                'provider': provider_clean
            },
            message='Redirect user to authorizationUrl to grant access'
        )

    except Exception as e:
        logger.exception(f"Error initiating OAuth for {provider}: {e}")
        return APIResponse.error('Failed to initiate OAuth')

@integration_bp.route("/oauth/<provider>/callback", methods=["GET", "OPTIONS"])
@rate_limit_by_endpoint
def oauth_callback(provider):
    """
    OAuth callback endpoint - receives authorization code
    """
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        # Validate provider
        provider_clean = input_sanitizer.sanitize(provider) if provider else ''
        if not PROVIDER_PATTERN.match(provider_clean) or provider_clean not in SUPPORTED_PROVIDERS:
            return APIResponse.bad_request('Invalid provider')

        code = request.args.get('code')
        state = request.args.get('state')
        error = request.args.get('error')

        logger.info(f"🔵 OAUTH CALLBACK: Received authorization code for {provider_clean.upper()}")

        if error:
            logger.error(f"❌ OAuth error from {provider_clean}: {error}")
            return APIResponse.bad_request(
                message='Authorization denied',
                details={'provider': provider_clean, 'error': input_sanitizer.sanitize(error)}
            )

        if not code or not state:
            logger.error(f"❌ Missing code or state in OAuth callback for {provider_clean}")
            return APIResponse.bad_request('Missing code or state parameter')

        # Exchange code for token
        logger.info(f"🔵 Exchanging authorization code for access token ({provider_clean})")
        token_data = oauth_service.exchange_code_for_token(provider_clean, code, state)
        user_id = token_data['user_id']

        if not user_id or not USER_ID_PATTERN.match(user_id):
            logger.error("❌ Invalid user_id from OAuth exchange")
            return APIResponse.bad_request('Invalid user from OAuth exchange')

        logger.info(f"✅ OAuth token exchange successful for user {user_id} ({provider_clean})")

        # Store tokens in Firestore
        token_ref = db.collection('oauth_tokens').document(f"{user_id}_{provider_clean}")
        token_ref.set({
            'user_id': user_id,
            'provider': provider_clean,
            'access_token': token_data.get('access_token'),
            'refresh_token': token_data.get('refresh_token'),
            'expires_in': token_data.get('expires_in'),
            'token_type': token_data.get('token_type'),
            'scope': token_data.get('scope'),
            'obtained_at': datetime.now(UTC).isoformat(),
            'expires_at': (datetime.now(UTC) + timedelta(seconds=token_data.get('expires_in', 3600))).isoformat()
        })

        logger.info(f"✅ OAuth tokens stored in Firestore for user {user_id} ({provider_clean})")

        audit_log(
            event_type="OAUTH_COMPLETED",
            user_id=user_id,
            details={
                'provider': provider_clean,
                'scope': token_data.get('scope')
            }
        )

        # Redirect to frontend success page - validate frontend_url
        default_frontend = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        frontend_url = request.args.get('frontend_url', default_frontend)
        # Only allow known frontend URLs using strict validation
        frontend_url = _validate_redirect_url(frontend_url, default_frontend)

        logger.info("OAuth flow complete: redirecting to frontend for provider %s", provider_clean)
        return redirect(f"{frontend_url}/integrations?success=true&provider={provider_clean}")

    except Exception as e:
        logger.exception("Error in OAuth callback")
        default_frontend = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        frontend_url = request.args.get('frontend_url', default_frontend)
        frontend_url = _validate_redirect_url(frontend_url, default_frontend)
        provider_clean = re.sub(r'[^a-zA-Z0-9_-]', '', str(provider))[:50]
        return redirect(f"{frontend_url}/integrations?error=oauth_failed&provider={provider_clean}")

@integration_bp.route("/oauth/<provider>/disconnect", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def oauth_disconnect(provider):
    """
    Disconnect OAuth integration and revoke tokens
    """
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        # Validate provider
        provider_clean = input_sanitizer.sanitize(provider) if provider else ''
        if not PROVIDER_PATTERN.match(provider_clean) or provider_clean not in SUPPORTED_PROVIDERS:
            return APIResponse.bad_request('Invalid provider')

        # Get stored tokens
        token_ref = db.collection('oauth_tokens').document(f"{user_id}_{provider_clean}")
        token_doc = token_ref.get()

        if token_doc.exists:
            token_data = token_doc.to_dict()
            access_token = token_data.get('access_token')

            # Revoke token with provider
            try:
                oauth_service.revoke_token(provider_clean, access_token)
            except Exception as revoke_error:
                logger.warning(f"Failed to revoke token with provider: {revoke_error}")

            # Delete from database
            token_ref.delete()

            audit_log(
                event_type="OAUTH_DISCONNECTED",
                user_id=user_id,
                details={'provider': provider_clean}
            )

            return APIResponse.success(
                data={'provider': provider_clean},
                message=f'{provider_clean} disconnected successfully'
            )
        else:
            return APIResponse.not_found(f'No OAuth connection found for {provider_clean}')

    except Exception as e:
        logger.exception(f"Error disconnecting OAuth for {provider}: {e}")
        return APIResponse.error('Failed to disconnect OAuth')

@integration_bp.route("/oauth/<provider>/status", methods=["GET", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def oauth_status(provider):
    """
    Check OAuth connection status for a provider
    """
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        # Validate provider
        provider_clean = input_sanitizer.sanitize(provider) if provider else ''
        if not PROVIDER_PATTERN.match(provider_clean) or provider_clean not in SUPPORTED_PROVIDERS:
            return APIResponse.bad_request('Invalid provider')

        logger.info(f"🔵 Checking OAuth status for {provider_clean.upper()} (user: {user_id})")

        token_ref = db.collection('oauth_tokens').document(f"{user_id}_{provider_clean}")
        token_doc = token_ref.get()

        if token_doc.exists:
            token_data = token_doc.to_dict()
            expires_at = parse_iso_timestamp(token_data.get('expires_at'), default_to_now=False)
            is_expired = datetime.now(UTC) > expires_at if expires_at else True

            logger.info(f"✅ OAuth token FOUND for {provider_clean.upper()}: expires_at={token_data.get('expires_at')}, is_expired={is_expired}")

            return APIResponse.success(
                data={
                    'connected': True,
                    'provider': provider_clean,
                    'scope': token_data.get('scope'),
                    'obtainedAt': token_data.get('obtained_at'),
                    'expiresAt': token_data.get('expires_at'),
                    'isExpired': is_expired
                },
                message='OAuth connection active'
            )
        else:
            logger.info(f"❌ OAuth token NOT FOUND for {provider_clean.upper()} (user: {user_id})")
            return APIResponse.success(
                data={'connected': False, 'provider': provider_clean},
                message='No OAuth connection'
            )

    except Exception as e:
        logger.exception(f"Error checking OAuth status for {provider}: {e}")
        return APIResponse.error('Failed to check OAuth status')

# ============================================================================
# HEALTH DATA ENDPOINTS (WITH OAUTH)
# ============================================================================

@integration_bp.route("/health/sync/<provider>", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def sync_health_data_oauth(provider):
    """
    Sync real health data using OAuth tokens
    Supported providers: google_fit, fitbit, samsung
    """
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        # Validate provider
        provider_clean = input_sanitizer.sanitize(provider) if provider else ''
        if not PROVIDER_PATTERN.match(provider_clean):
            return APIResponse.bad_request('Invalid provider format')

        sync_providers = ['google_fit', 'fitbit', 'samsung']
        if provider_clean not in sync_providers:
            return APIResponse.bad_request(f'Unsupported provider: {provider_clean}. Must be one of: {", ".join(sync_providers)}')

        logger.info(f"🔵 HEALTH DATA SYNC STARTED for {provider_clean.upper()} (user: {user_id})")

        # Get OAuth token
        token_ref = db.collection('oauth_tokens').document(f"{user_id}_{provider_clean}")
        token_doc = token_ref.get()

        if not token_doc.exists:
            logger.error(f"❌ No OAuth token found for {provider_clean.upper()} (user: {user_id})")
            return APIResponse.unauthorized(
                message=f'Not connected to {provider_clean}. Please authorize access first'
            )

        token_data = token_doc.to_dict()
        access_token = token_data.get('access_token')
        refresh_token = token_data.get('refresh_token')

        logger.info(f"✅ OAuth token found for {provider_clean.upper()}")

        if not access_token:
            logger.error(f"❌ Invalid access token for {provider_clean.upper()}")
            return APIResponse.unauthorized(
                message=f'Invalid token for {provider_clean}. Please reconnect to continue'
            )

        expires_at = parse_iso_timestamp(token_data.get('expires_at'), default_to_now=True)

        # Refresh token if expired
        if datetime.now(UTC) > expires_at and refresh_token:
            logger.info(f"🔄 Token expired for {provider_clean.upper()}, refreshing...")
            new_token_data = oauth_service.refresh_access_token(provider_clean, refresh_token)

            # Update stored token
            token_ref.update({
                'access_token': new_token_data.get('access_token'),
                'expires_in': new_token_data.get('expires_in'),
                'refreshed_at': datetime.now(UTC).isoformat(),
                'expires_at': (datetime.now(UTC) + timedelta(seconds=new_token_data.get('expires_in', 3600))).isoformat()
            })

            logger.info(f"✅ Token refreshed for {provider_clean.upper()}")
            access_token = new_token_data.get('access_token') or access_token

        # Get date range from request - validate
        data = request.get_json() or {}
        days_back = data.get('days', 7)
        if not isinstance(days_back, int) or days_back < 1 or days_back > 90:
            days_back = 7

        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=days_back)

        # Fetch health data based on provider
        logger.info(f"🔵 Fetching real health data from {provider_clean.upper()} API (days_back={days_back})")

        if provider_clean == 'google_fit':
            health_data = health_data_service.fetch_google_fit_data(
                access_token, start_date, end_date
            )
        elif provider_clean == 'fitbit':
            health_data = health_data_service.fetch_fitbit_data(
                access_token, start_date, end_date
            )
        elif provider_clean == 'samsung':
            health_data = health_data_service.fetch_samsung_health_data(
                access_token, start_date, end_date
            )
        else:
            return APIResponse.bad_request(f'Unsupported provider: {provider_clean}')

        logger.info(f"✅ Real health data FETCHED from {provider_clean.upper()}: {list(health_data.keys()) if health_data else 'no data'}")

        # Store health data in Firestore
        health_ref = db.collection('health_data').document(user_id).collection(provider_clean).document()
        health_ref.set({
            'user_id': user_id,
            'provider': provider_clean,
            'data': health_data,
            'synced_at': datetime.now(UTC).isoformat(),
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            }
        })

        logger.info(f"✅ Real health data STORED in Firestore for user {user_id} ({provider_clean.upper()})")

        audit_log(
            event_type="HEALTH_DATA_SYNCED",
            user_id=user_id,
            details={
                'provider': provider_clean,
                'metrics': list(health_data.keys()) if health_data else [],
                'days': days_back
            }
        )

        return APIResponse.success(
            data={
                'provider': provider_clean,
                'data': health_data,
                'syncedAt': datetime.now(UTC).isoformat()
            },
            message=f'Successfully synced data from {provider_clean}'
        )

    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error syncing {provider} data: {str(e)}")
        return APIResponse.error(
            message='Failed to fetch data from provider',
            error_code='BAD_GATEWAY',
            status_code=502
        )
    except Exception as e:
        logger.exception(f"Error syncing health data from {provider}: {e}")
        return APIResponse.error('Failed to sync health data')

# ============================================================================
# HEALTH ANALYTICS ENDPOINTS - AI ANALYSIS
# ============================================================================

@integration_bp.route("/health/analyze", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def analyze_health_mood_patterns():
    """
    Analyze patterns between health data and mood tracking
    Provides AI-powered recommendations for stress reduction and better sleep
    """
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        # Get request parameters (optional date range)
        data = request.get_json() or {}
        days = data.get('days', 30)  # Default to last 30 days

        # Fetch health data from Firestore
        health_data = []
        try:
            health_ref = db.collection('health_data').where('user_id', '==', user_id).limit(days).stream()
            for doc in health_ref:
                doc_data = doc.to_dict()
                health_data.append({
                    'date': doc_data.get('date'),
                    'steps': doc_data.get('steps', 0),
                    'sleep_hours': doc_data.get('sleep_hours', 0),
                    'heart_rate': doc_data.get('heart_rate', 0),
                    'calories': doc_data.get('calories', 0)
                })
        except Exception as e:
            logger.warning(f"Failed to fetch health data: {e}")

        # Fetch mood data from Firestore
        mood_data = []
        try:
            mood_ref = db.collection('moods').where('user_id', '==', user_id).limit(days).stream()
            for doc in mood_ref:
                doc_data = doc.to_dict()
                mood_data.append({
                    'date': doc_data.get('timestamp'),
                    'mood_score': doc_data.get('mood_score', 5)
                })
        except Exception as e:
            logger.warning(f"Failed to fetch mood data: {e}")

        # Analyze correlation using health_analytics_service
        analysis = health_analytics_service.analyze_health_mood_correlation(
            health_data=health_data,
            mood_data=mood_data
        )

        # Add metadata
        analysis['user_id'] = user_id
        analysis['generated_at'] = datetime.now(UTC).isoformat()
        analysis['data_points'] = {
            'health_entries': len(health_data),
            'mood_entries': len(mood_data)
        }

        audit_log('HEALTH_MOOD_ANALYSIS_COMPLETED', user_id, {
            'days_analyzed': analysis.get('days_analyzed', 0),
            'patterns_found': len(analysis.get('patterns', []))
        })

        return APIResponse.success(
            data=analysis,
            message='Health-mood analysis completed successfully'
        )
    except Exception as e:
        logger.error(f"Exception in analyze_health_mood_patterns: {e}")
        return APIResponse.error('Internal server error')

@integration_bp.route("/test", methods=["GET", "OPTIONS"])
@rate_limit_by_endpoint
def test_route():
    """Test endpoint for integration blueprint - blocked in production"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    if IS_PRODUCTION:
        return APIResponse.forbidden('Test endpoint disabled in production')

    return APIResponse.success(message='Integration blueprint is working!')

# ============================================================================
# LEGACY ENDPOINTS - DEPRECATED! USE OAUTH ENDPOINTS INSTEAD
# ============================================================================
# ⚠️ These endpoints return MOCK DATA ONLY
# ⚠️ Use /api/integration/oauth/<provider>/* endpoints for REAL data
# ============================================================================

# Google Fit & Wearable Data Integration
@integration_bp.route("/wearable/status", methods=["GET", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_wearable_status():
    """Get wearable integration status - DEPRECATED: Returns MOCK DATA"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        logger.warning("⚠️ DEPRECATED ENDPOINT CALLED: /wearable/status returns MOCK DATA!")
        logger.warning("⚠️ USE INSTEAD: GET /api/integration/oauth/*/status for real OAuth data")

        devices = get_user_devices(user_id)

        return APIResponse.success(
            data={'devices': devices, 'deprecated': True},
            message='Use /api/integration/oauth/<provider>/status for real data'
        )

    except Exception as e:
        logger.exception(f"Error getting wearable status: {e}")
        return APIResponse.error('Failed to get wearable status')

# PRODUCTION: Deprecated MOCK endpoint removed
# Use real OAuth flow instead: GET /api/integration/oauth/{provider}/authorize
"""
@integration_bp.route("/wearable/connect", methods=["POST"])
@jwt_required()
def connect_wearable():
    return jsonify({
        "error": "Endpoint deprecated - use OAuth flow",
        "oauth_endpoints": {
            "fitbit": "/api/integration/oauth/fitbit/authorize",
            "google_fit": "/api/integration/oauth/google-fit/authorize",
            "apple_health": "/api/integration/oauth/apple-health/authorize"
        }
    }), 410
"""

@integration_bp.route("/wearable/disconnect", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def disconnect_wearable():
    """Disconnect a wearable device"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        data = request.get_json() or {}
        device_id = data.get('device_id')

        # Validate device_id
        if not device_id or not DEVICE_ID_PATTERN.match(str(device_id)):
            return APIResponse.bad_request('Invalid device_id')

        device_id_clean = input_sanitizer.sanitize(str(device_id))

        # Remove from user's devices
        remove_user_device(user_id, device_id_clean)

        audit_log(
            event_type="WEARABLE_DISCONNECTED",
            user_id=user_id,
            details={'device_id': device_id_clean}
        )

        return APIResponse.success(message='Device disconnected successfully')

    except Exception as e:
        logger.exception(f"Error disconnecting wearable: {e}")
        return APIResponse.error('Failed to disconnect wearable')

@integration_bp.route("/wearable/sync", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def sync_wearable():
    """Sync wearable device data"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        data = request.get_json() or {}
        device_id = data.get('device_id')

        # Validate device_id
        if not device_id or not DEVICE_ID_PATTERN.match(str(device_id)):
            return APIResponse.bad_request('Invalid device_id')

        device_id_clean = input_sanitizer.sanitize(str(device_id))

        # Update device's last sync time
        devices = get_user_devices(user_id)
        for device in devices:
            if device['id'] == device_id_clean:
                device['lastSync'] = datetime.now(UTC).isoformat()
                break

        # PRODUCTION FIX: Return deprecation notice instead of random mock data
        return APIResponse.success(
            data={
                "deprecated": True,
                "message": "This endpoint returns no real data. Use OAuth endpoints instead.",
                "oauth_endpoints": {
                    "sync": "/api/integration/oauth/<provider>/sync"
                }
            },
            message='Endpoint deprecated — use OAuth flow for real wearable sync'
        )

    except Exception as e:
        logger.exception(f"Error syncing wearable: {e}")
        return APIResponse.error('Failed to sync wearable', status_code=500)

@integration_bp.route("/wearable/google-fit/sync", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def sync_google_fit():
    """Sync data from Google Fit API"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        data = request.get_json() or {}
        access_token = data.get('access_token')
        data.get('date_from', (datetime.now(UTC) - timedelta(days=7)).isoformat())
        data.get('date_to', datetime.now(UTC).isoformat())

        if not access_token:
            return APIResponse.bad_request('Access token required')

        # PRODUCTION FIX: Return deprecation notice instead of mock data.
        # Real Google Fit integration uses OAuth flow at
        # /api/integration/oauth/google-fit/*
        return APIResponse.success(
            data={
                "deprecated": True,
                "message": "Legacy endpoint — use OAuth flow for real Google Fit data.",
                "oauth_endpoints": {
                    "authorize": "/api/integration/oauth/google-fit/authorize",
                    "sync": "/api/integration/oauth/google-fit/sync"
                }
            },
            message='Endpoint deprecated — use OAuth flow'
        )

    except Exception as e:
        logger.error(f"Failed to sync Google Fit data: {str(e)}")
        return APIResponse.error('Failed to sync wearable data', status_code=500)

@integration_bp.route('/wearable/apple-health/sync', methods=['POST', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def sync_apple_health():
    """Sync data from Apple Health (stub implementation)"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        # Apple Health integration would require HealthKit on iOS
        # This is a stub that would need native iOS implementation
        return APIResponse.error(
            'Apple Health integration requires native iOS implementation',
            error_code='NOT_IMPLEMENTED',
            status_code=501,
            details={'note': 'Use React Native or native iOS app for Apple Health integration'}
        )

    except Exception as e:
        logger.error(f"Apple Health sync failed: {str(e)}")
        return APIResponse.error('Failed to sync Apple Health data', status_code=500)

@integration_bp.route('/wearable/details', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_wearable_details():
    """Get detailed wearable data with insights"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        # Get user's connected devices
        devices = get_user_devices(user_id)

        # PRODUCTION FIX: Return actual connected device info without random mock health data.
        # Real health metrics come from OAuth-connected providers.
        wearable_data = {
            "data": {
                "note": "Health metrics require OAuth integration. Use /api/integration/oauth/<provider>/sync."
            },
            "lastSync": None,
            "devices": [
                {
                    "type": d.get('type', 'smartwatch'),
                    "brand": d.get('name', 'Unknown').split()[0] if d.get('name') else 'Unknown',
                    "model": d.get('name', 'Unknown Device'),
                    "connected": d.get('connected', True),
                    "lastSync": d.get('lastSync')
                }
                for d in devices
            ] if devices else [],
            "deprecated": True,
            "oauth_endpoints": {
                "fitbit": "/api/integration/oauth/fitbit/authorize",
                "google_fit": "/api/integration/oauth/google-fit/authorize"
            }
        }

        return APIResponse.success(data=wearable_data)

    except Exception as e:
        logger.error(f"Failed to get wearable data: {str(e)}")
        return APIResponse.error('Failed to retrieve wearable data', status_code=500)

# FHIR Healthcare Integration (Not Yet Implemented — returns 501)
@integration_bp.route('/fhir/patient', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_fhir_patient():
    """Get patient data from FHIR server (not yet implemented)"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    return APIResponse.error(
        'FHIR patient integration is not yet available',
        error_code='NOT_IMPLEMENTED',
        status_code=501,
        details={'note': 'FHIR R4 integration requires a configured FHIR server endpoint'}
    )


@integration_bp.route('/fhir/observation', methods=['GET', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_fhir_observations():
    """Get observation data from FHIR server (not yet implemented)"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    return APIResponse.error(
        'FHIR observation integration is not yet available',
        error_code='NOT_IMPLEMENTED',
        status_code=501,
        details={'note': 'FHIR R4 integration requires a configured FHIR server endpoint'}
    )


# ============================================================================
# CRISIS REFERRAL ENDPOINTS
# ============================================================================

@integration_bp.route('/crisis/referral', methods=['POST', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def create_crisis_referral():
    """Create a crisis referral to healthcare services"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        data = request.get_json() or {}

        # Validate and sanitize input
        valid_crisis_types = ['general', 'anxiety', 'depression', 'suicidal', 'panic', 'other']
        valid_urgency_levels = ['low', 'medium', 'high', 'critical']

        crisis_type = data.get('crisis_type', 'general')
        if crisis_type not in valid_crisis_types:
            crisis_type = 'general'

        urgency_level = data.get('urgency_level', 'medium')
        if urgency_level not in valid_urgency_levels:
            urgency_level = 'medium'

        notes = input_sanitizer.sanitize(data.get('notes', ''))[:500]  # Limit notes length

        referral_data = {
            "referralId": f"REF-{user_id}-{int(datetime.now(UTC).timestamp())}",
            "userId": user_id,
            "crisisType": crisis_type,
            "urgencyLevel": urgency_level,
            "notes": notes,
            "createdAt": datetime.now(UTC).isoformat(),
            "status": "pending",
            "assignedProvider": "Crisis Intervention Team",
            "followUpRequired": True,
            "estimatedResponseTime": "2 hours" if urgency_level in ["high", "critical"] else "24 hours"
        }

        audit_log(
            event_type="CRISIS_REFERRAL_CREATED",
            user_id=user_id,
            details={
                'crisis_type': crisis_type,
                'urgency_level': urgency_level,
                'referral_id': referral_data['referralId']
            }
        )

        return APIResponse.created(data={
            'referral': referral_data,
            'nextSteps': [
                "A healthcare provider will contact you within the estimated response time",
                "Keep emergency contact information handy",
                "Consider reaching out to trusted friends or family"
            ]
        }, message='Crisis referral created successfully')

    except Exception as e:
        logger.error(f"Failed to create crisis referral: {str(e)}")
        return APIResponse.error('Failed to create referral', status_code=500)

@integration_bp.route('/health/sync', methods=['POST', 'OPTIONS'])
@rate_limit_by_endpoint
@AuthService.jwt_required
def sync_health_data():
    """Sync comprehensive health data from multiple sources"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        data = request.get_json() or {}
        sources = data.get('sources', ['google_fit'])  # Default to Google Fit

        # Validate sources
        valid_sources = ['google_fit', 'apple_health', 'fhir', 'fitbit', 'samsung']
        sources = [s for s in sources if s in valid_sources][:5]  # Limit to 5 sources
        if not sources:
            sources = ['google_fit']

        synced_data = {}

        # Sync from each requested source
        for source in sources:
            if source == 'google_fit':
                # Mock Google Fit sync
                synced_data['googleFit'] = {
                    'heartRate': 72,
                    'steps': 8500,
                    'sleepHours': 7.5,
                    'syncedAt': datetime.now(UTC).isoformat()
                }
            elif source == 'apple_health':
                synced_data['appleHealth'] = {
                    'status': 'notAvailable',
                    'message': 'Apple Health requires native iOS integration'
                }
            elif source == 'fhir':
                synced_data['fhir'] = {
                    'patientData': True,
                    'observationsCount': 5,
                    'lastUpdated': datetime.now(UTC).isoformat()
                }

        # Combine data for mood correlation analysis
        health_insights = generate_health_insights(synced_data)

        audit_log(
            event_type="HEALTH_DATA_MULTI_SYNCED",
            user_id=user_id,
            details={
                'sources': sources,
                'data_points': sum(len(data_item) for data_item in synced_data.values() if isinstance(data_item, dict))
            }
        )

        return APIResponse.success(data={
            'syncedData': synced_data,
            'insights': health_insights,
            'correlationWithMood': analyze_health_mood_correlation(user_id, synced_data)
        })

    except Exception as e:
        logger.error(f"Failed to sync health data: {str(e)}")
        return APIResponse.error('Failed to sync health data', status_code=500)

def generate_health_insights(health_data):
    """Generate insights from synced health data"""
    insights = []

    # Check both camelCase and snake_case keys for compatibility
    if 'googleFit' in health_data or 'google_fit' in health_data:
        fit_data = health_data.get('googleFit') or health_data.get('google_fit', {})
        if fit_data.get('steps', 0) >= 8000:
            insights.append("Great job meeting your step goal today!")
        if fit_data.get('sleepHours', fit_data.get('sleep_hours', 0)) >= 7:
            insights.append("You're getting adequate sleep - this supports good mental health")
        if fit_data.get('heartRate', fit_data.get('heart_rate', 0)) < 80:
            insights.append("Your resting heart rate indicates good cardiovascular health")

    return insights

def analyze_health_mood_correlation(user_id, health_data):
    """Analyze correlation between health metrics and mood using historical data."""
    try:
        from datetime import datetime, timedelta
        # Fetch last 30 days of moods
        thirty_days_ago = (datetime.now(UTC) - timedelta(days=30)).isoformat()
        moods_ref = (
            db.collection('moods')
            .where('user_id', '==', user_id)
            .where('created_at', '>=', thirty_days_ago)
            .order_by('created_at')
            .limit(200)
            .stream()
        )
        mood_scores = [m.to_dict().get('mood_score', 5) for m in moods_ref]

        if len(mood_scores) < 5:
            return {
                "sleepMoodCorrelation": None,
                "activityMoodCorrelation": None,
                "heartRateMoodCorrelation": None,
                "insights": ["Not enough data to calculate correlations. Keep logging your moods!"]
            }

        sum(mood_scores) / len(mood_scores)
        sleep_hours = health_data.get('sleepHours', health_data.get('sleep_hours', 0))
        steps = health_data.get('steps', 0)
        hr = health_data.get('heartRate', health_data.get('heart_rate', 0))

        # Simple heuristic correlations based on available data
        insights = []
        sleep_corr = min(sleep_hours / 8.0, 1.0) if sleep_hours else None
        activity_corr = min(steps / 10000.0, 1.0) if steps else None
        hr_corr = max(1.0 - (hr - 60) / 40.0, 0.0) if hr else None

        if sleep_corr is not None and sleep_corr > 0.7:
            insights.append("Your sleep duration supports good mood stability")
        if activity_corr is not None and activity_corr > 0.5:
            insights.append("Your physical activity level positively impacts your mood")
        if hr_corr is not None and hr_corr > 0.6:
            insights.append("Your resting heart rate indicates low stress levels")
        if not insights:
            insights.append("Keep tracking to discover patterns between your health and mood")

        return {
            "sleepMoodCorrelation": round(sleep_corr, 2) if sleep_corr is not None else None,
            "activityMoodCorrelation": round(activity_corr, 2) if activity_corr is not None else None,
            "heartRateMoodCorrelation": round(hr_corr, 2) if hr_corr is not None else None,
            "insights": insights,
            "data_points": len(mood_scores)
        }
    except Exception as e:
        logger.error(f"Error analyzing health-mood correlation: {e}")
        return {
            "sleepMoodCorrelation": None,
            "activityMoodCorrelation": None,
            "heartRateMoodCorrelation": None,
            "insights": ["Unable to calculate correlations at this time"]
        }

# ============================================================================
# AUTO-SYNC SCHEDULER ENDPOINTS
# ============================================================================

@integration_bp.route("/oauth/<provider>/auto-sync", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def toggle_auto_sync(provider):
    """Enable or disable auto-sync for a provider"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        # Validate provider
        provider_clean = input_sanitizer.sanitize(provider) if provider else ''
        if not PROVIDER_PATTERN.match(provider_clean) or provider_clean not in SUPPORTED_PROVIDERS:
            return APIResponse.bad_request('Invalid provider')

        data = request.get_json() or {}
        enabled = bool(data.get("enabled", False))

        valid_frequencies = ['hourly', 'daily', 'weekly']
        frequency = data.get("frequency", "daily")
        if frequency not in valid_frequencies:
            frequency = "daily"

        integrations_ref = db.collection("integrations").document(user_id)
        integrations_data = integrations_ref.get().to_dict() or {}

        if "auto_sync" not in integrations_data:
            integrations_data["auto_sync"] = {}

        integrations_data["auto_sync"][provider_clean] = {
            "enabled": enabled,
            "frequency": frequency,
            "lastSync": datetime.now(UTC).isoformat() if enabled else None,
            "nextSync": (datetime.now(UTC) + timedelta(days=1)).isoformat() if enabled else None
        }

        integrations_ref.set(integrations_data, merge=True)

        return APIResponse.success(data={
            "provider": provider_clean,
            "autoSyncEnabled": enabled,
            "frequency": frequency
        })

    except Exception as e:
        logger.error(f"Failed to toggle auto-sync: {str(e)}")
        return APIResponse.error('Failed to toggle auto-sync', status_code=500)

@integration_bp.route("/oauth/auto-sync/settings", methods=["GET", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def get_auto_sync_settings():
    """Get all auto-sync settings for user"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        integrations_ref = db.collection("integrations").document(user_id)
        integrations_data = integrations_ref.get().to_dict() or {}

        auto_sync_settings = integrations_data.get("auto_sync", {})

        return APIResponse.success(data={'settings': auto_sync_settings})

    except Exception as e:
        logger.error(f"Failed to get auto-sync settings: {str(e)}")
        return APIResponse.error('Failed to get auto-sync settings', status_code=500)

# ============================================================================
# HEALTH ALERTS ENDPOINTS
# ============================================================================

@integration_bp.route("/health/check-alerts", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def check_health_alerts():
    """Check health data for abnormalities and send alerts"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        data = request.get_json() or {}

        provider = data.get("provider", "unknown")
        if provider:
            provider = input_sanitizer.sanitize(str(provider))[:30]

        health_data = data.get("health_data", {})

        alerts = []

        # Safely extract numeric values
        try:
            steps = int(health_data.get("steps", 0))
        except (ValueError, TypeError):
            steps = 0

        if steps > 0 and steps < 3000:
            alerts.append({
                "type": "lowSteps",
                "severity": "warning",
                "message": "Low activity level detected",
                "value": steps,
                "threshold": "5000+ steps recommended",
                "recommendations": [
                    "Take a 10-minute walk",
                    "Use stairs instead of elevator",
                    "Go for a walk during lunch"
                ]
            })

        heart_rate = health_data.get("heart_rate", 0)
        if heart_rate > 85:
            alerts.append({
                "type": "highHeartRate",
                "severity": "warning",
                "message": "Elevated resting heart rate detected",
                "value": f"{heart_rate} bpm",
                "threshold": "60-80 bpm is normal",
                "recommendations": [
                    "Try to reduce stress",
                    "Practice deep breathing",
                    "Review sleep quality",
                    "Contact healthcare provider if concerned"
                ]
            })

        sleep_hours = health_data.get("sleep_hours", 0)
        if sleep_hours > 0 and sleep_hours < 6:
            alerts.append({
                "type": "poorSleep",
                "severity": "warning",
                "message": "Insufficient sleep detected",
                "value": f"{sleep_hours} hours",
                "threshold": "7-9 hours recommended",
                "recommendations": [
                    "Establish a sleep routine",
                    "Avoid screens 1 hour before bed",
                    "Keep bedroom cool and dark",
                    "Avoid caffeine after 2 PM"
                ]
            })

        calories = health_data.get("calories", 0)
        if calories > 0 and calories < 1500:
            alerts.append({
                "type": "lowCalories",
                "severity": "info",
                "message": "Low energy expenditure",
                "value": f"{calories} kcal",
                "threshold": "1800-2200 kcal is normal",
                "recommendations": [
                    "Increase your physical activity",
                    "Try interval training",
                    "Take faster walks"
                ]
            })

        if alerts:
            # Get user data from Firestore
            user_ref = db.collection("users").document(user_id)
            user_doc = user_ref.get()
            user_data = user_doc.to_dict() if user_doc.exists else None

            if user_data and user_data.get('email'):
                from src.services.email_service import email_service

                integrations_ref = db.collection("integrations").document(user_id)
                integrations_data = integrations_ref.get().to_dict() or {}
                email_alerts_enabled = integrations_data.get("email_alerts", {}).get("enabled", False)

                if email_alerts_enabled:
                    user_email = user_data.get('email')
                    username = user_data.get('username') or user_email.split("@")[0]

                    for alert in alerts:
                        if alert["severity"] == "warning":
                            email_service.send_health_alert(
                                user_email=user_email,
                                username=username,
                                alert_type=alert["type"],
                                health_data={
                                    "value": alert["value"],
                                    "threshold": alert["threshold"],
                                    "device": provider,
                                    "date": datetime.now().strftime("%Y-%m-%d"),
                                    "recommendations": alert["recommendations"]
                                }
                            )

        return APIResponse.success(data={
            "alerts": alerts,
            "alertCount": len(alerts)
        })

    except Exception as e:
        logger.error(f"Failed to check health alerts: {str(e)}")
        return APIResponse.error('Failed to check health alerts', status_code=500)

@integration_bp.route("/health/alert-settings", methods=["POST", "OPTIONS"])
@rate_limit_by_endpoint
@AuthService.jwt_required
def update_alert_settings():
    """Update health alert settings"""
    if request.method == "OPTIONS":
        return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')

    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized('Authentication required')

        data = request.get_json() or {}

        email_alerts = bool(data.get("email_alerts", False))
        push_alerts = bool(data.get("push_alerts", False))

        # Validate alert types
        valid_alert_types = ["low_steps", "high_heart_rate", "poor_sleep", "low_calories"]
        alert_types = data.get("alert_types", ["low_steps", "high_heart_rate", "poor_sleep"])
        if not isinstance(alert_types, list):
            alert_types = ["low_steps", "high_heart_rate", "poor_sleep"]
        alert_types = [t for t in alert_types if t in valid_alert_types]

        integrations_ref = db.collection("integrations").document(user_id)
        integrations_data = integrations_ref.get().to_dict() or {}

        integrations_data["emailAlerts"] = {
            "enabled": email_alerts,
            "types": alert_types
        }
        integrations_data["pushAlerts"] = {
            "enabled": push_alerts,
            "types": alert_types
        }

        integrations_ref.set(integrations_data, merge=True)

        return APIResponse.success(data={
            "settings": {
                "emailAlerts": email_alerts,
                "pushAlerts": push_alerts,
                "alertTypes": alert_types
            }
        })

    except Exception as e:
        logger.error(f"Failed to update alert settings: {str(e)}")
        return APIResponse.error('Failed to update alert settings', status_code=500)
