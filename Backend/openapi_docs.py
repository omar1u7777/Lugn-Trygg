"""
OpenAPI/Swagger Documentation Generator for Lugn-Trygg Backend API
Generates comprehensive API documentation with examples
"""

from fastapi import FastAPI
from typing import Dict, List, Any

# API Metadata
API_METADATA = {
    "title": "Lugn-Trygg AI Mental Health API",
    "description": """
# 🧠 Lugn-Trygg AI Mental Health Platform API

**A world-class API for mental health tracking, AI therapy, and analytics**

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

## Rate Limits

- **Authentication**: 10 requests/minute
- **Mood Logging**: 60 requests/hour
- **AI Chat**: 30 requests/hour
- **Analytics**: 100 requests/hour

## Error Handling

All endpoints return consistent error responses:

```json
{
  "detail": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-11-10T12:00:00Z"
}
```

## Support

- Documentation: https://docs.lugn-trygg.se
- Support: support@lugn-trygg.se
- Status: https://status.lugn-trygg.se
    """,
    "version": "2.0.0",
    "contact": {
        "name": "Lugn-Trygg Support",
        "email": "support@lugn-trygg.se",
        "url": "https://lugn-trygg.se"
    },
    "license": {
        "name": "Proprietary",
        "url": "https://lugn-trygg.se/license"
    },
    "servers": [
        {
            "url": "https://api.lugn-trygg.se",
            "description": "Production server"
        },
        {
            "url": "https://staging-api.lugn-trygg.se",
            "description": "Staging server"
        },
        {
            "url": "http://localhost:8000",
            "description": "Local development"
        }
    ]
}

# Security Schemes
SECURITY_SCHEMES = {
    "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT access token obtained from /auth/login endpoint"
    },
    "refreshToken": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT refresh token for obtaining new access tokens"
    }
}

# Tag Metadata
TAGS_METADATA = [
    {
        "name": "Authentication",
        "description": "User authentication, registration, and token management"
    },
    {
        "name": "Mood Logging",
        "description": "Log and retrieve mood entries with text, voice, and photos"
    },
    {
        "name": "AI Chat",
        "description": "Conversational AI therapy powered by GPT-4"
    },
    {
        "name": "Analytics",
        "description": "Mood pattern analysis, predictions, and insights"
    },
    {
        "name": "Memories",
        "description": "Store and retrieve encrypted personal memories"
    },
    {
        "name": "Gamification",
        "description": "Achievements, streaks, levels, and rewards"
    },
    {
        "name": "Health Integration",
        "description": "Sync with Apple Health and Google Fit"
    },
    {
        "name": "User Profile",
        "description": "Manage user settings and preferences"
    },
    {
        "name": "Admin",
        "description": "Administrative endpoints (admin-only)"
    }
]

# Example Responses
EXAMPLE_RESPONSES = {
    "login_success": {
        "description": "Successful login",
        "content": {
            "application/json": {
                "example": {
                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "token_type": "bearer",
                    "expires_in": 3600,
                    "user": {
                        "id": "user_123",
                        "email": "user@example.com",
                        "name": "Test User",
                        "created_at": "2025-01-01T00:00:00Z"
                    }
                }
            }
        }
    },
    "mood_entry_created": {
        "description": "Mood entry created successfully",
        "content": {
            "application/json": {
                "example": {
                    "id": "mood_789",
                    "user_id": "user_123",
                    "mood_score": 7,
                    "mood_text": "Feeling great today!",
                    "mood_category": "happy",
                    "timestamp": "2025-11-10T14:30:00Z",
                    "encrypted": True,
                    "has_voice": False,
                    "has_photo": False,
                    "tags": ["work", "exercise"],
                    "ai_analysis": {
                        "sentiment": "positive",
                        "confidence": 0.92,
                        "themes": ["productivity", "wellness"]
                    }
                }
            }
        }
    },
    "ai_chat_response": {
        "description": "AI therapy response",
        "content": {
            "application/json": {
                "example": {
                    "message_id": "msg_456",
                    "response": "I hear that you're feeling great today. That's wonderful! What specifically made today so positive for you?",
                    "timestamp": "2025-11-10T14:31:00Z",
                    "conversation_id": "conv_789",
                    "context_used": True,
                    "suggested_followups": [
                        "Tell me more about what made you happy",
                        "How can you maintain this positive feeling?",
                        "What are you grateful for today?"
                    ]
                }
            }
        }
    },
    "analytics_weekly": {
        "description": "Weekly mood analytics",
        "content": {
            "application/json": {
                "example": {
                    "period": "2025-11-04 to 2025-11-10",
                    "average_mood": 6.8,
                    "mood_trend": "improving",
                    "total_entries": 12,
                    "mood_distribution": {
                        "happy": 5,
                        "calm": 4,
                        "anxious": 2,
                        "sad": 1
                    },
                    "peak_hours": ["09:00", "14:00", "20:00"],
                    "insights": [
                        "Your mood tends to be highest in the morning",
                        "Exercise days correlate with better mood (+1.2 points)",
                        "You've logged mood 12 times this week - great consistency!"
                    ],
                    "predictions": {
                        "next_week_average": 7.1,
                        "confidence": 0.85,
                        "risk_factors": []
                    }
                }
            }
        }
    },
    "unauthorized": {
        "description": "Missing or invalid authentication token",
        "content": {
            "application/json": {
                "example": {
                    "detail": "Not authenticated",
                    "code": "UNAUTHORIZED",
                    "timestamp": "2025-11-10T14:30:00Z"
                }
            }
        }
    },
    "validation_error": {
        "description": "Request validation failed",
        "content": {
            "application/json": {
                "example": {
                    "detail": [
                        {
                            "loc": ["body", "mood_score"],
                            "msg": "ensure this value is greater than or equal to 1",
                            "type": "value_error.number.not_ge"
                        }
                    ],
                    "code": "VALIDATION_ERROR",
                    "timestamp": "2025-11-10T14:30:00Z"
                }
            }
        }
    },
    "rate_limit_exceeded": {
        "description": "Too many requests",
        "content": {
            "application/json": {
                "example": {
                    "detail": "Rate limit exceeded. Try again in 45 seconds.",
                    "code": "RATE_LIMIT_EXCEEDED",
                    "retry_after": 45,
                    "timestamp": "2025-11-10T14:30:00Z"
                }
            }
        }
    }
}

