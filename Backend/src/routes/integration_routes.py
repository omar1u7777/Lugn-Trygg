from flask import Blueprint, request, jsonify, session, redirect, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models.user import User
from ..services.audit_service import audit_log
from ..services.oauth_service import oauth_service
from ..services.health_data_service import health_data_service
from ..services.health_analytics_service import health_analytics_service
from ..firebase_config import db
import logging
import requests
from datetime import datetime, timedelta
import random

logger = logging.getLogger(__name__)

integration_bp = Blueprint('integration', __name__)

# In-memory storage for demo purposes (in production, use database)
connected_devices = {}

def get_user_devices(user_id):
    """Get devices for a specific user"""
    if user_id not in connected_devices:
        connected_devices[user_id] = []
    return connected_devices[user_id]

def add_user_device(user_id, device):
    """Add a device for a specific user"""
    if user_id not in connected_devices:
        connected_devices[user_id] = []
    connected_devices[user_id].append(device)

def remove_user_device(user_id, device_id):
    """Remove a device for a specific user"""
    if user_id in connected_devices:
        connected_devices[user_id] = [d for d in connected_devices[user_id] if d['id'] != device_id]

# ============================================================================
# OAUTH 2.0 ENDPOINTS
# ============================================================================

@integration_bp.route("/oauth/<provider>/authorize", methods=["GET"])
@jwt_required(optional=True)
def oauth_authorize(provider):
    """
    Initiate OAuth flow for a health provider
    Supported providers: google_fit, fitbit, samsung, withings
    
    Can be called with JWT token OR with user_id query parameter (for testing)
    """
    try:
        # Try to get user_id from JWT, g object, or query parameter
        user_id = get_jwt_identity() or g.get('user_id') or request.args.get('user_id')
        
        logger.info(f"🔵 OAUTH FLOW STARTED: User {user_id} authorizing {provider.upper()}")
        
        if not user_id:
            logger.error("❌ Missing user_id in OAuth authorize request")
            return jsonify({
                'error': 'Missing user_id',
                'message': 'Provide user_id as query parameter or use JWT authentication'
            }), 401
        
        # Validate provider
        supported_providers = ['google_fit', 'fitbit', 'samsung', 'withings']
        if provider not in supported_providers:
            return jsonify({
                'error': f'Unsupported provider. Must be one of: {", ".join(supported_providers)}'
            }), 400
        
        # Check if OAuth is configured
        if not oauth_service.validate_config(provider):
            return jsonify({
                'error': f'OAuth not configured for {provider}',
                'message': 'Please configure OAuth credentials in .env file'
            }), 503
        
        # Generate authorization URL
        auth_data = oauth_service.get_authorization_url(provider, user_id)
        
        audit_log('oauth_initiated', user_id, {
            'provider': provider,
            'state': auth_data['state']
        })
        
        return jsonify({
            'success': True,
            'authorization_url': auth_data['authorization_url'],
            'state': auth_data['state'],
            'provider': provider,
            'message': f'Redirect user to authorization_url to grant access'
        }), 200
        
    except Exception as e:
        logger.exception(f"Error initiating OAuth for {provider}: {e}")
        return jsonify({'error': str(e)}), 500

