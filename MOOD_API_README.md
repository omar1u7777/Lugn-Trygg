# MOOD API README

## FAS 2 - Mood Tracking Implementation

### Overview
FAS 2 implements complete mood tracking functionality for the Lugn & Trygg mental health platform.

### Endpoints

#### Mood Routes (`/api/mood`)
- `GET /api/mood` - Get all moods for authenticated user
- `POST /api/mood` - Create new mood entry
- `GET /api/mood/<mood_id>` - Get specific mood entry
- `PUT /api/mood/<mood_id>` - Update mood entry
- `DELETE /api/mood/<mood_id>` - Delete mood entry
- `GET /api/mood/recent` - Get recent mood entries
- `GET /api/mood/today` - Get today's mood entries
- `GET /api/mood/streaks` - Get mood streaks

#### Mood Statistics (`/api/mood-stats`)
- `GET /api/mood-stats/statistics` - Get mood statistics and AI insights

### Authentication
All endpoints require JWT authentication via `@AuthService.jwt_required` decorator.

### Database Structure
Moods are stored in Firebase Firestore under user-specific subcollections:
```
/users/{user_id}/moods/{mood_id}
```

### AI Integration
- Sentiment analysis using OpenAI/Google NLP
- Mood insights and recommendations
- Pattern recognition for mental health trends

### Error Handling
Comprehensive error handling with standardized APIResponse format.

### Implementation Status
✅ Complete - All functionality implemented and tested