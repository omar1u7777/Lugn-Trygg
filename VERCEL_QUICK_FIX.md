# 🎯 SNABB GUIDE - Fixa Vercel Deployment

## ⚡ 5 Minuters Fix

### 1️⃣ Öppna Vercel Settings
```
vercel.com → Ditt Projekt → Settings (högst upp)
```

### 2️⃣ Ändra dessa 3 inställningar

#### Build & Development Settings

```
┌─────────────────────────────────────────┐
│ Root Directory                          │
│ ┌─────────────────────────────────────┐ │
│ │ web-app                             │ │ ← ÄNDRA TILL DETTA
│ └─────────────────────────────────────┘ │
│                                         │
│ Build Command                           │
│ ┌─────────────────────────────────────┐ │
│ │ npm run build                       │ │ ← ÄNDRA TILL DETTA
│ └─────────────────────────────────────┘ │
│                                         │
│ Output Directory                        │
│ ┌─────────────────────────────────────┐ │
│ │ dist                                │ │ ← ÄNDRA TILL DETTA
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 3️⃣ Lägg till Environment Variables

Gå till: **Settings → Environment Variables → Add New**

Kopiera och klistra in dessa (en i taget):

```env
Name: VITE_FIREBASE_API_KEY
Value: AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
✓ Production ✓ Preview ✓ Development
[Save]

Name: VITE_FIREBASE_AUTH_DOMAIN
Value: lugn-trygg.firebaseapp.com
✓ Production ✓ Preview ✓ Development
[Save]

Name: VITE_FIREBASE_PROJECT_ID
Value: lugn-trygg
✓ Production ✓ Preview ✓ Development
[Save]

Name: VITE_FIREBASE_STORAGE_BUCKET
Value: lugn-trygg.firebasestorage.app
✓ Production ✓ Preview ✓ Development
[Save]

Name: VITE_FIREBASE_MESSAGING_SENDER_ID
Value: 412776932054
✓ Production ✓ Preview ✓ Development
[Save]

Name: VITE_FIREBASE_APP_ID
Value: 1:412776932054:web:7c4c72c93eb9b5c49fdaf0
✓ Production ✓ Preview ✓ Development
[Save]

Name: VITE_API_URL
Value: https://lugn-trygg-backend.onrender.com
✓ Production ✓ Preview ✓ Development
[Save]
```

### 4️⃣ Redeploy

```
Deployments → Senaste deployen → ... (meny) → Redeploy
[ ] Use existing Build Cache  ← SE TILL ATT DENNA ÄR AVBOCKAD!
[Redeploy]
```

### 5️⃣ Vänta 2-5 min och testa!

```
https://lugn-trygg-9nzjs2eki-omaralhaeks-projects.vercel.app/
```

---

## ✅ Klart när du ser:

1. ✅ Login-sidan med korrekt design
2. ✅ Kan logga in med: `demo@lugntrygg.se` / `Demo123!`
3. ✅ Dashboard fungerar

---

## ❌ Problem? Kolla detta:

### Build Failed
→ Kolla Deployments → Senaste → View Build Logs
→ Se efter "error" i loggen

### Blank sida
→ Tryck F12 → Console tab
→ Troligen saknas environment variables

### Gamla appen visas fortfarande
→ Ctrl+Shift+R (hard refresh)
→ Eller vänta 1-2 min på cache clear

---

## 📋 Quick Checklist

- [ ] Root Directory = `web-app` ✓
- [ ] Build Command = `npm run build` ✓
- [ ] Output Directory = `dist` ✓
- [ ] 7 st VITE_* variables tillagda ✓
- [ ] Redeployed (utan cache) ✓
- [ ] Sidan fungerar! 🎉

---

**Tid:** ~5 min
**Svårighet:** ⭐ Lätt
**Status:** ✅ GitHub är uppdaterad - Nu är det din tur att fixa Vercel!
