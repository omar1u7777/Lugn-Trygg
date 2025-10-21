# 🔐 OAUTH SETUP GUIDE - HEALTH INTEGRATIONS
**Implementation Complete!** ✅  
**Created:** 2025-10-20  
**Status:** Ready for Production Configuration

---

## 📋 OVERVIEW

OAuth 2.0 implementation is now **fully complete** for all health integrations:
- ✅ Google Fit
- ✅ Fitbit  
- ✅ Samsung Health
- ✅ Withings

**What's Implemented:**
- ✅ Backend OAuth service (`oauth_service.py`)
- ✅ Health data fetching service (`health_data_service.py`)
- ✅ OAuth API endpoints (`integration_routes.py`)
- ✅ Frontend OAuth service (`oauthHealthService.ts`)
- ✅ React UI component (`OAuthHealthIntegrations.tsx`)
- ✅ Token storage in Firestore
- ✅ Automatic token refresh
- ✅ Token revocation
- ✅ Real health data syncing

---

## 🚀 QUICK START

### Step 1: Choose Your Provider

Pick which health platforms you want to integrate:
- **Google Fit** - Most popular, works on Android + iOS + Web
- **Fitbit** - Dedicated fitness trackers, large user base
- **Samsung Health** - Samsung devices, popular in Asia
- **Withings** - Smart scales and health devices

### Step 2: Get OAuth Credentials

Follow provider-specific guides below to get:
- Client ID
- Client Secret
- Redirect URI configuration

### Step 3: Configure Backend

Add credentials to `Backend/.env`:

```bash
# Example for all providers
GOOGLE_FIT_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_FIT_CLIENT_SECRET=YOUR_SECRET_HERE
GOOGLE_FIT_REDIRECT_URI=http://localhost:5001/api/integration/oauth/google_fit/callback

FITBIT_CLIENT_ID=YOUR_FITBIT_ID
FITBIT_CLIENT_SECRET=YOUR_FITBIT_SECRET
FITBIT_REDIRECT_URI=http://localhost:5001/api/integration/oauth/fitbit/callback

# ... etc for other providers
```

### Step 4: Test Integration

```bash
# Start backend
cd Backend
python main.py

# Start frontend  
cd frontend
npm start

# Navigate to: http://localhost:3000/integrations/oauth
```

---

## 🔧 PROVIDER-SPECIFIC SETUP

### 1. GOOGLE FIT OAUTH SETUP

#### Prerequisites:
- Google Cloud Console account
- Google Fit API enabled

#### Steps:

**1. Create Google Cloud Project:**
```
1. Go to: https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Name: "Lugn & Trygg Health Integration"
4. Click "Create"
```

**2. Enable Google Fit API:**
```
1. In Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Fitness API"
3. Click "Fitness API" → "Enable"
```

**3. Create OAuth 2.0 Credentials:**
```
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen first:
   - User Type: External
   - App name: Lugn & Trygg
   - User support email: your-email@example.com
   - Developer contact: your-email@example.com
   - Add scopes:
     * .../auth/fitness.activity.read
     * .../auth/fitness.heart_rate.read
     * .../auth/fitness.sleep.read
     * .../auth/fitness.body.read
4. Create OAuth Client:
   - Application type: Web application
   - Name: Lugn & Trygg Backend
   - Authorized redirect URIs:
     * http://localhost:5001/api/integration/oauth/google_fit/callback
     * https://yourdomain.com/api/integration/oauth/google_fit/callback (for production)
5. Click "Create"
6. Copy Client ID and Client Secret
```

**4. Configure Backend:**
```bash
# Backend/.env
GOOGLE_FIT_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
GOOGLE_FIT_CLIENT_SECRET=GOCSPX-abcdefghijklmnop
GOOGLE_FIT_REDIRECT_URI=http://localhost:5001/api/integration/oauth/google_fit/callback
GOOGLE_FIT_SCOPES=https://www.googleapis.com/auth/fitness.activity.read,https://www.googleapis.com/auth/fitness.heart_rate.read,https://www.googleapis.com/auth/fitness.sleep.read,https://www.googleapis.com/auth/fitness.body.read
```

