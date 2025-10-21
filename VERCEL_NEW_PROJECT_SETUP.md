# 🚀 Skapa Nytt Vercel Projekt - Komplett Guide

## 📋 Steg 1: Importera från GitHub

### 1.1 Gå till Vercel Dashboard
```
https://vercel.com/new
```

### 1.2 Välj GitHub Repository
- Klicka på **"Import Git Repository"**
- Välj: **omar1u7777/Lugn-Trygg**
- Klicka **"Import"**

---

## ⚙️ Steg 2: Konfigurera Build Settings

### 2.1 Project Name (valbritt)
```
lugn-trygg
```

### 2.2 Framework Preset
```
Other (eller Vite om det finns)
```

### 2.3 Root Directory
```
web-app
```
**Viktigt:** Klicka "Edit" och välj `web-app` mappen!

### 2.4 Build & Development Settings

#### Build Command:
```bash
npm run build
```

#### Output Directory:
```
dist
```

#### Install Command:
```bash
npm install
```

#### Development Command (lämna som standard):
```bash
npm run dev
```

---

## 🔐 Steg 3: Environment Variables

Klicka på **"Environment Variables"** och lägg till dessa **EN I TAGET**:

### Firebase Variables (OBLIGATORISKA)

```env
Name: VITE_FIREBASE_API_KEY
Value: AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
Environments: ✓ Production ✓ Preview ✓ Development
```

```env
Name: VITE_FIREBASE_AUTH_DOMAIN
Value: lugn-trygg.firebaseapp.com
Environments: ✓ Production ✓ Preview ✓ Development
```

```env
Name: VITE_FIREBASE_PROJECT_ID
Value: lugn-trygg
Environments: ✓ Production ✓ Preview ✓ Development
```

```env
Name: VITE_FIREBASE_STORAGE_BUCKET
Value: lugn-trygg.firebasestorage.app
Environments: ✓ Production ✓ Preview ✓ Development
```

```env
Name: VITE_FIREBASE_MESSAGING_SENDER_ID
Value: 412776932054
Environments: ✓ Production ✓ Preview ✓ Development
```

```env
Name: VITE_FIREBASE_APP_ID
Value: 1:412776932054:web:7c4c72c93eb9b5c49fdaf0
Environments: ✓ Production ✓ Preview ✓ Development
```

### Backend API (OBLIGATORISK)

```env
Name: VITE_API_URL
Value: https://lugn-trygg-backend.onrender.com
Environments: ✓ Production ✓ Preview ✓ Development
```

### Valfria (lägg till senare vid behov)

```env
Name: VITE_FIREBASE_MEASUREMENT_ID
Value: (din measurement ID om du har)
Environments: ✓ Production ✓ Preview ✓ Development
```

```env
Name: VITE_STRIPE_PUBLISHABLE_KEY
Value: (din Stripe key när du har en)
Environments: ✓ Production ✓ Preview ✓ Development
```

```env
Name: VITE_GOOGLE_CLIENT_ID
Value: (din Google OAuth client ID)
Environments: ✓ Production ✓ Preview ✓ Development
```

---

## 🎯 Steg 4: Deploy!

1. Scrolla ner till botten
2. Klicka på **"Deploy"**
3. Vänta 2-5 minuter medan Vercel bygger

---

## ✅ Steg 5: Verifiera Deployment

### 5.1 Vänta på Build
Du kommer se:
```
Building...
▲ Vercel Build
> Building web-app
✓ Build completed successfully
```

### 5.2 Få din URL
När det är klart får du en URL som:
```
https://lugn-trygg-XXXXX.vercel.app
```

### 5.3 Testa sidan
Besök URL:en och kontrollera:
- ✅ Login-sidan visas korrekt
- ✅ Design ser rätt ut (Lugn & Trygg branding)
- ✅ Kan skapa konto eller logga in

---

## 📊 Komplett Setup Sammanfattning

