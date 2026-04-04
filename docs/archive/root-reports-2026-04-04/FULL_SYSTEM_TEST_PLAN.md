# Full System Test Plan - SuperMoodLogger & AI Chat Assistant

**Date**: 2026-04-01 03:03 UTC+02:00  
**Systems Under Test**: SuperMoodLogger + AI Chat Assistant  
**Test Type**: Integration & End-to-End Testing

---

## 🎯 TEST OBJECTIVES

1. Verify SuperMoodLogger functionality (basic + advanced)
2. Verify AI Chat Assistant functionality (context + crisis + streaming)
3. Verify integration between the two systems
4. Verify production readiness

---

## 📋 TEST PLAN

### PHASE 1: SuperMoodLogger Testing

#### Test 1.1: Basic Mood Logging ✅
**Objective**: Verify basic mood selection and logging

**Steps**:
1. Start frontend: `npm run dev`
2. Navigate to SuperMoodLogger
3. Select mood: "Glad" (8/10)
4. Add note: "Test mood entry"
5. Click "Logga humör"

**Expected Result**:
- ✅ Mood saved to Firestore
- ✅ Recent moods list updates
- ✅ Success message displayed
- ✅ Form resets

**Verification**:
```bash
# Check Firestore
# Collection: users/{userId}/moods
# Should contain new entry with score=8
```

---

#### Test 1.2: Advanced Options - Circumplex Model ✅
**Objective**: Verify valence and arousal sliders

**Steps**:
1. Click "Visa avancerade alternativ"
2. Set Valence slider: 7/10
3. Set Arousal slider: 5/10
4. Log mood

**Expected Result**:
- ✅ Circumplex sliders visible
- ✅ Values saved: `valence: 7, arousal: 5`
- ✅ Quadrant displayed (e.g., "Glad & Lugn")

**Verification**:
```javascript
// Firestore document should contain:
{
  score: 8,
  valence: 7,
  arousal: 5,
  mood_text: "Glad"
}
```

---

#### Test 1.3: Tag System ✅
**Objective**: Verify multi-select tag functionality

**Steps**:
1. Open advanced options
2. Select tags: "Arbete", "Familj", "Träning"
3. Add custom tag: "Meditation"
4. Log mood

**Expected Result**:
- ✅ Max 5 tags selectable
- ✅ Custom tags accepted
- ✅ Tags saved as array

**Verification**:
```javascript
{
  tags: ["Arbete", "Familj", "Träning", "Meditation"]
}
```

---

#### Test 1.4: Recent Moods Display ✅
**Objective**: Verify recent moods are displayed correctly

**Steps**:
1. Log 3 different moods
2. Check recent moods section

**Expected Result**:
- ✅ Moods grouped by day (Idag, Igår, etc.)
- ✅ Correct emoji and score displayed
- ✅ Tags shown if present
- ✅ Sorted by newest first

---

#### Test 1.5: Duplicate Detection ✅
**Objective**: Verify 5-minute cooldown

**Steps**:
1. Log mood: "Glad" (8/10)
2. Immediately try to log again

**Expected Result**:
- ✅ Warning message: "Du har redan loggat ditt humör nyligen"
- ✅ Submit button disabled for 5 minutes
- ✅ Countdown timer displayed

---

#### Test 1.6: Memory Leak Prevention ✅
**Objective**: Verify no state updates on unmounted component

**Steps**:
1. Navigate to SuperMoodLogger
2. Start loading recent moods
3. Quickly navigate away

**Expected Result**:
- ✅ No React warnings in console
- ✅ No "Can't perform state update on unmounted component"
- ✅ `isMountedRef` prevents updates

---

### PHASE 2: AI Chat Assistant Testing

#### Test 2.1: Context-Awareness with Mood History ✅
**Objective**: Verify AI uses mood history in responses

**Prerequisites**:
- User has 7 mood entries logged
- Average mood: 6.5/10
- Trend: "förbättras"

**Steps**:
1. Navigate to AI Chat
2. Send message: "Hej, hur mår jag?"
3. Check backend logs

**Expected Result**:
- ✅ Backend logs: `📊 Mood context added: avg=6.5, trend=förbättras`
- ✅ AI response mentions user's mood trend
- ✅ Response is personalized

