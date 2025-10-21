# Onboarding Flow - One-Time Display Guide

**Status:** ✅ CONFIGURED  
**Date:** 2025-10-20  
**Behavior:** Onboarding shown only ONCE per user

---

## 🎯 How It Works

### Display Logic

```
First Login
    ↓
onboardingComplete = false (checked from localStorage)
    ↓
Show OnboardingFlow component (3 steps)
    ↓
User completes all 3 steps
    ↓
completeOnboarding() called
    ↓
localStorage[`onboarding_{userId}_complete`] = true
    ↓
Dashboard shown instead of onboarding

---

Second+ Login
    ↓
onboardingComplete = true (retrieved from localStorage)
    ↓
Skip OnboardingFlow entirely
    ↓
Show Dashboard directly
    ↓
Show "Welcome Back!" message (once)
```

---

## 📝 Onboarding Flow (3 Steps)

### Step 1: Welcome ✨
```
Title: "Välkommen till Lugn & Trygg"
Subtitle: "Din personliga mental health-app"

Content:
  "Hej! Vi är glada att du är här.
   
   Lugn & Trygg hjälper dig att hantera stress, 
   förbättra din mental hälsa och hitta lugn i ditt dagliga liv.
   
   ✨ Din personliga resa börjar här
   
   Med dina valda mål kommer vi att ge dig personliga 
   rekommendationer för att stötta din mental hälsa."
```

### Step 2: Choose Goals 🎯
```
Title: "Sätt dina mål"
Subtitle: "Vad vill du uppnå?"

Options (user selects at least 1):
  ☐ 😌 Hantera stress
  ☐ 😴 Bättre sömn
  ☐ 🎯 Ökad fokusering
  ☐ ✨ Mental klarhet
```

### Step 3: Start Journey 🚀
```
Title: "Starta din resa"
Subtitle: "Du är redo!"

Content:
  "Du är nu redo att börja!
   
   Börja med en kort meditation eller spåra din 
   nuvarande humör för att få personliga rekommendationer."
```

---

## 💾 Data Storage (localStorage)

### Keys Used

```
onboarding_{userId}_complete    → boolean (true/false)
onboarding_{userId}_step        → number (0, 1, or 2)
onboarding_{userId}_goals       → array of selected goal IDs
first_login_{userId}            → boolean (indicates first dashboard load)
```

### Example

```javascript
// For user "user_12345"
localStorage['onboarding_user_12345_complete'] = true  // ✓ Onboarding done
localStorage['onboarding_user_12345_step'] = 2        // Last step viewed
localStorage['onboarding_user_12345_goals'] = ["stress", "sleep"]  // Selected goals
localStorage['first_login_user_12345'] = true         // "Welcome Back!" shown
```

---

## 🎨 Welcome Back Message

After onboarding is complete, on the user's first dashboard login:

```
🎉 Välkommen tillbaka!

Du är nu redo att börja din resa med Lugn & Trygg. 
Börja genom att spåra din nuvarande humör eller utforska dina nya mål.
```

