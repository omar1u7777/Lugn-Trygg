# 🔐 ENVIRONMENT VARIABLES SETUP GUIDE

## Overview

The Lugn & Trygg mobile app uses environment variables to manage configuration across different environments (development, staging, production).

---

## 📁 Environment Files

```
lugn-trygg-mobile/
├── .env.local          ← Your local development config (NOT in git ✗)
├── .env.production     ← Production config (NOT in git ✗)
├── .env.example        ← Template for other developers (in git ✓)
└── .gitignore          ← Prevents .env files from being committed
```

---

## 🔧 Setup Steps

### Step 1: Copy the Template

```bash
cp .env.example .env.local
```

### Step 2: Fill in Your Values

Edit `.env.local` and add your Firebase credentials:

```bash
EXPO_PUBLIC_API_URL=http://localhost:5001
EXPO_PUBLIC_FIREBASE_API_KEY=YOUR_KEY_HERE
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_DOMAIN_HERE
# ... etc
```

### Step 3: Verify Configuration

Check that all values are filled in (no "YOUR_" placeholders remaining)

### Step 4: Start the App

```bash
npm start
```

---

## 🌍 Environment Variables Explained

### Backend API

```
EXPO_PUBLIC_API_URL
```

**Purpose**: Points to the Flask backend API

**Values**:
- Development: `http://localhost:5001`
- Production: `https://api.lugn-trygg.se`

---

### Firebase Authentication

```
EXPO_PUBLIC_FIREBASE_API_KEY
```

**Purpose**: Firebase Web API Key for authentication

**Where to get**:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project "Lugn & Trygg"
3. Settings → Project Settings
4. Copy "API Key" from Web API Key section

**Example**: `AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY`

---

### Firebase Authentication Domain

```
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
```

**Purpose**: Domain for Firebase authentication

**Format**: `{projectname}.firebaseapp.com`

**Example**: `lugn-trygg-53d75.firebaseapp.com`

---

### Firebase Project ID

```
EXPO_PUBLIC_FIREBASE_PROJECT_ID
```

**Purpose**: Identifies your Firebase project

**Where to get**:
1. Firebase Console → Project Settings
2. Copy "Project ID"

**Example**: `lugn-trygg-53d75`

---

### Firebase Storage Bucket

```
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
```

**Purpose**: Cloud Storage location for files

**Format**: `{projectname}.appspot.com`

**Example**: `lugn-trygg-53d75.appspot.com`

---

### Firebase Messaging Sender ID

```
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
```

**Purpose**: For push notifications via Firebase Cloud Messaging

**Where to get**:
1. Firebase Console → Cloud Messaging tab
2. Find "Sender ID"

**Example**: `111615148451`

---

### Firebase App ID

```
EXPO_PUBLIC_FIREBASE_APP_ID
```

**Purpose**: Identifies your Firebase app configuration

**Format**: `1:{numeric-id}:web:{hex-id}`

**Example**: `1:111615148451:web:1b1b1b1b1b1b1b1b1b1b1b`

---

## 🔒 Security Considerations

### ✅ DO's

- ✅ Keep `.env.local` out of version control
- ✅ Use `.env.example` as a template
- ✅ Rotate API keys periodically
- ✅ Use different keys for dev/prod
- ✅ Document all environment variables
- ✅ Restrict Firebase permissions to what's needed

### ❌ DON'Ts

- ❌ Never commit `.env.local` to git
- ❌ Never hardcode secrets in code
- ❌ Never share API keys via Slack/Email
- ❌ Never use production keys for development
- ❌ Never push secrets to GitHub
- ❌ Never log sensitive values

---

## 🚀 Environment-Specific Configuration

### Development (.env.local)

```bash
EXPO_PUBLIC_API_URL=http://localhost:5001
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=lugn-trygg-53d75.firebaseapp.com
# ... debug enabled, verbose logging
```

**Use case**: Local testing on simulator

---

### Production (.env.production)