**5. Test:**
```bash
# Start backend
python main.py

# Navigate to OAuth page in frontend
# Click "Connect" on Google Fit
# Should open Google authorization page
# Grant permissions
# Should redirect back successfully
```

---

### 2. FITBIT OAUTH SETUP

#### Prerequisites:
- Fitbit Developer account

#### Steps:

**1. Create Fitbit Developer Account:**
```
1. Go to: https://dev.fitbit.com
2. Click "Register" (top right)
3. Create account with email
4. Verify email
```

**2. Register Your App:**
```
1. Go to: https://dev.fitbit.com/apps
2. Click "Register an App"
3. Fill in details:
   - Application Name: Lugn & Trygg
   - Description: Mental health and wellness tracking
   - Application Website: http://localhost:3000
   - Organization: Your Company/Name
   - Organization Website: http://localhost:3000
   - Terms of Service URL: http://localhost:3000/terms
   - Privacy Policy URL: http://localhost:3000/privacy
   - OAuth 2.0 Application Type: Server
   - Callback URL: http://localhost:5001/api/integration/oauth/fitbit/callback
   - Default Access Type: Read-Only
4. Agree to terms
5. Click "Register"
```

**3. Get Credentials:**
```
1. After registration, you'll see:
   - OAuth 2.0 Client ID
   - Client Secret
2. Copy both values
```

**4. Configure Backend:**
```bash
# Backend/.env
FITBIT_CLIENT_ID=23ABCD
FITBIT_CLIENT_SECRET=abcdef1234567890abcdef1234567890
FITBIT_REDIRECT_URI=http://localhost:5001/api/integration/oauth/fitbit/callback
FITBIT_SCOPES=activity,heartrate,sleep,weight,profile
```

**5. Test:**
```bash
# Click "Connect" on Fitbit in OAuth page
# Should open Fitbit authorization
# Login with Fitbit account
# Grant permissions
# Redirect back successfully
```

---

### 3. SAMSUNG HEALTH OAUTH SETUP

#### Prerequisites:
- Samsung Developer account
- Samsung Health SDK access

#### Steps:

**1. Create Samsung Developer Account:**
```
1. Go to: https://developer.samsung.com
2. Click "Sign Up"
3. Complete registration
4. Verify email
```

**2. Register Application:**
```
1. Go to: https://developer.samsung.com/health
2. Click "My Apps" → "Create New"
3. Fill in:
   - App Name: Lugn & Trygg
   - Package Name: com.lugntrygg.health
   - Callback URI: http://localhost:5001/api/integration/oauth/samsung/callback
4. Submit for review (may take 1-3 days)
```

**3. Get Credentials:**
```
1. Once approved, go to "My Apps"
2. Click your app
3. Copy:
   - Client ID
   - Client Secret
```

**4. Configure Backend:**
```bash
# Backend/.env
SAMSUNG_HEALTH_CLIENT_ID=samsung_app_id_here
SAMSUNG_HEALTH_CLIENT_SECRET=samsung_secret_here
SAMSUNG_HEALTH_REDIRECT_URI=http://localhost:5001/api/integration/oauth/samsung/callback
```

**Note:** Samsung Health OAuth is complex and requires app approval. Consider starting with Google Fit or Fitbit first.

---

### 4. WITHINGS OAUTH SETUP (OPTIONAL)

#### Prerequisites:
- Withings Developer account

#### Steps:

**1. Create Withings Account:**
```
1. Go to: https://account.withings.com/partner/add_oauth2
2. Register as developer
3. Verify email
```

**2. Create Application:**
```
1. Fill in application details:
   - App Name: Lugn & Trygg
   - Description: Health tracking integration
   - Callback URI: http://localhost:5001/api/integration/oauth/withings/callback
2. Submit
```

**3. Get Credentials:**
```
1. After approval, copy:
   - Client ID
   - Consumer Secret
```

**4. Configure Backend:**
```bash
# Backend/.env
WITHINGS_CLIENT_ID=your_withings_client_id
WITHINGS_CLIENT_SECRET=your_withings_secret
WITHINGS_REDIRECT_URI=http://localhost:5001/api/integration/oauth/withings/callback
```

