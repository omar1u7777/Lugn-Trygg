# Dashboard Auto-Update Mechanism

## Overview
The dashboard statistics cards (HUMÖR IDAG, STREAK DAGAR, AI-SESSIONER, ACHIEVEMENTS) now automatically update when users log mood entries, send messages to the AI chat, or perform other related actions.

## How It Works

### 1. Data Flow Architecture

```
User Action (Mood, AI Chat, etc.)
    ↓
Component saves data to backend via API
    ↓
clearDashboardCache() is called
    ↓
Feature closes & calls onClose()
    ↓
Dashboard.handleCloseFeature() triggers refresh()
    ↓
useDashboardData hook fetches fresh data with forceRefresh=true
    ↓
DashboardStats component re-renders with new values
```

### 2. Core Components

#### **useDashboardData Hook** (`src/hooks/useDashboardData.ts`)
- Centralized data fetching for all dashboard statistics
- Implements 5-minute TTL (Time To Live) cache
- Provides `refresh()` function to force fresh data fetch
- Provides `clearDashboardCache()` utility to invalidate cache

**Key features:**
- Caches data in memory with 5-minute TTL
- Forces fresh fetch when `refresh(forceRefresh=true)` is called
- Handles error states gracefully
- Tracks metrics via analytics

#### **DashboardStats Component** (`src/components/Dashboard/DashboardStats.tsx`)
- Displays four main statistics:
  - **Humör idag** (Average mood 0-10)
  - **Streak dagar** (Consecutive days)
  - **AI-sessioner** (Chat count)
  - **Achievements** (Calculated from streaks + moods)
- Re-renders automatically when props change

#### **WorldClassDashboard Component** (`src/components/WorldClassDashboard.tsx`)
- Main dashboard container
- Manages view states (overview, mood, chat, analytics, gamification)
- Calls `refresh()` when closing feature views via `handleCloseFeature()`

### 3. Trigger Points

#### Mood Logging (`src/components/WorldClassMoodLogger.tsx`)
```typescript
// After successful mood save:
clearDashboardCache();  // Invalidate cache
onClose();              // Close feature view
// Parent component calls refresh() on close
```

#### AI Chat (`src/components/WorldClassAIChat.tsx`)
```typescript
// After successful AI response:
clearDashboardCache();  // Invalidate cache to update AI-sessioner count
// Parent component calls refresh() when feature closes
```

#### Wellness Goals (`src/components/Wellness/WellnessGoalsOnboarding.tsx`)
```typescript
// After saving wellness goals:
onComplete(goals) → refresh()  // Immediately refresh dashboard
```

## Implementation Details

### Cache Management
1. **Client-side cache** prevents unnecessary API calls
2. **TTL of 5 minutes** balances freshness vs. performance
3. **Manual cache clearing** ensures immediate updates after user actions
4. **Force refresh** bypasses cache and fetches fresh data from backend

### Update Flow for Each Feature

**Mood Logging:**
1. User selects mood and clicks "Spara humör"
2. API endpoint `/api/mood/log` saves mood entry
3. `clearDashboardCache()` invalidates client cache
4. Component shows success message (2-second delay)
5. `onClose()` closes mood logger
6. Parent's `handleCloseFeature()` calls `refresh()`
7. Dashboard re-fetches data with fresh counts

**AI Chat:**
1. User sends message to AI
2. API endpoint `/api/chat` saves chat message
3. `clearDashboardCache()` invalidates client cache
4. AI response is displayed
5. When returning to dashboard, fresh data is loaded

**Achievements & Wellness:**
1. Backend automatically calculates achievements
2. Wellness goals trigger immediate refresh
3. Dashboard displays updated values on next view

## Console Logging for Debugging

All key steps are logged to browser console for troubleshooting:

```
🔄 REFRESH FUNCTION CALLED in useDashboardData
📊 Dashboard data received: {...}
🗑️ Client cache cleared after mood logging
🔄 handleCloseFeature called - closing feature view and refreshing dashboard
📊 Executing dashboard refresh after feature close...
✅ REFRESH COMPLETED
```

## Testing the Auto-Update

1. **Open DevTools Console** (F12)
2. **Log a mood:**
   - Click mood card
   - Select a mood
   - Click "Spara humör"
   - Watch console for "Client cache cleared" message
   - Return to dashboard
   - Check if stats updated

3. **Send AI message:**
   - Start AI chat
   - Send a message
   - Look for cache clear log
   - Return to dashboard
   - Verify "AI-sessioner" count increased

4. **Verify with Network tab:**
   - First load uses cache (no API call)
   - After mood/chat action, next dashboard load forces API call
   - Fresh data reflects new stats

## Files Modified

1. **src/hooks/useDashboardData.ts** - Core caching logic
2. **src/components/WorldClassDashboard.tsx** - Added logging to refresh flow
3. **src/components/WorldClassMoodLogger.tsx** - Added logging for cache clear
4. **src/components/WorldClassAIChat.tsx** - Added cache clearing on AI response ✨ NEW

## Performance Considerations

- **5-minute cache** prevents excessive API calls
- **Cache clearing** ensures 1-2 second update latency after user action
- **Force refresh** only happens on close, not during typing/editing
- **Analytics tracking** monitors cache hit rate and refresh frequency

## Known Issues & Fixes

### Issue: "Humör idag" Shows 0 Average
**Status:** FIXED ✅

**Root Cause:** Backend was calculating average mood from sentiment analysis score (-1 to 1) instead of user-selected mood score (1-10).

**Solution:** 
- Backend now extracts `score` from frontend data (line 413-424 in mood_routes.py)
- Uses mood score for dashboard average calculation instead of sentiment score
- Sentiment analysis preserved separately for AI recommendations

**Files Modified:**
- `Backend/src/routes/mood_routes.py` (lines 286, 413-424, 435)
- See `HUMOR_AVERAGE_SCORE_FIX.md` for detailed explanation

**Testing:** See `TEST_HUMOR_UPDATE.md` for verification steps

## Known Limitations

- Dashboard stats are calculated server-side (no real-time sync)
- Updates only occur when returning to overview view
- Achievements calculated based on mood count / streak count ratio
- Weekly progress depends on backend calculation

## Future Enhancements

- WebSocket support for true real-time updates
- Server-Sent Events (SSE) for push notifications
- Optimistic UI updates while data is loading
- Per-stat cache invalidation (mood-only refresh, etc.)
