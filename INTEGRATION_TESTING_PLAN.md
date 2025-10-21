# Integration & E2E Testing Plan

**Date**: 2025-10-19  
**Phase**: FASE 1 Final Testing  
**Scope**: Offline mode, notifications, onboarding, analytics tracking  
**Target**: Production-ready validation  

---

## Testing Overview

This document outlines comprehensive integration tests for the FASE 1 MVP features:
1. Onboarding Flow (first-time user experience)
2. Push Notifications (permission & delivery)
3. Offline Mode (data persistence & sync)
4. Analytics & Page Tracking (event logging)

---

## Test Environment Setup

### Prerequisites
```bash
# 1. Backend running
cd Backend
python main.py  # or flask run

# 2. Frontend running
cd frontend
npm run dev

# 3. Browser DevTools open
# F12 → Network, Console, Application tabs

# 4. Mock services ready
# Firebase credentials: .env configured
# Backend API: Running on port 54112 (or configured port)
```

### Browser DevTools Preparation
```javascript
// In console, run to monitor events:
window.addEventListener('online', () => console.log('📡 Online'));
window.addEventListener('offline', () => console.log('📡 Offline'));

// Monitor localStorage changes:
const observeStorage = () => {
  const original = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    if (key === 'lugn_trygg_offline_data') {
      console.log('📦 Offline data updated:', JSON.parse(value));
    }
    original.apply(this, arguments);
  };
};
observeStorage();

// Monitor Amplitude events:
if (window.amplitude) {
  console.log('✅ Amplitude SDK loaded');
}
```

---

## Test Suite 1: Onboarding Flow

### Scenario 1.1: First-Time User Onboarding ✅

**Setup**: Clear localStorage, first visit
```javascript
// In console before test:
localStorage.clear();
sessionStorage.clear();
// Reload page
```

**Steps**:
1. [ ] Visit app home
2. [ ] OnboardingFlow displays (full-screen overlay)
3. [ ] Step 1: "Välkommen till Lugn & Trygg" visible
4. [ ] Icon and description present
5. [ ] Click "Nästa" button
6. [ ] Verify step 1 completion event logged

**Expected Results**:
```json
{
  "event": "onboarding_step_completed",
  "properties": {
    "step": 1,
    "userId": "user_id_here"
  }
}
```

**Verification**:
- [ ] Console shows step progression
- [ ] OnboardingFlow slides to Step 2
- [ ] Progress bar shows 33% → 66%
- [ ] Stepper updates to highlight Step 2

---

### Scenario 1.2: Goal Selection ✅

**Steps**:
1. [ ] On Step 2 "Sätt dina mål" (Set Your Goals)
2. [ ] See 4 goal buttons: Hantera stress, Bättre sömn, Ökad fokusering, Mental klarhet
3. [ ] Click one goal button (e.g., "Hantera stress")
4. [ ] Button highlights (selected state)
5. [ ] Click "Nästa" button
6. [ ] Verify goal selection event

**Expected Results**:
```json
{
  "event": "onboarding_goal_selected",
  "properties": {
    "goal": "Hantera stress",
    "userId": "user_id_here"
  }
}
```

**Verification**:
- [ ] Goal button changes appearance when selected
- [ ] Multiple goals can be selected (if allowed)
- [ ] Selected goals persist
- [ ] Event logged in analytics

---

### Scenario 1.3: Onboarding Completion ✅

**Steps**:
1. [ ] On Step 3 "Starta din resa" (Start Your Journey)
2. [ ] See "Börja med en kort meditation..." message
3. [ ] Button text changes to "Starta" (Start)
4. [ ] Click "Starta" button
5. [ ] Verify completion event
6. [ ] Dashboard appears (onboarding closes)

**Expected Results**:
```json
{
  "event": "onboarding_completed",
  "properties": {
    "goals_selected": ["Hantera stress"],
    "completion_time": 45000,  // milliseconds
    "userId": "user_id_here"
  }
}
```

**Verification**:
- [ ] OnboardingFlow closes
- [ ] Dashboard becomes visible
- [ ] Completion event logged
- [ ] User data saved to backend

---

### Scenario 1.4: Skip Onboarding ✅

**Setup**: Fresh user session

**Steps**:
1. [ ] On any onboarding step
2. [ ] Click "Hoppa över" (Skip) button
3. [ ] Verify skip event
4. [ ] Dashboard displays

