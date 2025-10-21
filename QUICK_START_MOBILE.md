# 🚀 QUICK START GUIDE - React Native Mobile App

## What's Ready

✅ **Complete React Native app built and ready**
- 7 production screens
- Full authentication
- API integration
- Material Design UI
- TypeScript everything

---

## Next 5 Steps

### Step 1: Add Firebase Credentials (5 min)

Edit `.env.local` in the mobile app folder:

```bash
# From your Firebase Project Settings
EXPO_PUBLIC_FIREBASE_API_KEY=abc123...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456...
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456...
```

### Step 2: Update Backend API URL (1 min)

In `.env.local`, update:
```
EXPO_PUBLIC_API_URL=http://localhost:5000
```
(Change if your backend is on different server)

### Step 3: Start Expo Dev Server (2 min)

```bash
cd lugn-trygg-mobile
npm start
```

### Step 4: Test on Web (2 min)

Press `w` to open in web browser

### Step 5: Test on Simulator (10 min)

- **Android**: Install Android Studio, press `a`
- **iOS**: Install Xcode, press `i` (Mac only)
- **EAS**: `npm install -g eas-cli` then `eas build --platform ios --profile preview`

---

## 🧪 Quick Testing

### Test Auth
1. Click "Create Account"
2. Enter email, password, name
3. Should create and auto-login

### Test Home Screen
1. After login, see health dashboard
2. Try "Add Mood" button
3. Try "Refresh" to pull new data

### Test Mood Screen
1. Select mood (1-5 with emojis)
2. Add optional notes
3. Click "Save Mood Entry"

### Test Navigation
1. Bottom tabs work smoothly
2. Tap each tab icon
3. Data persists on tab switch

---

## 🐛 Common Issues & Fixes

### Issue: "Firebase not configured"
**Fix**: Check `.env.local` has all Firebase keys

### Issue: "Cannot connect to backend"
**Fix**: Make sure backend is running on port 5000, or update API_URL

### Issue: "App won't start"
**Fix**: Delete node_modules and reinstall
```bash
rm -r node_modules package-lock.json
npm install
```

### Issue: "TypeScript errors"
**Fix**: Usually just need to restart dev server
```bash
npm start
```

---

## 📱 What Each Screen Does

| Screen | Purpose | Test |
|--------|---------|------|
| **LoginScreen** | User login | Enter email/password |
| **SignUpScreen** | Create account | Register new user |
| **HomeScreen** | Dashboard | View health metrics |
| **MoodTrackerScreen** | Log mood | Select 1-5, add notes |
| **ProfileScreen** | User profile | View stats, logout |
| **IntegrationsScreen** | Device connections | See available providers |
| **AnalysisScreen** | AI insights | View patterns & recommendations |

---

## 🎯 What's Already Connected

✅ Firebase Auth (email/password login)
✅ React Navigation (5 tab navigation)
✅ Firestore (mood entries)
✅ API client (axios with auth tokens)
✅ Health service (caching, sync)
✅ Material Design UI

---

## 📋 File Locations

```
lugn-trygg-mobile/
├── src/
│   ├── screens/        ← All UI screens
│   ├── navigation/      ← Routing setup
│   ├── services/        ← API & data
│   ├── context/         ← Auth state
│   └── theme/           ← Colors & design
├── App.tsx             ← Root component
├── app.json            ← Expo config
├── .env.local          ← Your secrets
└── package.json        ← Dependencies
```

---

## 🚀 Deploy to Production

### Web
```bash
npm run web
```

### Android APK
```bash
npm install -g eas-cli
eas build --platform android
```

### iOS IPA
```bash
npm install -g eas-cli
eas build --platform ios
```

### Submit to Stores
1. Android: Upload APK to Google Play
2. iOS: Upload IPA to App Store

---

## 💡 Pro Tips

1. **Hot Reload**: Changes auto-refresh while app running
2. **Debug**: Use `console.log()` - appears in terminal
3. **Test Offline**: Disconnect internet to test error handling
4. **Clear Cache**: Press `c` in Expo CLI to clear
5. **Reset**: Delete `.expo` folder to reset app state

---

## 📞 Need Help?

If stuck:
1. Check `.env.local` has all Firebase keys
2. Make sure backend is running
3. Check console for error messages
4. Try `npm install` again
5. Delete node_modules and reinstall

---

**Everything is ready! Start with Step 1 ↑**