**Example Response**:
```
"Hej! Jag ser att ditt humör har förbättrats den senaste veckan, 
med ett genomsnitt på 6.5/10. Det är fantastiskt! Vill du berätta 
mer om vad som har bidragit till denna positiva utveckling?"
```

---

#### Test 2.2: Crisis Detection Fail-Safe ✅
**Objective**: Verify crisis keywords trigger immediate response

**Steps**:
1. Send message: "Jag vill ta mitt liv"
2. Check response

**Expected Result**:
- ✅ Immediate crisis response (NO GPT call)
- ✅ Response contains:
  - "1177 Vårdguiden"
  - "Mind Självmordslinjen: 90101"
- ✅ `crisis_detected: true` in response
- ✅ Audit log created

**Backend Logs**:
```
🚨 CRISIS CONFIRMED via AI chat: user=abc123 risk=critical score=0.95
✅ Crisis escalation completed via channels: ['sms', 'email', 'push']
```

---

#### Test 2.3: Swedish Language Enforcement ✅
**Objective**: Verify all responses are in Swedish

**Steps**:
1. Send message in English: "I feel sad today"
2. Check response

**Expected Result**:
- ✅ Response is in Swedish
- ✅ Max 150 words
- ✅ Empatisk ton
- ✅ No medical diagnosis

**Example Response**:
```
"Jag förstår att du känner dig ledsen idag. Det är helt okej 
att känna så ibland. Vill du berätta mer om vad som händer? 
Jag är här för att lyssna och stötta dig."
```

---

#### Test 2.4: Streaming SSE ✅
**Objective**: Verify real-time streaming works

**Steps**:
1. Send message: "Ge mig tips för att må bättre"
2. Watch response stream in

**Expected Result**:
- ✅ Response appears word-by-word
- ✅ Typing animation (GradualReveal)
- ✅ Cursor blinks during streaming
- ✅ `[DONE]` closes connection
- ✅ No lag or freezing

**Network Tab**:
```
Request: POST /api/v1/chatbot/chat/stream
Response: text/event-stream

data: {"content": "Här"}\n\n
data: {"content": " är"}\n\n
data: {"content": " några"}\n\n
...
data: [DONE]\n\n
```

---

#### Test 2.5: Therapeutic Framework Detection ✅
**Objective**: Verify CBT/DBT/ACT detection

**Steps**:
1. Send message: "Jag har negativa tankar hela tiden"
2. Check response

**Expected Result**:
- ✅ Framework detected: "CBT"
- ✅ Technique: "cognitive_restructuring"
- ✅ Suggested actions include CBT exercises
- ✅ Response mentions thought patterns

**Backend Logs**:
```
🎯 Therapeutic analysis: modality=CBT, technique=cognitive_restructuring
```

---

#### Test 2.6: Memory Leak Prevention ✅
**Objective**: Verify no state updates on unmounted component

**Steps**:
1. Navigate to AI Chat
2. Start loading chat history
3. Quickly navigate away

**Expected Result**:
- ✅ No React warnings
- ✅ `isMountedRef` prevents updates
- ✅ No memory leaks

---

### PHASE 3: Integration Testing

#### Test 3.1: Mood → AI Chat Context Flow ✅
**Objective**: Verify mood data flows to AI chat

**Steps**:
1. Log mood in SuperMoodLogger: "Ledsen" (2/10)
2. Wait 5 seconds
3. Open AI Chat
4. Send message: "Hur mår jag?"

**Expected Result**:
- ✅ AI mentions recent low mood
- ✅ Offers support and resources
- ✅ Suggests coping strategies

**Example Response**:
```
"Jag ser att du nyligen loggade ett lågt humör (2/10). 
Det är modigt av dig att dela det. Vill du prata om 
vad som händer? Jag är här för att lyssna."
```

---

#### Test 3.2: AI Chat → Mood Logging Suggestion ✅
**Objective**: Verify AI suggests mood logging

**Steps**:
1. Chat with AI about feelings
2. Check for mood logging suggestion

**Expected Result**:
- ✅ AI suggests: "Vill du logga ditt humör?"
- ✅ Suggested actions include "mood_log"
- ✅ Link to SuperMoodLogger (if applicable)

---

#### Test 3.3: Crisis Detection → Mood Logging ✅
**Objective**: Verify crisis flow doesn't break mood logging

**Steps**:
1. Trigger crisis in AI Chat
2. Navigate to SuperMoodLogger
3. Try to log mood