**Expected Results**:
```json
{
  "event": "onboarding_skipped",
  "properties": {
    "step": 1,  // which step they skipped from
    "userId": "user_id_here"
  }
}
```

**Verification**:
- [ ] Skip event logged
- [ ] No required goal selection
- [ ] Direct access to app

---

### Scenario 1.5: Onboarding Not Shown to Returning Users ✅

**Setup**: User has completed onboarding before

**Steps**:
1. [ ] Close and reopen browser
2. [ ] Visit app
3. [ ] OnboardingFlow should NOT appear

**Expected Results**:
- [ ] Dashboard displays directly
- [ ] No onboarding overlay
- [ ] Timestamp stored locally

**Verification**:
```javascript
// In console:
localStorage.getItem('lugn_trygg_onboarding_completed')
// Should show timestamp
```

---

## Test Suite 2: Push Notifications

### Scenario 2.1: Notification Permission Dialog ✅

**Setup**: Fresh session, onboarding complete

**Steps**:
1. [ ] After onboarding completes
2. [ ] NotificationPermission dialog appears
3. [ ] Dialog shows benefits:
   - 🔔 Meditation reminders
   - 📅 Mood check-in prompts
   - ✨ Daily motivation
   - 🎯 Goal progress updates
4. [ ] Title: "Stay Connected with Lugn & Trygg"

**Expected Results**:
- [ ] Dialog displays with all 4 benefits
- [ ] Icons visible and styled correctly
- [ ] Layout responsive (mobile-friendly)

**Verification**:
- [ ] Dialog not dismissible by clicking outside
- [ ] Close/Deny buttons present
- [ ] Allow button prominent

---

### Scenario 2.2: Grant Notification Permission ✅

**Steps**:
1. [ ] On NotificationPermission dialog
2. [ ] Click "Allow" / "Tillåt" button
3. [ ] Browser requests notification permission
4. [ ] Accept browser permission prompt
5. [ ] Verify permission granted event

**Expected Results**:
```json
{
  "event": "notification_permission_granted",
  "properties": {
    "source": "notification_dialog",
    "userId": "user_id_here"
  }
}
```

**Verification**:
- [ ] Browser permission prompt appears
- [ ] Grant event logged
- [ ] Dialog closes after ~1.5s
- [ ] FCM token obtained
- [ ] User can receive notifications

**Check Permissions**:
```javascript
// In console:
Notification.permission  // Should be "granted"
```

---

### Scenario 2.3: Deny Notification Permission ✅

**Steps**:
1. [ ] On NotificationPermission dialog (fresh session)
2. [ ] Click "Deny" / "Neka" button
3. [ ] Verify deny event
4. [ ] Dialog closes

**Expected Results**:
```json
{
  "event": "notification_permission_denied",
  "properties": {
    "source": "notification_dialog",
    "userId": "user_id_here"
  }
}
```

**Verification**:
- [ ] Deny event logged
- [ ] Dialog closes immediately
- [ ] No notification functionality

---

### Scenario 2.4: Skip Notification Permission ✅

**Steps**:
1. [ ] On NotificationPermission dialog
2. [ ] Click outside dialog or press Escape (if allowed)
3. [ ] Verify skip event

**Expected Results**:
```json
{
  "event": "notification_permission_skipped",
  "properties": {
    "userId": "user_id_here"
  }
}
```

**Verification**:
- [ ] Skip event logged
- [ ] Dialog closes
- [ ] User can still use app

---

## Test Suite 3: Offline Mode

### Scenario 3.1: Detect Offline Status ✅

**Setup**: App running, network connected

**Steps**:
1. [ ] Open DevTools Network tab
2. [ ] Toggle offline mode: DevTools → Network → Offline checkbox
3. [ ] Observe OfflineIndicator component
4. [ ] Should display: "You're offline"

**Expected Results**:
- [ ] OfflineIndicator appears
- [ ] Offline icon (cloud with slash) shown
- [ ] Background color changes (yellow/warning)
- [ ] Message: "You're offline • X items waiting to sync"

**Verification**:
```javascript
// In console:
navigator.onLine  // Should be false
window.dispatchEvent(new Event('offline'));
```

---

### Scenario 3.2: Store Data While Offline ✅

