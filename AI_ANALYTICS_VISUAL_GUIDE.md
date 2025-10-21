# 🎯 AI Health Analytics - Visual Flow Guide

## User Experience Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LUGN & TRYGG USER JOURNEY                     │
└─────────────────────────────────────────────────────────────────┘

STEP 1: CONNECT HEALTH DEVICE
═══════════════════════════════════════════════════════════════════
┌──────────────────────────────────────────────┐
│  🔗 Health Integrations (OAuth)               │
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │ 🟢 Google Fit        [🔗 Connect]       │  │
│  │ Status: Not Connected                   │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │ 🟢 Fitbit            [🔗 Connect]       │  │
│  │ Status: Not Connected                   │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  User clicks [🔗 Connect] on Google Fit       │
│       ↓                                         │
│  Browser redirects to Google OAuth             │
│  User authorizes access                       │
│  Backend receives token & stores in Firebase  │
│       ↓                                         │
│  ✅ Successfully connected!                   │
└──────────────────────────────────────────────┘


STEP 2: SYNC HEALTH DATA
═══════════════════════════════════════════════════════════════════
┌──────────────────────────────────────────────┐
│  🟢 Google Fit        ✓ Connected             │
│  Status: Connected                            │
│  [🔄 Sync Now]  [🔌 Disconnect]              │
│                                                │
│  Connected: Jan 15, 2024 10:30                │
│  Expires: Feb 14, 2024 10:30                  │
│                                                │
│  User clicks [🔄 Sync Now]                    │
│       ↓                                         │
│  Backend fetches from Google Fit API          │
│  - Steps: 8500                                │
│  - Sleep: 7.5 hours                           │
│  - Heart Rate: 72 bpm                         │
│  - Calories: 2200                             │
│       ↓                                         │
│  Data stored in Firestore                     │
│  ✅ Synced! Data from: Jan 8-15               │
└──────────────────────────────────────────────┘


STEP 3: ADD MOOD ENTRIES
═══════════════════════════════════════════════════════════════════
┌──────────────────────────────────────────────┐
│  😊 Mood Tracker                              │
│                                                │
│  Date        │ Mood │ Notes                   │
│  ─────────────────────────────────────────── │
│  Jan 8       │ 4/10 │ Tired, didn't sleep    │
│  Jan 9       │ 9/10 │ Felt great after run   │
│  Jan 10      │ 3/10 │ Low energy              │
│  Jan 11      │ 8/10 │ Slept well             │
│  Jan 12      │ 4/10 │ Stressful day          │
│  Jan 13      │ 9/10 │ Good mood              │
│  Jan 14      │ 3/10 │ Poor sleep             │
│  Jan 15      │ 8/10 │ Active today           │
│                                                │
│  (At least 2-3 entries needed for analysis)   │
└──────────────────────────────────────────────┘


STEP 4: RUN ANALYSIS
═══════════════════════════════════════════════════════════════════
┌──────────────────────────────────────────────┐
│  🧠 Health & Mood Analysis                    │
│                                                │
│  Discover patterns between your health        │
│  metrics and mood tracking                    │
│                                                │
│           [🔬 Analyze Now]                    │
│                                                │
│  User clicks [🔬 Analyze Now]                 │
│       ↓                                         │
│  ┌─────────────────────────────────────────┐ │
│  │ BACKEND ANALYSIS PROCESS                │ │
│  │                                           │ │
│  │ 1. Fetch all health data (8500 docs)   │ │
│  │ 2. Fetch all mood entries (100 docs)   │ │
│  │ 3. Match by date (found 14 matches)    │ │
│  │ 4. Separate into groups:                │ │
│  │    - Good mood days (≥6): avg 8500 stp │ │
│  │    - Bad mood days (<6): avg 3000 stp  │ │
│  │ 5. Detect patterns (found 2)            │ │
│  │ 6. Generate recommendations (2)         │ │
│  │ 7. Store results in Firestore           │ │
│  │ 8. Return to frontend                   │ │
│  └─────────────────────────────────────────┘ │
│                                                │
│  ⏳ Analyzing... (takes 1-2 seconds)          │
│       ↓                                         │
│  ✅ Analysis Complete!                        │
└──────────────────────────────────────────────┘


