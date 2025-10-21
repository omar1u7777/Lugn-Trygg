# ⚡ SNABB SETUP - Nytt Vercel Projekt

## 🎯 10 Minuters Setup

### 1. Import Project (2 min)
```
https://vercel.com/new
→ Import Git Repository
→ Välj: omar1u7777/Lugn-Trygg
→ Import
```

---

### 2. Configure Project (3 min)

#### Framework Preset
```
Other
```

#### Root Directory (VIKTIGT!)
```
web-app
```

#### Build Settings
```
Build Command:     npm run build
Output Directory:  dist
Install Command:   npm install
```

---

### 3. Environment Variables (4 min)

Kopiera och klistra in en i taget:

```
VITE_FIREBASE_API_KEY
AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY

VITE_FIREBASE_AUTH_DOMAIN
lugn-trygg.firebaseapp.com

VITE_FIREBASE_PROJECT_ID
lugn-trygg

VITE_FIREBASE_STORAGE_BUCKET
lugn-trygg.firebasestorage.app

VITE_FIREBASE_MESSAGING_SENDER_ID
412776932054

VITE_FIREBASE_APP_ID
1:412776932054:web:7c4c72c93eb9b5c49fdaf0

VITE_API_URL
https://lugn-trygg-backend.onrender.com
```

**För varje variabel:**
- Name: (namnet från listan)
- Value: (värdet från listan)
- ✓ Production ✓ Preview ✓ Development
- [Save]

---

### 4. Deploy! (1 min)
```
[Deploy] knappen längst ner
```

Vänta 2-5 min...

---

### 5. Testa! (30 sek)

Besök din nya URL:
```
https://lugn-trygg-XXXXX.vercel.app
```

Kontrollera:
- ✅ Login-sidan visas
- ✅ Rätt design
- ✅ Kan logga in

---

## ✅ Checklist

- [ ] Import från GitHub ✓
- [ ] Root Directory = `web-app` ✓
- [ ] Build Command = `npm run build` ✓
- [ ] Output Directory = `dist` ✓
- [ ] 7 environment variables tillagda ✓
- [ ] Deployed ✓
- [ ] Testad och fungerar ✓

---

## 🔑 Testinloggning

```
Email:    demo@lugntrygg.se
Password: Demo123!
```

*Skapa först i Firebase Console!*
*Se: FIREBASE_TEST_USERS.md*

---

## 🆘 Problem?

**Build Failed?**
→ Kolla att Root Directory = `web-app`

**Blank sida?**
→ Kontrollera environment variables
→ Öppna F12 console

**Gammalt innehåll?**
→ Ctrl+Shift+R (hard refresh)

---

## 📚 Mer hjälp

Detaljerad guide: `VERCEL_NEW_PROJECT_SETUP.md`

---

**Tid:** ~10 min
**Status:** ✅ REDO!
