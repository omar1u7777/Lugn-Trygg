"""
Test Consent API Integration
Verifies consent service endpoints work correctly
"""

import sys
import os

# Add Backend directory to sys.path (one level up from tests/)
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import Flask app directly
from main import app
from src.services.auth_service import AuthService

def test_consent_api():
    """Test consent API endpoints"""
    client = app.test_client()
    
    # Test without auth - should get 401
    print("Testing without auth...")
    response = client.get('/api/consent')
    print(f"Without auth: {response.status_code}")
    assert response.status_code == 401, "Should require authentication"
    
    # Generate test token
    test_user_id = "test-consent-user-123"
    token = AuthService.generate_access_token(test_user_id)
    headers = {'Authorization': f'Bearer {token}'}
    
    # Test GET consents (empty initially)
    print("\nTesting GET /api/consent...")
    response = client.get('/api/consent', headers=headers)
    print(f"GET consents: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"Consents data keys: {list(data.get('data', {}).keys())}")
    
    # Test POST bulk consents
    print("\nTesting POST /api/consent (bulk)...")
    consent_data = {
        'terms_of_service': True,
        'privacy_policy': True,
        'data_processing_consent': True,
        'ai_analysis_consent': True,
        'marketing_consent': False,
        'analytics_consent': True
    }
    response = client.post('/api/consent', json=consent_data, headers=headers)
    print(f"POST bulk consents: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"Granted: {data.get('data', {}).get('granted', [])}")
        print(f"Failed: {data.get('data', {}).get('failed', [])}")
    
    # Test POST single consent
    print("\nTesting POST /api/consent/analytics...")
    response = client.post(
        '/api/consent/analytics',
        json={'version': '1.0'},
        headers=headers
    )
    print(f"POST single consent: {response.status_code}")
    
    # Test GET check consent
    print("\nTesting GET /api/consent/check/analytics...")
    response = client.get('/api/consent/check/analytics', headers=headers)
    print(f"Check consent: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        print(f"Has consent: {data.get('data', {}).get('has_consent', False)}")
    
    # Test feature validation
    print("\nTesting GET /api/consent/validate/mood_logging...")
    response = client.get('/api/consent/validate/mood_logging', headers=headers)
    print(f"Validate feature: {response.status_code}")
    if response.status_code == 200:
        data = response.get_json()
        validation = data.get('data', {})
        print(f"Access granted: {validation.get('access_granted', False)}")
        print(f"Missing consents: {validation.get('missing_consents', [])}")
    
    # Test DELETE consent
    print("\nTesting DELETE /api/consent/marketing...")
    response = client.delete('/api/consent/marketing', headers=headers)
    print(f"DELETE consent: {response.status_code}")
    
    # Verify routes are registered
    print("\n\n=== Consent Routes Registered ===")
    with app.app_context():
        consent_routes = [r for r in app.url_map.iter_rules() if '/consent' in r.rule]
        for route in consent_routes:
            print(f"  {route.methods} {route.rule}")
        print(f"Total: {len(consent_routes)} consent endpoints")
    
    print("\n✅ All consent API tests completed!")

if __name__ == '__main__':
    test_consent_api()

