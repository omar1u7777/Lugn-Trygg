"""
OpenAPI/Swagger Documentation Configuration for Lugn & Trygg API
Generates comprehensive API documentation with examples and validation
"""

from importlib import metadata as importlib_metadata

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
import marshmallow
from flask_apispec import FlaskApiSpec
from marshmallow import Schema, fields, validate

# ---------------------------------------------------------------------------
# Compatibility helpers
# ---------------------------------------------------------------------------

# Flask-apispec relies on the deprecated ``marshmallow.__version__`` attribute.
# Marshmallow 4 removed this attribute, which causes Render deployments to fail
# when the platform installs the newest major release.  We restore the value by
# querying the installed package metadata before Flask-apispec is imported.
if not getattr(marshmallow, "__version__", None):
    marshmallow.__version__ = importlib_metadata.version("marshmallow")
import os

# Create APISpec instance
spec = APISpec(
    title='Lugn & Trygg API',
    version='1.0.0',
    openapi_version='3.0.3',
    info=dict(
        description='Mental Health & Wellness Platform API - Comprehensive API for mood tracking, AI therapy, and health monitoring',
        termsOfService='https://lugntrygg.se/terms',
        contact=dict(
            name='Lugn & Trygg Support',
            email='support@lugntrygg.se',
            url='https://lugntrygg.se/support'
        ),
        license=dict(
            name='Proprietary',
            url='https://lugntrygg.se/license'
        )
    ),
    servers=[
        dict(
            url='https://api.lugntrygg.se',
            description='Production server'
        ),
        dict(
            url='http://localhost:5001',
            description='Development server'
        )
    ],
    security=[{'BearerAuth': []}],
    tags=[
        dict(name='Authentication', description='User authentication and authorization'),
        dict(name='Mood Tracking', description='Mood logging and analysis'),
        dict(name='AI Services', description='AI-powered therapy and insights'),
        dict(name='Memory Management', description='User memory and media management'),
        dict(name='Integrations', description='Third-party service integrations'),
        dict(name='Subscriptions', description='Subscription and billing management'),
        dict(name='Admin', description='Administrative functions'),
    ]
)

# Add Marshmallow plugin
spec.plugins(MarshmallowPlugin())

# Security schemes
spec.components.security_scheme(
    'BearerAuth',
    {
        'type': 'http',
        'scheme': 'bearer',
        'bearerFormat': 'JWT',
        'description': 'JWT Authorization header using the Bearer scheme. Example: "Authorization: Bearer {token}"'
    }
)

# Common response schemas
class ErrorResponse(Schema):
    error = fields.Str(description='Error message')
    status_code = fields.Int(description='HTTP status code')
    timestamp = fields.DateTime(description='Error timestamp')

class SuccessResponse(Schema):
    message = fields.Str(description='Success message')
    status = fields.Str(description='Status indicator')
    timestamp = fields.DateTime(description='Response timestamp')

# Authentication schemas
class LoginRequest(Schema):
    email = fields.Email(required=True, description='User email address')
    password = fields.Str(required=True, description='User password', validate=validate.Length(min=8))

class RegisterRequest(Schema):
    email = fields.Email(required=True, description='User email address')
    password = fields.Str(required=True, description='User password', validate=validate.Length(min=8))
    language = fields.Str(missing='sv', description='User preferred language')

class AuthResponse(Schema):
    access_token = fields.Str(description='JWT access token')
    refresh_token = fields.Str(description='JWT refresh token')
    user = fields.Dict(description='User information')
    expires_in = fields.Int(description='Token expiration time in seconds')

# Mood schemas
class MoodLogRequest(Schema):
    mood_value = fields.Int(required=True, validate=validate.Range(min=1, max=10), description='Mood value (1-10)')
    note = fields.Str(description='Optional mood note')
    voice_data = fields.Str(description='Base64 encoded voice data')
    timestamp = fields.DateTime(description='Mood timestamp')

class MoodEntry(Schema):
    id = fields.Str(description='Mood entry ID')
    user_id = fields.Str(description='User ID')
    mood_value = fields.Int(description='Mood value (1-10)')
    note = fields.Str(description='Mood note')
    timestamp = fields.DateTime(description='Entry timestamp')
    ai_insights = fields.Dict(description='AI-generated insights')

class MoodAnalysis(Schema):
    period = fields.Str(description='Analysis period')
    average_mood = fields.Float(description='Average mood value')
    trend = fields.Str(description='Mood trend (improving/declining/stable)')
    insights = fields.List(fields.Str(), description='AI-generated insights')
    recommendations = fields.List(fields.Str(), description='Personalized recommendations')

