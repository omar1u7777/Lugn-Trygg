# 🐍 DEPLOY FLASK BACKEND TIL RENDER.COM

## ✅ STEP-BY-STEP GUIDE

### **STEG 1: Gå till Render Dashboard**
https://render.com/dashboard

---

### **STEG 2: Skapa ny Web Service**
1. Klicka **"New +"** knapp
2. Välj **"Web Service"**
3. Anslut GitHub: Välj **`omar1u7777/Lugn-Trygg`** repository
4. Klicka **"Connect"**

---

### **STEG 3: Konfigurera Deployment**

**Basic Settings:**
```
Name:                     lugn-trygg-backend
Environment:              Python 3
Build Command:            pip install -r Backend/requirements.txt
Start Command:            gunicorn -w 4 -b 0.0.0.0:$PORT Backend.main:app
Root Directory:           Backend  (VIKTIGT!)
```

**Environment Variables (Add these):**
```
FLASK_ENV              =  production
FLASK_DEBUG            =  False
PYTHONUNBUFFERED       =  True
```

---

### **STEG 4: Click "Create Web Service"**
Render börjar automatiskt bygga och deployer

**Väntid:** ~2-3 minuter

---

### **STEG 5: Hämta URL**
Efter deployment får du:
```
https://lugn-trygg-backend.onrender.com
```

---

## 📝 IMPORTANT NOTES

### Root Directory Issue
Om du får error om "Backend not found", sätt:
- **Root Directory:** `./Backend` eller lämna tom om Dockerfile finns

### Build Time
Första bygget tar ~2-3 minuter (installerar alla dependencies)
Nästa deployments går snabbare (~30-60 sekunder)

### Free Tier Limitations
- Gratis servrar går i "sleep" efter 15 min inaktivitet
- Första request tar längre tid (~30 sekunder)
- För production, upgrade till paid tier

---

## 🔗 CONNECTING FRONTEND TO BACKEND

Efter backend är live, uppdatera Frontend:

**File: `lugn-trygg-mobile/src/services/api.ts`**
```typescript
const API_BASE_URL = 'https://lugn-trygg-backend.onrender.com';
```

**File: `frontend/src/api/api.ts`**
```typescript
const API_BASE_URL = 'https://lugn-trygg-backend.onrender.com';
```

Sedan rebuild och redeploy web-appen

---

## ✅ TESTING BACKEND

Testa API efter deployment:

```bash
# Get health status
curl https://lugn-trygg-backend.onrender.com/api/health

# Get user moods
curl https://lugn-trygg-backend.onrender.com/api/mood/get

# Login
curl -X POST https://lugn-trygg-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 🚀 QUICK START (COPY-PASTE)

1. Go to: https://render.com/dashboard
2. New Web Service
3. Connect GitHub: `omar1u7777/Lugn-Trygg`
4. Configure:
   - Build: `pip install -r Backend/requirements.txt`
   - Start: `gunicorn -w 4 -b 0.0.0.0:$PORT Backend.main:app`
   - Root: `Backend`
5. Deploy

**That's it!** ✅

---

## 📊 EXPECTED RESULT

```
✅ Service: lugn-trygg-backend
✅ Status: Live
✅ URL: https://lugn-trygg-backend.onrender.com
✅ Environment: Production
```

---

Generated: October 21, 2025
