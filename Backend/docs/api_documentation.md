# Lugn & Trygg API Documentation

## Overview

Lugn & Trygg is a comprehensive mental health and wellness platform providing mood tracking, AI-powered insights, memory management, and therapeutic support.

## Authentication

All API endpoints require authentication using JWT tokens.

### Authentication Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "language": "sv",
  "accept_terms": true,
  "accept_privacy": true,
  "referral_code": "REF123"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user_id": "user123",
  "email": "user@example.com"
}
```

#### POST /api/auth/login
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "data": {
    "access_token": "eyJ0eXAi...",
    "refresh_token": "eyJ0eXAi...",
    "user_id": "user123",
    "expires_in": 900
  }
}
```

#### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "eyJ0eXAi..."
}
```

## Mood Tracking API

### POST /api/mood/log
Log a mood entry.

**Request Body:**
```json
{
  "mood_value": 7,
  "note": "Feeling good today, had a productive morning",
  "timestamp": "2024-01-15T10:30:00Z",
  "tags": ["work", "positive"],
  "location": "home"
}
```

**Response:**
```json
{
  "message": "Mood logged successfully",
  "mood_id": "mood123",
  "insights": {
    "sentiment_score": 0.8,
    "suggested_activities": ["meditation", "exercise"]
  }
}
```

### GET /api/mood/list
Get user's mood history.

**Query Parameters:**
- `limit` (optional): Number of entries to return (default: 50, max: 200)
- `offset` (optional): Pagination offset (default: 0)
- `start_date` (optional): Start date filter (ISO format)
- `end_date` (optional): End date filter (ISO format)

**Response:**
```json
{
  "moods": [
    {
      "id": "mood123",
      "mood_value": 7,
      "note": "Feeling good today",
      "timestamp": "2024-01-15T10:30:00Z",
      "tags": ["work", "positive"],
      "sentiment_score": 0.8
    }
  ],
  "total_count": 150,
  "has_more": true
}
```

### GET /api/mood/weekly-analysis
Get weekly mood analysis and insights.

**Response:**
```json
{
  "period": {
    "start_date": "2024-01-08",
    "end_date": "2024-01-14"
  },
  "statistics": {
    "average_mood": 6.8,
    "mood_variance": 1.2,
    "total_entries": 12,
    "positive_days": 8,
    "negative_days": 2
  },
  "trends": {
    "overall_trend": "improving",
    "best_day": "2024-01-10",
    "challenging_period": "2024-01-12 to 2024-01-13"
  },
  "insights": [
    "Your mood has been consistently positive this week",
    "Consider maintaining your current routine",
    "Try light exercise on lower-mood days"
  ],
  "recommendations": [
    {
      "type": "activity",
      "title": "Morning Meditation",
      "description": "Start your day with 10 minutes of mindfulness"
    }
  ]
}
```

## Memory Management API

### POST /api/memory/upload
Upload a memory file (audio, image, or document).

**Request Body (multipart/form-data):**
- `audio`: Audio file (MP3, WAV, M4A)
- `user_id`: User identifier
- `description`: Optional description
- `tags`: Optional tags (comma-separated)

**Response:**
```json
{
  "message": "Memory uploaded successfully",
  "memory_id": "mem123",
  "file_url": "https://storage.googleapis.com/...",
  "transcription": "Audio content transcribed here...",
  "insights": {
    "sentiment": "positive",
    "key_themes": ["family", "gratitude"]
  }
}
```

### GET /api/memory/list
List user's memories.

**Query Parameters:**
- `limit` (optional): Number of memories to return (default: 20)
- `offset` (optional): Pagination offset
- `tags` (optional): Filter by tags

**Response:**
```json
{
  "memories": [
    {
      "id": "mem123",
      "file_path": "memories/user123/audio.mp3",
      "description": "Family gathering memory",
      "tags": ["family", "happy"],
      "timestamp": "2024-01-15T14:30:00Z",
      "file_size": 2457600,
      "duration": 120
    }
  ],
  "total_count": 45,
  "has_more": true
}
```

## AI Assistant API

### POST /api/chat/message
Send message to AI assistant.

**Request Body:**
```json
{
  "message": "I'm feeling anxious about work",
  "context": {
    "recent_moods": [6, 7, 5],
    "current_mood": 6,
    "conversation_history": []
  },
  "language": "sv"
}
```

**Response:**
```json
{
  "response": "Jag förstår att du känner dig anxious inför arbetet. Det är helt normalt att känna så ibland. Låt mig hjälpa dig med några tekniker...",
  "suggestions": [
    {
      "type": "breathing_exercise",
      "title": "4-7-8 Andning",
      "description": "En enkel andningsövning för att minska ångest"
    }
  ],
  "crisis_keywords_detected": false,
  "follow_up_questions": [
    "Har du märkt några specifika triggers för din ångest?",
    "Vill du att jag föreslår några coping-strategier?"
  ]
}
```

### GET /api/chat/history
Get conversation history.

**Query Parameters:**
- `limit` (optional): Number of messages to return
- `conversation_id` (optional): Specific conversation

**Response:**
```json
{
  "conversation_id": "conv123",
  "messages": [
    {
      "role": "user",
      "content": "I'm feeling anxious",
      "timestamp": "2024-01-15T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "I understand you're feeling anxious...",
      "timestamp": "2024-01-15T10:00:05Z",
      "suggestions": [...]
    }
  ]
}
```

## User Management API

### GET /api/user/profile
Get user profile information.

**Response:**
```json
{
  "user_id": "user123",
  "email": "user@example.com",
  "name": "John Doe",
  "language": "sv",
  "timezone": "Europe/Stockholm",
  "preferences": {
    "notifications_enabled": true,
    "weekly_reports": true,
    "data_sharing": false
  },
  "subscription": {
    "plan": "premium",
    "status": "active",
    "expires_at": "2024-02-15T00:00:00Z"
  },
  "stats": {
    "total_moods_logged": 245,
    "current_streak": 12,
    "longest_streak": 28,
    "join_date": "2023-08-15"
  }
}
```

### PUT /api/user/preferences
Update user preferences.

**Request Body:**
```json
{
  "notifications_enabled": true,
  "weekly_reports": false,
  "language": "en",
  "timezone": "Europe/Stockholm"
}
```

## Health & Analytics API

### GET /api/health/status
Get system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00Z",
  "checks": {
    "database": {"status": "healthy", "response_time": 0.023},
    "cache": {"status": "healthy", "response_time": 0.001},
    "external_apis": {"status": "healthy", "response_time": 0.145}
  },
  "system_info": {
    "cpu_usage": 45.2,
    "memory_usage": 62.1,
    "disk_free": 15.3
  }
}
```

