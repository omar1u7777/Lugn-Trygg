# 🚀 Render Environment Variables - Komplett Lista

## ⚠️ SAKNAS NU (Lägg till dessa först!)

```bash
# 📧 SendGrid Email Service
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy

# 🔐 HIPAA Encryption (Generera med: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
HIPAA_ENCRYPTION_KEY=gAAAAABh1234567890abcdefghijklmnopqrstuvwxyz==
```

---

## ✅ DU HAR REDAN (men dubbelkolla värdena)

### 🔥 Firebase Configuration
```bash
FIREBASE_CREDENTIALS=serviceAccountKey.json
FIREBASE_WEB_API_KEY=din-firebase-web-api-key
FIREBASE_API_KEY=din-firebase-api-key
FIREBASE_PROJECT_ID=lugn-trygg-53d75
FIREBASE_STORAGE_BUCKET=lugn-trygg-53d75.appspot.com
FIREBASE_DATABASE_URL=https://lugn-trygg-53d75.firebaseio.com
```

### 🔐 Firebase Service Account (för Render)
```bash
FIREBASE_TYPE=service_account
FIREBASE_PRIVATE_KEY_ID=din-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ndin-private-key-här\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@lugn-trygg-53d75.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=din-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/your-service-account-email
```

### 🤖 Google Cloud & OpenAI
```bash
GOOGLE_APPLICATION_CREDENTIALS=google-credentials.json
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 💳 Stripe Payment
```bash
STRIPE_SECRET_KEY=sk_live_eller_sk_test_xxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_eller_pk_test_xxxxxxxxxx
STRIPE_PRICE_PREMIUM=price_xxxxxxxxxx
STRIPE_PRICE_ENTERPRISE=price_xxxxxxxxxx
STRIPE_PRICE_CBT_MODULE=price_xxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxx
```

### 🔐 Authentication & Security
```bash
JWT_SECRET_KEY=din-jwt-secret-key-här
JWT_REFRESH_SECRET_KEY=din-refresh-secret-key-här
JWT_EXPIRATION_MINUTES=1440
JWT_REFRESH_EXPIRATION_DAYS=360
ENCRYPTION_KEY=din-encryption-key-här
GOOGLE_CLIENT_ID=din-google-oauth-client-id.apps.googleusercontent.com
```

### ⚙️ App Configuration
```bash
FLASK_DEBUG=False
PORT=5001
FRONTEND_URL=https://lugn-trygg.vercel.app
DATABASE_URL=firestore://default
CORS_ALLOWED_ORIGINS=https://lugn-trygg.vercel.app,https://lugn-trygg-git-main-omaralhaeks-projects.vercel.app,https://lugn-trygg.firebaseapp.com
```

---

## 🎯 Snabbguide - Lägg till på Render

1. **Gå till**: [Render Dashboard](https://dashboard.render.com/) → Välj din backend-service
2. **Klicka**: Environment → Add Environment Variable
3. **Lägg till de 2 saknade**:
   - `SENDGRID_API_KEY` = (från SendGrid)
   - `HIPAA_ENCRYPTION_KEY` = (generera ny med Python-kommandot ovan)
4. **Klicka**: Save Changes
5. **Vänta**: Render redeploy automatiskt (1-2 min)

---

## 🧪 Test Efter Deployment

```powershell
# Test 1: Backend health check
curl https://lugn-trygg-backend.onrender.com/api/auth/health

# Test 2: Verifiera CORS (från frontend)
# Öppna lugn-trygg.vercel.app och kolla Console - inga CORS-errors

# Test 3: Skicka test-email (när du är inloggad)
# Testa feedback-systemet eller referral-funktionen
```

---

## 📝 Generera HIPAA_ENCRYPTION_KEY

Kör detta i PowerShell:

```powershell
pip install cryptography
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**⚠️ VIKTIGT**: Spara nyckeln säkert! Om du förlorar den kan du inte dekryptera gamla audit logs!

---

## 🔒 Säkerhet

- ❌ **Commit ALDRIG** dessa keys till GitHub
- ✅ **Använd** Render's Environment Variables (krypterade)
- ✅ **Backup**: Spara keys i en säker lösenordshanterare (1Password, Bitwarden etc.)

---

## 📧 SendGrid Setup

1. Gå till: https://app.sendgrid.com/
2. Settings → API Keys → Create API Key
3. Namn: "Lugn-Trygg Production"
4. Permissions: **Full Access** (eller minst "Mail Send")
5. Kopiera nyckeln (visas bara EN gång!)
6. Lägg till i Render: `SENDGRID_API_KEY=SG.xxxx...`

**Sender Identity:**
- Verifiera din email/domän i SendGrid → Settings → Sender Authentication
- Annars kommer emails att blockeras!

---

## ✅ Checklist

- [ ] SENDGRID_API_KEY tillagd på Render
- [ ] HIPAA_ENCRYPTION_KEY genererad och tillagd
- [ ] Render redeployad (automatiskt efter save)
- [ ] Backend logs visar INGA warnings om saknade keys
- [ ] Test-email skickat och mottaget
- [ ] CORS fungerar från Vercel
- [ ] Alla API endpoints svarar 200 OK