@integration_bp.route("/oauth/<provider>/callback", methods=["GET"])
def oauth_callback(provider):
    """
    OAuth callback endpoint - receives authorization code
    """
    try:
        code = request.args.get('code')
        state = request.args.get('state')
        error = request.args.get('error')
        
        logger.info(f"🔵 OAUTH CALLBACK: Received authorization code for {provider.upper()}")
        
        if error:
            logger.error(f"❌ OAuth error from {provider}: {error}")
            return jsonify({
                'error': 'Authorization denied',
                'provider': provider,
                'details': error
            }), 400
        
        if not code or not state:
            logger.error(f"❌ Missing code or state in OAuth callback for {provider}")
            return jsonify({'error': 'Missing code or state parameter'}), 400
        
        # Exchange code for token
        logger.info(f"🔵 Exchanging authorization code for access token ({provider})")
        token_data = oauth_service.exchange_code_for_token(provider, code, state)
        user_id = token_data['user_id']
        
        logger.info(f"✅ OAuth token exchange successful for user {user_id} ({provider})")
        
        # Store tokens in Firestore
        token_ref = db.collection('oauth_tokens').document(f"{user_id}_{provider}")
        token_ref.set({
            'user_id': user_id,
            'provider': provider,
            'access_token': token_data.get('access_token'),
            'refresh_token': token_data.get('refresh_token'),
            'expires_in': token_data.get('expires_in'),
            'token_type': token_data.get('token_type'),
            'scope': token_data.get('scope'),
            'obtained_at': datetime.utcnow().isoformat(),
            'expires_at': (datetime.utcnow() + timedelta(seconds=token_data.get('expires_in', 3600))).isoformat()
        })
        
        logger.info(f"✅ OAuth tokens stored in Firestore for user {user_id} ({provider})")
        
        audit_log('oauth_completed', user_id, {
            'provider': provider,
            'scope': token_data.get('scope')
        })
        
        # Redirect to frontend success page
        frontend_url = request.args.get('frontend_url', 'http://localhost:3000')
        logger.info(f"✅ OAuth flow COMPLETE: Redirecting to {frontend_url}/integrations?success=true&provider={provider}")
        return redirect(f"{frontend_url}/integrations?success=true&provider={provider}")
        
    except Exception as e:
        logger.exception(f"Error in OAuth callback for {provider}: {e}")
        frontend_url = request.args.get('frontend_url', 'http://localhost:3000')
        return redirect(f"{frontend_url}/integrations?error=oauth_failed&provider={provider}")

@integration_bp.route("/oauth/<provider>/disconnect", methods=["POST"])
@jwt_required()
def oauth_disconnect(provider):
    """
    Disconnect OAuth integration and revoke tokens
    """
    try:
        user_id = g.get('user_id') or get_jwt_identity()
        
        # Get stored tokens
        token_ref = db.collection('oauth_tokens').document(f"{user_id}_{provider}")
        token_doc = token_ref.get()
        
        if token_doc.exists:
            token_data = token_doc.to_dict()
            access_token = token_data.get('access_token')
            
            # Revoke token with provider
            oauth_service.revoke_token(provider, access_token)
            
            # Delete from database
            token_ref.delete()
            
            audit_log('oauth_disconnected', user_id, {'provider': provider})
            
            return jsonify({
                'success': True,
                'message': f'{provider} disconnected successfully'
            }), 200
        else:
            return jsonify({
                'error': f'No OAuth connection found for {provider}'
            }), 404
            
    except Exception as e:
        logger.exception(f"Error disconnecting OAuth for {provider}: {e}")
        return jsonify({'error': str(e)}), 500