### GET /api/analytics/dashboard
Get user analytics dashboard data.

**Response:**
```json
{
  "period": "30d",
  "mood_analytics": {
    "average_mood": 7.2,
    "mood_trend": "stable",
    "best_month": "December 2023",
    "mood_distribution": {
      "1-3": 5,
      "4-6": 15,
      "7-8": 35,
      "9-10": 8
    }
  },
  "activity_insights": {
    "most_active_day": "Wednesday",
    "most_active_hour": 9,
    "consistency_score": 85,
    "improvement_areas": ["Sleep tracking", "Exercise logging"]
  },
  "ai_interactions": {
    "total_conversations": 67,
    "avg_session_length": 12.5,
    "common_topics": ["anxiety", "stress", "relationships"],
    "satisfaction_score": 4.2
  }
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Invalid request parameters",
  "details": "mood_value must be between 1 and 10"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "details": "Valid JWT token required"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied",
  "details": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found",
  "details": "Mood entry with ID 'mood123' not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "details": "Too many requests. Try again in 60 seconds",
  "retry_after": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "An unexpected error occurred"
}
```

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- Authentication endpoints: 10 requests/minute
- Mood logging: 60 requests/minute
- Memory operations: 30 requests/minute
- AI chat: 100 requests/minute
- General endpoints: 300 requests/minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

## Data Privacy & Security

- All data is encrypted at rest and in transit
- User data is never shared without explicit consent
- GDPR and HIPAA compliance where applicable
- Comprehensive audit logging
- Regular security assessments

## SDKs and Libraries

Official client libraries are available for:
- JavaScript/TypeScript (Browser & Node.js)
- Python
- iOS (Swift)
- Android (Kotlin)

## Support

For API support and questions:
- Email: api-support@lugntrygg.se
- Documentation: https://docs.lugntrygg.se
- Status Page: https://status.lugntrygg.se

## Version History

### v2.1.0 (Current)
- Enhanced AI conversation capabilities
- Improved mood analysis algorithms
- Added memory transcription features
- Performance optimizations

### v2.0.0
- Complete API redesign
- Added subscription management
- Enhanced security features
- Improved error handling

### v1.5.0
- Added memory management
- Enhanced analytics
- Mobile app support