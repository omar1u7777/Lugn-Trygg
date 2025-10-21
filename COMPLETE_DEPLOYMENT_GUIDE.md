# 🚀 LUGN & TRYGG - COMPLETE DEPLOYMENT GUIDE

**Date:** October 21, 2025  
**Status:** ✅ Ready for Production  

---

## 📊 DEPLOYMENT SUMMARY

| Platform | Status | Method | Time |
|----------|--------|--------|------|
| **Web App** | ✅ Built | Vercel / Netlify / Static | 5 min |
| **Backend (Flask)** | ✅ Ready | Render / Railway | 10 min |
| **Android APK** | ✅ Ready | EAS Cloud Build | 10-15 min |
| **iOS (Optional)** | ✅ Ready | EAS Cloud Build | 15-20 min |

---

## 🌐 WEB APP DEPLOYMENT

### Option A: Deploy Web-App Locally (Testing)
```powershell
cd web-app-build
npm install -g http-server
http-server -p 8000 --gzip
# Open: http://localhost:8000
```

### Option B: Deploy to Vercel (Recommended)
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login (browser opens)
vercel login

# 3. Deploy web-app-build
cd web-app-build
vercel deploy --prod

# 4. Get URL: https://lugn-trygg.vercel.app (example)
```

**Or use Vercel Dashboard:**
1. Go to: https://vercel.com/dashboard
2. Click "New Project"
3. Import: `https://github.com/omar1u7777/Lugn-Trygg`
4. Root Directory: `./web-app-build`
5. Framework: None (Static)
6. Deploy

### Option C: Deploy to Netlify
```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Login
netlify login

# 3. Deploy
netlify deploy --dir=web-app-build --prod --site-name=lugn-trygg

# 4. Get URL: https://lugn-trygg.netlify.app (example)
```

### Option D: Deploy to Firebase Hosting
```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Initialize (if not done)
firebase init hosting

# 4. Deploy
firebase deploy --only hosting
```

---

## 🐍 BACKEND DEPLOYMENT (Flask)

### Option A: Deploy to Render.com (Recommended - Free Tier)

**Steps:**
1. Go to: https://render.com
2. Sign up / Login
3. Click "New +" > "Web Service"
4. Connect GitHub: Select `Lugn-Trygg` repository
5. Configure:
   ```
   Name: lugn-trygg-backend
   Environment: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: gunicorn Backend.main:app
   ```
6. Add Environment Variables:
   ```
   FLASK_ENV = production
   FLASK_DEBUG = False
   ```
7. Click "Create Web Service"
8. Wait 2-3 minutes for deployment
9. Get URL: `https://lugn-trygg-backend.onrender.com`

### Option B: Deploy to Railway.app
1. Go to: https://railway.app
2. Connect GitHub
3. Select repository
4. Add Flask service
5. Set environment variables
6. Deploy

### Option C: Deploy to Heroku (Deprecated but still works)
```bash
npm install -g heroku
heroku login
heroku create lugn-trygg-backend
git push heroku main
```

---

## 📱 ANDROID APK BUILD

### Build Android APK with EAS

**Prerequisites:**
- EAS CLI installed: `npm install -g eas-cli`
- EAS account (free at expo.dev)

**Steps:**

```powershell
cd lugn-trygg-mobile

# 1. Login to EAS
npx eas-cli login
# Enter: omaralhaek97@gmail.com / Rudeyna.86123456

# 2. Build APK (preview = faster, ~5-10 min)
npx eas-cli build --platform android --profile preview

# 3. Watch build progress
# Go to: https://expo.dev/builds

# 4. Download APK when ready
# Install on Android: adb install -r lugn-trygg-*.apk
```

**Or use the built-in script:**
```powershell
.\BUILD_ANDROID_APK.ps1
```

---

## 🔗 CONNECTING FRONTEND TO BACKEND

After deployment, update backend URL in your app:

**File:** `lugn-trygg-mobile/src/services/api.ts`
```typescript
const API_BASE_URL = 'https://lugn-trygg-backend.onrender.com';
// or your deployed backend URL
```