```bash
EXPO_PUBLIC_API_URL=https://api.lugn-trygg.se
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=lugn-trygg-53d75.firebaseapp.com
# ... debug disabled, no verbose logging
```

**Use case**: App Store / Google Play builds

---

## 🔄 How Environment Variables Work in React Native/Expo

### Accessing Variables in Code

```typescript
import { API_BASE_URL } from '../config/constants';

// Or directly:
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
```

### Rules

1. **EXPO_PUBLIC_ prefix required**
   - Only variables starting with `EXPO_PUBLIC_` are exposed to the app
   - Other variables are private to Expo CLI only

2. **Build-time substitution**
   - Variables are replaced at build time
   - Changes require app restart

3. **No modification at runtime**
   - Can't change env vars after build
   - For runtime config, use Firestore or API

---

## 🧪 Testing Your Configuration

### Verify Firebase Connection

Add this test file temporarily:

```typescript
// test-firebase-config.ts
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

try {
  const app = initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}
```

---

## 🔗 Getting Your Firebase Credentials

### Option 1: Firebase Console (Web App)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select "Lugn & Trygg" project
3. Click Settings ⚙️
4. Go to "Project Settings"
5. Find "Your apps" section
6. Click on the web app
7. Copy the credentials

### Option 2: From Backend .env

Your backend already has the Firebase config. Extract from `Backend/.env`:

```bash
grep FIREBASE Backend/.env | grep -E "KEY|DOMAIN|PROJECT|BUCKET|SENDER|APP_ID"
```

### Option 3: Firebase Console Direct Link

For project "Lugn & Trygg":
- [Firebase Console](https://console.firebase.google.com/project/lugn-trygg-53d75/settings/general)

---

## 🆘 Troubleshooting

### Problem: "Firebase not initialized"

**Cause**: Wrong or missing API key

**Solution**:
1. Check `.env.local` exists
2. Verify API key matches Firebase Console
3. Restart dev server: `npm start` then press `r`

---

### Problem: "API connection failed"

**Cause**: Wrong backend URL

**Solution**:
1. Verify `EXPO_PUBLIC_API_URL` is correct
2. Make sure backend is running: `python Backend/src/main.py`
3. Check backend is on correct port (5001)

---

### Problem: "Variables not updating"

**Cause**: Expo caches variables at build time

**Solution**:
1. Clear Expo cache: `npm start` then press `c`
2. Rebuild app: Delete `.expo` folder
3. Restart dev server

---

## 📋 Checklist

Before deploying:

- [ ] `.env.local` created and filled
- [ ] All variables have real values (no "YOUR_" placeholders)
- [ ] `.env.local` is in `.gitignore`
- [ ] Firebase credentials verified in console
- [ ] Backend API URL is correct
- [ ] Tested on simulator/device
- [ ] `.env.production` created for production build
- [ ] Production API URL points to production server

---

## 🔄 Updating Environment Variables

### During Development

Edit `.env.local`:

```bash
# Change this:
EXPO_PUBLIC_API_URL=http://localhost:5001

# To this:
EXPO_PUBLIC_API_URL=http://your-new-api.com
```

Then restart Expo:
```bash
npm start
# Press 'r' to reload
```

### For Production Build

Edit `.env.production`:

```bash
EXPO_PUBLIC_API_URL=https://api.lugn-trygg.se
```

Then build:
```bash
npm run build:web
# or
eas build --platform android
```

---

## 📚 References

- [Firebase Console](https://console.firebase.google.com/)
- [Expo Environment Variables](https://docs.expo.dev/build-reference/variables/)
- [Firebase Configuration](https://firebase.google.com/docs/web/setup)
- [Environment Variables Best Practices](https://12factor.net/config)

---

## ✅ Status

Current `.env.local` status:

```
✅ API URL: http://localhost:5001
✅ Firebase Project: lugn-trygg-53d75
✅ All credentials configured
✅ Ready for testing
```

Ready to start the app! 🚀
