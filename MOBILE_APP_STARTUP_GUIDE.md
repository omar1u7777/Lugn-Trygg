# 🚀 Mobile App Startup Guide

## Quick Start (5 minutes)

### Prerequisites

```bash
# 1. Node.js 18+ installed
node --version  # Should be v18+

# 2. Git installed
git --version

# 3. (Optional) Android Studio or Xcode for simulators
```

### 1️⃣ Setup Environment

```bash
# Navigate to mobile app
cd lugn-trygg-mobile

# Copy environment template
cp .env.example .env.local

# The .env.local now has real Firebase credentials!
# No need to edit - already configured ✅
```

### 2️⃣ Start Development Server

```bash
# Start Expo development server
npm start
```

You should see:
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   Expo DevTools is running at http://localhost:19000      │
│                                                            │
│   ➜  Press 'i' to open iOS simulator                      │
│   ➜  Press 'a' to open Android emulator                   │
│   ➜  Press 'w' to open web                                │
│   ➜  Press 'r' to reload                                  │
│   ➜  Press 'q' to quit                                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 3️⃣ Choose Your Platform

**Option A: Web (Fastest)**
```bash
# Press 'w' in the dev server terminal
# Opens http://localhost:19000 in browser
```

**Option B: Android Emulator**
```bash
# First, open Android Studio and start an emulator
# Press 'a' in the dev server terminal
```

**Option C: iOS Simulator (Mac only)**
```bash
# Press 'i' in the dev server terminal
```

### 4️⃣ Test the App

Once the app loads:

1. **Signup**
   - Enter email: `test@example.com`
   - Enter password: `Test1234!`
   - Click "Create Account"

2. **Verify Firebase Connection**
   - Check console for "✅ Firebase initialized"
   - Check browser Network tab for Firebase API calls

3. **Login**
   - Use the email/password you just created
   - Should redirect to Home screen

4. **Test Features**
   - Mood Tracker: Log a mood with emoji
   - Profile: Update your information
   - Integrations: View connected devices

---

## 📋 Complete Setup (Detailed)

### A. Verify Prerequisites

```bash
# Check Node.js version (must be 18+)
node --version
npm --version

# Check that you're in the right directory
pwd  # Should end with: ...Lugn-Trygg-main_klar
ls   # Should show: lugn-trygg-mobile folder
```

### B. Install Dependencies

```bash
# Navigate to mobile app
cd lugn-trygg-mobile

# Install all npm packages
npm install
# This installs 1065 packages - takes 2-5 minutes

# Verify installation
npm list react-native
npm list react-navigation
```

### C. Setup Environment Variables

```bash
# Create .env.local from template
cp .env.example .env.local

# Verify credentials are there
cat .env.local | grep FIREBASE_API_KEY
# Should show: EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyAxs7Monr...
```

### D. Start Development Server

```bash
# Start the Expo development server
npm start

# Or with specific platform:
npm run web     # Web browser
npm run android # Android emulator
npm run ios     # iOS simulator (Mac only)
```

### E. Open in Browser/Simulator

**Web (Recommended for first test):**
```bash
# In dev server, press 'w'
# Opens http://localhost:19000
```

**Android:**
```bash
# Install Android Studio if not already
# Start Android emulator from Android Studio
# In dev server, press 'a'
# App will load on emulator
```

**iOS (Mac only):**
```bash
# Install Xcode if not already
# In dev server, press 'i'
# App will load on iOS simulator
```

---

## 🔧 Development Commands

### Start Dev Server
```bash
npm start
```

### Start on Web
```bash
npm run web
```

### Start on Android
```bash
npm run android
```

### Start on iOS
```bash
npm run ios
```

### Reload App
```bash
# In dev server terminal, press 'r'
# Or: npm start, then press 'r'
```

### Clear Cache
```bash
npm start
# Then press 'c' in the terminal
```

### Debug
```bash
# Press 'j' in dev server terminal to open debugger
# Or visit: http://localhost:19000/debugger-ui
```

---

## 📱 Simulator Setup

### Android Emulator

```bash
# 1. Install Android Studio (if not already)
# 2. Open Android Studio → AVD Manager
# 3. Create or start a virtual device (e.g., Pixel 4)
# 4. Leave it running
# 5. In dev server, press 'a'
```

### iOS Simulator (Mac only)

```bash
# 1. Have Xcode installed
# 2. Open Terminal:
   open -a Simulator
# 3. Launch different iOS version:
   xcrun simctl list devices
   xcrun simctl boot "iPhone 14"
# 4. In dev server, press 'i'
```

---

## 🧪 Testing Checklist

### Firebase Connection
- [ ] App starts without errors
- [ ] Console shows "✅ Firebase initialized"
- [ ] No Firebase errors in console

### Authentication
- [ ] Can create new account
- [ ] User appears in Firebase Console → Authentication
- [ ] Can login with created account
- [ ] Session persists after reload

### API Connection
- [ ] Backend is running (`python Backend/src/main.py`)
- [ ] Backend on port 5001: `http://localhost:5001`
- [ ] Mood entry creates log in Firestore
- [ ] Profile can be updated