STEP 5: VIEW RESULTS
═══════════════════════════════════════════════════════════════════
┌───────────────────────────────────────────────────────────────┐
│  ANALYSIS RESULTS                                              │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  😊 Mood Summary                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Average Mood: 6.5/10                                   │  │
│  │ Trend: 📈 Improving                                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  💚 Health Summary                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Avg Steps: 8500 ✅ Good                               │  │
│  │ Avg Sleep: 7.2h ✅ Good                               │  │
│  │ Avg Heart Rate: 72 bpm ✅ Healthy                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  🔍 PATTERNS DISCOVERED (2)                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                         │  │
│  │ 1️⃣ 🏃 Exercise Boosts Mood                            │  │
│  │    On days you walk more (~8500 steps), your mood     │  │
│  │    is notably better                                  │  │
│  │    Impact: 🔴 HIGH                                    │  │
│  │                                                         │  │
│  │ 2️⃣ 😴 Sleep Quality Impacts Mood                      │  │
│  │    You sleep better (7.2h) on good mood days vs       │  │
│  │    bad mood days (5.5h)                               │  │
│  │    Impact: 🔴 HIGH                                    │  │
│  │                                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  💡 PERSONALIZED RECOMMENDATIONS (2)                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                         │  │
│  │ 1️⃣ 🏃 Increase Daily Activity                         │  │
│  │    Since exercise correlates with better mood,        │  │
│  │    try to get 8000+ steps daily                       │  │
│  │                                                         │  │
│  │    💪 Action: Take a 30-minute walk or do             │  │
│  │              light exercise                            │  │
│  │    🎯 Expected: Improved mood and energy levels       │  │
│  │                                                         │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │ 2️⃣ 😴 Prioritize Sleep Quality                        │  │
│  │    Good sleep is fundamental for mental health        │  │
│  │                                                         │  │
│  │    💪 Action: Try to sleep 7-9 hours each night      │  │
│  │    🎯 Expected: Improved emotional resilience         │  │
│  │                                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       COMPLETE DATA FLOW                              │
└──────────────────────────────────────────────────────────────────────┘

OAUTH FLOW
══════════════════════════════════════════════════════════════════════

  User Device                Backend              Google Fit API
      │                         │                       │
      │  1. Click Connect        │                       │
      ├────────────────────────→ │                       │
      │                         │  2. Redirect          │
      │ ←────────────────────────┼──────────────────────→│
      │                         │                       │
      │  3. Authorize           │                       │
      ├──────────────────────────────────────────────→  │
      │                         │  4. Auth Code      │
      │ ←──────────────────────────────────────────────  │
      │                         │                       │
      │                         │  5. Exchange Code for Token
      │                         ├──────────────────────→│
      │                         │  6. Return Token  │
      │                         │←──────────────────────┤
      │                         │                       │
      │ 7. Redirect + Success   │                       │
      │ ←────────────────────────┤                       │
      │                         │                       │


HEALTH DATA SYNC
══════════════════════════════════════════════════════════════════════

  Frontend                Backend              Google Fit API    Firestore
      │                     │                      │                │
      │  1. Click Sync      │                      │                │
      ├────────────────────→│                      │                │
      │                     │  2. Get Token        │                │
      │                     ├─────────────────────→│                │
      │                     │  3. Return Data      │                │
      │                     │←─────────────────────┤                │
      │                     │                      │                │
      │                     │ 4. Process Data      │                │
      │                     │ (steps, sleep, etc)  │                │
      │                     │                      │                │
      │                     │ 5. Store in DB       │                │
      │                     ├─────────────────────────────────────→ │
      │                     │                      │                │
      │  6. Return Status   │                      │                │
      │ ←────────────────────┤                      │                │
      │                     │                      │                │
      │ ✅ Synced!          │                      │                │
      │                     │                      │                │


