# Health Data Sync - Troubleshooting Guide

**Status:** No data showing after sync  
**Date:** 2025-10-20  
**Issue:** User successfully connects OAuth but no health data displays

---

## 🔍 Diagnosis Steps

### Step 1: Check Backend Response

**Backend logs should show:**
```
🔵 HEALTH DATA SYNC STARTED for GOOGLE_FIT (user: xxx)
✅ Real health data FETCHED from GOOGLE_FIT: ['steps', 'heart_rate', 'sleep', ...]
✅ Real health data STORED in Firestore
```

**If you see instead:**
```
✅ Real health data FETCHED from GOOGLE_FIT: no data
```

This means the API returned empty data. This is the actual problem!

### Step 2: Check What Google Fit Returns

The backend calls Google Fit API with these endpoints:

1. **Steps:** `POST /fitness/v1/users/me/dataset:aggregate`
2. **Heart Rate:** `GET /fitness/v1/users/me/dataSources/derived:com.google.heart_rate.bpm:.../datasets/{start}-{end}`
3. **Sleep:** `GET /fitness/v1/users/me/sessions`
4. **Calories:** `POST /fitness/v1/users/me/dataset:aggregate`

**If Google Fit returns 200 but empty data**, it means:
- User has NO data recorded in the last 7 days
- Device not connected to user's Google account
- Permission scopes not granted properly

---

## 🛠️ Why Is Data Empty?

### Reason 1: No Data in Google Fit
**Symptoms:**
- OAuth token is valid (connection works)
- But no data recorded in the last 7 days

**Solution:**
1. Open Google Fit app on your phone
2. Check if any activity is recorded
3. Sync your device first
4. Wait for Google Fit to record data
5. Try syncing again after 15 minutes

### Reason 2: Device Not Connected
**Symptoms:**
- Google Fit app shows "No devices"
- OAuth works but no data

**Solution:**
1. Open Google Fit app
2. Go to Settings → Devices
3. Connect your smartwatch/fitness tracker
4. Grant permissions
5. Let it sync for 5 minutes
6. Try Lugn & Trygg sync again

### Reason 3: OAuth Permissions Too Narrow
**Symptoms:**
- OAuth popup doesn't show all requested scopes
- User didn't grant all permissions

**Solution:**
1. Disconnect from Lugn & Trygg
2. Click Connect again
3. **Important:** Grant ALL requested permissions
   - ✅ Activity data
   - ✅ Heart rate
   - ✅ Sleep data
   - ✅ Body measurements
4. Retry sync

### Reason 4: First Time Sync Takes Longer
**Symptoms:**
- Sync appears stuck or returns no data
- Happens first time only

**Solution:**
1. Wait 1-2 minutes (Google Fit API is slow)
2. If still no data, try again
3. Check Google Fit app directly to see if data exists

### Reason 5: API Rate Limiting
**Symptoms:**
- Sync works sometimes, fails other times
- Error about rate limits

**Solution:**
1. Wait 5 minutes
2. Try again
3. Contact Google if persistent

---

## 📊 How to Test Manually

### Test 1: Check if Google Fit Has Data

1. Open Google Fit app on your phone
2. Look at today's stats
3. You should see:
   - Steps taken
   - Heart rate measurements
   - Sleep from last night
   - Calories burned

If you see data there but not in Lugn & Trygg, the problem is the API call or token.

### Test 2: Verify the OAuth Token

```bash
# Backend test - check if token is stored
curl -X GET "http://localhost:5001/api/integration/oauth/google_fit/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return:
{
  "connected": true,
  "provider": "google_fit",
  "scope": "https://www.googleapis.com/auth/fitness.activity.read ...",
  "obtained_at": "2025-10-20T20:33:48",
  "expires_at": "2025-10-20T21:33:48",
  "is_expired": false
}
```

If `expires_at` is in the past, token expired. Reconnect.

### Test 3: Manually Call Google Fit API

If you have `curl` and a valid access token:

```bash
# Test steps endpoint
curl -X POST "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "aggregateBy": [{
      "dataTypeName": "com.google.step_count.delta"
    }],
    "bucketByTime": {"durationMillis": 86400000},
    "startTimeMillis": START_TIME_MS,
    "endTimeMillis": END_TIME_MS
  }'

# Response should contain your step data in buckets
```

---

## 🔐 Backend Debug Logging

### Enable Detailed Logging

Add this to `Backend/main.py` before app.run():

```python
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
```

Then look for these debug messages:

```
🔵 Fetching real health data from GOOGLE_FIT API (days_back=7)
🔵 Making request to: https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate
🔵 Headers: Authorization: Bearer ya29.xxxxx
🔵 Response status: 200
🔵 Response data: {buckets: [...]}
✅ Extracted steps: 8247
✅ Extracted HR: 72.5
✅ Extracted sleep: 7.5 hours
```

### Check Response Status

```python
# In health_data_service.py, after each request add:

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
```

---

## 🔗 API Endpoints to Test

### 1. Check Status
```bash
GET /api/integration/oauth/google_fit/status
Authorization: Bearer JWT
```

Expected response:
```json
{
  "connected": true,
  "provider": "google_fit",
  "expires_at": "2025-10-20T21:33:48"
}
```

### 2. Sync Data
```bash
POST /api/integration/health/sync/google_fit
Authorization: Bearer JWT
Content-Type: application/json

{
  "days": 7
}
```

Expected response:
```json
{
  "success": true,
  "provider": "google_fit",
  "data": {
    "steps": 8247,
    "heart_rate": 72.5,
    "sleep_hours": 7.5,
    "calories": 2150
  }
}
```

If `data` is empty `{}`, Google Fit returned no data.

---

## 💾 Firestore Verification

### Check if Data Was Stored

1. Firebase Console → Firestore
2. Navigate to: `health_data` → `{user_id}` → `google_fit`
3. Should have a document like:
```json
{
  "user_id": "xxx",
  "provider": "google_fit",
  "data": {
    "steps": 8247,
    "heart_rate": 72.5,
    "sleep_hours": 7.5
  },
  "synced_at": "2025-10-20T22:30:00",
  "date_range": {
    "start": "2025-10-13T22:30:00",
    "end": "2025-10-20T22:30:00"
  }
}
```

If `data` field is empty, Google Fit API returned no data.

---

## 🚀 Solutions by Symptom

### Symptom: "Connected" but no data after sync

**Check list:**
1. [ ] Is your phone's Google Fit app synced and showing data?
2. [ ] Did you grant ALL permissions when connecting?
3. [ ] Is the token expired? (Check Firestore oauth_tokens)
4. [ ] Have you recorded activity in the last 7 days?
5. [ ] Is the device paired with your Google account?

**Actions:**
- Try sync again (sometimes takes 30 sec)
- Disconnect and reconnect
- Clear app data and try again
- Check Google Fit on phone - if no data there, sync phone first

### Symptom: Error message appears

**If "Failed to fetch data":**
- Check backend logs for actual error
- Verify JWT token hasn't expired
- Check if Google Fit API is down

**If "Invalid token":**
- Disconnect and reconnect
- Token may have expired
- Check Firestore for token expiry

### Symptom: Sync takes forever

- Google Fit API is slow (normal, ~1-2 min)
- Don't close the browser
- Wait for response

---

## 🎯 Expected Behavior

**When it works:**

1. User clicks "Sync Now"
2. Button shows "⏳ Syncing..."
3. Backend calls Google Fit API
4. Backend gets back real data (steps, HR, sleep, etc)
5. Backend stores in Firestore
6. Frontend displays data
7. Button shows "✅ Synced: steps 8247, HR 72, sleep 7.5h"

**When data is empty:**

1. User clicks "Sync Now"
2. Button shows "⏳ Syncing..."
3. Backend calls Google Fit API
4. Google Fit returns `{"bucket": []}` (no data)
5. Backend extracts 0 from empty response
6. Frontend shows error: "No health data found for google_fit"
7. Button goes back to "🔄 Sync Now"

---

## 📞 Escalation Path

If none of these work:

1. **Check logs:** Backend terminal output
2. **Check Firestore:** Is token stored? Is health data stored?
3. **Check Google:** Is Google Fit API down?
4. **Check Device:** Is smartwatch synced to phone?
5. **Check Permissions:** Did user grant access?

**Contact Support if:**
- Logs show API errors (5xx status codes)
- Google Fit account is locked
- API credentials are wrong

---

## 📝 Common Solutions

| Problem | Solution |
|---------|----------|
| Empty data | Check if phone has recorded data first |
| Token expired | Disconnect and connect again |
| Permission denied | Reconnect and grant all scopes |
| Slow sync | Wait 1-2 minutes, normal for Google |
| Sync keeps failing | Check backend logs for errors |

---

**Remember:** If Google Fit app on your phone shows no data, Lugn & Trygg won't have data either. Always sync your device first!