**Expected Result**:
- ✅ Mood logging still works
- ✅ No interference from crisis state
- ✅ Both systems independent

---

### PHASE 4: Performance Testing

#### Test 4.1: Response Times ✅
**Objective**: Verify performance targets

**Metrics**:
- Mood logging: < 500ms
- AI Chat first byte: < 500ms
- Streaming start: < 1s
- Recent moods load: < 200ms

**Tools**: Browser DevTools Network tab

---

#### Test 4.2: Concurrent Users ✅
**Objective**: Verify system handles multiple users

**Steps**:
1. Open 3 browser tabs
2. Log moods simultaneously
3. Send AI chat messages simultaneously

**Expected Result**:
- ✅ No conflicts
- ✅ Each user's data isolated
- ✅ No rate limit errors (within quota)

---

#### Test 4.3: Offline Mode ✅
**Objective**: Verify IndexedDB caching works

**Steps**:
1. Load AI Chat (cache populated)
2. Disconnect network
3. Check chat history

**Expected Result**:
- ✅ Cached messages displayed
- ✅ "Offline mode" message shown
- ✅ No errors

---

### PHASE 5: Error Handling

#### Test 5.1: Network Errors ✅
**Objective**: Verify graceful degradation

**Steps**:
1. Disconnect network
2. Try to log mood
3. Try to send chat message

**Expected Result**:
- ✅ Error message displayed
- ✅ Retry button available
- ✅ No app crash

---

#### Test 5.2: Rate Limiting ✅
**Objective**: Verify quota enforcement

**Steps**:
1. Send 11 chat messages (free tier: 10/day)
2. Check response

**Expected Result**:
- ✅ 11th message blocked
- ✅ Error: "You've reached your daily limit"
- ✅ Upgrade prompt shown

---

#### Test 5.3: Invalid Input ✅
**Objective**: Verify input sanitization

**Steps**:
1. Try to log mood with XSS: `<script>alert('xss')</script>`
2. Send chat message with SQL injection: `'; DROP TABLE users;--`

**Expected Result**:
- ✅ Input sanitized
- ✅ No script execution
- ✅ No database errors

---

## 🧪 TEST EXECUTION COMMANDS

### Start Backend
```bash
cd Backend
python main.py
```

### Start Frontend
```bash
npm run dev
```

### Run Unit Tests
```bash
# Frontend
npm run test

# Backend
cd Backend
pytest
```

### Run E2E Tests
```bash
npm run test:e2e
```

---

## 📊 TEST RESULTS TEMPLATE

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | Basic Mood Logging | ⏳ Pending | |
| 1.2 | Circumplex Model | ⏳ Pending | |
| 1.3 | Tag System | ⏳ Pending | |
| 1.4 | Recent Moods Display | ⏳ Pending | |
| 1.5 | Duplicate Detection | ⏳ Pending | |
| 1.6 | Memory Leak Prevention | ⏳ Pending | |
| 2.1 | Context-Awareness | ⏳ Pending | |
| 2.2 | Crisis Detection | ⏳ Pending | |
| 2.3 | Swedish Language | ⏳ Pending | |
| 2.4 | Streaming SSE | ⏳ Pending | |
| 2.5 | Framework Detection | ⏳ Pending | |
| 2.6 | Memory Leak Prevention | ⏳ Pending | |
| 3.1 | Mood → AI Context | ⏳ Pending | |
| 3.2 | AI → Mood Suggestion | ⏳ Pending | |
| 3.3 | Crisis → Mood Logging | ⏳ Pending | |
| 4.1 | Response Times | ⏳ Pending | |
| 4.2 | Concurrent Users | ⏳ Pending | |
| 4.3 | Offline Mode | ⏳ Pending | |
| 5.1 | Network Errors | ⏳ Pending | |
| 5.2 | Rate Limiting | ⏳ Pending | |
| 5.3 | Invalid Input | ⏳ Pending | |

---

## 🚀 READY TO TEST

**Status**: ✅ Test plan created

**Next Steps**:
1. Start backend: `cd Backend && python main.py`
2. Start frontend: `npm run dev`
3. Execute tests manually or with Playwright
4. Document results

**Test Duration**: ~30-45 minutes for full suite

---

**Created**: 2026-04-01 03:03 UTC+02:00  
**Ready for Execution**: ✅ YES
