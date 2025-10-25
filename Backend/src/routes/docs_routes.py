"""
API Documentation Routes - OpenAPI/Swagger UI
Provides interactive API documentation and testing interface
"""

from flask import Blueprint, jsonify, render_template_string, request
from src.docs.swagger_config import get_openapi_spec, get_openapi_json, get_openapi_yaml
import os

docs_bp = Blueprint('docs', __name__)

# Swagger UI HTML template
SWAGGER_UI_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Lugn & Trygg API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
    <link rel="icon" type="image/png" href="https://lugntrygg.se/favicon.ico" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin: 0; background: #fafafa; }
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { color: #1abc9c; }
        .swagger-ui .scheme-container { background: #f8f9fa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/api/docs/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                validatorUrl: null,
                tryItOutEnabled: true,
                requestInterceptor: function(request) {
                    // Add authorization header if token exists
                    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                    if (token) {
                        request.headers.Authorization = 'Bearer ' + token;
                    }
                    return request;
                },
                responseInterceptor: function(response) {
                    // Store auth token from login responses
                    if (response.url.includes('/api/auth/') && response.status === 200) {
                        try {
                            const data = JSON.parse(response.data);
                            if (data.access_token) {
                                localStorage.setItem('token', data.access_token);
                            }
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                    return response;
                }
            });
        };
    </script>
</body>
</html>
"""

REDOC_UI_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Lugn & Trygg API Documentation - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <link rel="icon" type="image/png" href="https://lugntrygg.se/favicon.ico" />
    <style>
        body { margin: 0; padding: 0; }
    </style>
</head>
<body>
    <redoc spec-url='/api/docs/openapi.json'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
"""

@docs_bp.route('/')
def api_docs():
    """
    Main API documentation page with Swagger UI
    ---
    tags:
      - Documentation
    summary: API Documentation
    description: Interactive API documentation with Swagger UI
    responses:
      200:
        description: Swagger UI interface
        content:
          text/html:
            schema:
              type: string
    """
    return render_template_string(SWAGGER_UI_HTML)

@docs_bp.route('/redoc')
def api_docs_redoc():
    """
    Alternative API documentation with ReDoc
    ---
    tags:
      - Documentation
    summary: API Documentation (ReDoc)
    description: Clean, responsive API documentation with ReDoc
    responses:
      200:
        description: ReDoc interface
        content:
          text/html:
            schema:
              type: string
    """
    return render_template_string(REDOC_UI_HTML)

@docs_bp.route('/openapi.json')
def openapi_json():
    """
    OpenAPI specification in JSON format
    ---
    tags:
      - Documentation
    summary: OpenAPI JSON Specification
    description: Complete OpenAPI 3.0 specification for the Lugn & Trygg API
    responses:
      200:
        description: OpenAPI specification
        content:
          application/json:
            schema:
              type: object
    """
    return jsonify(get_openapi_spec())

@docs_bp.route('/openapi.yaml')
def openapi_yaml():
    """
    OpenAPI specification in YAML format
    ---
    tags:
      - Documentation
    summary: OpenAPI YAML Specification
    description: Complete OpenAPI 3.0 specification in YAML format
    responses:
      200:
        description: OpenAPI specification in YAML
        content:
          application/yaml:
            schema:
              type: string
    """
    response = get_openapi_yaml()
    return response, 200, {'Content-Type': 'application/yaml'}

@docs_bp.route('/health')
def docs_health():
    """
    Documentation service health check
    ---
    tags:
      - Documentation
    summary: Health Check
    description: Check if the documentation service is running
    responses:
      200:
        description: Service is healthy
        content:
          application/json:
            schema:
              type: object
              properties:
                status:
                  type: string
                  example: healthy
                service:
                  type: string
                  example: api-docs
                version:
                  type: string
                  example: "1.0.0"
    """
    return jsonify({
        'status': 'healthy',
        'service': 'api-docs',
        'version': '1.0.0',
        'endpoints': {
            'swagger_ui': '/api/docs/',
            'redoc_ui': '/api/docs/redoc',
            'openapi_json': '/api/docs/openapi.json',
            'openapi_yaml': '/api/docs/openapi.yaml'
        }
    })

@docs_bp.route('/test-auth')
def test_auth_page():
    """
    Test page for API authentication
    ---
    tags:
      - Documentation
    summary: Authentication Test Page
    description: Simple page to test API authentication and token storage
    responses:
      200:
        description: Authentication test interface
        content:
          text/html:
            schema:
              type: string
    """
    test_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>API Authentication Test</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .token-display { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; }
            button { background: #1abc9c; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
            button:hover { background: #16a085; }
        </style>
    </head>
    <body>
        <h1>Lugn & Trygg API Authentication Test</h1>
        <p>Use this page to test authentication and view stored tokens.</p>

        <h3>Stored Token:</h3>
        <div class="token-display" id="token-display">No token stored</div>

        <button onclick="clearToken()">Clear Token</button>
        <button onclick="refreshToken()">Refresh Token Display</button>

        <h3>Test API Call:</h3>
        <button onclick="testProtectedEndpoint()">Test Protected Endpoint</button>
        <div id="api-result"></div>

        <script>
            function refreshToken() {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token') || 'No token stored';
                document.getElementById('token-display').textContent = token;
            }

            function clearToken() {
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
                refreshToken();
                document.getElementById('api-result').textContent = '';
            }

            async function testProtectedEndpoint() {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                if (!token) {
                    document.getElementById('api-result').textContent = 'No token available. Please authenticate first.';
                    return;
                }

                try {
                    const response = await fetch('/api/mood/get', {
                        headers: {
                            'Authorization': 'Bearer ' + token
                        }
                    });

                    const result = await response.json();
                    document.getElementById('api-result').innerHTML =
                        '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
                } catch (error) {
                    document.getElementById('api-result').textContent = 'Error: ' + error.message;
                }
            }

            // Load token on page load
            refreshToken();
        </script>
    </body>
    </html>
    """
    return render_template_string(test_html)