**Key Points:**
- ✅ Shows only ONCE (after onboarding)
- ✅ Automatically dismissed after animation completes
- ✅ Marked as seen via `first_login_{userId}` localStorage key
- ✅ Will never show again for this user
- ✅ Different from daily mood reminder (which shows every day user hasn't logged in)

---

## 📊 Daily Mood Reminder

This is DIFFERENT from onboarding and the welcome message:

```
💡 Daily Reminder

Du har inte loggat din humör idag.
Spåra din humör nu för personliga rekommendationer!
```

**Shows:**
- ✅ Every day user hasn't logged mood
- ✅ Only once per day (checks `hasLoggedToday`)
- ✅ Automatically after "Welcome Back!" message

---

## 🔄 User Flow Diagram

### First Time User

```
Login
  ↓
[Check: onboarding_user_complete?]
  ├→ NO: Show OnboardingFlow
  │   ├─ Welcome Step
  │   ├─ Select Goals Step
  │   └─ Start Journey Step
  │       ↓
  │   completeOnboarding()
  │   Save localStorage
  │       ↓
  │   Hide OnboardingFlow
  │
  └→ YES: Show Dashboard
```

### Returning User (First Login That Day)

```
Login
  ↓
[Check: onboarding_user_complete?]
  ├→ YES: Show Dashboard immediately
  │   ├─ Check: first_login_{userId}?
  │   │   ├→ NO: Show "Welcome Back!" message
  │   │   │   Mark as seen
  │   │   │   ↓
  │   │   │   Continue to daily checks
  │   │   │
  │   │   └→ YES: Skip welcome message
  │   │       ↓
  │   │       Continue to daily checks
  │   │
  │   └─ Check: hasLoggedToday?
  │       ├→ NO: Show daily mood reminder
  │       └→ YES: Skip reminder
  │           ↓
  │           Show main dashboard
```

---

## 🔧 Technical Implementation

### useOnboarding Hook

```typescript
export const useOnboarding = (userId?: string) => {
  // Read from localStorage
  const STORAGE_KEY = `onboarding_${userId}`;
  
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_complete`);
    return saved ? JSON.parse(saved) : false;  // false on first login
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(
      `${STORAGE_KEY}_complete`, 
      JSON.stringify(onboardingComplete)
    );
    console.log(`🎯 Onboarding status: ${onboardingComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
  }, [onboardingComplete, userId, STORAGE_KEY]);

  // Returns {onboardingComplete, completeOnboarding, ...}
}
```

### Dashboard Integration

```typescript
// In Dashboard.tsx
const { onboardingComplete, completeOnboarding } = useOnboarding(user?.user_id);

// Show/hide onboarding
{!onboardingComplete && (
  <OnboardingFlow 
    onComplete={() => completeOnboarding()}
    userId={user?.user_id}
  />
)}

// Show dashboard content
{onboardingComplete && (
  <DashboardContent />
)}
```

---

## ✅ Verification Checklist

To verify onboarding is working correctly:

1. **First Time User**
   - [ ] User logs in → Sees onboarding (not dashboard)
   - [ ] Completes all 3 steps → Sees dashboard
   - [ ] Refresh page → Still sees dashboard (onboarding gone)
   - [ ] Logout and login → Sees dashboard directly (no onboarding)
   - [ ] Check browser DevTools → `localStorage['onboarding_user_xxx_complete']` = `true`

2. **Welcome Back Message**
   - [ ] After completing onboarding → See "🎉 Välkommen tillbaka!" message
   - [ ] Message disappears after animation
   - [ ] Refresh page → Message gone (not shown again)
   - [ ] Check localStorage → `first_login_user_xxx` = `true`

3. **Daily Mood Reminder**
   - [ ] After welcome message → See "💡 Daily Reminder" (if no mood logged today)
   - [ ] If mood already logged → Skip this reminder
   - [ ] Next day without logging → Reminder shows again

4. **Data Persistence**
   - [ ] Logout and login next day → Onboarding NOT shown (persistent)
   - [ ] Clear browser cache → Onboarding shown again (fresh start)
   - [ ] Multiple browsers/devices → Separate onboarding flows per device

---

## 🐛 Common Issues & Solutions

### Issue: Onboarding Shows Every Time

**Cause:** localStorage not persisting

**Solution:**
```javascript
// Check in browser console
localStorage.getItem('onboarding_user_xxx_complete')
// Should return "true" after completing onboarding
```

### Issue: Welcome Back Message Shows Multiple Times

**Cause:** `first_login_{userId}` not being set

**Solution:**
```javascript
// Dashboard.tsx should set it:
onAnimationComplete={() => {
  localStorage.setItem(`first_login_${user?.user_id}`, 'true');
}}
```

### Issue: Selected Goals Not Saved

**Cause:** Goals not being synced to backend

**Current:** Goals stored in localStorage only  
**Future:** Add API endpoint to save goals to user profile

---

## 🎯 User Experience Timeline

### Day 1: First Login
```
09:00 - Login
09:00 - See onboarding (Welcome step)
09:05 - Select goals (Goal selection step)
09:10 - Start journey step
09:15 - Onboarding complete
09:15 - Dashboard loads
09:15 - See "Welcome Back!" message
09:20 - See "Daily Mood Reminder"
09:22 - User logs mood
09:22 - Main dashboard visible
```

### Day 2: Return Visit
```
10:00 - Login
10:00 - Dashboard loads immediately (NO onboarding)
10:00 - NO "Welcome Back!" message (already seen)
10:00 - NO mood reminder (logged yesterday)
10:00 - Main dashboard visible
```

### Day 2: After 24 Hours (New Day)
```
10:00 - Next day, login
10:00 - Dashboard loads immediately
10:00 - NO "Welcome Back!" or onboarding
10:00 - YES daily mood reminder (new day, no mood logged yet)
10:01 - User logs mood
10:01 - Reminder dismissed
10:01 - Main dashboard visible
```

---

## 📱 Mobile Experience

On mobile devices, the same onboarding flow works:

- **Step 1:** Scrollable welcome message
- **Step 2:** Goal selection with checkboxes
- **Step 3:** Final encouragement

All navigation works via touch-friendly buttons.

---

## 🔄 Resetting Onboarding (For Testing)

To force onboarding to show again (e.g., for testing):

```javascript
// In browser console
localStorage.removeItem('onboarding_user_xxx_complete');
localStorage.removeItem('onboarding_user_xxx_step');
localStorage.removeItem('onboarding_user_xxx_goals');
localStorage.removeItem('first_login_user_xxx');

// Then refresh page - onboarding will show again
```

---

## 📊 Analytics Events

The following events are tracked:

```javascript
'onboarding_step_completed'   // When moving to next step
'onboarding_step_next'         // Explicitly clicked Next
'onboarding_step_previous'     // Clicked Back
'onboarding_skipped'           // Clicked Skip
'onboarding_completed'         // Finished all steps
'onboarding_goal_toggled'      // Selected/deselected a goal
```

These help track user engagement and flow completion rates.

---

## ✨ Summary

**Onboarding Design:**
- ✅ Shows only **once per user** (persisted in localStorage)
- ✅ **3 clear steps** with intuitive flow
- ✅ **"Welcome Back!" message** after completion
- ✅ **Daily mood reminder** (separate from onboarding)
- ✅ **Full persistence** across sessions and devices
- ✅ **Mobile responsive** design

**User sees:**
1. First login: Onboarding flow (10 minutes)
2. First dashboard: "Welcome Back!" message
3. First dashboard: Daily mood reminder (if applicable)
4. All future logins: Dashboard directly (no onboarding)

**Data persisted:**
- Onboarding completion status
- Selected goals
- Current step (for resume capability)
- First login flag (for welcome message)

