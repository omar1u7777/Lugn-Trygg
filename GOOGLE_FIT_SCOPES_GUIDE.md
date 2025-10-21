# 🔐 GOOGLE FIT - ADD OAUTH SCOPES

**Current Status:** ✅ Redirect URI Added | ⚠️ Scopes Needed  
**Time Required:** 2-3 minutes  
**Date:** October 20, 2025

---

## 📋 CURRENT SETUP

✅ **OAuth Client Created**  
✅ **Client ID:** `619308821427-tf09ut7iefgpev7dk1ge5mvt3griuu4s.apps.googleusercontent.com`  
✅ **Redirect URI Added:** `http://localhost:5001/api/integration/oauth/google_fit/callback`  
⚠️ **Scopes:** Need to add Fitness API scopes

---

## 🎯 STEP-BY-STEP: ADD SCOPES (2 MINUTES)

### Step 1: Go to OAuth Consent Screen
```
URL: https://console.cloud.google.com/apis/credentials/consent
```

### Step 2: Edit App Configuration
1. Click **"EDIT APP"** button (top of page)
2. You'll see tabs: App information, Scopes, Test users, Summary

### Step 3: Navigate to Scopes
1. Click **"SCOPES"** tab (or "CONTINUE" to get to it)
2. Click **"ADD OR REMOVE SCOPES"** button

### Step 4: Add Fitness API Scopes
In the filter/search box, type: **"fitness"**

Then select these **4 scopes**:

| Scope | Description | Required |
|-------|-------------|----------|
| `.../auth/fitness.activity.read` | See your physical activity data | ✅ YES |
| `.../auth/fitness.body.read` | See info about your body measurements | ✅ YES |
| `.../auth/fitness.heart_rate.read` | See your heart rate data | ✅ YES |
| `.../auth/fitness.sleep.read` | See your sleep data | ✅ YES |

**Full scope URLs:**
```
https://www.googleapis.com/auth/fitness.activity.read
https://www.googleapis.com/auth/fitness.body.read
https://www.googleapis.com/auth/fitness.heart_rate.read
https://www.googleapis.com/auth/fitness.sleep.read
```

### Step 5: Save Changes
1. Click **"UPDATE"** (bottom of scope modal)
2. Click **"SAVE AND CONTINUE"** (bottom of page)
3. Continue through remaining tabs (Test users, Summary)
4. Click **"BACK TO DASHBOARD"**

---

## 👤 ADD TEST USER (OPTIONAL BUT RECOMMENDED)

While still in OAuth Consent Screen:

1. Go to **"Test users"** tab
2. Click **"ADD USERS"**
3. Enter your Gmail address (e.g., `your-email@gmail.com`)
4. Click **"SAVE"**

**Why?** Your app is in "Testing" mode, so only test users can authorize it.

---

## 🔑 GET CLIENT SECRET

Since the current secret is masked (`****btp3`), create a new one:

### Method 1: Add New Secret (Recommended)
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth client: **"Web client (auto created by Google Service)"**
3. Under **"Client secrets"** section
4. Click **"ADD SECRET"**
5. Copy the new secret (looks like: `GOCSPX-abc123xyz...`)
6. Save it securely!

### Method 2: Download JSON (Alternative)
1. On the OAuth client page
2. Click **"DOWNLOAD JSON"** (top right)
3. Open the downloaded file
4. Find `"client_secret": "GOCSPX-..."`
5. Copy that value

---

## 📝 UPDATE BACKEND CONFIGURATION

### Update Backend/.env

Open: `c:\Projekt\Lugn-Trygg-main_klar\Backend\.env`

Replace this line:
```bash
GOOGLE_FIT_CLIENT_SECRET=GOCSPX-W_____btp3
```

With your actual secret:
```bash
GOOGLE_FIT_CLIENT_SECRET=GOCSPX-<your-actual-secret-here>
```

**Example:**
```bash
GOOGLE_FIT_CLIENT_SECRET=GOCSPX-AbCd1234EfGh5678IjKl
```

