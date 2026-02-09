"""
OpenAPI/Swagger Documentation Configuration for Lugn & Trygg API
Generates comprehensive API documentation with examples and validation
"""

from importlib import metadata as importlib_metadata

import marshmallow
from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin

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

try:
    from flask_apispec import FlaskApiSpec
    FLASK_APISPEC_AVAILABLE = True
except (ImportError, AttributeError) as e:
    print(f"Warning: flask-apispec not available: {e}")
    FLASK_APISPEC_AVAILABLE = False
    FlaskApiSpec = None


from marshmallow import Schema, fields, validate

# Create APISpec instance
spec = APISpec(
    title='Lugn & Trygg API',
    version='1.0.0',
    openapi_version='3.0.3',
    info={
        "description": 'Mental Health & Wellness Platform API - Comprehensive API for mood tracking, AI therapy, and health monitoring',
        "termsOfService": 'https://lugntrygg.se/terms',
        "contact": {
            "name": 'Lugn & Trygg Support',
            "email": 'support@lugntrygg.se',
            "url": 'https://lugntrygg.se/support'
        },
        "license": {
            "name": 'Proprietary',
            "url": 'https://lugntrygg.se/license'
        }
    },
    servers=[
        {
            "url": 'http://localhost:5001',
            "description": 'Development server (local)'
        },
        {
            "url": 'https://api.lugntrygg.se',
            "description": 'Production server'
        }
    ],
    security=[{'BearerAuth': []}],
    tags=[
        {"name": 'Health', "description": 'Server health and readiness checks'},
        {"name": 'Authentication', "description": 'User authentication and authorization'},
        {"name": 'Mood Tracking', "description": 'Mood logging, streaks, and statistics'},
        {"name": 'Dashboard', "description": 'User dashboard and quick stats'},
        {"name": 'AI Services', "description": 'AI chatbot, sentiment analysis, and predictions'},
        {"name": 'Memory Management', "description": 'User memory and media management'},
        {"name": 'Journal', "description": 'Daily journal entries'},
        {"name": 'CBT', "description": 'Cognitive Behavioral Therapy modules and exercises'},
        {"name": 'Crisis', "description": 'Crisis assessment and safety planning'},
        {"name": 'Rewards', "description": 'XP, levels, achievements, and rewards catalog'},
        {"name": 'Leaderboard', "description": 'XP, streak, and mood leaderboards'},
        {"name": 'Challenges', "description": 'Active challenges'},
        {"name": 'Subscriptions', "description": 'Subscription plans, billing, and status'},
        {"name": 'Audio', "description": 'Relaxation audio library and categories'},
        {"name": 'Users', "description": 'User profile, preferences, and settings'},
        {"name": 'Notifications', "description": 'Notification settings'},
        {"name": 'Consent', "description": 'User consent management (GDPR)'},
        {"name": 'Privacy', "description": 'Privacy settings, GDPR export, HIPAA compliance'},
        {"name": 'Onboarding', "description": 'User onboarding flow and goals'},
        {"name": 'Referral', "description": 'Referral code generation and tracking'},
        {"name": 'Peer Chat', "description": 'Anonymous community peer support chat'},
        {"name": 'Voice', "description": 'Voice transcription and emotion analysis'},
        {"name": 'Sync', "description": 'Sync history and statistics'},
        {"name": 'Rate Limiting', "description": 'Rate limit status'},
        {"name": 'Admin', "description": 'Administrative functions (admin only)'},
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


def _register_paths():
    """Register all API endpoint paths in the OpenAPI spec."""

    # ── Helper for standard JSON response ──
    def _json(desc, example=None):
        content = {}
        if example:
            content = {'application/json': {'example': example}}
        return {'description': desc, 'content': content}

    _auth_header = [{'BearerAuth': []}]
    _no_auth = []

    # ================================================================
    #  Health
    # ================================================================
    spec.path(
        path='/api/health/',
        operations={
            'get': {
                'tags': ['Health'],
                'summary': 'Health check',
                'security': _no_auth,
                'responses': {'200': _json('Server is healthy', {'status': 'healthy'})},
            }
        },
    )
    spec.path(
        path='/api/health/ready',
        operations={
            'get': {
                'tags': ['Health'],
                'summary': 'Readiness check (Firebase + server)',
                'security': _no_auth,
                'responses': {'200': _json('Service readiness', {'status': 'ready', 'firebase': True, 'server': True})},
            }
        },
    )
    spec.path(
        path='/api/health/live',
        operations={
            'get': {
                'tags': ['Health'],
                'summary': 'Liveness probe',
                'security': _no_auth,
                'responses': {'200': _json('Server alive', {'status': 'alive'})},
            }
        },
    )

    # ================================================================
    #  Authentication
    # ================================================================
    spec.path(
        path='/api/v1/auth/register',
        operations={
            'post': {
                'tags': ['Authentication'],
                'summary': 'Register new user',
                'security': _no_auth,
                'requestBody': {
                    'required': True,
                    'content': {
                        'application/json': {
                            'schema': {'$ref': '#/components/schemas/RegisterRequest'},
                            'example': {'email': 'user@example.com', 'password': 'SecurePass123!', 'language': 'sv'},
                        }
                    },
                },
                'responses': {
                    '201': _json('User registered', {'success': True, 'data': {'uid': '...'}}),
                    '400': _json('Validation error'),
                    '409': _json('Email already exists'),
                },
            }
        },
    )
    spec.path(
        path='/api/v1/auth/login',
        operations={
            'post': {
                'tags': ['Authentication'],
                'summary': 'Login and receive JWT tokens',
                'security': _no_auth,
                'requestBody': {
                    'required': True,
                    'content': {
                        'application/json': {
                            'schema': {'$ref': '#/components/schemas/LoginRequest'},
                            'example': {'email': 'user@example.com', 'password': 'SecurePass123!'},
                        }
                    },
                },
                'responses': {
                    '200': _json('Login successful', {'success': True, 'data': {'accessToken': '...', 'refreshToken': '...'}}),
                    '401': _json('Invalid credentials'),
                },
            }
        },
    )
    spec.path(
        path='/api/v1/auth/refresh',
        operations={
            'post': {
                'tags': ['Authentication'],
                'summary': 'Refresh access token',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'refreshToken': '...'}}},
                },
                'responses': {'200': _json('Token refreshed')},
            }
        },
    )

    # ================================================================
    #  Mood Tracking
    # ================================================================
    spec.path(
        path='/api/v1/mood/log',
        operations={
            'post': {
                'tags': ['Mood Tracking'],
                'summary': 'Log a mood entry',
                'requestBody': {
                    'required': True,
                    'content': {
                        'application/json': {
                            'example': {'mood_value': 7, 'note': 'Feeling good today', 'activities': ['exercise', 'meditation']},
                        }
                    },
                },
                'responses': {
                    '200': _json('Mood logged with AI analysis'),
                    '400': _json('Validation error'),
                },
            }
        },
    )
    spec.path(
        path='/api/v1/mood',
        operations={
            'get': {
                'tags': ['Mood Tracking'],
                'summary': 'Get mood entries',
                'parameters': [
                    {'name': 'limit', 'in': 'query', 'schema': {'type': 'integer', 'default': 30}, 'description': 'Number of entries'},
                ],
                'responses': {'200': _json('Mood entries list')},
            }
        },
    )
    spec.path(
        path='/api/v1/mood/today',
        operations={
            'get': {
                'tags': ['Mood Tracking'],
                'summary': "Get today's mood entries",
                'responses': {'200': _json("Today's moods")},
            }
        },
    )
    spec.path(
        path='/api/v1/mood/streaks',
        operations={
            'get': {
                'tags': ['Mood Tracking'],
                'summary': 'Get mood logging streaks',
                'responses': {'200': _json('Streak data', {'currentStreak': 5, 'longestStreak': 14})},
            }
        },
    )
    spec.path(
        path='/api/v1/mood-stats/statistics',
        operations={
            'get': {
                'tags': ['Mood Tracking'],
                'summary': 'Get detailed mood statistics with trends',
                'parameters': [
                    {'name': 'period', 'in': 'query', 'schema': {'type': 'string', 'default': '30d'}, 'description': 'Analysis period'},
                ],
                'responses': {'200': _json('Mood statistics and trend analysis')},
            }
        },
    )

    # ================================================================
    #  Dashboard
    # ================================================================
    spec.path(
        path='/api/v1/dashboard/{user_id}/summary',
        operations={
            'get': {
                'tags': ['Dashboard'],
                'summary': 'Get dashboard summary',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'responses': {'200': _json('Dashboard summary with averageMood, streakDays, recentActivity')},
            }
        },
    )
    spec.path(
        path='/api/v1/dashboard/{user_id}/quick-stats',
        operations={
            'get': {
                'tags': ['Dashboard'],
                'summary': 'Get quick stats',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'responses': {'200': _json('Quick stats')},
            }
        },
    )

    # ================================================================
    #  AI Services
    # ================================================================
    spec.path(
        path='/api/v1/chatbot/chat',
        operations={
            'post': {
                'tags': ['AI Services'],
                'summary': 'Chat with AI therapist',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'message': 'Jag känner mig stressad idag'}}},
                },
                'responses': {'200': _json('AI chatbot response with sentiment analysis')},
            }
        },
    )
    spec.path(
        path='/api/v1/chatbot/history',
        operations={
            'get': {
                'tags': ['AI Services'],
                'summary': 'Get chat conversation history',
                'responses': {'200': _json('Chat history')},
            }
        },
    )
    spec.path(
        path='/api/v1/ai-helpers/analyze-text',
        operations={
            'post': {
                'tags': ['AI Services'],
                'summary': 'Analyze text sentiment',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'text': 'Jag mår bra idag och är glad'}}},
                },
                'responses': {'200': _json('Sentiment analysis results')},
            }
        },
    )
    spec.path(
        path='/api/v1/predictive/trends',
        operations={
            'get': {
                'tags': ['AI Services'],
                'summary': 'Get mood trend predictions',
                'parameters': [
                    {'name': 'period', 'in': 'query', 'schema': {'type': 'string', 'default': '30d'}},
                ],
                'responses': {'200': _json('Mood trends and predictions')},
            }
        },
    )
    spec.path(
        path='/api/v1/predictive/crisis-check',
        operations={
            'get': {
                'tags': ['AI Services'],
                'summary': 'Check crisis risk level',
                'responses': {'200': _json('Crisis risk analysis')},
            }
        },
    )
    spec.path(
        path='/api/v1/predictive/insights',
        operations={
            'get': {
                'tags': ['AI Services'],
                'summary': 'Get personal predictive insights (requires ≥7 mood entries)',
                'responses': {
                    '200': _json('Predictive insights'),
                    '400': _json('Insufficient data'),
                },
            }
        },
    )

    # ================================================================
    #  Memory Management
    # ================================================================
    spec.path(
        path='/api/v1/memory/list/{user_id}',
        operations={
            'get': {
                'tags': ['Memory Management'],
                'summary': 'List user memories',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'responses': {'200': _json('Memory entries')},
            }
        },
    )

    # ================================================================
    #  Journal
    # ================================================================
    spec.path(
        path='/api/v1/journal/{user_id}/journal',
        operations={
            'post': {
                'tags': ['Journal'],
                'summary': 'Create a journal entry',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'title': 'Min dag', 'content': 'Idag var en bra dag.', 'mood': 8}}},
                },
                'responses': {'201': _json('Journal entry created')},
            }
        },
    )
    spec.path(
        path='/api/v1/users/journal',
        operations={
            'get': {
                'tags': ['Journal'],
                'summary': 'Get journal entries for authenticated user',
                'responses': {'200': _json('Journal entries list')},
            },
            'post': {
                'tags': ['Journal'],
                'summary': 'Create journal entry (via users endpoint)',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'title': 'Entry', 'content': 'My journal entry', 'mood': 7}}},
                },
                'responses': {'201': _json('Journal entry created')},
            },
        },
    )

    # ================================================================
    #  CBT (Cognitive Behavioral Therapy)
    # ================================================================
    spec.path(
        path='/api/v1/cbt/modules',
        operations={
            'get': {
                'tags': ['CBT'],
                'summary': 'Get available CBT modules',
                'responses': {'200': _json('CBT modules list')},
            }
        },
    )
    spec.path(
        path='/api/v1/cbt/modules/{module_id}',
        operations={
            'get': {
                'tags': ['CBT'],
                'summary': 'Get CBT module details',
                'parameters': [{'name': 'module_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'responses': {'200': _json('Module details')},
            }
        },
    )
    spec.path(
        path='/api/v1/cbt/exercises',
        operations={
            'get': {
                'tags': ['CBT'],
                'summary': 'Get CBT exercises',
                'responses': {'200': _json('Available exercises')},
            }
        },
    )
    spec.path(
        path='/api/v1/cbt/session',
        operations={
            'get': {
                'tags': ['CBT'],
                'summary': 'Get a personalized CBT session',
                'responses': {'200': _json('Personalized session with exercises')},
            }
        },
    )
    spec.path(
        path='/api/v1/cbt/progress',
        operations={
            'post': {
                'tags': ['CBT'],
                'summary': 'Update exercise progress',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'exerciseId': 'thought_record_basic', 'successRate': 0.8, 'timeSpent': 15}}},
                },
                'responses': {'200': _json('Progress updated')},
            }
        },
    )
    spec.path(
        path='/api/v1/cbt/insights',
        operations={
            'get': {
                'tags': ['CBT'],
                'summary': 'Get CBT progress insights',
                'responses': {'200': _json('Progress insights and recommendations')},
            }
        },
    )

    # ================================================================
    #  Crisis
    # ================================================================
    spec.path(
        path='/api/v1/crisis/assess',
        operations={
            'post': {
                'tags': ['Crisis'],
                'summary': 'Assess crisis risk level',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'message': 'Jag mår bra idag'}}},
                },
                'responses': {'200': _json('Crisis assessment result')},
            }
        },
    )
    spec.path(
        path='/api/v1/crisis/safety-plan',
        operations={
            'get': {
                'tags': ['Crisis'],
                'summary': 'Get user safety plan',
                'responses': {'200': _json('Safety plan')},
            },
            'put': {
                'tags': ['Crisis'],
                'summary': 'Update safety plan',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'contacts': [], 'copingStrategies': []}}},
                },
                'responses': {'200': _json('Safety plan updated')},
            },
        },
    )
    spec.path(
        path='/api/v1/crisis/indicators',
        operations={
            'get': {
                'tags': ['Crisis'],
                'summary': 'Get crisis indicators',
                'responses': {'200': _json('Crisis indicators')},
            }
        },
    )

    # ================================================================
    #  Rewards & Gamification
    # ================================================================
    spec.path(
        path='/api/v1/rewards/profile',
        operations={
            'get': {
                'tags': ['Rewards'],
                'summary': 'Get user reward profile (XP, level)',
                'responses': {'200': _json('Rewards profile', {'level': 1, 'xp': 0})},
            }
        },
    )
    spec.path(
        path='/api/v1/rewards/catalog',
        operations={
            'get': {
                'tags': ['Rewards'],
                'summary': 'Get available rewards catalog',
                'responses': {'200': _json('Rewards catalog')},
            }
        },
    )
    spec.path(
        path='/api/v1/rewards/achievements',
        operations={
            'get': {
                'tags': ['Rewards'],
                'summary': 'Get achievements list',
                'responses': {'200': _json('Achievements')},
            }
        },
    )

    # ================================================================
    #  Leaderboard
    # ================================================================
    spec.path(
        path='/api/v1/leaderboard/xp',
        operations={
            'get': {
                'tags': ['Leaderboard'],
                'summary': 'Get XP leaderboard',
                'responses': {'200': _json('XP leaderboard')},
            }
        },
    )
    spec.path(
        path='/api/v1/leaderboard/streaks',
        operations={
            'get': {
                'tags': ['Leaderboard'],
                'summary': 'Get streak leaderboard',
                'responses': {'200': _json('Streak leaderboard')},
            }
        },
    )
    spec.path(
        path='/api/v1/leaderboard/moods',
        operations={
            'get': {
                'tags': ['Leaderboard'],
                'summary': 'Get mood leaderboard',
                'responses': {'200': _json('Mood leaderboard')},
            }
        },
    )
    spec.path(
        path='/api/v1/leaderboard/weekly-winners',
        operations={
            'get': {
                'tags': ['Leaderboard'],
                'summary': 'Get weekly winners',
                'responses': {'200': _json('Weekly winners')},
            }
        },
    )

    # ================================================================
    #  Challenges
    # ================================================================
    spec.path(
        path='/api/v1/challenges',
        operations={
            'get': {
                'tags': ['Challenges'],
                'summary': 'Get active challenges',
                'responses': {'200': _json('Challenges list')},
            }
        },
    )

    # ================================================================
    #  Subscriptions
    # ================================================================
    spec.path(
        path='/api/v1/subscription/plans',
        operations={
            'get': {
                'tags': ['Subscriptions'],
                'summary': 'Get available subscription plans',
                'responses': {'200': _json('Subscription plans (Free, Trial, Premium, Enterprise)')},
            }
        },
    )
    spec.path(
        path='/api/v1/subscription/status/{user_id}',
        operations={
            'get': {
                'tags': ['Subscriptions'],
                'summary': 'Get user subscription status',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'responses': {'200': _json('Subscription status with plan, features, usage')},
            }
        },
    )
    spec.path(
        path='/api/v1/subscription/create-session',
        operations={
            'post': {
                'tags': ['Subscriptions'],
                'summary': 'Create Stripe checkout session',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'plan': 'premium'}}},
                },
                'responses': {'200': _json('Checkout session URL')},
            }
        },
    )

    # ================================================================
    #  Audio Library
    # ================================================================
    spec.path(
        path='/api/v1/audio/categories',
        operations={
            'get': {
                'tags': ['Audio'],
                'summary': 'Get audio categories (Nature, Ambient, Meditation, Sleep, Focus)',
                'responses': {'200': _json('Audio categories')},
            }
        },
    )
    spec.path(
        path='/api/v1/audio/library',
        operations={
            'get': {
                'tags': ['Audio'],
                'summary': 'Get full audio library with tracks',
                'responses': {'200': _json('Audio library')},
            }
        },
    )

    # ================================================================
    #  User Profile & Settings
    # ================================================================
    spec.path(
        path='/api/v1/users/profile',
        operations={
            'get': {
                'tags': ['Users'],
                'summary': 'Get user profile',
                'responses': {'200': _json('User profile')},
            }
        },
    )
    spec.path(
        path='/api/v1/users/preferences',
        operations={
            'put': {
                'tags': ['Users'],
                'summary': 'Update user preferences',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'theme': 'dark', 'language': 'sv'}}},
                },
                'responses': {'200': _json('Preferences updated')},
            }
        },
    )
    spec.path(
        path='/api/v1/users/notification-settings',
        operations={
            'get': {
                'tags': ['Users'],
                'summary': 'Get notification settings',
                'responses': {'200': _json('Notification settings')},
            }
        },
    )
    spec.path(
        path='/api/v1/users/wellness-goals',
        operations={
            'get': {
                'tags': ['Users'],
                'summary': 'Get wellness goals',
                'responses': {'200': _json('Wellness goals')},
            },
            'post': {
                'tags': ['Users'],
                'summary': 'Set wellness goals',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'goals': ['daily_meditation', 'mood_logging']}}},
                },
                'responses': {'200': _json('Goals saved')},
            },
        },
    )
    spec.path(
        path='/api/v1/users/meditation-sessions',
        operations={
            'get': {
                'tags': ['Users'],
                'summary': 'Get meditation session history',
                'responses': {'200': _json('Meditation sessions')},
            },
            'post': {
                'tags': ['Users'],
                'summary': 'Log meditation session',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'duration': 15, 'type': 'breathing'}}},
                },
                'responses': {'200': _json('Session logged')},
            },
        },
    )

    # ================================================================
    #  Notifications
    # ================================================================
    spec.path(
        path='/api/v1/notifications/settings',
        operations={
            'get': {
                'tags': ['Notifications'],
                'summary': 'Get notification settings',
                'responses': {'200': _json('Notification settings')},
            }
        },
    )

    # ================================================================
    #  Consent
    # ================================================================
    spec.path(
        path='/api/v1/consent',
        operations={
            'get': {
                'tags': ['Consent'],
                'summary': 'Get all user consents',
                'responses': {'200': _json('Consent statuses for all categories')},
            },
            'post': {
                'tags': ['Consent'],
                'summary': 'Update consents in bulk',
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'consent_type': 'data_processing', 'granted': True}}},
                },
                'responses': {'200': _json('Consents updated')},
            },
        },
    )

    # ================================================================
    #  Privacy
    # ================================================================
    spec.path(
        path='/api/v1/privacy/settings/{user_id}',
        operations={
            'get': {
                'tags': ['Privacy'],
                'summary': 'Get privacy settings',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'responses': {'200': _json('Privacy settings')},
            },
            'put': {
                'tags': ['Privacy'],
                'summary': 'Update privacy settings',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'allowAnalytics': False, 'shareAnonymizedData': False}}},
                },
                'responses': {'200': _json('Settings updated')},
            },
        },
    )
    spec.path(
        path='/api/v1/privacy/export/{user_id}',
        operations={
            'post': {
                'tags': ['Privacy'],
                'summary': 'Request GDPR data export',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'responses': {'200': _json('Data export initiated')},
            }
        },
    )
    spec.path(
        path='/api/v1/privacy/hipaa/encryption-status',
        operations={
            'get': {
                'tags': ['Privacy'],
                'summary': 'Get HIPAA encryption compliance status',
                'responses': {'200': _json('Encryption status')},
            }
        },
    )
    spec.path(
        path='/api/v1/privacy/gdpr/data-residency',
        operations={
            'get': {
                'tags': ['Privacy'],
                'summary': 'Get GDPR data residency status',
                'responses': {'200': _json('Data residency info')},
            }
        },
    )

    # ================================================================
    #  Onboarding
    # ================================================================
    spec.path(
        path='/api/v1/onboarding/status/{user_id}',
        operations={
            'get': {
                'tags': ['Onboarding'],
                'summary': 'Get onboarding status',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'responses': {'200': _json('Onboarding status')},
            }
        },
    )
    spec.path(
        path='/api/v1/onboarding/goals/{user_id}',
        operations={
            'get': {
                'tags': ['Onboarding'],
                'summary': 'Get onboarding goals',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'responses': {'200': _json('Onboarding goals')},
            },
            'post': {
                'tags': ['Onboarding'],
                'summary': 'Set onboarding goals',
                'parameters': [{'name': 'user_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'goals': ['reduce_anxiety', 'better_sleep']}}},
                },
                'responses': {'200': _json('Goals saved')},
            },
        },
    )

    # ================================================================
    #  Referral
    # ================================================================
    spec.path(
        path='/api/v1/referral/generate',
        operations={
            'post': {
                'tags': ['Referral'],
                'summary': 'Generate referral code',
                'responses': {'200': _json('Referral code generated', {'referralCode': 'XXXXXXXX'})},
            }
        },
    )
    spec.path(
        path='/api/v1/referral/stats',
        operations={
            'get': {
                'tags': ['Referral'],
                'summary': 'Get referral statistics',
                'responses': {'200': _json('Referral stats')},
            }
        },
    )

    # ================================================================
    #  Peer Chat
    # ================================================================
    spec.path(
        path='/api/v1/peer-chat/rooms',
        operations={
            'get': {
                'tags': ['Peer Chat'],
                'summary': 'Get available chat rooms',
                'responses': {'200': _json('Chat rooms list')},
            }
        },
    )
    spec.path(
        path='/api/v1/peer-chat/room/{room_id}/join',
        operations={
            'post': {
                'tags': ['Peer Chat'],
                'summary': 'Join a chat room',
                'parameters': [{'name': 'room_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'user_id': '...'}}},
                },
                'responses': {'200': _json('Joined room with recent messages')},
            }
        },
    )
    spec.path(
        path='/api/v1/peer-chat/room/{room_id}/messages',
        operations={
            'get': {
                'tags': ['Peer Chat'],
                'summary': 'Get room messages',
                'parameters': [{'name': 'room_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'responses': {'200': _json('Room messages')},
            }
        },
    )
    spec.path(
        path='/api/v1/peer-chat/room/{room_id}/send',
        operations={
            'post': {
                'tags': ['Peer Chat'],
                'summary': 'Send message to room',
                'parameters': [{'name': 'room_id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}],
                'requestBody': {
                    'required': True,
                    'content': {'application/json': {'example': {'user_id': '...', 'message': 'Hello!'}}},
                },
                'responses': {'200': _json('Message sent')},
            }
        },
    )

    # ================================================================
    #  Voice
    # ================================================================
    spec.path(
        path='/api/v1/voice/status',
        operations={
            'get': {
                'tags': ['Voice'],
                'summary': 'Get voice service status',
                'responses': {'200': _json('Voice service capabilities')},
            }
        },
    )
    spec.path(
        path='/api/v1/voice/transcribe',
        operations={
            'post': {
                'tags': ['Voice'],
                'summary': 'Transcribe audio to text',
                'requestBody': {
                    'required': True,
                    'content': {'multipart/form-data': {'schema': {'type': 'object', 'properties': {'audio': {'type': 'string', 'format': 'binary'}}}}},
                },
                'responses': {'200': _json('Transcription result')},
            }
        },
    )
    spec.path(
        path='/api/v1/voice/analyze-emotion',
        operations={
            'post': {
                'tags': ['Voice'],
                'summary': 'Analyze emotion from voice',
                'requestBody': {
                    'required': True,
                    'content': {'multipart/form-data': {'schema': {'type': 'object', 'properties': {'audio': {'type': 'string', 'format': 'binary'}}}}},
                },
                'responses': {'200': _json('Emotion analysis result')},
            }
        },
    )

    # ================================================================
    #  Sync History
    # ================================================================
    spec.path(
        path='/api/v1/sync-history/list',
        operations={
            'get': {
                'tags': ['Sync'],
                'summary': 'Get sync history',
                'responses': {'200': _json('Sync history entries')},
            }
        },
    )
    spec.path(
        path='/api/v1/sync-history/stats',
        operations={
            'get': {
                'tags': ['Sync'],
                'summary': 'Get sync statistics',
                'responses': {'200': _json('Sync stats')},
            }
        },
    )

    # ================================================================
    #  Rate Limiting
    # ================================================================
    spec.path(
        path='/api/v1/rate-limit/status',
        operations={
            'get': {
                'tags': ['Rate Limiting'],
                'summary': 'Get current rate limit status',
                'responses': {'200': _json('Rate limit status per endpoint')},
            }
        },
    )
    spec.path(
        path='/api/v1/rate-limit/config',
        operations={
            'get': {
                'tags': ['Admin'],
                'summary': 'Get rate limit configuration (admin only)',
                'responses': {
                    '200': _json('Rate limit config'),
                    '403': _json('Admin access required'),
                },
            }
        },
    )
    spec.path(
        path='/api/v1/rate-limit/stats',
        operations={
            'get': {
                'tags': ['Admin'],
                'summary': 'Get rate limit statistics (admin only)',
                'responses': {
                    '200': _json('Rate limit stats'),
                    '403': _json('Admin access required'),
                },
            }
        },
    )


# Register schemas and paths when module loads
try:
    register_schemas()
except Exception as e:
    print(f"Warning: Schema registration error (non-fatal): {e}")
_register_paths()

# Initialize Flask-apispec
def init_swagger(app):
    """Initialize Swagger documentation for Flask app"""
    if not FLASK_APISPEC_AVAILABLE or FlaskApiSpec is None:
        print("Warning: Swagger documentation disabled - flask-apispec not available")
        return None

    docs = FlaskApiSpec(app)

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