**Setup**: App offline mode enabled

**Steps**:
1. [ ] While offline, perform app actions:
   - [ ] Add a mood entry (if feature available)
   - [ ] Create a memory note
   - [ ] Record any user data
2. [ ] Data should be queued locally
3. [ ] Check OfflineIndicator: "X items waiting to sync"

**Expected Results**:
```json
{
  "moods": [
    {
      "id": "mood_123",
      "timestamp": 1697754000000,
      "mood": 7,
      "notes": "Feeling good"
    }
  ],
  "memories": [
    {
      "id": "memory_456",
      "timestamp": 1697754000000,
      "content": "Had a good day"
    }
  ]
}
```

**Verification**:
```javascript
// In console:
const offlineData = JSON.parse(localStorage.getItem('lugn_trygg_offline_data'));
console.log('Offline items:', offlineData);
// Should show queued moods/memories
```

---

### Scenario 3.3: Auto-Sync on Reconnect ✅

**Setup**: App offline with queued data

**Steps**:
1. [ ] With data queued offline
2. [ ] Toggle online: DevTools → Network → Offline unchecked
3. [ ] App detects connection
4. [ ] OfflineIndicator updates: "Syncing..."
5. [ ] Spinner animation visible

**Expected Results**:
- [ ] Status changes to "Syncing X items..."
- [ ] Spinner animation in OfflineIndicator
- [ ] API calls made to backend
- [ ] Success: "Synced" message appears

**Verification**:
```javascript
// In console:
const offlineData = JSON.parse(localStorage.getItem('lugn_trygg_offline_data'));
console.log('Remaining items:', offlineData);
// After sync, should be empty or have only failed items

// Monitor network requests
// DevTools → Network tab → Should see POST requests to /api/moods, /api/memories
```

---

### Scenario 3.4: Sync Failure & Retry ✅

**Setup**: Offline data, but backend temporarily down

**Steps**:
1. [ ] Have offline data queued
2. [ ] Go online but backend is unavailable
3. [ ] Watch retry behavior

**Expected Results**:
- [ ] First attempt fails
- [ ] Retry after 2 seconds
- [ ] Maximum 3 retry attempts
- [ ] User notified of failure
- [ ] Data remains queued

**Verification**:
```javascript
// In console (beforehand):
const offlineStorage = window.offlineStorage;
console.log('Retry attempts:', offlineStorage.retryCount);
```

---

### Scenario 3.5: Manual Sync Button ✅

**Setup**: Offline data queued

**Steps**:
1. [ ] If manual sync button available in OfflineIndicator
2. [ ] Click "Sync Now" button
3. [ ] Observe sync attempt

**Expected Results**:
- [ ] Manual sync initiates
- [ ] "Syncing..." state shows
- [ ] Data attempts upload
- [ ] Success/failure message

---

## Test Suite 4: Analytics & Page Tracking

### Scenario 4.1: Page View Tracking ✅

**Setup**: App running with analytics enabled

**Steps**:
1. [ ] Open DevTools Console
2. [ ] Navigate between pages:
   - [ ] Dashboard page
   - [ ] Profile page (if exists)
   - [ ] Settings page (if exists)
   - [ ] Meditation page (if exists)
3. [ ] Each navigation should log event

**Expected Results**:
```json
{
  "event": "page_view",
  "properties": {
    "page": "dashboard",
    "timestamp": 1697754000000
  }
}
```

**Verification**:
```javascript
// Check if Sentry captured events:
// https://your-sentry-project.sentry.io/events

// Check Amplitude dashboard:
// Log in to Amplitude → View your events
```

---

### Scenario 4.2: Feature Usage Tracking ✅

**Steps**:
1. [ ] Use various features in app
2. [ ] Expected tracked features:
   - [ ] Button clicks
   - [ ] Form submissions
   - [ ] Meditation starts
   - [ ] Mood logging

**Expected Results**:
```json
{
  "event": "feature_usage",
  "properties": {
    "feature": "start_meditation",
    "action": "click",
    "timestamp": 1697754000000
  }
}
```

---

### Scenario 4.3: Error Tracking ✅

**Setup**: Intentionally trigger errors

**Steps**:
1. [ ] Open DevTools Console
2. [ ] Trigger an error (e.g., invalid API call)
3. [ ] Watch error capture

