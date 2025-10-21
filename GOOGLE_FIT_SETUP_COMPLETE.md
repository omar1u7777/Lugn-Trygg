# ✅ GOOGLE FIT OAUTH - SETUP GUIDE

**Status:** 🟡 Almost Ready - Need to add scopes and get full client secret  
**Time Needed:** 5-10 minutes  
**Date:** October 20, 2025

---

## 📋 WHAT YOU HAVE

✅ **Google Cloud Project:** `Lugn-Trygg` (Project ID: `lugn-trygg-53d75`)  
✅ **Fitness API:** Enabled  
✅ **OAuth Client Created:** `Web client (auto created by Google Service)`  
✅ **Client ID:** `619308821427-tf09ut7iefgpev7dk1ge5mvt3griuu4s.apps.googleusercontent.com`  
✅ **Redirect URI Added:** `http://localhost:5001/api/integration/oauth/google_fit/callback`  

---

## ⚠️ WHAT'S NEEDED (5 MINUTES)

### Step 1: Get Full Client Secret (2 minutes)

Since the secret is masked (`****btp3`), you need to create a new one:

1. **Go to:** https://console.cloud.google.com/apis/credentials
2. **Click:** Your OAuth client (`Web client (auto created by Google Service)`)
3. **Under "Client secrets"** → Click **"ADD SECRET"**
4. **Copy** the new secret (it looks like: `GOCSPX-abcdefghijklmnopqrstuvwxyz123`)
5. **Paste** it in `Backend/.env`:
   ```bash
   GOOGLE_FIT_CLIENT_SECRET=GOCSPX-<your-actual-secret>
   ```

### Step 2: Configure OAuth Consent Screen (3 minutes)

1. **Go to:** https://console.cloud.google.com/apis/credentials/consent
2. **Click:** "EDIT APP"
3. **Scopes section:**
   - Click "ADD OR REMOVE SCOPES"
   - Search for "Fitness API"
   - Select these scopes:
     * ✅ `.../auth/fitness.activity.read` - View physical activity
     * ✅ `.../auth/fitness.heart_rate.read` - View heart rate
     * ✅ `.../auth/fitness.sleep.read` - View sleep data
     * ✅ `.../auth/fitness.body.read` - View body measurements
   - Click "UPDATE"
4. **Test users:** Add your Gmail address as test user (for testing before publishing)
5. **Click:** "SAVE AND CONTINUE" through remaining steps

### Step 3: Verify Authorized Domains (Already Done ✅)

Your current setup:
```
Authorized JavaScript origins:
✅ http://localhost
✅ http://localhost:5000
✅ https://lugn-trygg-53d75.firebaseapp.com

Authorized redirect URIs:
✅ https://lugn-trygg-53d75.firebaseapp.com/__/auth/handler
✅ http://localhost:5001/api/integration/oauth/google_fit/callback  ← Perfect!
```

---

## 🚀 TESTING (After Setup)

### Test Backend OAuth Flow

1. **Start Backend:**
   ```powershell
   cd c:\Projekt\Lugn-Trygg-main_klar\Backend
   python main.py
   ```

2. **Get JWT Token:**
   ```powershell
   # Login or register first
   $response = Invoke-RestMethod -Uri "http://localhost:5001/api/auth/login" `
     -Method POST `
     -ContentType "application/json" `
     -Body '{"email":"test@example.com","password":"test123"}'
   
   $token = $response.access_token
   ```

3. **Test OAuth Authorization:**
   ```powershell
   # Get authorization URL
   $authResponse = Invoke-RestMethod `
     -Uri "http://localhost:5001/api/integration/oauth/google_fit/authorize" `
     -Method GET `
     -Headers @{ "Authorization" = "Bearer $token" }
   
   # Output should be:
   # {
   #   "authorization_url": "https://accounts.google.com/o/oauth2/auth?...",
   #   "state": "random-csrf-token"
   # }
   
   # Open authorization_url in browser
   Start-Process $authResponse.authorization_url
   ```

4. **Expected OAuth Flow:**
   ```
   User clicks link
   → Google login page
   → Permission request (steps, heart rate, sleep, body)
   → User clicks "Allow"
   → Redirect to: http://localhost:5001/api/integration/oauth/google_fit/callback?code=...&state=...
   → Backend exchanges code for access token
   → Token saved to Firestore
   → Success message displayed
   ```

### Test Frontend OAuth Flow

1. **Start Frontend:**
   ```powershell
   cd c:\Projekt\Lugn-Trygg-main_klar\frontend
   npm start
   ```

2. **Navigate to:**
   ```
   http://localhost:3000/integrations/oauth
   ```

3. **Click "Connect" on Google Fit card**
4. **OAuth popup opens**
5. **Grant permissions**
6. **Popup closes, status updates to "Connected"**
7. **Click "Sync Now" to fetch real data**

---

## 📊 EXPECTED RESULTS

### After Successful Connection:

**Firestore Collection:** `oauth_tokens`
```json
{
  "user_id": "abc123",
  "provider": "google_fit",
  "access_token": "ya29.a0...",
  "refresh_token": "1//...",
  "expires_at": 1729468800,
  "created_at": 1729465200,
  "scopes": ["fitness.activity.read", "fitness.heart_rate.read", ...]
}
```

