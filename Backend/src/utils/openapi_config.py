"""
2026-Compliant OpenAPI/Swagger Configuration
Automatic API documentation generation with Flasgger
"""

from typing import Any, Dict

SWAGGER_CONFIG: Dict[str, Any] = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/api/docs/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/api/docs/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/api/docs",
    "openapi": "3.0.3",
    "title": "Lugn & Trygg API - 2026 Compliant",
    "version": "2.0.0",
    "description": """
    # 🧠 Lugn & Trygg AI Mental Health Platform API (2026 Standard)
    
    **A world-class API for mental health tracking, AI therapy, and analytics**
    
    ## API Versioning
    
    - **Current Version:** v1
    - **Base URL:** `/api/v1/*`
    - **Future Versions:** `/api/v2/*` (for breaking changes)
    
    ## Features
    
    - 🔐 **Secure Authentication**: JWT-based auth with refresh tokens
    - 📝 **Mood Logging**: Track moods with voice, text, and photos
    - 🤖 **AI Therapy**: GPT-powered conversational therapy
    - 📊 **Analytics**: Advanced mood pattern analysis and predictions
    - 🎯 **Gamification**: Achievements, streaks, and rewards
    - 💾 **Memories**: Encrypted storage of user memories
    - 🏥 **Health Integration**: Apple Health & Google Fit sync
    
    ## Security
    
    - End-to-end encryption for sensitive data
    - AES-256-GCM encryption for mood entries
    - HIPAA-compliant data handling
    - Rate limiting and DDoS protection
    - CORS configuration for web clients
    - Correlation IDs for distributed tracing (2026 standard)
    
    ## Rate Limits
    
    - **Authentication**: 10 requests/minute
    - **Mood Logging**: 60 requests/hour
    - **AI Chat**: 30 requests/hour
    - **Analytics**: 100 requests/hour
    
    ## Error Handling
    
    All endpoints return consistent error responses:
    
    ```json
    {
      "error": "Error message",
      "code": "ERROR_CODE",
      "timestamp": "2026-01-27T12:00:00Z",
      "request_id": "correlation-id-for-tracing"
    }
    ```
    
    ## Correlation IDs (2026 Standard)
    
    All responses include correlation headers:
    - `X-Request-ID`: Request tracking ID
    - `X-Trace-ID`: Distributed tracing ID
    
    Include these in error reports for better debugging.
    """,
    "termsOfService": "https://lugntrygg.se/terms",
    "contact": {
        "name": "Lugn & Trygg Support",
        "email": "support@lugntrygg.se",
        "url": "https://lugntrygg.se/support"
    },
    "license": {
        "name": "Proprietary",
        "url": "https://lugntrygg.se/license"
    },
    "servers": [
        {
            "url": "https://api.lugntrygg.se/api/v1",
            "description": "Production server (v1)"
        },
        {
            "url": "https://api-staging.lugntrygg.se/api/v1",
            "description": "Staging server (v1)"
        },
        {
            "url": "http://localhost:5001/api/v1",
            "description": "Local development (v1)"
        }
    ],
    "tags": [
        {
            "name": "Authentication",
            "description": "User authentication, registration, and token management (v1)"
        },
        {
            "name": "Mood Logging",
            "description": "Log and retrieve mood entries with text, voice, and photos (v1)"
        },
        {
            "name": "AI Chat",
            "description": "Conversational AI therapy powered by GPT-4 (v1)"
        },
        {
            "name": "Analytics",
            "description": "Mood pattern analysis, predictions, and insights (v1)"
        },
        {
            "name": "Health",
            "description": "Health check endpoints (no versioning)"
        },
        {
            "name": "Documentation",
            "description": "API documentation endpoints (no versioning)"
        }
    ],
    "components": {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "JWT access token obtained from /api/v1/auth/login endpoint"
            }
        }
    },
    "security": [
        {
            "bearerAuth": []
        }
    ]
}

SWAGGER_TEMPLATE: Dict[str, Any] = {
    "swagger": "3.0",
    "info": {
        "title": "Lugn & Trygg API",
        "description": "2026-Compliant Mental Health Platform API",
        "version": "2.0.0"
    },
    "basePath": "/api/v1",
    "schemes": ["http", "https"],
    "produces": ["application/json"],
    "consumes": ["application/json"],
}

__all__ = ["SWAGGER_CONFIG", "SWAGGER_TEMPLATE"]