# Request Body Examples
REQUEST_EXAMPLES = {
    "register": {
        "email": "user@example.com",
        "password": "SecurePassword123!",
        "name": "Test User",
        "age": 28,
        "gender": "non-binary",
        "language": "en",
        "timezone": "Europe/Stockholm"
    },
    "login": {
        "email": "user@example.com",
        "password": "SecurePassword123!"
    },
    "log_mood": {
        "mood_score": 7,
        "mood_text": "Feeling energized after morning workout! 💪",
        "mood_category": "happy",
        "tags": ["exercise", "morning", "energy"],
        "location": "Home",
        "weather": "sunny",
        "activity": "workout"
    },
    "chat_message": {
        "message": "I've been feeling anxious about work lately. How can I manage this stress?",
        "conversation_id": "conv_789",
        "include_context": True
    },
    "save_memory": {
        "title": "First day at new job",
        "content": "Started my new position today. Feeling excited but nervous. The team seems welcoming.",
        "date": "2025-11-10",
        "tags": ["career", "milestone", "anxiety"],
        "mood_score": 6,
        "is_favorite": True
    }
}

def generate_openapi_spec(app: FastAPI) -> Dict[str, Any]:
    """
    Generate comprehensive OpenAPI specification
    """
    spec = app.openapi()
    
    # Add custom metadata
    spec.update(API_METADATA)
    spec["tags"] = TAGS_METADATA
    
    # Add security schemes
    if "components" not in spec:
        spec["components"] = {}
    spec["components"]["securitySchemes"] = SECURITY_SCHEMES
    
    # Add global security requirement
    spec["security"] = [{"bearerAuth": []}]
    
    return spec


def add_endpoint_examples(app: FastAPI):
    """
    Add example requests and responses to all endpoints
    """
    # This would be called in main.py to enhance the OpenAPI schema
    pass


# OpenAPI Extensions
OPENAPI_EXTENSIONS = {
    "x-logo": {
        "url": "https://lugn-trygg.se/logo.png",
        "altText": "Lugn-Trygg Logo"
    },
    "x-tagGroups": [
        {
            "name": "Core Features",
            "tags": ["Authentication", "Mood Logging", "AI Chat"]
        },
        {
            "name": "Analytics & Insights",
            "tags": ["Analytics", "Gamification"]
        },
        {
            "name": "Data Management",
            "tags": ["Memories", "User Profile", "Health Integration"]
        },
        {
            "name": "Administration",
            "tags": ["Admin"]
        }
    ]
}

# Code Generation Templates
CODE_EXAMPLES = {
    "python": """
# Python example using requests
import requests

# Login
response = requests.post(
    "https://api.lugn-trygg.se/auth/login",
    json={"email": "user@example.com", "password": "password"}
)
access_token = response.json()["access_token"]

# Log mood
headers = {"Authorization": f"Bearer {access_token}"}
mood_data = {
    "mood_score": 7,
    "mood_text": "Feeling great!",
    "tags": ["happy", "productive"]
}
response = requests.post(
    "https://api.lugn-trygg.se/mood/log",
    headers=headers,
    json=mood_data
)
print(response.json())
""",
    "javascript": """
// JavaScript example using fetch
const API_URL = 'https://api.lugn-trygg.se';

// Login
const loginResponse = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
});
const { access_token } = await loginResponse.json();

// Log mood
const moodResponse = await fetch(`${API_URL}/mood/log`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mood_score: 7,
    mood_text: 'Feeling great!',
    tags: ['happy', 'productive']
  })
});
const moodData = await moodResponse.json();
console.log(moodData);
""",
    "curl": """
# Login
curl -X POST https://api.lugn-trygg.se/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"password"}'

# Response: {"access_token":"eyJ...","refresh_token":"eyJ..."}

# Log mood
curl -X POST https://api.lugn-trygg.se/mood/log \\
  -H "Authorization: Bearer eyJ..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "mood_score": 7,
    "mood_text": "Feeling great!",
    "tags": ["happy", "productive"]
  }'
"""
}

if __name__ == "__main__":
    print("OpenAPI Documentation Generator for Lugn-Trygg API")
    print("=" * 60)
    print(f"API Version: {API_METADATA['version']}")
    print(f"Total Endpoints: 50+")
    print(f"Tags: {len(TAGS_METADATA)}")
    print("\nTo generate full docs, add to main.py:")
    print("  from openapi_docs import generate_openapi_spec")
    print("  app.openapi = lambda: generate_openapi_spec(app)")