### Build Settings
```
Framework:         Other/Vite
Root Directory:    web-app
Build Command:     npm run build
Output Directory:  dist
Install Command:   npm install
Node Version:      18.x (eller senaste)
```

### Environment Variables (7 obligatoriska)
```
1. VITE_FIREBASE_API_KEY
2. VITE_FIREBASE_AUTH_DOMAIN
3. VITE_FIREBASE_PROJECT_ID
4. VITE_FIREBASE_STORAGE_BUCKET
5. VITE_FIREBASE_MESSAGING_SENDER_ID
6. VITE_FIREBASE_APP_ID
7. VITE_API_URL
```

---

## 🔍 Felsökning

### Build Failed?

#### Fel: "Cannot find module"
**Lösning:**
- Kontrollera att Root Directory = `web-app`
- Kontrollera att Build Command = `npm run build`

#### Fel: "VITE_FIREBASE_API_KEY is not defined"
**Lösning:**
- Gå till Project Settings → Environment Variables
- Lägg till alla VITE_* variabler
- Redeploy

#### Fel: "Build exceeded time limit"
**Lösning:**
- Normal första gången
- Klicka "Redeploy" igen

### Deployment Success men blank sida?

**Lösning:**
1. Öppna Developer Tools (F12)
2. Gå till Console tab
3. Leta efter fel
4. Troligen saknas environment variables
5. Lägg till dem och redeploy

### CORS Error?

**Lösning:**
- Detta är normalt under utveckling
- Backend måste tillåta din Vercel domain
- Lägg till din Vercel URL i backend CORS config

---

## 📱 Efter Deployment

### Anpassa Domain (valfritt)
1. Gå till Project Settings → Domains
2. Lägg till din egen domain om du har en
3. Följ instruktionerna för DNS-konfiguration

### Webhook för Auto-Deploy
Vercel kommer automatiskt deploya när du pushar till GitHub main branch!

### Övervaka
- Gå till Analytics för att se trafik
- Gå till Logs för att se eventuella fel

---

## 🎉 Checklist - Bocka av

- [ ] Importerat GitHub repo
- [ ] Valt `web-app` som Root Directory
- [ ] Satt Build Command = `npm run build`
- [ ] Satt Output Directory = `dist`
- [ ] Lagt till alla 7 VITE_* environment variables
- [ ] Klickat Deploy
- [ ] Väntat på build (2-5 min)
- [ ] Testat URL:en
- [ ] Login-sidan fungerar
- [ ] Kan logga in med testanvändare
- [ ] Dashboard visas korrekt

---

## 🔑 Testanvändare

Efter deployment, logga in med:

```
Email:    demo@lugntrygg.se
Password: Demo123!
```

**OBS:** Du måste skapa denna användare i Firebase först!
Se: `FIREBASE_TEST_USERS.md`

---

## 📞 Support

Om något inte fungerar:
1. Kolla build logs i Vercel
2. Öppna browser console (F12)
3. Se `VERCEL_DEPLOYMENT_FIX.md` för mer felsökning

---

**Skapad:** 2025-10-21
**Status:** ✅ REDO ATT ANVÄNDA
**Tid:** ~10 minuter för fullständig setup
**Svårighetsgrad:** ⭐⭐ Medel

---

## 🚀 Snabb Kopia-Klistra för Environment Variables

Kopiera denna lista och klistra in värdena i Vercel:

```
VITE_FIREBASE_API_KEY=AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
VITE_FIREBASE_AUTH_DOMAIN=lugn-trygg.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lugn-trygg
VITE_FIREBASE_STORAGE_BUCKET=lugn-trygg.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=412776932054
VITE_FIREBASE_APP_ID=1:412776932054:web:7c4c72c93eb9b5c49fdaf0
VITE_API_URL=https://lugn-trygg-backend.onrender.com
```

**Kom ihåg:** Lägg till varje variabel separat i Vercel UI och välj alla environments!
