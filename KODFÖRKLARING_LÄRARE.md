# Lugn & Trygg - Kodförklaring för Lärare

## Projektöversikt
**Lugn & Trygg** är en mental hälsoplattform som hjälper användare att logga sitt mående, skriva dagbok och få AI-stöd för mental wellness.

## Teknisk Arkitektur

### Frontend (React + TypeScript)
- **Placering**: `src/` mappen
- **Teknologi**: React 18, TypeScript, Tailwind CSS, Vite
- **Port**: 3000 (utveckling)

**Viktiga filer:**
- `src/App.tsx` - Huvudapplikationen, alla routes (580 rader)
- `src/components/ui/` - UI-komponenter (Button, Card, Input)
- `src/contexts/AuthContext.tsx` - Hanterar inloggning globalt

### Backend (Python Flask)
- **Placering**: `Backend/` mappen  
- **Teknologi**: Flask 3.0, Python 3.11+, Firebase Admin SDK
- **Port**: 5001

**Viktiga filer:**
- `Backend/main.py` - Startar Flask servern (308 rader)
- `Backend/src/services/auth_service.py` - Autentisering och JWT tokens (419 rader)
- `Backend/src/routes/` - API endpoints för mood, memory, ai, etc.

### Databas
- **Firebase Firestore** - NoSQL databas
- **Samlingar**: users (807), moods (41k+), memories (6.8k+)

## Så fungerar det

### 1. Användaren loggar in
1. Frontend skickar till Firebase Auth
2. Firebase returnerar en ID token
3. Backend verifierar token med `@AuthService.jwt_required`

### 2. Användaren loggar sitt mående
1. Frontend: formulär i `MoodLogger` komponent
2. API call till `/api/mood/log` (Flask route)
3. Backend sparar i Firestore databas
4. Bekräftelse skickas tillbaka

### 3. AI Funktioner
- OpenAI API integration för mental hälsorådgivning
- AI analyserar användares mående-mönster
- Ger personliga rekommendationer

## Körning av Projektet

### Enkel start (allt samtidigt):
```powershell
docker-compose up
```
Detta startar:
- Frontend på http://localhost:3000
- Backend på http://localhost:5001
- Redis för rate limiting

### Separat start:

**Frontend:**
```powershell
npm run dev
```

**Backend:**
```powershell
cd Backend
.\venv\Scripts\activate
python main.py
```

## Säkerhetsfeatures

1. **Rate Limiting** - Begränsar API calls per IP
2. **JWT Authentication** - Säker token-baserad inloggning  
3. **CORS** - Kontrollerar vilka domäner som får komma åt API:et
4. **Audit Logging** - Loggar säkerhetshändelser

## Testning

**Frontend tester:**
```powershell
npm run test        # Vitest unit tests
npm run test:e2e    # Playwright E2E tests
```

**Backend tester:**
```powershell
cd Backend
pytest             # Python tests med Firebase mocks
```

## Produktion
- **Frontend**: Deployed på Vercel (https://lugn-trygg.vercel.app)
- **Backend**: Render eller Docker container
- **Databas**: Firebase Firestore (produktionsdatabas)

## Statistik (Nuvarande)
- **807 registrerade användare**
- **41,000+ mående-loggar**
- **6,800+ minnen/dagboksinlägg**
- **100% Tailwind CSS** (ingen Material-UI)

## Viktiga Tekniska Val

1. **Ingen lazy loading** - Alla komponenter importeras direkt i App.tsx för att undvika React konflikter
2. **Custom JWT decorator** - Använder `@AuthService.jwt_required` istället för Flask-JWT-Extended
3. **Tailwind CSS** - Migrerat från Material-UI för bättre prestanda
4. **Blueprint routing** - Organiserat backend med 18+ Flask blueprints

## Demo för Läraren
1. Visa inloggning på http://localhost:3000
2. Logga mående (mood logging)
3. Visa AI chat funktioner
4. Visa analytics dashboard
5. Förklara koden i `src/App.tsx` och `Backend/main.py`