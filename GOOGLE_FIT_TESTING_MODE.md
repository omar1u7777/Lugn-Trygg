# 🚨 GOOGLE FIT OAUTH - TESTING MODE SETUP

**Problem:** Google Fit scopes kräver verifiering för "External" user type  
**Lösning:** Använd "Testing" publishing status  
**Time:** 1-2 minuter  
**Date:** October 20, 2025

---

## ⚠️ PROBLEM

Du ser detta fel:
```
The following scopes are not available for external usage:
- fitness.activity.read
- fitness.body.read
- fitness.heart_rate.read
- fitness.sleep.read
```

**Orsak:** Google kräver full verifiering för "External" apps som använder Fitness API scopes.

---

## ✅ LÖSNING: Använd Testing Mode

### Steg 1: Ändra Publishing Status (1 minut)

1. **Du är redan på rätt sida:** OAuth consent screen
2. **Leta efter "Publishing status"** eller **"Testing status"** knapp
3. **Klicka:** "PUBLISH APP" eller "MAKE EXTERNAL" knapp
4. **Välj:** "Testing" (INTE "In Production")
5. **Bekräfta**

**ELLER:**

1. **Gå till:** https://console.cloud.google.com/apis/credentials/consent
2. **Se efter sektion:** "Publishing status"
3. **Om den säger "External - Not Published"** → Detta är OK!
4. **Lägg till test users** (se nästa steg)

### Steg 2: Lägg till Test Users (1 minut)

1. **Samma sida** (OAuth consent screen)
2. **Gå till:** "Test users" tab/section
3. **Klicka:** "+ ADD USERS"
4. **Lägg till din email:**
   ```
   omaralhaek97@gmail.com
   ```
5. **Klicka:** "SAVE"

### Steg 3: Ignorera Verifieringsvarningar

När du är i **"Testing" mode**:
- ✅ Du kan använda alla Fitness API scopes
- ✅ Upp till 100 test users
- ✅ Ingen verifiering krävs
- ✅ Perfekt för utveckling och demo
- ⚠️ Bara test users kan logga in

---

## 📋 VERIFERINGSVARNINGAR - VAD DU KAN IGNORERA

Du ser dessa varningar, men de **spelar ingen roll i Testing mode:**

### "Required fields missing:"
- ❌ Homepage link - **Ignorera för testing**
- ❌ Privacy policy link - **Ignorera för testing**
- ❌ App logo - **Ignorera för testing**

**Varför?** Dessa krävs bara för "In Production" mode när du submittar för Google verification.

### "Needs verification"
- ⚠️ Detta är normalt för Fitness API scopes
- ✅ I "Testing" mode kan du ändå använda scopes
- ✅ Test users kan logga in utan verifiering

---

## 🎯 TESTING MODE FÖRDELAR

### Vad du kan göra:
- ✅ Använda alla 4 Fitness API scopes
- ✅ Testa OAuth flow
- ✅ Synka real Google Fit data
- ✅ Upp till 100 test users
- ✅ Ingen tidsbegränsning
- ✅ Ingen Google verification krävs

### Begränsningar:
- ⚠️ Bara test users kan logga in
- ⚠️ "This app isn't verified" warning visas (normalt, klicka "Advanced" → "Go to app")
- ⚠️ Kan inte användas av allmänheten (än)

---

## 📝 UPDATING CONFIGURATION

Nu när scopes är tillagda, behöver du bara:

### 1. Skapa Client Secret

Eftersom den nuvarande är maskerad (`****btp3`):

1. **Gå till:** https://console.cloud.google.com/apis/credentials
2. **Klicka:** Din OAuth client ("Web client...")
3. **Under "Client secrets"** → Klicka **"ADD SECRET"**
4. **Kopiera** den nya secret (ex: `GOCSPX-abc123xyz...`)

### 2. Uppdatera Backend/.env

