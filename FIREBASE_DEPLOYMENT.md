# 🚀 FIREBASE DEPLOYMENT SCRIPT

**Project**: Lugn & Trygg MVP  
**Firebase Project**: lugn-trygg-53d75  
**Build Status**: ✅ Ready (dist/ verified)  
**Date**: October 19, 2025

---

## Deployment Steps

### Step 1: Verify Firebase CLI Installation
```powershell
firebase --version
```

**Expected**: firebase-tools@13.x.x or higher

### Step 2: Install Firebase CLI (if needed)
```powershell
npm install -g firebase-tools
```

### Step 3: Authenticate with Firebase
```powershell
firebase login
```

**Expected**: Browser opens, login to Google account linked to project

### Step 4: Configure firebase.json

Already configured in: `C:\Projekt\Lugn-Trygg-main_klar\firebase.json`

Verify settings:
```json
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

### Step 5: Deploy to Firebase Hosting

From root directory:
```powershell
firebase deploy --only hosting --project lugn-trygg-53d75
```

**Expected Output**:
```
Uploading 45 files to version [hash-version]
✓ File sharing completed
✓ Finalizing version...
✓ Deploy complete!

Project Console: https://console.firebase.google.com/project/lugn-trygg-53d75/overview
Hosting URL: https://lugn-trygg-53d75.web.app
```

### Step 6: Verify Deployment

```powershell
# Check deployment status
firebase hosting:list --project lugn-trygg-53d75

# Test production URL
curl -I https://lugn-trygg-53d75.web.app
```

**Expected**: 200 OK with proper headers

### Step 7: Monitor Deployment

Visit Firebase Console:
- **URL**: https://console.firebase.google.com/project/lugn-trygg-53d75/hosting/launches
- **Check**: Latest deployment status
- **Monitor**: Real-time analytics

---

## Post-Deployment Verification

### Frontend Checks
- [ ] Landing page loads (https://lugn-trygg-53d75.web.app)
- [ ] Onboarding displays
- [ ] Skip functionality works
- [ ] localStorage persists

### Backend Checks
- [ ] API health endpoint: `http://localhost:54112/api/health`
- [ ] Authentication service: Working
- [ ] Analytics service: Connected
- [ ] Database: Firestore connected

### Monitoring Checks
- [ ] Sentry dashboard: No errors
- [ ] Amplitude analytics: Events tracking
- [ ] Firebase console: Deployment successful
- [ ] Performance: <2s load time

---

## Success Criteria

✅ All criteria met:
- [ ] Frontend deployed to https://lugn-trygg-53d75.web.app
- [ ] HTTPS enabled automatically
- [ ] SPA routing works (all routes return index.html)
- [ ] Assets cached (js/css files have immutable headers)
- [ ] Service Worker active
- [ ] Offline mode functional
- [ ] Analytics tracking
- [ ] Error monitoring
- [ ] Performance optimal

---

**Next**: Execute deployment commands in terminal