### UI/UX
- [ ] Bottom navigation visible and working
- [ ] All 5 tabs clickable (Home, Mood, Integrations, Analysis, Profile)
- [ ] Screens load without lag
- [ ] Material Design components render correctly

### Performance
- [ ] App loads in <2 seconds
- [ ] No memory warnings in console
- [ ] Smooth navigation between screens

---

## 🐛 Troubleshooting

### Problem: "npm ERR! ERESOLVE unable to resolve dependency tree"

**Solution:**
```bash
npm install --force
# or
npm install --legacy-peer-deps
```

---

### Problem: "Metro Bundler crashed"

**Solution:**
```bash
# Clear Metro cache and restart
npm start
# Then press 'c'

# Or manually:
rm -rf node_modules/.cache
npm start
```

---

### Problem: "Firebase is not defined"

**Check:**
1. `.env.local` exists
2. Contains `EXPO_PUBLIC_FIREBASE_API_KEY=...`
3. Not a typo in the variable name

**Restart:**
```bash
npm start
# Press 'c' to clear cache
# Press 'r' to reload
```

---

### Problem: "Cannot connect to localhost:5001"

**Check:**
1. Backend is running: `python Backend/src/main.py`
2. Backend on correct port (5001, not 5000)
3. `.env.local` has `EXPO_PUBLIC_API_URL=http://localhost:5001`

**To verify backend:**
```bash
# In another terminal:
curl http://localhost:5001/health

# Should return: {"status": "ok"}
```

---

### Problem: "Simulator shows blank white screen"

**Solution:**
```bash
npm start
# Press 'c' to clear cache
# Press 'r' to reload
# Wait 10-15 seconds for rebuild

# If still blank:
npm install
npm start
```

---

### Problem: "Module not found: react-navigation"

**Solution:**
```bash
# Reinstall packages
rm -rf node_modules
npm install

# Start dev server
npm start
```

---

## 🔐 Security Notes

### Development
- `.env.local` has real Firebase credentials (don't share)
- `.env.local` is in `.gitignore` (won't be committed)
- Only for local development

### Production
- Use `.env.production` for app store builds
- Change API URL to production server
- Use separate Firebase project for production (optional)

---

## 📊 Project Structure

```
lugn-trygg-mobile/
├── src/
│   ├── screens/          ← UI screens (7 screens)
│   ├── navigation/       ← Navigation setup
│   ├── services/         ← API & Health services
│   ├── context/          ← Authentication context
│   ├── hooks/            ← Custom hooks
│   ├── types/            ← TypeScript types
│   ├── theme/            ← Design tokens
│   └── config/           ← Firebase config
├── App.tsx               ← Root component
├── app.json              ← Expo configuration
├── .env.local            ← Development config (created from .env.example)
├── .env.example          ← Template (in git)
└── package.json          ← Dependencies
```

---

## ✅ What Works

- ✅ React Native + TypeScript
- ✅ Expo for easy development
- ✅ Firebase Authentication (Email/Password)
- ✅ React Navigation (Tabs + Stack)
- ✅ Material Design (React Native Paper)
- ✅ API integration (Axios)
- ✅ Environment variables (dev + prod)
- ✅ Bottom tab navigation
- ✅ Authentication flow

---

## 📚 Next Steps

After successful startup:

1. **Test All Screens**
   - Home: View health dashboard
   - Mood: Log mood entries
   - Integrations: Connect devices
   - Analysis: View AI insights
   - Profile: Update user info

2. **Test Backend Integration**
   - Ensure Backend is running on port 5001
   - Test saving mood entries
   - Test fetching health data

3. **Prepare for Distribution**
   - Update app icon: `assets/icon.png`
   - Update splash screen: `assets/splash.png`
   - Configure app store listings

4. **Build for Release**
   ```bash
   # Android
   eas build --platform android

   # iOS (Mac only)
   eas build --platform ios

   # Web
   npm run build:web
   ```

---

## 🆘 Need Help?

### Check Logs

```bash
# View detailed console output
npm start

# In another terminal, tail logs
tail -f ~/Library/Logs/Expo/Expo.log  # Mac
# or
Get-Content "path-to-expo-logs" -Tail 50  # Windows PowerShell
```

### Reset Everything

```bash
# Complete reset
rm -rf node_modules .expo
npm install
npm start
```

### Check Dependencies

```bash
# Verify all packages installed correctly
npm ls react-native
npm ls @react-navigation/native
npm ls firebase
```

---

## 🎉 Success!

When you see:
```
✅ App loaded on simulator/web
✅ Can sign up and login
✅ Firebase authentication working
✅ Backend API responding
✅ Mood entries being saved
```

**Congratulations! 🎊 The mobile app is production-ready!**

---

## 📞 Support

For issues or questions:

1. Check the troubleshooting section above
2. Review `.env.local` configuration
3. Check Firebase Console for errors
4. View browser console for stack traces
5. Check backend logs: `Backend/src/main.py` output

---

**Ready to start? Run this:**

```bash
cd lugn-trygg-mobile
npm install
npm start
# Press 'w' for web, 'a' for Android, 'i' for iOS
```

🚀 Good luck!