---

## 📊 TESTING YOUR OAUTH SETUP

### Backend API Testing

```bash
# 1. Get authorization URL
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:5001/api/integration/oauth/google_fit/authorize

# Response:
{
  "success": true,
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "random_state_string",
  "provider": "google_fit"
}

# 2. Open authorization_url in browser
# 3. Grant permissions
# 4. Get redirected to callback with code

# 5. Check connection status
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:5001/api/integration/oauth/google_fit/status

# Response if connected:
{
  "connected": true,
  "provider": "google_fit",
  "scope": "fitness.activity.read fitness.heart_rate.read...",
  "obtained_at": "2025-10-20T12:00:00",
  "expires_at": "2025-10-20T13:00:00",
  "is_expired": false
}

# 6. Sync health data
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days": 7}' \
  http://localhost:5001/api/integration/health/sync/google_fit

# Response:
{
  "success": true,
  "provider": "google_fit",
  "data": {
    "steps": 52341,
    "heart_rate": 72.5,
    "sleep_hours": 7.2,
    "calories": 12450
  },
  "synced_at": "2025-10-20T12:05:00"
}
```

### Frontend UI Testing

```
1. Start frontend: npm start
2. Navigate to: http://localhost:3000/integrations/oauth
3. You should see all 4 providers (Google Fit, Fitbit, Samsung, Withings)
4. Each provider shows:
   - Icon and name
   - Description
   - Connection status
   - Connect/Disconnect button
   - Sync button (if connected)
5. Click "Connect" on Google Fit
6. Should open popup window with Google authorization
7. Grant permissions
8. Popup closes, status updates to "Connected"
9. Click "Sync Now" to test data sync
10. Should see success message with health metrics
```

---

## 🔒 SECURITY CONSIDERATIONS

### 1. Token Storage
```
✅ Access tokens stored encrypted in Firestore
✅ Refresh tokens stored separately
✅ Tokens never exposed in frontend
✅ Automatic token refresh before expiry
```

### 2. State Parameter
```
✅ Random state generated for CSRF protection
✅ State verified during callback
✅ State expires after 5 minutes
```

### 3. HTTPS Required
```
⚠️ For production, MUST use HTTPS
⚠️ OAuth providers reject http:// in production
⚠️ Update redirect URIs to https://yourdomain.com/...
```

### 4. Scope Minimization
```
✅ Only request necessary scopes
✅ Clearly explain what data is accessed
✅ Allow users to disconnect anytime
```

---

## 🌐 PRODUCTION DEPLOYMENT

### 1. Update Redirect URIs

**Google Fit:**
```
Production redirect URI: https://api.lugntrygg.com/api/integration/oauth/google_fit/callback

Update in:
1. Google Cloud Console → Credentials
2. Add production URI to authorized redirect URIs
3. Update Backend/.env:
   GOOGLE_FIT_REDIRECT_URI=https://api.lugntrygg.com/api/integration/oauth/google_fit/callback
```

**Fitbit:**
```
Production redirect URI: https://api.lugntrygg.com/api/integration/oauth/fitbit/callback

Update in:
1. Fitbit App Settings
2. Change Callback URL
3. Update Backend/.env
```

### 2. Environment Variables

```bash
# Production .env
GOOGLE_FIT_CLIENT_ID=prod_client_id
GOOGLE_FIT_CLIENT_SECRET=prod_secret
GOOGLE_FIT_REDIRECT_URI=https://api.lugntrygg.com/api/integration/oauth/google_fit/callback

FITBIT_CLIENT_ID=prod_fitbit_id
FITBIT_CLIENT_SECRET=prod_fitbit_secret
FITBIT_REDIRECT_URI=https://api.lugntrygg.com/api/integration/oauth/fitbit/callback

# Never commit these to git!
```

### 3. SSL Certificate

```bash
# Ensure your domain has valid SSL
# Use Let's Encrypt for free SSL:
sudo certbot --nginx -d api.lugntrygg.com
```

### 4. OAuth Consent Screen

**Google Fit:**
```
1. Complete OAuth Consent Screen verification
2. Add Privacy Policy URL
3. Add Terms of Service URL
4. Submit for verification (can take 1-2 weeks)
5. Until verified, limited to 100 users
```

