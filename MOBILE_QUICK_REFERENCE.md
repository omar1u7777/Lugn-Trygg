# ⚡ MOBILE APP QUICK REFERENCE

**Created:** Session 8 Configuration  
**Status:** ✅ Ready to Test  
**Last Updated:** Just now

---

## 🚀 Start Mobile App (30 seconds)

```bash
cd lugn-trygg-mobile
npm start
# Press 'w' for web, 'a' for Android, 'i' for iOS
```

**Expected:** App loads, Firebase connects ✅

---

## 📱 Platform Commands

```bash
# Web (fastest)
npm start
# Then press 'w'

# Android (requires emulator)
npm run android

# iOS (Mac only)
npm run ios

# Reload app
# Press 'r' in dev server terminal

# Clear cache
# Press 'c' in dev server terminal
```

---

## 🔐 Environment Files

| File | Status | Purpose |
|------|--------|---------|
| `.env.local` | ✅ Ready | Development (REAL credentials) |
| `.env.production` | ✅ Ready | Production build |
| `.env.example` | ✅ Ready | Team template |

**All configured with real Firebase credentials!** ✅

---

## 🔑 Firebase Configuration

```
Project ID: lugn-trygg-53d75
API Key: AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
Auth Domain: lugn-trygg-53d75.firebaseapp.com
Backend API: http://localhost:5001
```

**Already in `.env.local`** ✅

---

## ✅ First Time Setup

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Run dev server
npm start

# 3. Open web
# Press 'w'

# 4. Test sign up
# Email: test@example.com
# Password: Test1234!
```

---

## 📁 Key Files

```
lugn-trygg-mobile/
├── .env.local              ← Dev config (real credentials ✅)
├── .env.example            ← Template
├── App.tsx                 ← Main component
├── app.json                ← Expo config
└── src/
    ├── screens/            ← 7 UI screens
    ├── navigation/         ← Tab navigation
    ├── services/           ← API client
    ├── context/            ← Firebase Auth
    └── config/             ← Firebase setup
```

---

## 🧪 Quick Test (5 min)

```bash
npm start
# Press 'w'
```

**Steps:**
1. Click "Create Account"
2. Enter: test@example.com / Test1234!
3. Click "Create"
4. Should log in automatically
5. See home screen ✅

---

## ⚙️ Development Commands

```bash
npm start              # Start dev server
npm install            # Install packages
npm run build:web      # Build for web
npm run build:android  # Build APK
npm run build:ios      # Build IPA (Mac)
npm ls react-native    # Check packages
```

---

## 🐛 Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| App won't start | `npm install` → `npm start` → press `c` |
| Blank screen | Press `r` to reload |
| Firebase error | Check `.env.local` exists |
| API connection failed | Start Backend on port 5001 |
| Doesn't load | `npm start`, wait 10-15 sec |

---

## ✨ Screens (7 Total)

```
1. LoginScreen       - Email/password login
2. SignUpScreen      - Create new account
3. HomeScreen        - Health dashboard
4. MoodTrackerScreen - Log mood with emoji
5. IntegrationsScreen- Connected devices
6. AnalysisScreen    - AI insights
7. ProfileScreen     - User profile
```

**Navigation:** Bottom tabs (5 main tabs)

---

## 🎯 Next Steps

1. ✅ Run `npm start` and open web
2. ✅ Sign up and test auth
3. ⏳ Test mood logging
4. ⏳ Test profile edit
5. ⏳ Test device integrations
6. ⏳ Test analytics view

---

## 📊 Stack

- React Native 0.76+
- Expo 52+
- TypeScript 5+
- Firebase Auth + Firestore
- React Navigation 6+
- React Native Paper (Material Design)
- Axios (HTTP client)

---

## 🔒 Security

- ✅ `.env.local` NOT in git
- ✅ `.env.example` safe to commit
- ✅ Real credentials in local only
- ✅ Separate prod/dev configs

---

## 💾 Firebase Console

Project: https://console.firebase.google.com/project/lugn-trygg-53d75

Check:
- Authentication → Users
- Firestore → Collections
- Logs → Errors

---

## 📚 Full Guides

- `ENV_SETUP_GUIDE.md` - Complete environment setup
- `MOBILE_APP_STARTUP_GUIDE.md` - Detailed startup
- `SESSION_8_COMPLETION_SUMMARY.md` - Full session details

---

## 🚀 Ready!

```bash
cd lugn-trygg-mobile
npm start
```

**App is configured and ready to test!** ✅