ANALYSIS FLOW
══════════════════════════════════════════════════════════════════════

  Frontend              Backend                            Firestore
      │                   │                                  │
      │  1. Click Analyze │                                  │
      ├──────────────────→│                                  │
      │                   │ 2. Fetch Health Data             │
      │                   ├─────────────────────────────────→│
      │                   │ 3. Health Data Returned          │
      │                   │←─────────────────────────────────┤
      │                   │                                  │
      │                   │ 4. Fetch Mood Data               │
      │                   ├─────────────────────────────────→│
      │                   │ 5. Mood Data Returned            │
      │                   │←─────────────────────────────────┤
      │                   │                                  │
      │                   │ 6. HealthAnalyticsService       │
      │                   │    - Match data by date          │
      │                   │    - Find patterns               │
      │                   │    - Generate recommendations    │
      │                   │                                  │
      │                   │ 7. Store Results                 │
      │                   ├─────────────────────────────────→│
      │                   │ 8. Analysis Stored               │
      │                   │←─────────────────────────────────┤
      │                   │                                  │
      │  9. Return Results│                                  │
      │ ←──────────────────┤                                  │
      │                   │                                  │
      │ Display Patterns  │                                  │
      │ & Recommendations │                                  │
      │                   │                                  │


DATABASE SCHEMA
══════════════════════════════════════════════════════════════════════

Firestore Collections:

┌─ oauth_tokens/{user_id}_{provider}
│  ├─ user_id: string
│  ├─ provider: "google_fit" | "fitbit" | "samsung" | "withings"
│  ├─ access_token: string (encrypted)
│  ├─ refresh_token: string (encrypted)
│  ├─ expires_at: timestamp
│  └─ scope: string[]
│
├─ health_data/{user_id}/{provider}/{doc_id}
│  ├─ user_id: string
│  ├─ provider: string
│  ├─ data:
│  │  ├─ steps: number
│  │  ├─ sleep_hours: number
│  │  ├─ heart_rate: number
│  │  └─ calories: number
│  ├─ synced_at: timestamp
│  └─ date_range: {start, end}
│
├─ mood_entries/{user_id}/entries/{doc_id}
│  ├─ user_id: string
│  ├─ mood_score: 1-10
│  ├─ date: timestamp
│  └─ notes: string (optional)
│
└─ health_analysis/{user_id}/results/{doc_id}
   ├─ user_id: string
   ├─ analysis_result:
   │  ├─ status: "success" | "insufficient_data"
   │  ├─ patterns: Pattern[]
   │  ├─ recommendations: Recommendation[]
   │  ├─ mood_average: number
   │  ├─ mood_trend: "improving" | "declining" | "stable"
   │  └─ health_summary: {steps, sleep, hr}
   └─ analyzed_at: timestamp
```

---

## Pattern Detection Example

```
DATA INPUT
══════════════════════════════════════════════════════════════════════

Health Data (7 days):
┌─────┬───────┬──────────┬──────────┬──────────┐
│ Day │ Steps │ Sleep(h) │ HR(bpm) │ Calories │
├─────┼───────┼──────────┼──────────┼──────────┤
│ 1   │ 10000 │ 7.5      │ 70       │ 2200     │
│ 2   │ 3000  │ 5.5      │ 85       │ 1800     │
│ 3   │ 9500  │ 7.8      │ 68       │ 2300     │
│ 4   │ 2000  │ 5.0      │ 90       │ 1600     │
│ 5   │ 8000  │ 7.2      │ 72       │ 2100     │
│ 6   │ 1500  │ 6.0      │ 88       │ 1700     │
│ 7   │ 9000  │ 7.5      │ 70       │ 2250     │
└─────┴───────┴──────────┴──────────┴──────────┘

Mood Data (7 days):
┌─────┬────────────┐
│ Day │ Mood/10    │
├─────┼────────────┤
│ 1   │ 8          │
│ 2   │ 4          │
│ 3   │ 9          │
│ 4   │ 3          │
│ 5   │ 7          │
│ 6   │ 3          │
│ 7   │ 8          │
└─────┴────────────┘