---

## 📚 API ENDPOINTS REFERENCE

### OAuth Flow Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/integration/oauth/<provider>/authorize` | GET | Initiate OAuth flow |
| `/api/integration/oauth/<provider>/callback` | GET | OAuth callback handler |
| `/api/integration/oauth/<provider>/status` | GET | Check connection status |
| `/api/integration/oauth/<provider>/disconnect` | POST | Disconnect and revoke |

### Health Data Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/integration/health/sync/<provider>` | POST | Sync health data |

### Supported Providers

- `google_fit` - Google Fit
- `fitbit` - Fitbit
- `samsung` - Samsung Health
- `withings` - Withings

---

## 🐛 TROUBLESHOOTING

### Error: "OAuth not configured"
```
Problem: OAuth credentials not set in .env
Solution: Add GOOGLE_FIT_CLIENT_ID and GOOGLE_FIT_CLIENT_SECRET to Backend/.env
```

### Error: "redirect_uri_mismatch"
```
Problem: Redirect URI doesn't match registered URI
Solution: 
1. Check Backend/.env GOOGLE_FIT_REDIRECT_URI
2. Verify it matches Google Cloud Console → Credentials → Authorized redirect URIs
3. Must be exact match (including http/https, port, path)
```

### Error: "invalid_client"
```
Problem: Client ID or Secret is wrong
Solution:
1. Double-check credentials in Google Cloud Console
2. Ensure no extra spaces in .env
3. Regenerate secret if needed
```

### Error: "Token expired"
```
Problem: Access token expired
Solution: Token should auto-refresh. If not:
1. Check refresh_token is stored in Firestore
2. Check oauth_service.refresh_access_token() is working
3. Manually disconnect and reconnect
```

### Popup Blocked
```
Problem: Browser blocks OAuth popup
Solution:
1. Allow popups for localhost
2. User clicks "Connect" again
3. Browser should remember preference
```

---

## ✅ VERIFICATION CHECKLIST

### Backend Setup
- [ ] OAuth credentials added to .env
- [ ] Backend runs without errors
- [ ] `/oauth/<provider>/authorize` returns auth URL
- [ ] Callback endpoint accessible

### Frontend Setup
- [ ] `oauthHealthService.ts` imported correctly
- [ ] `OAuthHealthIntegrations.tsx` renders
- [ ] Connect button works
- [ ] Popup opens correctly
- [ ] Callback handled properly

### OAuth Flow
- [ ] Authorization URL generated
- [ ] Redirect to provider works
- [ ] User can grant permissions
- [ ] Callback receives code
- [ ] Token exchange succeeds
- [ ] Token stored in Firestore

### Health Data Sync
- [ ] Sync button appears when connected
- [ ] API call succeeds
- [ ] Real data returned
- [ ] Data stored in Firestore
- [ ] UI displays synced data

---

## 📈 NEXT STEPS

### Phase 1: Basic OAuth (DONE ✅)
- ✅ OAuth service implementation
- ✅ Token management
- ✅ Frontend UI
- ✅ Basic data sync

### Phase 2: Enhanced Features (Next)
- [ ] Automatic daily sync (cron job)
- [ ] Data visualization charts
- [ ] Historical data trends
- [ ] Notifications for sync failures
- [ ] Batch sync optimization

### Phase 3: Advanced Integration
- [ ] AI insights from health data
- [ ] Mood correlation analysis
- [ ] Personalized recommendations
- [ ] Wellness score calculation

---

## 📞 SUPPORT

### Google Fit Issues
- Docs: https://developers.google.com/fit
- Support: https://support.google.com/googleapi

### Fitbit Issues  
- Docs: https://dev.fitbit.com/build/reference/
- Forum: https://community.fitbit.com/t5/Web-API-Development/bd-p/webapi

### Samsung Health Issues
- Docs: https://developer.samsung.com/health
- Support: developer.samsung.com/support

---

**Created:** 2025-10-20  
**Status:** ✅ **PRODUCTION-READY** (pending OAuth credentials)  
**Next:** Configure provider credentials and test!