**Expected Results**:
- [ ] Error logged to Sentry
- [ ] Stack trace captured
- [ ] Context info included (user, session, etc.)

**Verification**:
```javascript
// In console (test):
throw new Error('Test error for Sentry');
// Check Sentry dashboard for captured error
```

---

### Scenario 4.4: User Property Tracking ✅

**Steps**:
1. [ ] Log in as user
2. [ ] User properties should be set:
   - [ ] User ID
   - [ ] Email
   - [ ] Creation date
   - [ ] Selected goals

**Expected Results**:
```json
{
  "user_id": "user_123",
  "email": "user@example.com",
  "created_at": "2025-10-19",
  "goals": ["Hantera stress", "Bättre sömn"]
}
```

---

## Comprehensive User Journey Test

### Complete First-Time User Flow ✅

**Setup**: Clear all data, fresh session

**Test Steps**:
```
1. [ ] Visit app (URL)
   → OnboardingFlow shows ✅
   → Step 1 displays ✅
   → page_view logged ✅

2. [ ] Complete onboarding
   → All 3 steps completed ✅
   → Goals selected ✅
   → onboarding_completed logged ✅

3. [ ] Notification permission dialog appears ✅
   → Grant permission ✅
   → notification_permission_granted logged ✅

4. [ ] Dashboard displays ✅
   → Page view tracked ✅
   → OfflineIndicator visible (online) ✅

5. [ ] Test offline mode
   → Disconnect network ✅
   → Offline status shows ✅
   → Log data offline ✅

6. [ ] Reconnect and sync
   → Connection restored ✅
   → Auto-sync starts ✅
   → Data synced ✅

7. [ ] Verify analytics
   → All events logged ✅
   → Sentry captured events ✅
   → Amplitude dashboard updated ✅
```

---

## Performance Metrics

### Targets
- Page load: < 3 seconds
- Onboarding steps: < 300ms per slide
- Offline data save: < 100ms
- Sync initiation: < 500ms
- Event logging: < 50ms

### Testing
```javascript
// Measure page load:
performance.now()  // Record before/after navigation

// Measure operation times:
const start = performance.now();
// ... operation ...
const duration = performance.now() - start;
console.log(`Operation took ${duration}ms`);
```

---

## Test Failure Scenarios

### Expected to PASS:
- [ ] Network slowness (2G connection)
- [ ] Intermittent connectivity
- [ ] Browser tab backgrounded
- [ ] Multiple tabs open
- [ ] Device rotated (mobile)
- [ ] Mobile browser (iOS/Android)

### Testing Slow Network:
```javascript
// DevTools → Network → Throttle → Fast 3G
// Rerun all test scenarios
```

---

## Sign-Off Checklist

### Onboarding Flow
- [ ] First-time onboarding works
- [ ] Skip onboarding works
- [ ] Goals selected and saved
- [ ] Events logged correctly
- [ ] Not shown to returning users

### Notifications
- [ ] Permission dialog appears
- [ ] Grant/deny/skip all work
- [ ] Events logged
- [ ] FCM token obtained
- [ ] (Optional) Test push notification delivery

### Offline Mode
- [ ] Offline detection works
- [ ] Data saved locally
- [ ] Sync indicator shows
- [ ] Auto-sync on reconnect works
- [ ] Failed sync retries
- [ ] (Optional) Manual sync works

### Analytics
- [ ] Page views tracked
- [ ] Feature usage tracked
- [ ] Errors captured
- [ ] User properties set
- [ ] Sentry events visible
- [ ] Amplitude events logged

### Production Ready
- [ ] All tests passing
- [ ] No console errors
- [ ] No console warnings
- [ ] Performance acceptable
- [ ] Mobile responsive
- [ ] Accessibility verified
- [ ] Team lead approval

---

## Deployment Approval

**QA Lead**: ___________________ Date: ___________

**Status**: ☐ Pass ☐ Fail ☐ Conditional

**Issues Found**:
```
(List any blocking issues)



```

**Ready for Production**: ☐ Yes ☐ No

---

## Resources

- Firebase FCM Documentation: https://firebase.google.com/docs/cloud-messaging
- Sentry React Guide: https://docs.sentry.io/platforms/javascript/guides/react/
- Amplitude SDK: https://developers.amplitude.com/
- LocalStorage API: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