ANALYSIS PROCESS
══════════════════════════════════════════════════════════════════════

Step 1: Separate into groups
────────────────────────────
Good Mood Days (≥6):  Days 1, 3, 5, 7
Bad Mood Days (<6):   Days 2, 4, 6

Step 2: Calculate averages
──────────────────────────
                Good Days       Bad Days        Difference
Steps:          9125            2167            421% ⬆️
Sleep:          7.5h            5.5h            36% ⬆️
HR:             70 bpm          88 bpm          26% ⬇️  (lower is better)
Calories:       2213            1700            30% ⬆️

Step 3: Identify patterns
─────────────────────────
✅ ACTIVITY PATTERN FOUND
   Good mood days have 4x more steps (9125 vs 2167)
   CONCLUSION: Exercise → Better Mood
   
✅ SLEEP PATTERN FOUND
   Good mood days have 2 more hours sleep (7.5h vs 5.5h)
   CONCLUSION: Better sleep → Better Mood
   
✅ STRESS PATTERN FOUND
   Bad mood days have elevated HR (88 vs 70 bpm)
   CONCLUSION: Higher stress (↑HR) → Lower Mood

Step 4: Generate recommendations
────────────────────────────────
For Activity Pattern:
  Recommendation: "Increase Daily Activity"
  Action: "Take a 30-minute walk"
  Benefit: "Improved mood and energy"

For Sleep Pattern:
  Recommendation: "Prioritize Sleep Quality"
  Action: "Sleep 7-9 hours per night"
  Benefit: "Better emotional resilience"

For Stress Pattern:
  Recommendation: "Practice Stress Management"
  Action: "Try meditation 5-10 minutes"
  Benefit: "Lower stress and better health"


OUTPUT
══════════════════════════════════════════════════════════════════════

{
  "status": "success",
  "days_analyzed": 7,
  "mood_average": 6.1,
  "mood_trend": "stable",
  "health_summary": {
    "avg_steps": 6229,
    "steps_status": "low",
    "avg_sleep": 6.5,
    "sleep_status": "too_little",
    "avg_hr": 77,
    "hr_status": "elevated"
  },
  "patterns": [
    {
      "title": "🏃 Exercise Boosts Mood",
      "impact": "high"
    },
    {
      "title": "😴 Sleep Quality Impacts Mood",
      "impact": "high"
    },
    {
      "title": "❤️ Heart Rate Indicates Stress",
      "impact": "high"
    }
  ],
  "recommendations": [
    {
      "title": "🏃 Increase Daily Activity",
      "action": "Take a 30-minute walk or do light exercise",
      "benefit": "Improved mood and energy levels"
    },
    {
      "title": "😴 Prioritize Sleep Quality",
      "action": "Try to sleep 7-9 hours each night",
      "benefit": "Improved emotional resilience"
    },
    {
      "title": "🧘 Practice Stress Management",
      "action": "Try 5-10 minutes of meditation daily",
      "benefit": "Better stress management"
    }
  ]
}
```

---

## Summary

```
🎯 THE COMPLETE JOURNEY:

User Flow:
  1. Connect Health Device (OAuth)
      ↓
  2. Sync Real Health Data
      ↓
  3. Add Mood Entries
      ↓
  4. Click Analyze
      ↓
  5. View Personalized Patterns & Recommendations
      ↓
  6. Make Lifestyle Changes
      ↓
  7. See Improved Mood & Wellness

Backend Processing:
  1. Receive Analyze Request
  2. Fetch health_data from Firestore
  3. Fetch mood_entries from Firestore
  4. Match by date
  5. Run HealthAnalyticsService
  6. Detect patterns
  7. Generate recommendations
  8. Store results
  9. Return to frontend

Result:
  ✅ Real analysis
  ✅ Personalized insights
  ✅ Actionable recommendations
  ✅ Scientific approach
  ✅ User value delivered
```

**The system is now honest, working, and delivering real value.** ✨