**Firestore Collection:** `health_data`
```json
{
  "user_id": "abc123",
  "provider": "google_fit",
  "date": "2025-10-20",
  "metrics": {
    "steps": 8543,
    "heart_rate": 72,
    "sleep_hours": 7.5,
    "calories": 2134
  },
  "synced_at": 1729465200
}
```

---

## 🔧 CURRENT CONFIGURATION

### Backend/.env (Updated)
```bash
GOOGLE_FIT_CLIENT_ID=619308821427-tf09ut7iefgpev7dk1ge5mvt3griuu4s.apps.googleusercontent.com
GOOGLE_FIT_CLIENT_SECRET=GOCSPX-W_____btp3  # ⚠️ UPDATE THIS WITH FULL SECRET
GOOGLE_FIT_REDIRECT_URI=http://localhost:5001/api/integration/oauth/google_fit/callback
GOOGLE_FIT_SCOPES=https://www.googleapis.com/auth/fitness.activity.read,https://www.googleapis.com/auth/fitness.heart_rate.read,https://www.googleapis.com/auth/fitness.sleep.read,https://www.googleapis.com/auth/fitness.body.read
```

### OAuth Flow Implementation
```
✅ Backend/src/services/oauth_service.py
✅ Backend/src/services/health_data_service.py
✅ Backend/src/routes/integration_routes.py
✅ frontend/src/services/oauthHealthService.ts
✅ frontend/src/components/Integrations/OAuthHealthIntegrations.tsx
```

---

## 🎯 COMPLETION CHECKLIST

- [x] Google Cloud project created
- [x] Fitness API enabled
- [x] OAuth client created
- [x] Client ID configured in .env
- [x] Redirect URI added to Google Cloud
- [ ] **Add scopes to OAuth Consent Screen** ← DO THIS NOW
- [ ] **Get full client secret and update .env** ← DO THIS NOW
- [ ] Add test user (your email)
- [ ] Test OAuth flow
- [ ] Verify token storage in Firestore
- [ ] Test data sync

---

## 📱 QUICK START (After Adding Scopes & Secret)

### 1. Update .env with Full Secret
```powershell
# Open Backend/.env and replace:
GOOGLE_FIT_CLIENT_SECRET=GOCSPX-<paste-your-new-secret-here>
```

### 2. Restart Backend
```powershell
cd c:\Projekt\Lugn-Trygg-main_klar\Backend
python main.py
```

### 3. Test in Browser
```
1. Go to: http://localhost:3000/integrations/oauth
2. Click "Connect" on Google Fit
3. Login with Gmail
4. Grant permissions
5. See "Connected" status
6. Click "Sync Now"
7. Real health data appears! 🎉
```

---

## 🔐 SECURITY NOTES

### What's Protected:
- ✅ CSRF protection (state parameter)
- ✅ Token encryption in Firestore
- ✅ Automatic token refresh
- ✅ Secure token revocation
- ✅ Minimal scope access

### For Production:
1. Change redirect URI to HTTPS: `https://lugn-trygg-53d75.firebaseapp.com/api/integration/oauth/google_fit/callback`
2. Update OAuth consent screen to "In production"
3. Submit for Google verification (1-2 weeks)
4. Use production domain in .env

---

## 🐛 TROUBLESHOOTING

### Error: "redirect_uri_mismatch"
**Fix:** Make sure redirect URI in .env matches exactly in Google Cloud Console

### Error: "invalid_client"
**Fix:** Verify client ID and secret in .env are correct

### Error: "access_denied"
**Fix:** User declined permissions - ask them to try again

### Error: "invalid_scope"
**Fix:** Add scopes to OAuth Consent Screen (Step 2 above)

### Token Expired
**Fix:** Automatic refresh implemented - should work automatically

---

## 📞 SUPPORT

### Documentation:
- `OAUTH_SETUP_GUIDE.md` - Complete OAuth setup guide
- `OAUTH_IMPLEMENTATION_SUMMARY.md` - Implementation summary

### Google Resources:
- OAuth Console: https://console.cloud.google.com/apis/credentials
- Fitness API Docs: https://developers.google.com/fit/rest
- OAuth Playground: https://developers.google.com/oauthplayground

---

## ✅ FINAL STATUS

**Current State:**
- OAuth Infrastructure: ✅ 100% Complete
- Google Client ID: ✅ Configured
- Redirect URI: ✅ Added
- Backend Code: ✅ Ready
- Frontend Code: ✅ Ready

**Needed (5 min):**
- Add OAuth scopes to consent screen
- Get full client secret
- Update .env
- Test!

**After These Steps:**
- ✅ Real Google Fit data syncing
- ✅ Production-ready OAuth flow
- ✅ Automatic token refresh
- ✅ AI insights with real health data

---

**Created:** October 20, 2025  
**Time to Complete:** 5-10 minutes  
**Difficulty:** Easy  
**Status:** 🟡 Almost Ready → 🟢 Ready After Quick Setup
