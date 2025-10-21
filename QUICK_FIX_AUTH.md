# 🚀 SNABB FIX - Auth Problem

## ❌ Problemet
```
Login error: FirebaseError: Firebase: Error (auth/invalid-credential)
```

## ✅ Lösningen - 3 minuter

### Steg 1: Skapa testanvändare i Firebase (1 min)

1. Öppna: https://console.firebase.google.com/
2. Välj ditt projekt
3. Gå till **Authentication** → **Users**
4. Klicka **Add user**
5. Skapa användare:
   ```
   Email: demo@lugntrygg.se
   Password: Demo123!
   ```

### Steg 2: Bygg om appen (2 min)

```powershell
cd lugn-trygg-mobile
npm run build:web
```

### Steg 3: Deploya till Vercel

```powershell
vercel --prod
```

### Steg 4: Testa!

Gå till din Vercel URL och logga in med:
- **Email:** demo@lugntrygg.se
- **Password:** Demo123!

---

## 🎯 Vad har fixats?

### ✅ LoginScreen.tsx
- ❌ Tidigare: Hårdkodade `test@example.com` / `password123` (som inte finns)
- ✅ Nu: Tomma fält - användare måste ange giltiga uppgifter

### ✅ Bättre felmeddelanden (på svenska!)
- `auth/invalid-credential` → "Felaktig e-postadress eller lösenord. Kontrollera dina uppgifter och försök igen."
- `auth/too-many-requests` → "För många misslyckade försök. Vänta en stund och försök igen."
- Och mer...

### ✅ AuthContext.tsx
- Förbättrad error handling
- Bevarar Firebase error codes

---

## 🧪 Fler testanvändare

Skapa dessa i Firebase Console för olika testfall:

| Email | Password | Användning |
|-------|----------|------------|
| `demo@lugntrygg.se` | `Demo123!` | Allmän demo |
| `test@lugntrygg.se` | `Test123!` | Feature testing |
| `qa@lugntrygg.se` | `QA123456` | QA testing |

---

## ⚠️ CSS-varningar (kan ignoreras)

De CSS-varningar du ser är INTE riktiga fel:
```
Fel vid tolkningen av värdet för 'pointer-events'. Ignorerad deklaration.
Fel vid tolkningen av värdet för 'transition-property'. Ignorerad deklaration.
```

Detta är normalt när Expo kompilerar React Native till web. De påverkar inte funktionaliteten.

---

## 🔍 Felsökning

### Får fortfarande auth/invalid-credential?
✅ Kontrollera att användaren finns i Firebase Console
✅ Dubbelkolla email/lösenord (case-sensitive!)
✅ Vänta 30 sekunder efter att ha skapat användaren

### Får auth/too-many-requests?
✅ Vänta 15 minuter
✅ Eller rensa IP-blockeringen i Firebase Console

### Får network-request-failed?
✅ Kontrollera internetanslutning
✅ Verifiera Firebase API key i `.env`
✅ Se till att Firebase-projektet är aktivt

---

## 📝 Ändringar i kod

**Ändrade filer:**
- ✅ `src/screens/auth/LoginScreen.tsx` - Tomma fält + svenska felmeddelanden
- ✅ `src/context/AuthContext.tsx` - Bättre error propagation

**Nya filer:**
- ✅ `FIREBASE_TEST_USERS.md` - Komplett dokumentation
- ✅ `QUICK_FIX_AUTH.md` - Denna guide

---

## ⏭️ Nästa steg

1. ✅ Skapa testanvändare (se Steg 1 ovan)
2. ✅ Bygg och deploya (se Steg 2-3 ovan)
3. ✅ Testa inloggning
4. 🎉 Klart!

---

**Beräknad tid:** 3 minuter
**Svårighetsgrad:** ⭐ Lätt
**Status:** ✅ REDO ATT KÖRA
