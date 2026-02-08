# Mood Tracking API Documentation

## Overview
The Mood Tracking API provides comprehensive mood logging, analysis, and insights for mental health monitoring.

## Endpoints

### Mood Logging
- `POST /api/mood/log` - Log a new mood entry (text or voice)
- `PUT /api/mood/{id}` - Update an existing mood entry
- `DELETE /api/mood/{id}` - Delete a mood entry

### Mood Retrieval
- `GET /api/mood` - Get mood history with filtering and pagination
- `GET /api/mood/{id}` - Get a specific mood entry
- `GET /api/mood/recent` - Get moods from last 7 days
- `GET /api/mood/today` - Get today's mood (if logged)

### Analytics & Insights
- `GET /api/mood/statistics` - Comprehensive mood statistics
- `GET /api/mood/streaks` - Mood logging streaks and consistency
- `GET /api/mood/insights` - AI-powered mood insights and recommendations

## Authentication
All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

## Request/Response Examples

### Log Mood
```bash
POST /api/mood/log
Content-Type: application/json

{
  "mood_text": "Känner mig glad idag!",
  "timestamp": "2025-11-25T10:00:00Z"
}
```

### Get Mood History
```bash
GET /api/mood?limit=20&start_date=2025-11-01&end_date=2025-11-25
```

### Get Statistics
```bash
GET /api/mood/statistics
# Returns: average sentiment, streaks, positive/negative percentages, etc.
```

### Get Streaks
```bash
GET /api/mood/streaks
# Returns: current streak, longest streak, consistency percentage
```

### Get Insights
```bash
GET /api/mood/insights
# Returns: AI-powered insights, patterns, recommendations
```

## Features
- ✅ Text mood logging with sentiment analysis
- ✅ Voice mood logging with speech-to-text and emotion analysis
- ✅ Mood history with advanced filtering
- ✅ Comprehensive statistics and analytics
- ✅ Streak tracking and consistency metrics
- ✅ AI-powered insights and recommendations
- ✅ Redis caching for performance
- ✅ GDPR-compliant data handling
- ✅ Audit logging for all operations

## Data Models

### Mood Entry
```json
{
  "id": "mood_doc_id",
  "user_id": "user_id",
  "mood_text": "Känner mig glad idag!",
  "timestamp": "2025-11-25T10:00:00Z",
  "sentiment": "POSITIVE",
  "score": 0.8,
  "emotions_detected": ["joy", "happiness"],
  "sentiment_analysis": {...},
  "voice_analysis": {...},
  "transcript": "optional voice transcript"
}
```

### Statistics Response
```json
{
  "total_moods": 150,
  "average_sentiment": 0.3,
  "current_streak": 5,
  "longest_streak": 12,
  "positive_percentage": 65.2,
  "negative_percentage": 15.8,
  "neutral_percentage": 19.0,
  "best_day": "2025-11-20",
  "worst_day": "2025-11-15",
  "recent_trend": "improving"
}
```

## Performance
- Redis caching for frequently accessed data
- Optimized Firestore queries with composite indexes
- Pagination support for large datasets
- Background processing for AI analysis

## Error Handling
- 401 Unauthorized: Missing or invalid JWT token
- 404 Not Found: Mood entry doesn't exist
- 500 Internal Server Error: Server-side processing error

All errors include descriptive messages and appropriate HTTP status codes.