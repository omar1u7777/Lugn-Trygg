# 🔥 Firebase Google Authentication Fix

## Problem
Frontend visade felmeddelandet:
```
Firebase: Error (auth/api-key-not-valid.-please-pass-a-valid-api-key.)
```

## Orsak
Frontend `.env`-filen hade felaktig Firebase-konfiguration och Vite-servern hade inte läst in de uppdaterade värdena.

## Lösning Genomförd ✅

### 1. Uppdaterad Frontend `.env`-fil
Filen `frontend/.env` har uppdaterats med korrekta Firebase-credentials från backend:

```env
# 🔥 Firebase Configuration - Synced with Backend
VITE_FIREBASE_API_KEY=AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
VITE_FIREBASE_AUTH_DOMAIN=lugn-trygg-53d75.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lugn-trygg-53d75
VITE_FIREBASE_STORAGE_BUCKET=lugn-trygg-53d75
VITE_FIREBASE_MESSAGING_SENDER_ID=111615148451906030622
VITE_FIREBASE_APP_ID=1:111615148451:web:1b1b1b1b1b1b1b1b1b1b1b
VITE_FIREBASE_MEASUREMENT_ID=G-1B1B1B1B1B

# 🔗 Backend URL (note: no /api suffix, added in API client)
VITE_BACKEND_URL=http://localhost:54112
```

### 2. Starta om Frontend-servern

**VIKTIGT:** Vite läser endast `.env`-filer vid uppstart. Du MÅSTE starta om frontend-servern för att få de nya värdena!

```powershell
# Stoppa nuvarande frontend-server (Ctrl+C i terminalen där den kör)
# Eller om den kör i bakgrunden, hitta och stoppa processen

# Starta om frontend-servern
cd frontend
npm run dev
```

### 3. Rensa webbläsarens cache
Efter omstart av servern:
1. Öppna DevTools (F12)
2. Högerklicka på reload-knappen
3. Välj "Empty Cache and Hard Reload"

## Verifiering

Efter omstart bör du se följande i konsolen:
```
🔥 Firebase Configuration Loaded:
   API Key: AIzaSyAxs... (not dummy-api-...)
   Auth Domain: lugn-trygg-53d75.firebaseapp.com (not localhost)
   Project ID: lugn-trygg-53d75 (not dummy-project)
```

## Google Sign-In Setup

För att aktivera Google Sign-In i Firebase Console:

1. Gå till [Firebase Console](https://console.firebase.google.com/)
2. Välj projekt: `lugn-trygg-53d75`
3. Gå till **Authentication** → **Sign-in method**
4. Klicka på **Google** i listan
5. Aktivera **Enable**
6. Ange **Project support email** (din email)
7. Klicka **Save**

### Lägg till Authorized Domains
Under **Authentication** → **Settings** → **Authorized domains**, lägg till:
- `localhost`
- `127.0.0.1`
- Din produktions-domän (när du deployar)

## Resultat ✅

Efter dessa steg:
- ✅ Firebase Auth initialiseras korrekt
- ✅ Google Sign-In fungerar
- ✅ Ingen "invalid API key" error
- ✅ Frontend kan autentisera användare

## Backend Status
✅ Backend kör på: http://localhost:54112
✅ Alla 11 blueprints registrerade
✅ Firebase Admin SDK konfigurerad korrekt

---

**Tips:** Om du fortfarande ser dummy-värden efter omstart, kontrollera att:
1. Du sparade `.env`-filen korrekt
2. Du startade om från rätt katalog (`frontend/`)
3. Ingen annan `.env.local` eller `.env.development` fil override:ar värdena