---

## ✅ VERIFICATION CHECKLIST

After completing the steps above, verify:

- [ ] OAuth Consent Screen configured
- [ ] 4 Fitness API scopes added
- [ ] Test user added (your email)
- [ ] New client secret created
- [ ] Client secret added to Backend/.env
- [ ] .env file saved

---

## 🚀 TEST THE OAUTH FLOW

### Quick Test (PowerShell)

```powershell
# 1. Start Backend
cd c:\Projekt\Lugn-Trygg-main_klar\Backend
python main.py

# Should see:
# "Blueprint integration_bp registrerad under /api/integration"
# "Blueprint oauth_bp registrerad under /api/oauth" (or similar)
```

### Test OAuth Authorization Endpoint

```powershell
# 2. In new PowerShell window, test OAuth URL generation
$env:GOOGLE_FIT_CLIENT_ID = "619308821427-tf09ut7iefgpev7dk1ge5mvt3griuu4s.apps.googleusercontent.com"

# Import oauth_service to test (from Python)
# Or just check if backend starts without errors
```

### Test in Browser

1. **Start Frontend:**
   ```powershell
   cd c:\Projekt\Lugn-Trygg-main_klar\frontend
   npm start
   ```

2. **Navigate to OAuth page:**
   ```
   http://localhost:3000/integrations/oauth
   ```

3. **Click "Connect" on Google Fit card**

4. **Expected Flow:**
   - Popup window opens
   - Google login page appears
   - Shows: "Lugn & Trygg wants to access your Google Account"
   - Lists the 4 permissions (activity, heart rate, sleep, body)
   - Click "Allow"
   - Popup closes
   - Status changes to "Connected" ✅

---

## 📊 WHAT HAPPENS AFTER CONNECTION

### 1. Token Storage (Firestore)
```json
Collection: "oauth_tokens"
Document ID: "<user_id>_google_fit"
{
  "user_id": "abc123",
  "provider": "google_fit",
  "access_token": "ya29.a0AfB_...",
  "refresh_token": "1//0gXx...",
  "token_type": "Bearer",
  "expires_at": 1729469200,
  "scopes": [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.heart_rate.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
    "https://www.googleapis.com/auth/fitness.body.read"
  ],
  "created_at": 1729465600
}
```

### 2. Health Data Sync
Click "Sync Now" button → Backend calls Google Fit API:

```json
Collection: "health_data"
Document ID: "auto-generated"
{
  "user_id": "abc123",
  "provider": "google_fit",
  "date": "2025-10-20",
  "metrics": {
    "steps": 8543,
    "heart_rate_avg": 72,
    "heart_rate_max": 145,
    "sleep_hours": 7.5,
    "calories": 2134,
    "distance_km": 6.2
  },
  "raw_data": { ... },
  "synced_at": 1729465800,
  "sync_status": "success"
}
```

---

## 🔐 SCOPE DETAILS

### What Each Scope Allows

**fitness.activity.read:**
- Steps count
- Distance traveled
- Calories burned
- Active minutes
- Exercise sessions

**fitness.heart_rate.read:**
- Heart rate (BPM)
- Resting heart rate
- Heart rate zones
- Heart rate during activities

**fitness.sleep.read:**
- Sleep duration
- Sleep stages (light, deep, REM)
- Sleep quality
- Sleep schedule

**fitness.body.read:**
- Weight
- Height
- Body fat percentage
- BMI
- Body measurements

---

## ⚠️ COMMON ISSUES & FIXES

### Issue 1: "Access blocked: Authorization Error"
**Cause:** Scopes not added to OAuth Consent Screen  
**Fix:** Complete Step 4 above - add all 4 scopes

### Issue 2: "redirect_uri_mismatch"
**Cause:** Redirect URI doesn't match exactly  
**Current URI:** `http://localhost:5001/api/integration/oauth/google_fit/callback`  
**Fix:** Already correct! ✅

### Issue 3: "invalid_client"
**Cause:** Client secret not updated in .env  
**Fix:** Add new client secret to Backend/.env

