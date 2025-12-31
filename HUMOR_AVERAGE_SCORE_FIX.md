# Humör Idag Average Score Fix

## Problem
After logging a mood with a score (e.g., "Deprimerad" = score 1), the dashboard was showing `averageMood: 0` instead of the correct average. The data was being saved (`totalMoods` increased correctly), but the average calculation was broken.

## Root Cause

### Frontend Sending (Correct ✅)
```typescript
// WorldClassMoodLogger.tsx line 177-182
await logMood(user.user_id, {
  score: selectedMood.score,    // 1-10 scale (1=depressed, 10=ecstatic)
  note: moodText.trim() || selectedMood.label,
  timestamp: new Date(),
  emotions: analysis?.emotion ? [analysis.emotion] : [],
});
```

### Backend Receiving (Broken ❌)
The backend was:
1. **Not finding the mood score** - Frontend sends `score`, but backend was looking for `mood_text` or `mood`
2. **Using wrong score field** - When calculating `averageMood`, it was using `sentiment_analysis.get('score')` which is a sentiment score (-1 to 1), not the mood score (1-10)

**Bad code (line 435):**
```python
'score': sentiment_analysis.get('score', 0) if sentiment_analysis else 0,
```

This stores the sentiment analysis score (which is often 0 or ±0.something), not the mood score (1-10) that the user selected.

## Solution

### 1. Extract Mood Score from Frontend Data
**File:** `Backend/src/routes/mood_routes.py` (lines 413-424)

```python
# Get mood score from frontend (1-10 scale)
mood_score = data.get('score')
if mood_score is not None:
    try:
        mood_score = float(mood_score)
        logger.info(f"💾 Mood score from frontend: {mood_score}")
    except (ValueError, TypeError):
        mood_score = None
        logger.warning(f"⚠️ Invalid mood score: {data.get('score')}")
```

### 2. Fix Mood Text Extraction
**File:** `Backend/src/routes/mood_routes.py` (line 286)

**Before:**
```python
mood_text_raw = data.get('mood_text', '') or data.get('mood', '')
```

**After:**
```python
# Frontend sends 'note' field, backend expects 'mood_text'
mood_text_raw = data.get('mood_text', '') or data.get('mood', '') or data.get('note', '')
logger.info(f"📝 Mood text sources - mood_text: {data.get('mood_text')}, mood: {data.get('mood')}, note: {data.get('note')}, raw: {mood_text_raw}")
```

### 3. Store Mood Score Instead of Sentiment Score
**File:** `Backend/src/routes/mood_routes.py` (line 435)

**Before:**
```python
'score': sentiment_analysis.get('score', 0) if sentiment_analysis else 0,
```

**After:**
```python
'score': mood_score if mood_score is not None else (sentiment_analysis.get('score', 0) if sentiment_analysis else 0),
```

## Data Flow After Fix

```
User selects mood (score=1-10)
        ↓
Frontend sends: { score: 1, note: "...", timestamp, emotions }
        ↓
Backend extracts: mood_score = 1
        ↓
Firestore stores: { score: 1, mood_text: "...", timestamp, ... }
        ↓
Dashboard calculation (line 99 in dashboard_routes.py):
  average_mood = sum(mood.get("score", 0) for mood in moods) / total_moods
        ↓
averageMood = (1 + 1 + 3) / 3 = 1.67 ✅ CORRECT!
```

## Testing the Fix

### 1. Log a mood (score = 1)
- Backend logs: `💾 Mood score from frontend: 1.0`
- Firestore stores: `score: 1`

### 2. Log another mood (score = 7)
- Backend logs: `💾 Mood score from frontend: 7.0`
- Firestore stores: `score: 7`

### 3. View dashboard
- Backend calculates: `average_mood = (1 + 7) / 2 = 4.0`
- Frontend displays: `Humör idag: 4.0/10` ✅

## Console Logs to Verify

After applying the fix, you should see in backend logs:
```
📝 Mood text sources - mood_text: None, mood: None, note: "Min anteckning", raw: "Min anteckning"
💾 Mood score from frontend: 1.0
💾 Mood data: text='Min anteckning', timestamp=..., score=1.0
✅ Mood entry saved to database with ID: xxxxx
```

And on dashboard refresh:
```
📊 Dashboard data received: {
  "averageMood": 4.0,
  "totalMoods": 2,
  "streakDays": 2,
  ...
}
```

## Files Modified

1. **Backend/src/routes/mood_routes.py**
   - Line 286-289: Add 'note' field extraction and logging
   - Line 413-424: Extract mood_score from frontend data
   - Line 428: Log mood_score value
   - Line 435: Use mood_score instead of sentiment score

## Related Issues Fixed

- ✅ "Humör idag" now shows correct average (1-10 scale)
- ✅ Dashboard data properly updates after mood logging
- ✅ Sentiment analysis preserved for AI recommendations (different field)
- ✅ Backward compatibility: fallback to sentiment score if no mood_score provided

## Deployment Notes

- No database migration needed
- No frontend changes required
- Safe rollout - sentiment_analysis stored separately
- Old moods without score will use sentiment score as fallback
