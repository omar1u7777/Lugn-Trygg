# 🔐 Firebase Authentication - Testanvändare

## Problemet som fixats

❌ **FÖRE:** Applikationen använde hårdkodade testuppgifter (`test@example.com` / `password123`) som inte fanns i Firebase Authentication, vilket resulterade i `auth/invalid-credential` fel.

✅ **EFTER:** Fält är nu tomma och kräver giltiga uppgifter. Bättre felhantering med svenska felmeddelanden.

---

## Skapa din första användare

### Alternativ 1: Via Firebase Console (Rekommenderat)
1. Gå till [Firebase Console](https://console.firebase.google.com/)
2. Välj ditt projekt
3. Gå till **Authentication** → **Users** → **Add user**
4. Skapa en testanvändare:
   - Email: `demo@lugntrygg.se`
   - Password: `Demo123!`

### Alternativ 2: Via Signup-flödet i appen
1. Klicka på **"Skapa ett här"** på login-sidan
2. Fyll i:
   - Namn
   - Email
   - Lösenord (minst 6 tecken)
3. Klicka **"Skapa konto"**

---

## Testanvändare (Skapa dessa manuellt i Firebase)

### Användare 1: Demo Admin
- **Email:** `demo@lugntrygg.se`
- **Password:** `Demo123!`
- **Användning:** Allmän testning

### Användare 2: Test User
- **Email:** `test@lugntrygg.se`
- **Password:** `Test123!`
- **Användning:** Feature testing

### Användare 3: QA User
- **Email:** `qa@lugntrygg.se`
- **Password:** `QA123456`
- **Användning:** Quality assurance

---

## Förbättrade felmeddelanden

Appen ger nu tydliga svenska felmeddelanden:

| Firebase Error Code | Svenska meddelandet |
|---------------------|---------------------|
| `auth/invalid-credential` | Felaktig e-postadress eller lösenord. Kontrollera dina uppgifter och försök igen. |
| `auth/wrong-password` | Felaktig e-postadress eller lösenord. Kontrollera dina uppgifter och försök igen. |
| `auth/user-not-found` | Felaktig e-postadress eller lösenord. Kontrollera dina uppgifter och försök igen. |
| `auth/invalid-email` | Ogiltig e-postadress |
| `auth/user-disabled` | Detta konto har inaktiverats |
| `auth/too-many-requests` | För många misslyckade försök. Vänta en stund och försök igen. |
| `auth/network-request-failed` | Nätverksfel. Kontrollera din internetanslutning. |

---

## Ändringar som gjorts

### ✅ `LoginScreen.tsx`
- Tog bort hårdkodade testuppgifter
- Lade till svensk felöversättning
- Förbättrad felhantering med `error.code`

### ✅ `AuthContext.tsx`
- Förbättrad error propagation
- Bevarar Firebase error codes för UI

---

## Nästa steg

1. **Skapa en testanvändare i Firebase Console** (se instruktioner ovan)
2. **Bygg om och deploya:**
   ```powershell
   cd lugn-trygg-mobile
   npm run build:web
   vercel --prod
   ```
3. **Testa inloggning** med de nya uppgifterna

---

## Felsökning

### Problem: Får fortfarande `auth/invalid-credential`
**Lösning:** Kontrollera att:
- Användaren finns i Firebase Authentication Console
- Email och lösenord är exakt korrekta (case-sensitive)
- Firebase API key i `.env` är korrekt

### Problem: `auth/network-request-failed`
**Lösning:** Kontrollera:
- Internetanslutning
- Firebase projekt är aktivt
- API key och projekt-ID är korrekta

### Problem: `auth/too-many-requests`
**Lösning:**
- Vänta 15 minuter
- Eller återställ IP-blockeringen i Firebase Console under Authentication → Settings

---

## Support

Vid problem, kontakta:
- Firebase Support: https://firebase.google.com/support
- Projektdokumentation: Se `DOCUMENTATION_INDEX.md`

---

**Skapad:** 2025-10-21
**Senast uppdaterad:** 2025-10-21