@integration_bp.route("/oauth/<provider>/status", methods=["GET"])
@jwt_required()
def oauth_status(provider):
    """
    Check OAuth connection status for a provider
    """
    try:
        user_id = g.get('user_id') or get_jwt_identity()
        
        logger.info(f"🔵 Checking OAuth status for {provider.upper()} (user: {user_id})")
        
        token_ref = db.collection('oauth_tokens').document(f"{user_id}_{provider}")
        token_doc = token_ref.get()
        
        if token_doc.exists:
            token_data = token_doc.to_dict()
            expires_at = datetime.fromisoformat(token_data.get('expires_at'))
            is_expired = datetime.utcnow() > expires_at
            
            logger.info(f"✅ OAuth token FOUND for {provider.upper()}: expires_at={token_data.get('expires_at')}, is_expired={is_expired}")
            
            return jsonify({
                'connected': True,
                'provider': provider,
                'scope': token_data.get('scope'),
                'obtained_at': token_data.get('obtained_at'),
                'expires_at': token_data.get('expires_at'),
                'is_expired': is_expired
            }), 200
        else:
            logger.info(f"❌ OAuth token NOT FOUND for {provider.upper()} (user: {user_id})")
            return jsonify({
                'connected': False,
                'provider': provider
            }), 200
            
    except Exception as e:
        logger.exception(f"Error checking OAuth status for {provider}: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# HEALTH DATA ENDPOINTS (WITH OAUTH)
# ============================================================================

@integration_bp.route("/health/sync/<provider>", methods=["POST"])
@jwt_required()
def sync_health_data_oauth(provider):
    """
    Sync real health data using OAuth tokens
    Supported providers: google_fit, fitbit, samsung
    """
    try:
        user_id = g.get('user_id') or get_jwt_identity()
        
        logger.info(f"🔵 HEALTH DATA SYNC STARTED for {provider.upper()} (user: {user_id})")
        
        # Get OAuth token
        token_ref = db.collection('oauth_tokens').document(f"{user_id}_{provider}")
        token_doc = token_ref.get()
        
        if not token_doc.exists:
            logger.error(f"❌ No OAuth token found for {provider.upper()} (user: {user_id})")
            return jsonify({
                'error': f'Not connected to {provider}',
                'message': 'Please authorize access first'
            }), 401
        
        token_data = token_doc.to_dict()
        access_token = token_data.get('access_token')
        refresh_token = token_data.get('refresh_token')
        
        logger.info(f"✅ OAuth token found for {provider.upper()}")
        
        if not access_token:
            logger.error(f"❌ Invalid access token for {provider.upper()}")
            return jsonify({
                'error': f'Invalid token for {provider}',
                'message': 'Please reconnect to continue'
            }), 401
        
        expires_at = datetime.fromisoformat(token_data.get('expires_at', datetime.utcnow().isoformat()))
        
        # Refresh token if expired
        if datetime.utcnow() > expires_at and refresh_token:
            logger.info(f"🔄 Token expired for {provider.upper()}, refreshing...")
            new_token_data = oauth_service.refresh_access_token(provider, refresh_token)
            
            # Update stored token
            token_ref.update({
                'access_token': new_token_data.get('access_token'),
                'expires_in': new_token_data.get('expires_in'),
                'refreshed_at': datetime.utcnow().isoformat(),
                'expires_at': (datetime.utcnow() + timedelta(seconds=new_token_data.get('expires_in', 3600))).isoformat()
            })
            
            logger.info(f"✅ Token refreshed for {provider.upper()}")
            access_token = new_token_data.get('access_token') or access_token
        
        # Get date range from request
        data = request.get_json() or {}
        days_back = data.get('days', 7)
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days_back)
        
        # Fetch health data based on provider
        logger.info(f"🔵 Fetching real health data from {provider.upper()} API (days_back={days_back})")
        
        if provider == 'google_fit':
            health_data = health_data_service.fetch_google_fit_data(
                access_token, start_date, end_date
            )
        elif provider == 'fitbit':
            health_data = health_data_service.fetch_fitbit_data(
                access_token, start_date, end_date
            )
        elif provider == 'samsung':
            health_data = health_data_service.fetch_samsung_health_data(
                access_token, start_date, end_date
            )
        else:
            return jsonify({'error': f'Unsupported provider: {provider}'}), 400
        
        logger.info(f"✅ Real health data FETCHED from {provider.upper()}: {list(health_data.keys()) if health_data else 'no data'}")
        
        # Store health data in Firestore
        health_ref = db.collection('health_data').document(user_id).collection(provider).document()
        health_ref.set({
            'user_id': user_id,
            'provider': provider,
            'data': health_data,
            'synced_at': datetime.utcnow().isoformat(),
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            }
        })
        
        logger.info(f"✅ Real health data STORED in Firestore for user {user_id} ({provider.upper()})")
        
        audit_log('health_data_synced', user_id, {
            'provider': provider,
            'metrics': list(health_data.keys()),
            'days': days_back
        })
        
        return jsonify({
            'success': True,
            'provider': provider,
            'data': health_data,
            'synced_at': datetime.utcnow().isoformat(),
            'message': f'Successfully synced data from {provider}'
        }), 200
        
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error syncing {provider} data: {str(e)}")
        return jsonify({
            'error': 'Failed to fetch data from provider',
            'details': str(e)
        }), 502
    except Exception as e:
        logger.exception(f"Error syncing health data from {provider}: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# HEALTH ANALYTICS ENDPOINTS - AI ANALYSIS
# ============================================================================

@integration_bp.route("/health/analyze", methods=["POST"])
@jwt_required()
def analyze_health_mood_patterns():
    """
    Analyze patterns between health data and mood tracking
    Provides AI-powered recommendations for stress reduction and better sleep
    """
    try:
        user_id = g.get('user_id') or get_jwt_identity()
        
        logger.info(f"🧠 HEALTH ANALYSIS STARTED for user {user_id}")
        
        # Get health data from Firestore
        health_docs = db.collection('health_data').document(user_id).collections()
        health_data_list = []
        
        for provider_collection in health_docs:
            docs = provider_collection.stream()
            for doc in docs:
                data = doc.to_dict()
                if data:
                    health_data_list.append({
                        'date': data.get('synced_at', datetime.utcnow().isoformat()),
                        'steps': data.get('data', {}).get('steps', 0),
                        'sleep_hours': data.get('data', {}).get('sleep_hours', 0),
                        'heart_rate': data.get('data', {}).get('heart_rate', 0),
                        'calories': data.get('data', {}).get('calories', 0),
                        'provider': data.get('provider')
                    })
        
        # Get mood data from Firestore
        mood_docs = db.collection('mood_entries').document(user_id).collection('entries').stream()
        mood_data_list = []
        
        for doc in mood_docs:
            data = doc.to_dict()
            if data:
                # Extract mood score (could be 0-10 or specific mood label)
                mood_score = data.get('mood_score')
                if mood_score is None:
                    # Try alternative field names
                    mood_value = data.get('mood_value', data.get('mood', 5))
                    # If it's a string like "happy", convert to score
                    if isinstance(mood_value, str):
                        mood_map = {
                            'terrible': 1, 'bad': 2, 'poor': 2,
                            'okay': 5, 'alright': 5, 'neutral': 5,
                            'good': 7, 'great': 8, 'excellent': 9, 'amazing': 10
                        }
                        mood_score = mood_map.get(mood_value.lower(), 5)
                    else:
                        mood_score = mood_value
                
                mood_data_list.append({
                    'date': data.get('date', data.get('created_at', datetime.utcnow().isoformat())),
                    'mood_score': mood_score
                })
        
        logger.info(f"📊 Collected {len(health_data_list)} health data points and {len(mood_data_list)} mood entries")
        
        if not health_data_list and not mood_data_list:
            return jsonify({
                'status': 'insufficient_data',
                'message': 'No health or mood data available for analysis',
                'recommendations': health_analytics_service._get_generic_recommendations()
            }), 200
        
        # Run analysis
        analysis_result = health_analytics_service.analyze_health_mood_correlation(
            health_data_list,
            mood_data_list
        )
        
        logger.info(f"✅ Analysis complete: {len(analysis_result.get('patterns', []))} patterns found")
        
        # Store analysis result in Firestore for future reference
        analysis_ref = db.collection('health_analysis').document(user_id).collection('results').document()
        analysis_ref.set({
            'user_id': user_id,
            'analysis_result': analysis_result,
            'analyzed_at': datetime.utcnow().isoformat(),
            'health_data_points': len(health_data_list),
            'mood_data_points': len(mood_data_list)
        })
        
        audit_log('health_analysis_performed', user_id, {
            'patterns_found': len(analysis_result.get('patterns', [])),
            'recommendations_generated': len(analysis_result.get('recommendations', []))
        })
        
        return jsonify({
            'success': True,
            'analysis': analysis_result,
            'generated_at': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.exception(f"Error analyzing health-mood correlation: {e}")
        return jsonify({
            'error': 'Analysis failed',
            'details': str(e)
        }), 500

# ============================================================================
# LEGACY ENDPOINTS - DEPRECATED! USE OAUTH ENDPOINTS INSTEAD
# ============================================================================
# ⚠️ These endpoints return MOCK DATA ONLY
# ⚠️ Use /api/integration/oauth/<provider>/* endpoints for REAL data
# ============================================================================

# Google Fit API Integration Stub
@integration_bp.route("/wearable/status", methods=["GET"])
@jwt_required()
def get_wearable_status():
    """Get wearable integration status - DEPRECATED: Returns MOCK DATA"""
    try:
        user_id = g.get('user_id') or get_jwt_identity()
        
        logger.warning(f"⚠️ DEPRECATED ENDPOINT CALLED: /wearable/status returns MOCK DATA!")
        logger.warning(f"⚠️ USE INSTEAD: GET /api/integration/oauth/*/status for real OAuth data")

        devices = get_user_devices(user_id)

        return jsonify({
            "success": True,
            "devices": devices
        }), 200

    except Exception as e:
        logger.exception(f"Error getting wearable status: {e}")
        return jsonify({"error": str(e)}), 500

@integration_bp.route("/wearable/connect", methods=["POST"])
@jwt_required()
def connect_wearable():
    """Connect a new wearable device - DEPRECATED: Creates MOCK connection"""
    try:
        user_id = g.get('user_id') or get_jwt_identity()
        
        logger.warning(f"⚠️ DEPRECATED ENDPOINT CALLED: /wearable/connect creates MOCK device!")
        logger.warning(f"⚠️ USE INSTEAD: GET /api/integration/oauth/*/authorize for real OAuth")
        
        data = request.get_json()
        device_type = data.get('device_type', 'fitbit')

        # Device name mapping
        device_names = {
            'fitbit': 'Fitbit Charge 5',
            'apple_health': 'Apple Health',
            'google_fit': 'Google Fit',
            'samsung_health': 'Samsung Health'
        }

        # Create new device
        new_device = {
            "id": f"{device_type}-{int(datetime.utcnow().timestamp())}",
            "name": device_names.get(device_type, f"{device_type.title()} Device"),
            "type": device_type,
            "connected": True,
            "lastSync": datetime.utcnow().isoformat()
        }

        # Add to user's devices
        add_user_device(user_id, new_device)

        audit_log('wearable_connected', user_id, {'device_type': device_type})

        return jsonify({
            "success": True,
            "message": f"{device_names.get(device_type, device_type)} connected successfully",
            "device": new_device
        }), 200

    except Exception as e:
        logger.exception(f"Error connecting wearable: {e}")
        return jsonify({"error": str(e)}), 500

@integration_bp.route("/wearable/disconnect", methods=["POST"])
@jwt_required()
def disconnect_wearable():
    """Disconnect a wearable device"""
    try:
        user_id = g.get('user_id') or get_jwt_identity()
        data = request.get_json()
        device_id = data.get('device_id')

        # Remove from user's devices
        remove_user_device(user_id, device_id)

        audit_log('wearable_disconnected', user_id, {'device_id': device_id})

        return jsonify({
            "success": True,
            "message": "Device disconnected successfully"
        }), 200

    except Exception as e:
        logger.exception(f"Error disconnecting wearable: {e}")
        return jsonify({"error": str(e)}), 500

@integration_bp.route("/wearable/sync", methods=["POST"])
@jwt_required()
def sync_wearable():
    """Sync wearable device data"""
    try:
        user_id = g.get('user_id') or get_jwt_identity()
        data = request.get_json()
        device_id = data.get('device_id')

        # Update device's last sync time
        devices = get_user_devices(user_id)
        for device in devices:
            if device['id'] == device_id:
                device['lastSync'] = datetime.utcnow().isoformat()
                break

        # Generate realistic mock data with some variation
        synced_data = {
            "steps": random.randint(5000, 15000),
            "heartRate": random.randint(60, 85),
            "sleep": round(random.uniform(5.5, 9.0), 1),
            "calories": random.randint(1800, 2800),
            "timestamp": datetime.utcnow().isoformat()
        }

        audit_log('wearable_synced', user_id, {'device_id': device_id})

        return jsonify({
            "success": True,
            "message": "Sync completed successfully",
            "data": synced_data
        }), 200

    except Exception as e:
        logger.exception(f"Error syncing wearable: {e}")
        return jsonify({"error": str(e)}), 500

@integration_bp.route("/wearable/google-fit/sync", methods=["POST"])
@jwt_required()
def sync_google_fit():
    """Sync data from Google Fit API"""
    try:
        user_id = g.get('user_id') or get_jwt_identity()

        data = request.get_json()
        access_token = data.get('access_token')
        date_from = data.get('date_from', (datetime.utcnow() - timedelta(days=7)).isoformat())
        date_to = data.get('date_to', datetime.utcnow().isoformat())

        if not access_token:
            return jsonify({'error': 'Access token required'}), 400

        # Google Fit API endpoints
        base_url = "https://www.googleapis.com/fitness/v1/users/me"

        # Mock data for demonstration (in real implementation, make actual API calls)
        mock_heart_rate_data = {
            "dataSourceId": "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm",
            "point": [
                {
                    "startTimeNanos": str(int(datetime.fromisoformat(date_from).timestamp() * 1e9)),
                    "endTimeNanos": str(int(datetime.fromisoformat(date_to).timestamp() * 1e9)),
                    "value": [{"fpVal": 72.5}]
                }
            ]
        }

        mock_steps_data = {
            "dataSourceId": "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
            "point": [
                {
                    "startTimeNanos": str(int(datetime.fromisoformat(date_from).timestamp() * 1e9)),
                    "endTimeNanos": str(int(datetime.fromisoformat(date_to).timestamp() * 1e9)),
                    "value": [{"intVal": 8500}]
                }
            ]
        }

        mock_sleep_data = {
            "dataSourceId": "derived:com.google.sleep.segment:com.google.android.gms:merged",
            "point": [
                {
                    "startTimeNanos": str(int((datetime.fromisoformat(date_from) + timedelta(hours=23)).timestamp() * 1e9)),
                    "endTimeNanos": str(int(datetime.fromisoformat(date_to).timestamp() * 1e9)),
                    "value": [{"intVal": 7}]  # Sleep duration in hours
                }
            ]
        }

        # In real implementation, make actual API calls:
        # headers = {"Authorization": f"Bearer {access_token}"}
        # heart_rate_response = requests.post(f"{base_url}/dataSources/{mock_heart_rate_data['dataSourceId']}/datasets/{start_time}:{end_time}", headers=headers)

        synced_data = {
            "heart_rate": mock_heart_rate_data,
            "steps": mock_steps_data,
            "sleep": mock_sleep_data,
            "sync_timestamp": datetime.utcnow().isoformat(),
            "data_points": 3
        }

        audit_log('google_fit_sync', user_id, {
            'date_from': date_from,
            'date_to': date_to,
            'data_types': ['heart_rate', 'steps', 'sleep']
        })

        return jsonify({
            'success': True,
            'message': 'Google Fit data synced successfully',
            'data': synced_data
        }), 200

    except Exception as e:
        logger.error(f"Failed to sync Google Fit data: {str(e)}")
        return jsonify({'error': 'Failed to sync wearable data'}), 500

@integration_bp.route('/wearable/apple-health/sync', methods=['POST'])
@jwt_required()
def sync_apple_health():
    """Sync data from Apple Health (stub implementation)"""
    try:
        user_id = g.get('user_id') or get_jwt_identity()

        # Apple Health integration would require HealthKit on iOS
        # This is a stub that would need native iOS implementation
        return jsonify({
            'success': False,
            'message': 'Apple Health integration requires native iOS implementation',
            'note': 'Use React Native or native iOS app for Apple Health integration'
        }), 501

    except Exception as e:
        logger.error(f"Apple Health sync failed: {str(e)}")
        return jsonify({'error': 'Failed to sync Apple Health data'}), 500

@integration_bp.route('/wearable/details', methods=['GET'])
@jwt_required()
def get_wearable_details():
    """Get detailed wearable data with insights"""
    try:
        user_id = g.get('user_id') or get_jwt_identity()

        # Get user's connected devices
        devices = get_user_devices(user_id)

        # Generate realistic health data
        steps_today = random.randint(5000, 15000)
        hr_current = random.randint(65, 85)
        sleep_last_night = round(random.uniform(5.5, 9.0), 1)
        
        # Mock wearable data with enhanced details
        wearable_data = {
            "data": {
                "steps": steps_today,
                "heartRate": hr_current,
                "sleep": sleep_last_night,
                "calories": random.randint(1800, 2800)
            },
            "last_sync": datetime.utcnow().isoformat(),
            "devices": [
                {
                    "type": d.get('type', 'smartwatch'),
                    "brand": d.get('name', 'Unknown').split()[0],
                    "model": d.get('name', 'Unknown Device'),
                    "connected": d.get('connected', True),
                    "last_sync": d.get('lastSync', datetime.utcnow().isoformat())
                }
                for d in devices
            ] if devices else [],
            "metrics": {
                "heart_rate": {
                    "current": hr_current,
                    "average_today": hr_current + random.randint(-5, 5),
                    "resting_hr": hr_current - random.randint(5, 15),
                    "unit": "bpm"
                },
                "steps": {
                    "today": steps_today,
                    "goal": 10000,
                    "average_weekly": steps_today - random.randint(500, 2000),
                    "unit": "steps"
                },
                "sleep": {
                    "last_night": sleep_last_night,
                    "average_weekly": round(sleep_last_night + random.uniform(-0.5, 0.5), 1),
                    "deep_sleep_percentage": random.randint(20, 30),
                    "unit": "hours"
                },
                "active_minutes": {
                    "today": random.randint(20, 60),
                    "goal": 30,
                    "average_weekly": random.randint(25, 50),
                    "unit": "minutes"
                }
            },
            "insights": []
        }

        # Generate dynamic insights based on data
        if hr_current < 80:
            wearable_data['insights'].append("Din vilopuls är inom normalt område")
        if steps_today >= 8000:
            wearable_data['insights'].append("Bra jobbat med stegen idag!")
        elif steps_today >= 10000:
            wearable_data['insights'].append("Fantastiskt! Du nådde ditt stegmål!")
        if sleep_last_night >= 7:
            wearable_data['insights'].append("Du får tillräckligt med sömn - bra för din mentala hälsa")
        else:
            wearable_data['insights'].append("Försök få 7-9 timmar sömn per natt")

        audit_log('wearable_data_accessed', user_id, {'data_types': list(wearable_data['metrics'].keys())})
        return jsonify(wearable_data), 200

    except Exception as e:
        logger.error(f"Failed to get wearable data: {str(e)}")
        return jsonify({'error': 'Failed to retrieve wearable data'}), 500

# FHIR Healthcare Integration Stubs
@integration_bp.route('/fhir/patient', methods=['GET'])
@jwt_required()
def get_fhir_patient():
    """Get patient data from FHIR server (stub)"""
    try:
        from flask import g
        user_id = g.get('user_id') or get_jwt_identity()

        # Mock FHIR Patient resource
        patient_data = {
            "resourceType": "Patient",
            "id": f"patient-{user_id}",
            "identifier": [
                {
                    "system": "http://example.org/patient-id",
                    "value": user_id
                }
            ],
            "name": [
                {
                    "family": "Testsson",
                    "given": ["Anna"]
                }
            ],
            "gender": "female",
            "birthDate": "1990-01-01",
            "address": [
                {
                    "country": "SE"
                }
            ],
            "telecom": [
                {
                    "system": "email",
                    "value": "user@example.com"
                }
            ]
        }

        audit_log('fhir_patient_accessed', user_id, {'resource_type': 'Patient'})
        return jsonify(patient_data), 200

    except Exception as e:
        logger.error(f"Failed to get FHIR patient data: {str(e)}")
        return jsonify({'error': 'Failed to retrieve patient data'}), 500

@integration_bp.route('/fhir/observation', methods=['GET'])
@jwt_required()
def get_fhir_observations():
    """Get observation data from FHIR server (stub)"""
    try:
        from flask import g
        user_id = g.get('user_id') or get_jwt_identity()

        # Mock FHIR Observation resources
        observations = [
            {
                "resourceType": "Observation",
                "id": f"obs-hr-{user_id}",
                "status": "final",
                "code": {
                    "coding": [
                        {
                            "system": "http://loinc.org",
                            "code": "8867-4",
                            "display": "Heart rate"
                        }
                    ]
                },
                "subject": {
                    "reference": f"Patient/patient-{user_id}"
                },
                "effectiveDateTime": datetime.utcnow().isoformat(),
                "valueQuantity": {
                    "value": 72,
                    "unit": "beats/minute",
                    "system": "http://unitsofmeasure.org",
                    "code": "/min"
                }
            },
            {
                "resourceType": "Observation",
                "id": f"obs-weight-{user_id}",
                "status": "final",
                "code": {
                    "coding": [
                        {
                            "system": "http://loinc.org",
                            "code": "29463-7",
                            "display": "Body weight"
                        }
                    ]
                },
                "subject": {
                    "reference": f"Patient/patient-{user_id}"
                },
                "effectiveDateTime": (datetime.utcnow() - timedelta(days=1)).isoformat(),
                "valueQuantity": {
                    "value": 65.5,
                    "unit": "kg",
                    "system": "http://unitsofmeasure.org",
                    "code": "kg"
                }
            }
        ]

        audit_log('fhir_observations_accessed', user_id, {'count': len(observations)})
        return jsonify({"resourceType": "Bundle", "type": "searchset", "entry": observations}), 200

    except Exception as e:
        logger.error(f"Failed to get FHIR observations: {str(e)}")
        return jsonify({'error': 'Failed to retrieve observations'}), 500

@integration_bp.route('/crisis/referral', methods=['POST'])
@jwt_required()
def create_crisis_referral():
    """Create a crisis referral to healthcare services"""
    try:
        from flask import g
        user_id = g.get('user_id') or get_jwt_identity()

        data = request.get_json()
        crisis_type = data.get('crisis_type', 'general')
        urgency_level = data.get('urgency_level', 'medium')
        notes = data.get('notes', '')

        # In a real implementation, this would:
        # 1. Create a referral in the healthcare system
        # 2. Notify appropriate healthcare providers
        # 3. Schedule follow-up care

        referral_data = {
            "referral_id": f"REF-{user_id}-{int(datetime.utcnow().timestamp())}",
            "user_id": user_id,
            "crisis_type": crisis_type,
            "urgency_level": urgency_level,
            "notes": notes,
            "created_at": datetime.utcnow().isoformat(),
            "status": "pending",
            "assigned_provider": "Crisis Intervention Team",
            "follow_up_required": True,
            "estimated_response_time": "2 hours" if urgency_level == "high" else "24 hours"
        }

        audit_log('crisis_referral_created', user_id, {
            'crisis_type': crisis_type,
            'urgency_level': urgency_level,
            'referral_id': referral_data['referral_id']
        })

        return jsonify({
            'success': True,
            'message': 'Crisis referral created successfully',
            'referral': referral_data,
            'next_steps': [
                "A healthcare provider will contact you within the estimated response time",
                "Keep emergency contact information handy",
                "Consider reaching out to trusted friends or family"
            ]
        }), 201

    except Exception as e:
        logger.error(f"Failed to create crisis referral: {str(e)}")
        return jsonify({'error': 'Failed to create referral'}), 500

@integration_bp.route('/health/sync', methods=['POST'])
@jwt_required()
def sync_health_data():
    """Sync comprehensive health data from multiple sources"""
    try:
        from flask import g
        user_id = g.get('user_id') or get_jwt_identity()

        data = request.get_json()
        sources = data.get('sources', ['google_fit'])  # Default to Google Fit

        synced_data = {}

        # Sync from each requested source
        for source in sources:
            if source == 'google_fit':
                # Mock Google Fit sync
                synced_data['google_fit'] = {
                    'heart_rate': 72,
                    'steps': 8500,
                    'sleep_hours': 7.5,
                    'synced_at': datetime.utcnow().isoformat()
                }
            elif source == 'apple_health':
                synced_data['apple_health'] = {
                    'status': 'not_available',
                    'message': 'Apple Health requires native iOS integration'
                }
            elif source == 'fhir':
                synced_data['fhir'] = {
                    'patient_data': True,
                    'observations_count': 5,
                    'last_updated': datetime.utcnow().isoformat()
                }

        # Combine data for mood correlation analysis
        health_insights = generate_health_insights(synced_data)

        audit_log('health_data_synced', user_id, {
            'sources': sources,
            'data_points': sum(len(data) for data in synced_data.values() if isinstance(data, dict))
        })

        return jsonify({
            'success': True,
            'synced_data': synced_data,
            'insights': health_insights,
            'correlation_with_mood': analyze_health_mood_correlation(user_id, synced_data)
        }), 200

    except Exception as e:
        logger.error(f"Failed to sync health data: {str(e)}")
        return jsonify({'error': 'Failed to sync health data'}), 500

def generate_health_insights(health_data):
    """Generate insights from synced health data"""
    insights = []

    if 'google_fit' in health_data:
        fit_data = health_data['google_fit']
        if fit_data.get('steps', 0) >= 8000:
            insights.append("Great job meeting your step goal today!")
        if fit_data.get('sleep_hours', 0) >= 7:
            insights.append("You're getting adequate sleep - this supports good mental health")
        if fit_data.get('heart_rate', 0) < 80:
            insights.append("Your resting heart rate indicates good cardiovascular health")

    return insights

def analyze_health_mood_correlation(user_id, health_data):
    """Analyze correlation between health metrics and mood (stub)"""
    # In a real implementation, this would analyze historical data
    return {
        "sleep_mood_correlation": 0.75,
        "activity_mood_correlation": 0.65,
        "heart_rate_mood_correlation": 0.55,
        "insights": [
            "Better sleep quality correlates with improved mood",
            "Physical activity shows positive relationship with mood stability",
            "Monitoring these metrics can help predict mood changes"
        ]
    }