# 🚀 RENDER ENVIRONMENT VARIABLES - ADD NOW

## Status: ✅ Build OK, ❌ Missing Secrets

Your Render backend **built successfully** but won't start because:
- `FIREBASE_CREDENTIALS` is missing
- `JWT_SECRET_KEY` is missing

---

## 🎯 What to Do RIGHT NOW (5 Minutes)

### Step 1: Open Render Dashboard
```
https://dashboard.render.com/services/srv-d3ref3vdiees73bkjnp0
```

### Step 2: Click "Settings" Tab
Top right of the page

### Step 3: Scroll to "Environment"
You'll see an empty text area

### Step 4: Copy Values from Your `.env` File

Open your local file: `Backend/.env`

Find these exact values:
1. `FIREBASE_CREDENTIALS=` - Copy the entire value (the long JSON object)
2. `JWT_SECRET_KEY=` - Copy the value
3. `JWT_REFRESH_SECRET_KEY=` - Copy the value
4. `OPENAI_API_KEY=` - Copy the value (optional but recommended)

### Step 5: Add All These Variables to Render

Paste this into the Environment text area on Render, replacing `(values)` with your actual values from `.env`:

```
FIREBASE_CREDENTIALS=(paste entire value from Backend/.env)
JWT_SECRET_KEY=(paste from Backend/.env)
JWT_REFRESH_SECRET_KEY=(paste from Backend/.env)
JWT_EXPIRATION_MINUTES=15
JWT_REFRESH_EXPIRATION_DAYS=360
FIREBASE_API_KEY=AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
FIREBASE_AUTH_DOMAIN=lugn-trygg-53d75.firebaseapp.com
FIREBASE_PROJECT_ID=lugn-trygg-53d75
FIREBASE_STORAGE_BUCKET=lugn-trygg-53d75.appspot.com
FIREBASE_MESSAGING_SENDER_ID=619308821427
FIREBASE_APP_ID=1:619308821427:web:836ccc02062af8fde539c6
FLASK_DEBUG=False
PORT=10000
CORS_ALLOWED_ORIGINS=https://lugn-trygg-93uuaxabh-omaralhaeks-projects.vercel.app,http://localhost:3000,http://localhost:8081,http://localhost:19000,http://localhost:19001
OPENAI_API_KEY=(paste from Backend/.env or OpenAI dashboard)
```

### Step 6: Click "Save"

Render will automatically redeploy (2-3 minutes)

---

## ✅ How to Know It's Working

Watch the Logs tab:
- Should see green checkmark when deploy completes
- No more `ValueError` messages

Then test:
```powershell
.\test-render-backend.ps1
```

Or manually:
```bash
curl https://lugn-trygg-backend.onrender.com/api/health
```

Expected response:
```json
{"status":"ok","message":"Backend is running"}
```

---

## 📝 Key Points

1. **FIREBASE_CREDENTIALS** - Must be the ENTIRE JSON object (all on one line)
2. **Paste exactly** - Don't add extra spaces or quotes
3. **Click Save** - This triggers auto-redeploy
4. **Wait 2-3 min** - Render will rebuild and restart

---

## 🆘 If Something Goes Wrong

1. **Check Render Logs** - Dashboard → Logs tab
2. **Look for errors** - Search for `ERROR` or `ValueError`
3. **Verify variables** - Settings → Environment (all there?)
4. **Try Manual Deploy** - Click "Manual Deploy" button

---

**Once you add these variables, your backend will be LIVE!** 🎉

Then we'll:
1. Update frontend API URLs
2. Redeploy web app
3. Build Android APK
4. Done!