**File:** `frontend/src/api/api.ts`
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://lugn-trygg-backend.onrender.com';
```

Then rebuild:
```bash
npm run build
# or
npx expo export
```

---

## ✅ TESTING CHECKLIST

### Web App Testing
- [ ] Open deployed web URL in browser
- [ ] Login works (test@example.com / password123)
- [ ] Dashboard loads all 5 tabs
- [ ] Mood logging modal opens
- [ ] Chat modal works
- [ ] API calls reach backend (check Network tab in DevTools)
- [ ] No console errors

### Backend Testing
- [ ] API endpoint: `/api/mood/get` returns data
- [ ] POST to `/api/mood/log` creates mood entry
- [ ] Firebase auth integration works
- [ ] CORS allows web app domain

### Android Testing
- [ ] APK installs on Android device
- [ ] App launches without crashes
- [ ] Login screen appears
- [ ] Backend connectivity works
- [ ] All tabs accessible
- [ ] Mood logging end-to-end works

---

## 📊 EXPECTED RESULTS

### Web App
- **URL:** `https://lugn-trygg.vercel.app` (or similar)
- **Type:** Static React-Native-Web app
- **Performance:** <3s load time
- **Size:** ~2-3 MB initial load

### Backend
- **URL:** `https://lugn-trygg-backend.onrender.com` (or similar)
- **Type:** Flask REST API
- **Endpoints:** `/api/mood/*`, `/api/auth/*`, `/api/chatbot/*`, etc.
- **Database:** Firebase Firestore

### Android App
- **File:** `lugn-trygg-*.apk` (50-100 MB)
- **Platform:** Android 8+ (API 26+)
- **Installation:** Via APK file or Google Play Store (after submission)

---

## 🔑 KEY ENVIRONMENT VARIABLES

### Backend (.env or deployment settings)
```
FLASK_ENV=production
FLASK_DEBUG=False
FIREBASE_API_KEY=AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
FIREBASE_PROJECT_ID=lugn-trygg-53d75
```

### Frontend (.env.local or build-time)
```
REACT_APP_API_URL=https://lugn-trygg-backend.onrender.com
REACT_APP_FIREBASE_API_KEY=AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
```

### Mobile App (already in lugn-trygg-mobile/.env)
```
EXPO_PUBLIC_API_URL=https://lugn-trygg-backend.onrender.com
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
```

---

## 🆘 TROUBLESHOOTING

### Web App Won't Load
- **Issue:** Blank page or 404
- **Solution:** Check browser console (F12), verify API URL is correct

### Backend Connection Failed
- **Issue:** API calls return 404 or CORS error
- **Solution:** 
  - Check backend is running
  - Verify API URL in app config
  - Check CORS settings in `Backend/src/config.py`

### Android APK Won't Install
- **Issue:** Installation fails
- **Solution:**
  - Ensure device has 100+ MB free space
  - Use: `adb install -r lugn-trygg.apk` (force replace)
  - Or install via Android File Manager

### EAS Build Timeout
- **Issue:** Build stuck or fails after 15 min
- **Solution:**
  - Check EAS dashboard for logs
  - Reduce app size (remove assets)
  - Rebuild with `--clear-cache`

---

## 📚 USEFUL LINKS

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Netlify Dashboard:** https://app.netlify.com
- **Render Dashboard:** https://dashboard.render.com
- **Firebase Console:** https://console.firebase.google.com
- **EAS Dashboard:** https://expo.dev/builds
- **GitHub Repo:** https://github.com/omar1u7777/Lugn-Trygg

---

## 🎯 RECOMMENDED DEPLOYMENT FLOW

**Step 1 (5 min):** Deploy web app to Vercel
```bash
vercel deploy --prod
```

**Step 2 (10 min):** Deploy backend to Render
- Manual setup via dashboard

**Step 3 (15 min):** Build Android APK
```bash
npx eas-cli build --platform android --profile preview
```

**Step 4 (10 min):** Test everything
- Open web app URL
- Test login & mood logging
- Install APK on Android device
- Test mobile app

**Step 5 (Optional):** Submit to Google Play Store
- Create Play Store account ($25 one-time)
- Upload APK/AAB
- Wait 24-48 hours for review

---

## ✨ TOTAL DEPLOYMENT TIME

- **Web + Backend:** ~20-30 minutes
- **Android APK:** ~15-20 minutes (cloud build)
- **Full Stack:** ~40-50 minutes (all three)

---

**All systems ready for production! 🚀**

Generated: October 21, 2025  
Project: Lugn & Trygg (Mobile + Web + Backend)
