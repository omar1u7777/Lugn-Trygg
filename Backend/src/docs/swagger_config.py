"""
OpenAPI/Swagger Documentation Configuration for Lugn & Trygg API
Generates comprehensive API documentation with examples and validation
"""

from importlib import metadata as importlib_metadata

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
import marshmallow

# ---------------------------------------------------------------------------
# Compatibility helpers
# ---------------------------------------------------------------------------

# Flask-apispec relies on the deprecated ``marshmallow.__version__`` attribute.
# Marshmallow 4 removed this attribute, which causes Render deployments to fail
# when the platform installs the newest major release. Restore the value before
# importing Flask-apispec so it always sees the legacy metadata.
try:
    needs_version = not getattr(marshmallow, "__version__", None)
except AttributeError:
    needs_version = True

if needs_version:
    try:
        marshmallow.__version__ = importlib_metadata.version("marshmallow")
    except importlib_metadata.PackageNotFoundError:
        # As an absolute fallback, provide a placeholder version string so
        # flask-apispec can continue importing without crashing.
        marshmallow.__version__ = "0"

from flask_apispec import FlaskApiSpec
from marshmallow import Schema, fields, validate

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
    ],
    plugins=[MarshmallowPlugin()],
)

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
    error = fields.Str(metadata={'description': 'Error message'})
    status_code = fields.Int(metadata={'description': 'HTTP status code'})
    timestamp = fields.DateTime(metadata={'description': 'Error timestamp'})


class SuccessResponse(Schema):
    message = fields.Str(metadata={'description': 'Success message'})
    status = fields.Str(metadata={'description': 'Status indicator'})
    timestamp = fields.DateTime(metadata={'description': 'Response timestamp'})

# Authentication schemas
class LoginRequest(Schema):
    email = fields.Email(required=True, metadata={'description': 'User email address'})
    password = fields.Str(
        required=True,
        validate=validate.Length(min=8),
        metadata={'description': 'User password'}
    )


class RegisterRequest(Schema):
    email = fields.Email(required=True, metadata={'description': 'User email address'})
    password = fields.Str(
        required=True,
        validate=validate.Length(min=8),
        metadata={'description': 'User password'}
    )
    language = fields.Str(
        load_default='sv',
        metadata={'description': 'User preferred language'}
    )


class AuthResponse(Schema):
    access_token = fields.Str(metadata={'description': 'JWT access token'})
    refresh_token = fields.Str(metadata={'description': 'JWT refresh token'})
    user = fields.Dict(metadata={'description': 'User information'})
    expires_in = fields.Int(metadata={'description': 'Token expiration time in seconds'})

# Mood schemas
class MoodLogRequest(Schema):
    mood_value = fields.Int(
        required=True,
        validate=validate.Range(min=1, max=10),
        metadata={'description': 'Mood value (1-10)'}
    )
    note = fields.Str(metadata={'description': 'Optional mood note'})
    voice_data = fields.Str(metadata={'description': 'Base64 encoded voice data'})
    timestamp = fields.DateTime(metadata={'description': 'Mood timestamp'})


class MoodEntry(Schema):
    id = fields.Str(metadata={'description': 'Mood entry ID'})
    user_id = fields.Str(metadata={'description': 'User ID'})
    mood_value = fields.Int(metadata={'description': 'Mood value (1-10)'})
    note = fields.Str(metadata={'description': 'Mood note'})
    timestamp = fields.DateTime(metadata={'description': 'Entry timestamp'})
    ai_insights = fields.Dict(metadata={'description': 'AI-generated insights'})


class MoodAnalysis(Schema):
    period = fields.Str(metadata={'description': 'Analysis period'})
    average_mood = fields.Float(metadata={'description': 'Average mood value'})
    trend = fields.Str(metadata={'description': 'Mood trend (improving/declining/stable)'})
    insights = fields.List(
        fields.Str(),
        metadata={'description': 'AI-generated insights'}
    )
    recommendations = fields.List(
        fields.Str(),
        metadata={'description': 'Personalized recommendations'}
    )

# AI schemas
class AIStoryRequest(Schema):
    mood_context = fields.Str(metadata={'description': 'Current mood context'})
    preferences = fields.Dict(metadata={'description': 'User preferences for story generation'})


class AIStory(Schema):
    id = fields.Str(metadata={'description': 'Story ID'})
    title = fields.Str(metadata={'description': 'Story title'})
    content = fields.Str(metadata={'description': 'Story content'})
    mood_themes = fields.List(
        fields.Str(),
        metadata={'description': 'Mood themes addressed'}
    )
    created_at = fields.DateTime(metadata={'description': 'Creation timestamp'})


class PredictiveForecast(Schema):
    forecast_date = fields.Date(metadata={'description': 'Forecast date'})
    predicted_mood = fields.Float(metadata={'description': 'Predicted mood value'})
    confidence = fields.Float(metadata={'description': 'Prediction confidence (0-1)'})
    factors = fields.List(
        fields.Str(),
        metadata={'description': 'Contributing factors'}
    )

# Memory schemas
class MemoryUploadRequest(Schema):
    file = fields.Raw(metadata={'description': 'File to upload'})
    description = fields.Str(metadata={'description': 'Memory description'})
    tags = fields.List(fields.Str(), metadata={'description': 'Memory tags'})


class MemoryEntry(Schema):
    id = fields.Str(metadata={'description': 'Memory ID'})
    filename = fields.Str(metadata={'description': 'Original filename'})
    url = fields.Str(metadata={'description': 'Access URL'})
    description = fields.Str(metadata={'description': 'Memory description'})
    tags = fields.List(fields.Str(), metadata={'description': 'Memory tags'})
    uploaded_at = fields.DateTime(metadata={'description': 'Upload timestamp'})

# Subscription schemas
class SubscriptionStatus(Schema):
    active = fields.Bool(metadata={'description': 'Subscription active status'})
    plan = fields.Str(metadata={'description': 'Subscription plan'})
    current_period_end = fields.DateTime(metadata={'description': 'Current billing period end'})
    cancel_at_period_end = fields.Bool(metadata={'description': 'Will cancel at period end'})


# Integration schemas
class HealthData(Schema):
    date = fields.Date(metadata={'description': 'Data date'})
    steps = fields.Int(metadata={'description': 'Step count'})
    heart_rate = fields.Float(metadata={'description': 'Average heart rate'})
    sleep_hours = fields.Float(metadata={'description': 'Sleep hours'})
    mood_correlation = fields.Float(metadata={'description': 'Mood correlation coefficient'})

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