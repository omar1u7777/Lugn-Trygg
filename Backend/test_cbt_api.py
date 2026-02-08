import os
os.environ['SKIP_BACKGROUND_SERVICES'] = '1'

from flask import Flask
from src.routes.cbt_routes import cbt_bp
from src.services.auth_service import AuthService

app = Flask(__name__)
app.config['SECRET_KEY'] = 'test-secret'
app.register_blueprint(cbt_bp, url_prefix='/api/cbt')

with app.test_client() as client:
    # Test without auth (should fail)
    response = client.get('/api/cbt/modules')
    print(f'Without auth: {response.status_code}')
    
    # Get a real token by simulating login
    token = AuthService.generate_access_token('test-user-123')
    
    # Test with auth
    headers = {'Authorization': f'Bearer {token}'}
    response = client.get('/api/cbt/modules', headers=headers)
    print(f'With auth: {response.status_code}')
    if response.status_code == 200:
        import json
        data = json.loads(response.data)
        print(f'Success: {data.get("success", False)}')
        modules = data.get('data', {}).get('modules', [])
        print(f'Modules count: {len(modules)}')
        for m in modules:
            print(f'  - {m.get("moduleId")}: {m.get("title")}')
    else:
        print(f'Error: {response.data}')
