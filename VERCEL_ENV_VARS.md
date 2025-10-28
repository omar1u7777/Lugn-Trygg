# 🔧 Vercel Environment Variables för Lugn & Trygg Frontend
# Kopiera dessa till Vercel Dashboard > Project Settings > Environment Variables

## 🔥 KRITISKA (Obligatoriska för att appen ska fungera)

### Backend URL
VITE_BACKEND_URL=https://lugn-trygg-backend.onrender.com

### Firebase Configuration (Hämta från Firebase Console)
VITE_FIREBASE_API_KEY=din_firebase_api_key_här
VITE_FIREBASE_AUTH_DOMAIN=din_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=din_project_id
VITE_FIREBASE_STORAGE_BUCKET=din_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456789

### Säkerhet
VITE_ENCRYPTION_KEY=din_32_tecken_långa_encryption_nyckel

## 📊 ANALYTICS (Rekommenderade för produktion)

### Amplitude (För användaranalys)
VITE_AMPLITUDE_API_KEY=din_amplitude_api_key

### Sentry (För felrapportering)
VITE_SENTRY_DSN=https://din_sentry_dsn_url

### Vercel Analytics
VITE_VERCEL_ANALYTICS_ID=din_vercel_analytics_id

## 🖼️ MEDIA (För bilduppladdning)

### Cloudinary (För bildoptimering)
VITE_CLOUDINARY_CLOUD_NAME=din_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=optimized_images

## ⚡ PRESTANDA (Valfria optimeringar)

### Prestandaövervakning
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_PERFORMANCE_SAMPLE_RATE=0.1
VITE_ENABLE_WEB_VITALS=true

### Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true

## 🔍 DEBUG (Endast för utveckling)

### Debug-läge (Sätt till 'false' i produktion)
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_MODE=false

---

## 📋 STEG-FÖR-STEG INSTRUKTIONER:

### 1. Firebase Setup:
1. Gå till https://console.firebase.google.com/
2. Välj ditt projekt eller skapa nytt
3. Gå till Project Settings > General > Your apps
4. Lägg till en Web App eller kopiera befintliga credentials
5. Kopiera API Key, Project ID, etc. till Vercel env vars

### 2. Vercel Setup:
1. Gå till Vercel Dashboard
2. Välj ditt projekt
3. Gå till Settings > Environment Variables
4. Lägg till alla variabler ovan
5. **VIKTIGT**: Välj "Production", "Preview", och "Development" för varje variabel
6. Redeploy projektet

### 3. Verifiera:
- Appen laddar utan fel
- Inloggning fungerar
- API-anrop når backend på Render
- Bilder laddas upp korrekt

---

## 🚨 VIKTIGT ATT KOMMA IHÅG:

- **Firebase credentials** måste matcha ditt Firebase-projekt exakt
- **Backend URL** ska peka på din Render-deployment
- **Encryption key** ska vara minst 32 tecken lång
- Alla env vars måste sättas för alla environments (Production/Preview/Development)
- Efter ändringar: Redeploya på Vercel

---

## 🔧 Felsökning:

Om appen inte fungerar efter deployment:
1. Kolla Vercel build logs för fel
2. Verifiera att alla env vars är satta
3. Kontrollera Firebase Console att projektet finns och är aktivt
4. Testa backend-URL direkt i browser: https://lugn-trygg-backend.onrender.com/api/mood/get