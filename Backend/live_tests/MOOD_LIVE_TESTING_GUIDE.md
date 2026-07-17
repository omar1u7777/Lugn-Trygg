# Humör Live Testing Guide — Stegvisa Instruktioner

Denna guide beskriver hur man testar Humör-systemet mot riktig Firestore/Redis,
från säkrast (emulator) till mest produktionslikt (Render).

## Förutsättningar

- Python 3.11+ med `.venv` skapat i `Backend/`
- Node.js installerat
- `requests` paketet: `.venv\Scripts\pip install requests`

---

## Steg 1: Firebase Emulator Suite (säkrast)

Emulatorn kör Firestore/Auth/Storage lokalt — ingen riktig Firebase-data påverkas.

### Installation (engångs)

```powershell
# Installera Java 11+ (krävs för emulator)
# Ladda ner från: https://adoptium.net/

# Installera Firebase CLI
npm install -g firebase-tools

# Verifiera
firebase --version
java -version
```

### Starta emulatorn

```powershell
cd Backend
firebase emulators:start --config firebase.emulator.json
```

Emulatorn körs nu på:
- Firestore: `127.0.0.1:8080`
- Auth: `127.0.0.1:9099`
- Storage: `127.0.0.1:9199`
- UI: `http://localhost:4000`

### Kör emulator-tester

```powershell
cd Backend
.venv\Scripts\python.exe -m pytest live_tests/test_mood_emulator.py -v -s
```

### Vad testas
- Skapa/läsa/uppdatera/radera mood-dokument i riktig Firestore (emulator)
- Query med `where`, `order_by`, `limit`, `offset`
- Streak-beräkning med konsekutiva dagar och gap
- Paginering
- Sentiment-filter
- Tagg-lagring

---

## Steg 2: Lokalt med riktig Firebase

Testar mot er riktiga Firebase-projekt men från lokal backend.

### Installation (engångs)

1. Ladda ner `serviceAccountKey.json` från Firebase Console:
   - Firebase Console → Project Settings → Service Accounts → Generate New Private Key
   - Spara som `Backend/serviceAccountKey.json`

2. Skapa `Backend/.env` baserat på `.env.example`:
   ```powershell
   copy .env.example .env
   ```

3. Fyll i `.env` med riktiga värden:
   ```
   FIREBASE_CREDENTIALS=serviceAccountKey.json
   FIREBASE_PROJECT_ID=ditt-projekt-id
   FIREBASE_DATABASE_URL=https://ditt-projekt-id.firebaseio.com
   FIREBASE_STORAGE_BUCKET=ditt-projekt-id.appspot.com
   FIREBASE_WEB_API_KEY=din-api-key
   FIREBASE_API_KEY=din-api-key
   FIREBASE_APP_ID=1:xxx:web:xxx
   FIREBASE_MESSAGING_SENDER_ID=xxx
   JWT_SECRET_KEY=generera-en-hemlig-nyckel-min-32-tecken
   JWT_REFRESH_SECRET_KEY=generera-en-till-hemlig-nyckel
   ENCRYPTION_KEY=generera-64-hex-tecken
   HIPAA_ENCRYPTION_KEY=generera-fernet-nyckel
   ```

4. Starta Redis lokalt (valfritt men rekommenderat):
   ```powershell
   # Med Docker:
   docker run -d -p 6379:6379 redis

   # Eller ladda ner från: https://github.com/tporadowski/redis/releases
   ```

5. Starta backend lokalt:
   ```powershell
   cd Backend
   .venv\Scripts\python.exe main.py
   ```

6. I en annan terminal, kör live-tester mot localhost:
   ```powershell
   cd Backend
   $env:LIVE_FIREBASE_E2E="1"
   $env:LIVE_BASE_URL="http://127.0.0.1:5001"
   $env:LIVE_FIREBASE_EMAIL="test@example.com"
   $env:LIVE_FIREBASE_PASSWORD="SecureP@ss123!"
   .venv\Scripts\python.exe -m pytest live_tests/test_mood_live_e2e.py -v -s
   ```

### Vad testas
- Full Flask-stack lokalt med riktig Firestore
- Auth-flow (login, CSRF, JWT)
- Mood CRUD mot riktig Firestore
- Streaks, weekly analysis, statistics mot riktig Firestore
- Redis caching (om Redis körs)

---

## Steg 3: Render (deployad backend)

Testar mot er produktionslika backend på Render.

### Kör live E2E-tester

```powershell
cd Backend
$env:LIVE_FIREBASE_E2E="1"
$env:LIVE_BASE_URL="https://lugn-trygg-backend.onrender.com"
$env:LIVE_FIREBASE_EMAIL="e2e-test@example.com"
$env:LIVE_FIREBASE_PASSWORD="SecureP@ss123!"
.venv\Scripts\python.exe -m pytest live_tests/test_mood_live_e2e.py -v -s
```

Eller använd runner-scriptet:

```powershell
cd Backend
$env:LIVE_BASE_URL="https://lugn-trygg-backend.onrender.com"
$env:LIVE_FIREBASE_EMAIL="e2e-test@example.com"
$env:LIVE_FIREBASE_PASSWORD="SecureP@ss123!"
.venv\Scripts\python.exe live_tests\run_mood_live_e2e.py
```

### Vad testas
- Hela stacken: Flask → Firestore → Redis → AI services
- Nätverkslatens och cold start
- CSRF-skydd i produktionsmiljö
- Rate limiting
- Realistiska response-tider

### Viktigt
- Testerna skapar och raderar riktiga Firestore-dokument
- Använd en **dedikerad test-användare** — inte din riktiga användare
- Testerna städar upp efter sig (raderar test-moods)
- Om tester misslyckas mitt i, kan test-data ligga kvar — kör `test_live_cleanup_test_moods` separat

---

## Test-översikt

| Fil | Miljö | Antal tester | Vad testas |
|-----|-------|-------------|------------|
| `tests/test_mood_menu_coverage.py` | Mockat | 203 | Branch coverage, enhetstest |
| `live_tests/test_mood_emulator.py` | Emulator | 10 | Firestore CRUD, queries, streaks |
| `live_tests/test_mood_live_e2e.py` | Render/Lokal | 14 | Full E2E: auth + mood CRUD + stats |

## Kör alla tre nivåer

```powershell
# 1. Mockade enhetstester (snabbast)
.venv\Scripts\python.exe -m pytest tests/test_mood_menu_coverage.py -q --tb=short

# 2. Emulator-tester (kräver emulator running)
.venv\Scripts\python.exe -m pytest live_tests/test_mood_emulator.py -v -s

# 3. Live E2E (kräver nätverksåtkomst till Render)
.venv\Scripts\python.exe live_tests\run_mood_live_e2e.py
```
