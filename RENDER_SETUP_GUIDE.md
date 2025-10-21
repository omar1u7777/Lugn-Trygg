# 🚀 Render Environment Configuration Required

## Problem
Your Render backend deployment failed to start because **environment variables are missing**:
```
ValueError: Miljövariabel 'FIREBASE_CREDENTIALS' saknas och är obligatorisk!
ValueError: Miljövariabel 'JWT_SECRET_KEY' saknas och är obligatorisk!
```

---

## Solution: Add Environment Variables

### Step-by-Step

1. **Go to Render Dashboard**
   - URL: https://dashboard.render.com/services/srv-d3ref3vdiees73bkjnp0

2. **Click Settings Tab**

3. **Scroll to Environment Section**

4. **Add These Variables**
   - Get actual values from your local `Backend/.env` file
   - Each line is: `KEY=value`

**Required Variables:**
```
FIREBASE_CREDENTIALS=(Firebase service account JSON from .env)
JWT_SECRET_KEY=(From Backend/.env)
JWT_REFRESH_SECRET_KEY=(From Backend/.env)
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
OPENAI_API_KEY=(From your OpenAI API keys)
```

5. **Click Save**
   - Render will auto-deploy (wait 2-3 minutes)

---

## Verify Deployment

Once deployed, test:
```bash
curl https://lugn-trygg-backend.onrender.com/api/health
```

Expected response:
```json
{"status":"ok","message":"Backend is running"}
```

Or use the test script:
```powershell
.\test-render-backend.ps1
```

---

## Environment Variable Sources

| Variable | Where to Get |
|----------|-------------|
| `FIREBASE_CREDENTIALS` | `Backend/.env` - Copy entire value |
| `JWT_SECRET_KEY` | `Backend/.env` or `.env` |
| `JWT_REFRESH_SECRET_KEY` | `Backend/.env` or `.env` |
| `FIREBASE_API_KEY` | Firebase Console |
| `OPENAI_API_KEY` | OpenAI Dashboard |
| All others | Firebase Console → Project Settings |

---

## ✅ After Adding Variables

1. **Render builds automatically** (check Logs tab)
2. **Service should show green** status
3. **Test with curl or PowerShell script**
4. **Update frontend API URLs to production backend**
5. **Redeploy web app to Vercel**

---

## Next: Update Frontend URLs

Once backend is running, update:
- `lugn-trygg-mobile/src/services/api.ts`
- `frontend/src/api/api.ts`

Change API base URL to: `https://lugn-trygg-backend.onrender.com`

Then redeploy web app: `vercel deploy --prod`