### Issue 4: "This app isn't verified"
**This is NORMAL for testing!**
- Click "Advanced"
- Click "Go to Lugn & Trygg (unsafe)"
- This is expected for apps in testing mode
- For production: Submit for Google verification

---

## 🎯 EXPECTED RESULTS

### Success Indicators

**Backend Console:**
```
[OAuth] Authorization URL generated for google_fit
[OAuth] State parameter: abc123xyz...
[OAuth] Redirect URI: http://localhost:5001/api/integration/oauth/google_fit/callback
```

**After User Authorizes:**
```
[OAuth] Callback received for google_fit
[OAuth] Code: 4/0AY0e-...
[OAuth] Exchanging code for token...
[OAuth] Token received successfully
[OAuth] Token saved to Firestore
[OAuth] Access token expires in: 3600 seconds
```

**After Sync:**
```
[Health] Syncing data from google_fit
[Health] Fetching activity data...
[Health] Found 8543 steps
[Health] Fetching heart rate data...
[Health] Average heart rate: 72 bpm
[Health] Data saved to Firestore
```

---

## 📱 PRODUCTION CONSIDERATIONS

### For Production Deployment:

1. **Change OAuth Consent Screen to "In Production"**
2. **Update Redirect URIs:**
   ```
   https://lugn-trygg-53d75.firebaseapp.com/api/integration/oauth/google_fit/callback
   ```
3. **Submit for Google Verification:**
   - OAuth consent screen review
   - Privacy policy URL
   - Terms of service URL
   - App logo
   - Takes 1-2 weeks
4. **Update Backend/.env:**
   ```bash
   GOOGLE_FIT_REDIRECT_URI=https://lugn-trygg-53d75.firebaseapp.com/api/integration/oauth/google_fit/callback
   ```

---

## 📚 RESOURCES

### Documentation
- Google Fit REST API: https://developers.google.com/fit/rest
- OAuth 2.0: https://developers.google.com/identity/protocols/oauth2
- Scopes: https://developers.google.com/fit/rest/v1/authorization

### Your Files
- **Setup Guide:** `GOOGLE_FIT_SETUP_COMPLETE.md`
- **OAuth Implementation:** `OAUTH_SETUP_GUIDE.md`
- **Implementation Summary:** `OAUTH_IMPLEMENTATION_SUMMARY.md`
- **Backend OAuth Service:** `Backend/src/services/oauth_service.py`
- **Frontend OAuth Service:** `frontend/src/services/oauthHealthService.ts`

---

## ✅ COMPLETION STATUS

**Current Progress:**
- [x] Google Cloud project created
- [x] Fitness API enabled
- [x] OAuth client created
- [x] Client ID configured
- [x] Redirect URI added
- [ ] **Scopes added** ← DO THIS NOW (2 minutes)
- [ ] **Client secret updated** ← DO THIS NOW (1 minute)
- [ ] Test OAuth flow
- [ ] Verify data sync

**After completing the 2 checkboxes above:**
- ✅ Full Google Fit integration working
- ✅ Real health data syncing
- ✅ OAuth flow complete
- ✅ Production-ready (for testing mode)

---

**Created:** October 20, 2025  
**Estimated Completion Time:** 3 minutes  
**Difficulty:** Very Easy  
**Status:** 🟡 2 steps remaining → 🟢 Complete!

---

## 🚀 QUICK START SUMMARY

```
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Click "EDIT APP"
3. Click "SCOPES" → "ADD OR REMOVE SCOPES"
4. Search "fitness" → Select 4 scopes ✅
5. Click "UPDATE" → "SAVE AND CONTINUE"
6. Go to: https://console.cloud.google.com/apis/credentials
7. Click OAuth client → "ADD SECRET"
8. Copy secret → Paste in Backend/.env
9. Save .env
10. Test! 🎉
```

**Time:** 3 minutes  
**Result:** Real Google Fit data in your app! 🏃‍♂️💓😴
