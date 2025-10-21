# 🚀 Vercel Deployment Fix - Steg för Steg

## ✅ Vad som är klart

### GitHub
✅ Alla ändringar är pushade till GitHub
✅ `web-app` mappen innehåller nu hela frontend-appen (Vite/React)
✅ `vercel.json` är uppdaterad med rätt konfiguration

---

## 🔧 Fixa Vercel Deployment

### Steg 1: Logga in på Vercel
1. Gå till: https://vercel.com/
2. Logga in med ditt konto
3. Du bör se ditt projekt: **Lugn-Trygg** eller liknande

---

### Steg 2: Hitta ditt projekt
1. Klicka på ditt projekt (Lugn-Trygg)
2. Gå till **Settings** (längst upp till höger)

---

### Steg 3: Ändra Build & Development Settings

#### 3.1 Ändra Root Directory
1. I Settings, hitta **"Build & Development Settings"**
2. Under **"Root Directory"**:
   - Klicka på **Edit**
   - Ändra från: `lugn-trygg-mobile` eller `web-app-build`
   - Ändra till: `web-app`
   - Klicka **Save**

#### 3.2 Ändra Build Command
1. Under **"Build Command"**:
   - Klicka på **Edit** 
   - Skriv: `npm run build`
   - Klicka **Save**

#### 3.3 Ändra Output Directory
1. Under **"Output Directory"**:
   - Klicka på **Edit**
   - Skriv: `dist`
   - Klicka **Save**

#### 3.4 Ändra Install Command
1. Under **"Install Command"**:
   - Klicka på **Edit**
   - Skriv: `npm install`
   - Klicka **Save**

---

### Steg 4: Environment Variables

1. I Settings, gå till **"Environment Variables"**
2. Lägg till dessa variabler (om de inte redan finns):

```
VITE_FIREBASE_API_KEY=AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
VITE_FIREBASE_AUTH_DOMAIN=lugn-trygg.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lugn-trygg
VITE_FIREBASE_STORAGE_BUCKET=lugn-trygg.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=412776932054
VITE_FIREBASE_APP_ID=1:412776932054:web:7c4c72c93eb9b5c49fdaf0
VITE_API_URL=https://lugn-trygg-backend.onrender.com
```

**OBS:** För varje variabel:
- Klicka **Add New**
- Skriv namnet (t.ex. `VITE_FIREBASE_API_KEY`)
- Skriv värdet
- Välj alla environments (Production, Preview, Development)
- Klicka **Save**

---

### Steg 5: Ta bort gamla Environment Variables (om de finns)

Ta bort dessa om de finns:
- `EXPO_PUBLIC_*` (alla som börjar med EXPO_PUBLIC)
- Gamla Firebase variabler utan `VITE_` prefix

---

### Steg 6: Redeploy

#### Alternativ A: Från Vercel Dashboard
1. Gå tillbaka till ditt projekt (klicka på projektnamnet längst upp)
2. Gå till **"Deployments"** tab
3. Hitta den senaste deployment
4. Klicka på **"..."** (tre prickar)
5. Välj **"Redeploy"**
6. Välj **"Use existing Build Cache"** = OFF
7. Klicka **"Redeploy"**

#### Alternativ B: Trigger från GitHub
1. Gör en liten ändring i projektet (eller kör detta):
```powershell
cd c:\Projekt\Lugn-Trygg-main_klar
git commit --allow-empty -m "Trigger Vercel deployment"
git push origin main
```

---

### Steg 7: Verifiera Deployment

1. Vänta medan Vercel bygger (2-5 minuter)
2. När det är klart, besök din URL:
   - https://lugn-trygg-9nzjs2eki-omaralhaeks-projects.vercel.app/

3. **Kontrollera:**
   - ✅ Login-sidan ska visa rätt design (från frontend-appen)
   - ✅ Du kan skapa konto eller logga in
   - ✅ Dashboarden ska fungera

---

## 🎯 Sammanfattning av ändringar

### Vercel Settings (Vad du ska ändra)

| Setting | Gammalt värde | Nytt värde |
|---------|---------------|------------|
| **Root Directory** | `lugn-trygg-mobile` eller `web-app-build` | `web-app` |
| **Build Command** | `expo export` eller liknande | `npm run build` |
| **Output Directory** | `dist` eller `.next` | `dist` |
| **Install Command** | `npm install` | `npm install` |
| **Framework Preset** | Next.js eller Expo | Vite |

---

## 🔍 Felsökning

### Build Failed?

**Kolla build logs:**
1. Gå till Deployments tab i Vercel
2. Klicka på den misslyckade deploymenten
3. Se vilka fel som uppstod

**Vanliga problem:**
- **"Module not found"**: Kör `npm install` i web-app lokalt först
- **"Environment variable missing"**: Dubbelkolla att alla VITE_* variabler är satta
- **"Build command failed"**: Verifiera att `npm run build` fungerar lokalt

### Deployment Success men blank sida?

1. Öppna Developer Console (F12)
2. Kolla Console tab för fel
3. Troligen saknas environment variables - lägg till dem enligt Steg 4

### Fortfarande gamla appen?

1. Gå till Vercel project
2. Settings → Domains
3. Klicka på din domain
4. Scroll ner och klicka **"Remove"**
5. Lägg till den igen - det triggar en ny deployment

---

## ✅ Checklista

Bocka av när du gjort klart:

- [ ] Loggat in på Vercel
- [ ] Hittat mitt projekt
- [ ] Ändrat Root Directory till `web-app`
- [ ] Ändrat Build Command till `npm run build`
- [ ] Ändrat Output Directory till `dist`
- [ ] Lagt till alla VITE_* environment variables
- [ ] Tagit bort gamla EXPO_PUBLIC_* variabler
- [ ] Triggat redeploy
- [ ] Väntat på att build blir klar
- [ ] Testat sidan - den fungerar! 🎉

---

## 📞 Behöver du hjälp?

Om något inte fungerar:
1. Kolla build logs i Vercel
2. Ta en screenshot av felet
3. Testa bygga lokalt: `cd web-app && npm run build`

---

**Skapad:** 2025-10-21
**Status:** ✅ REDO ATT KÖRA
**Tid:** ~10 minuter