# AI schemas
class AIStoryRequest(Schema):
    mood_context = fields.Str(description='Current mood context')
    preferences = fields.Dict(description='User preferences for story generation')

class AIStory(Schema):
    id = fields.Str(description='Story ID')
    title = fields.Str(description='Story title')
    content = fields.Str(description='Story content')
    mood_themes = fields.List(fields.Str(), description='Mood themes addressed')
    created_at = fields.DateTime(description='Creation timestamp')

class PredictiveForecast(Schema):
    forecast_date = fields.Date(description='Forecast date')
    predicted_mood = fields.Float(description='Predicted mood value')
    confidence = fields.Float(description='Prediction confidence (0-1)')
    factors = fields.List(fields.Str(), description='Contributing factors')

# Memory schemas
class MemoryUploadRequest(Schema):
    file = fields.Raw(description='File to upload')
    description = fields.Str(description='Memory description')
    tags = fields.List(fields.Str(), description='Memory tags')

class MemoryEntry(Schema):
    id = fields.Str(description='Memory ID')
    filename = fields.Str(description='Original filename')
    url = fields.Str(description='Access URL')
    description = fields.Str(description='Memory description')
    tags = fields.List(fields.Str(), description='Memory tags')
    uploaded_at = fields.DateTime(description='Upload timestamp')

# Subscription schemas
class SubscriptionStatus(Schema):
    active = fields.Bool(description='Subscription active status')
    plan = fields.Str(description='Subscription plan')
    current_period_end = fields.DateTime(description='Current billing period end')
    cancel_at_period_end = fields.Bool(description='Will cancel at period end')

# Integration schemas
class HealthData(Schema):
    date = fields.Date(description='Data date')
    steps = fields.Int(description='Step count')
    heart_rate = fields.Float(description='Average heart rate')
    sleep_hours = fields.Float(description='Sleep hours')
    mood_correlation = fields.Float(description='Mood correlation coefficient')

# Register schemas with APISpec
def register_schemas():
    """Register all schemas with the APISpec instance"""
    schemas = [
        ('ErrorResponse', ErrorResponse),
        ('SuccessResponse', SuccessResponse),
        ('LoginRequest', LoginRequest),
        ('RegisterRequest', RegisterRequest),
        ('AuthResponse', AuthResponse),
        ('MoodLogRequest', MoodLogRequest),
        ('MoodEntry', MoodEntry),
        ('MoodAnalysis', MoodAnalysis),
        ('AIStoryRequest', AIStoryRequest),
        ('AIStory', AIStory),
        ('PredictiveForecast', PredictiveForecast),
        ('MemoryUploadRequest', MemoryUploadRequest),
        ('MemoryEntry', MemoryEntry),
        ('SubscriptionStatus', SubscriptionStatus),
        ('HealthData', HealthData),
    ]

    for name, schema_class in schemas:
        spec.components.schema(name, schema=schema_class)

# Initialize Flask-apispec
def init_swagger(app):
    """Initialize Swagger documentation for Flask app"""
    docs = FlaskApiSpec(app, spec)

    # Register schemas
    register_schemas()

    # Add common responses
    spec.components.response(
        'ErrorResponse',
        {
            'description': 'Error response',
            'content': {
                'application/json': {
                    'schema': {'$ref': '#/components/schemas/ErrorResponse'}
                }
            }
        }
    )

    spec.components.response(
        'Unauthorized',
        {
            'description': 'Authentication required',
            'content': {
                'application/json': {
                    'example': {'error': 'Authentication required', 'status_code': 401}
                }
            }
        }
    )

    spec.components.response(
        'Forbidden',
        {
            'description': 'Access forbidden',
            'content': {
                'application/json': {
                    'example': {'error': 'Access forbidden', 'status_code': 403}
                }
            }
        }
    )

    return docs

# Export spec for external access
def get_openapi_spec():
    """Get the complete OpenAPI specification as dict"""
    return spec.to_dict()

def get_openapi_json():
    """Get the OpenAPI specification as JSON string"""
    import json
    return json.dumps(spec.to_dict(), indent=2, ensure_ascii=False)

def get_openapi_yaml():
    """Get the OpenAPI specification as YAML string"""
    try:
        import yaml
        return yaml.dump(spec.to_dict(), allow_unicode=True, default_flow_style=False)
    except ImportError:
        # Fallback to JSON if PyYAML not available
        return get_openapi_json()