```powershell
# Öppna filen
notepad c:\Projekt\Lugn-Trygg-main_klar\Backend\.env

# Hitta denna rad:
GOOGLE_FIT_CLIENT_SECRET=GOCSPX-W_____btp3

# Ersätt med din nya secret:
GOOGLE_FIT_CLIENT_SECRET=GOCSPX-<din-nya-secret-här>

# Spara filen (Ctrl+S)
```

---

## 🚀 TESTA OAUTH FLOW

### Steg 1: Starta Backend
```powershell
cd c:\Projekt\Lugn-Trygg-main_klar\Backend
python main.py
```

**Förväntat output:**
```
 * Running on http://127.0.0.1:5001
Blueprint integration_bp registrerad under /api/integration
[OAuth] Google Fit OAuth configured successfully
```

### Steg 2: Starta Frontend
```powershell
cd c:\Projekt\Lugn-Trygg-main_klar\frontend
npm start
```

### Steg 3: Test OAuth Connection

1. **Öppna:** http://localhost:3000/integrations/oauth
2. **Klicka:** "Connect" på Google Fit card
3. **Förväntat:**
   - Popup öppnas
   - Google login page
   - **"This app isn't verified"** warning (NORMALT!)
   - Klicka **"Advanced"** → **"Go to Lugn & Trygg (unsafe)"**
   - Permission screen visar 4 scopes
   - Klicka **"Allow"**
   - Popup stängs
   - Status: "Connected" ✅

### Steg 4: Sync Data

1. **Klicka:** "Sync Now" button
2. **Förväntat:**
   - Backend gör API call till Google Fit
   - Real data hämtas (steg, hjärtfrekvens, sömn, kalorier)
   - Data sparas till Firestore
   - Success message visas

---

## 🔐 "THIS APP ISN'T VERIFIED" - FÖRKLARING

### När du ser denna warning:

```
⚠️ This app isn't verified

Google hasn't verified this app yet. Only proceed if you 
know and trust the developer (omaralhaek97@gmail.com).
```

**Detta är NORMALT och FÖRVÄNTAT!**

### Vad du gör:
1. Klicka **"Advanced"** (längst ner)
2. Klicka **"Go to Lugn & Trygg (unsafe)"**
3. Klicka **"Allow"** på permission screen

### Varför det händer:
- Google visar detta för ALLA apps i "Testing" mode
- Det betyder INTE att appen är osäker
- Du är developer och test user - det är OK
- För produktion submittar du för verification (1-2 veckor)

---

## 📊 EXPECTED RESULTS

### Firestore - oauth_tokens Collection

```json
{
  "user_id": "abc123",
  "provider": "google_fit",
  "access_token": "ya29.a0AfB_byBc...",
  "refresh_token": "1//0gXxYzAbc...",
  "token_type": "Bearer",
  "expires_at": 1729469200,
  "scopes": [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.heart_rate.read",
    "https://www.googleapis.com/auth/fitness.sleep.read"
  ],
  "created_at": 1729465600,
  "updated_at": 1729465600
}
```

### Firestore - health_data Collection

```json
{
  "user_id": "abc123",
  "provider": "google_fit",
  "date": "2025-10-20",
  "metrics": {
    "steps": 8543,
    "heart_rate_avg": 72,
    "heart_rate_max": 145,
    "heart_rate_min": 58,
    "sleep_hours": 7.5,
    "calories": 2134,
    "distance_meters": 6234,
    "active_minutes": 45
  },
  "synced_at": 1729465800,
  "sync_status": "success"
}
```

### Backend Console Output

