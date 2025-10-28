# 🔑 Hur du hämtar riktiga värden för dina Environment Variables

## 1. 📊 **AMPLITUDE API KEY**
```
VITE_AMPLITUDE_API_KEY=din_amplitude_api_key
```

**Så här får du den:**
1. Gå till: https://amplitude.com/
2. Logga in eller skapa konto
3. Gå till: **Settings** → **Projects**
4. Välj ditt projekt
5. Kopiera **API Key** från "Project Information"

---

## 2. 🐛 **SENTRY DSN**
```
VITE_SENTRY_DSN=https://din_sentry_dsn_url
```

**Så här får du den:**
1. Gå till: https://sentry.io/
2. Logga in eller skapa konto
3. Gå till: **Projects**
4. Välj ditt projekt (eller skapa nytt React-projekt)
5. Gå till: **Settings** → **Client Keys (DSN)**
6. Kopiera **DSN** från "Client Keys"

---

## 3. ⚡ **VERCEL ANALYTICS ID**
```
VITE_VERCEL_ANALYTICS_ID=din_vercel_analytics_id
```

**Så här får du den:**
1. Gå till: https://vercel.com/dashboard
2. Välj ditt projekt
3. Gå till: **Settings** → **Analytics**
4. Kopiera **Analytics ID** (om tillgängligt)
   - Eller lämna tom om du inte använder Vercel Analytics

---

## 4. 🖼️ **CLOUDINARY (Du har redan rätt värden)**
```
VITE_CLOUDINARY_CLOUD_NAME=lugn-trygg
VITE_CLOUDINARY_UPLOAD_PRESET=optimized_images
```

**Du har redan rätt värden!** Om du behöver ändra:
1. Gå till: https://cloudinary.com/
2. Logga in på ditt konto
3. Gå till: **Dashboard** → **Account Details**
4. Kopiera **Cloud name**
5. För Upload Preset: Gå till **Settings** → **Upload** → Skapa/en preset

---

## 5. 🔐 **ENCRYPTION KEY (32 tecken)**
```
VITE_ENCRYPTION_KEY=din_32_tecken_långa_nyckel
```

**Så här skapar du en säker nyckel:**
1. Öppna terminal/PowerShell
2. Kör detta kommando:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Kopiera den genererade strängen (64 tecken hex)

**Alternativ:** Använd en online generator eller skapa själv:
- Minst 32 tecken lång
- Använd stora/små bokstäver, siffror, symboler
- Exempel: `MySuperSecretKey123!@#With32CharsMin`

---

## 🎯 **SAMMANFATTNING - Vilka som är obligatoriska:**

### 🔥 **KRITISKA (Måste ha):**
- `VITE_BACKEND_URL` ✅ (har du)
- `VITE_FIREBASE_*` ✅ (har du)
- `VITE_ENCRYPTION_KEY` ❌ (generera en)

### 📊 **REKOMMENDERADE (Bra att ha):**
- `VITE_AMPLITUDE_API_KEY` - För användaranalys
- `VITE_SENTRY_DSN` - För felrapportering
- `VITE_VERCEL_ANALYTICS_ID` - För Vercel analytics

### 🖼️ **MEDIA (Valfritt):**
- `VITE_CLOUDINARY_*` ✅ (har du redan)

---

## 🚀 **Vad du ska göra nu:**

1. **Generera encryption key** med kommandot ovan
2. **Skapa konton** på Amplitude/Sentry om du vill ha analytics
3. **Lägg till alla env vars** i Vercel med riktiga värden
4. **Redeploya** och testa

**Fråga om du behöver hjälp med något av stegen!** 🎯