```
[OAuth] Authorization URL requested for google_fit
[OAuth] State: abc123xyz789
[OAuth] Redirect URI: http://localhost:5001/api/integration/oauth/google_fit/callback

[OAuth] Callback received: code=4/0AY0e-g... state=abc123xyz789
[OAuth] Exchanging authorization code for token...
[OAuth] Token received successfully
[OAuth] Access token expires in: 3600 seconds
[OAuth] Refresh token saved
[OAuth] Token stored in Firestore

[Health] Sync requested for google_fit
[Health] Fetching activity data...
[Health] API Response: 200 OK
[Health] Parsed steps: 8543
[Health] Parsed calories: 2134
[Health] Fetching heart rate data...
[Health] Average heart rate: 72 bpm
[Health] Fetching sleep data...
[Health] Sleep duration: 7.5 hours
[Health] Data saved to Firestore
[Health] Sync completed successfully
```

---

## 🎯 PRODUCTION DEPLOYMENT (FÖR FRAMTIDEN)

När du vill släppa till allmänheten:

### 1. Fyll i Required Fields
```
✅ App logo (120x120 PNG)
✅ Homepage: https://lugn-trygg-53d75.web.app
✅ Privacy Policy: https://lugn-trygg-53d75.web.app/privacy
✅ Terms of Service: https://lugn-trygg-53d75.web.app/terms
```

### 2. Create Privacy Policy Page
- Förklara hur du använder Google Fit data
- Data retention policy
- User rights (radera data, etc.)
- Third-party sharing (none)

### 3. Create Demo Video
- YouTube video som visar OAuth flow
- Hur du använder scopes
- 2-5 minuter lång
- Visa alla features

### 4. Submit for Verification
- Google review: 1-2 veckor
- Kan be om mer info
- Kan kräva ändringar

### 5. Update to Production
```
Publishing status: "In production"
User type: External
```

---

## ✅ COMPLETION CHECKLIST

### Right Now (Testing Mode)
- [x] Fitness API scopes added
- [x] Scope justification provided
- [ ] **Publishing status: Testing** ← VERIFY THIS
- [ ] **Test users added (your email)** ← DO THIS NOW
- [ ] Client secret created
- [ ] Client secret in Backend/.env
- [ ] Backend tested
- [ ] OAuth flow tested
- [ ] Data sync tested

### For Production (Later)
- [ ] App logo uploaded
- [ ] Homepage link added
- [ ] Privacy policy created & linked
- [ ] Terms of service created & linked
- [ ] Demo video created
- [ ] Submit for Google verification
- [ ] Verification approved
- [ ] Change to "In production"

---

## 🚨 TROUBLESHOOTING

### Error: "Access blocked: This app's request is invalid"
**Fix:** Add your email as test user in OAuth consent screen

### Error: "redirect_uri_mismatch"
**Fix:** Verify redirect URI matches exactly:
```
http://localhost:5001/api/integration/oauth/google_fit/callback
```

### Error: "invalid_scope"
**Fix:** Make sure all 4 scopes are added in OAuth consent screen

### Error: "invalid_client"
**Fix:** Create new client secret and update Backend/.env

### Warning: "This app isn't verified"
**This is normal!** Click "Advanced" → "Go to Lugn & Trygg"

---

## 📚 RESOURCES

- OAuth Consent Screen: https://console.cloud.google.com/apis/credentials/consent
- OAuth Clients: https://console.cloud.google.com/apis/credentials
- Google Fit API Docs: https://developers.google.com/fit/rest
- Verification Guide: https://support.google.com/cloud/answer/9110914

---

## ✅ SUMMARY

**Current Status:**
- ✅ Scopes added (4 Fitness API scopes)
- ✅ Justification provided
- ✅ Redirect URI configured
- ⚠️ Need to add test users
- ⚠️ Need client secret

**Next Steps:**
1. Add your email as test user (1 min)
2. Create new client secret (1 min)
3. Update Backend/.env (30 sec)
4. Test OAuth flow (2 min)
5. Celebrate real Google Fit data! 🎉

**Time to Complete:** 5 minutes  
**Difficulty:** Easy  
**Status:** 🟡 Almost Ready → 🟢 Ready!

---

**Created:** October 20, 2025  
**Mode:** Testing (Perfect for development!)  
**Verification:** Not needed for testing mode ✅
