# Lugn & Trygg - Mental Health & Wellness Desktop Application

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com)
[![Electron](https://img.shields.io/badge/Electron-Desktop-green.svg)](https://electronjs.org)

> En säker, användarvänlig desktop-applikation för mental hälsa och välbefinnande med AI-stödd terapi, humörspårning och avslappningsverktyg.

## 📋 Innehåll

- [Översikt](#-översikt)
- [Funktioner](#-funktioner)
- [Teknisk Stack](#-teknisk-stack)
- [Installation](#-installation)
- [Utveckling](#-utveckling)
- [Produktion](#-produktion)
- [API Dokumentation](#-api-dokumentation)
- [Arkitektur](#-arkitektur)
- [Säkerhet](#-säkerhet)
- [Bidrag](#-bidrag)
- [Licens](#-licens)

## 🌟 Översikt

**Lugn & Trygg** är en omfattande mentalvårdsapplikation som kombinerar moderna teknologier för att erbjuda användarna verktyg för bättre mental hälsa. Applikationen erbjuder AI-driven terapi, humörspårning, avslappningsövningar och professionell stöd.

### 🎯 Målgrupp
- Individer som vill förbättra sin mentala hälsa
- Personer med stressrelaterade problem
- Användare som behöver daglig humörspårning
- De som söker avslappnings- och mindfulness-verktyg

## ✨ Funktioner

### 🤖 AI-Driven Funktioner
- **Personliga rekommendationer** - GPT-4o-mini genererar skräddarsydda råd
- **Känsloanalys** - Google Cloud NLP för avancerad sentimentanalys
- **Tal-till-text** - Google Speech-to-Text för röstbaserad humörloggning
- **Automatiska insikter** - Veckovis analys av humörmönster

### 📊 Humörspårning
- **Röstbaserad loggning** - Tala in ditt humör istället för att skriva
- **Visuella diagram** - Interaktiva grafer över tid
- **Mångsidiga kategorier** - Glad, stressad, trött, avslappnad, m.fl.
- **Veckovis analys** - AI-genererade insikter och trender

### 🎵 Avslappning & Mindfulness
- **Ljudbibliotek** - Olika ljud för avslappning
- **Andningsövningar** - Guidad meditation
- **Progressiv avslappning** - Muskulär avslappningsteknik

### 🔐 Säkerhet & Integritet
- **GDPR-kompatibel** - Fullständig dataskydd och samtycke
- **End-to-end kryptering** - Säker datahantering
- **Firebase Auth** - Säker autentisering
- **JWT-tokens** - Säker API-kommunikation

### 🎨 Användarupplevelse
- **Mörkt läge** - Valfritt mörkt tema
- **Responsiv design** - Fungerar på olika skärmstorlekar
- **Flerspråkig** - Svenska, engelska, norska
- **Offline-stöd** - Grundläggande funktioner utan internet

## 🛠 Teknisk Stack

### Frontend
- **React 18** - Moderna UI-komponenter
- **TypeScript** - Typsäker utveckling
- **Vite** - Snabb byggprocess
- **Electron** - Cross-platform desktop app
- **React Router** - Klient-sida routing
- **Chart.js** - Data visualisering
- **Framer Motion** - Animationer

### Backend
- **Flask** - Python web-ramverk
- **Flask-Limiter** - Rate limiting
- **Redis** - Cache och sessionshantering
- **Firebase Admin** - Backend-tjänster
- **Google Cloud** - AI och taligenkänning

### Databas & Lagring
- **Firestore** - NoSQL databas
- **Firebase Storage** - Filuppladdning
- **Redis** - Cache och rate limiting

### AI & ML
- **OpenAI GPT-4o-mini** - Terapeutiska rekommendationer
- **Google Cloud NLP** - Sentimentanalys
- **Google Speech-to-Text** - Taligenkänning

### DevOps
- **Docker** - Containerisering
- **Docker Compose** - Multi-container setup
- **Nginx** - Reverse proxy
- **GitHub Actions** - CI/CD

## 🚀 Installation

### Förutsättningar
- **Node.js** 18+ och **npm**
- **Python** 3.11+
- **Docker** och **Docker Compose**
- **Git**

### Snabbstart
```bash
# Klona repository
git clone https://github.com/omar1u7777/Lugn-Trygg.git
cd Lugn-Trygg

# Starta hela applikationen
docker-compose -f docker-compose.prod.yml up -d

# Eller bygg för desktop
./build.bat all
```

### Manuell Installation

#### Backend
```bash
cd Backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Konfigurera miljövariabler
python main.py
```

#### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Konfigurera miljövariabler
npm run dev
```

## 💻 Utveckling

### Utvecklingsmiljö
```bash
# Starta backend
cd Backend && python main.py

# Starta frontend (nytt terminalfönster)
cd frontend && npm run dev

# Starta Electron (nytt terminalfönster)
cd frontend && npx electron .
```

### Kodstruktur
```
Lugn-Trygg/
├── Backend/                 # Python Flask API
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Helper functions
│   │   └── config.py       # Configuration
│   └── requirements.txt
├── frontend/               # React/Electron app
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   └── styles/         # CSS styles
│   ├── main.cjs            # Electron main process
│   └── preload.js          # Electron preload script
├── docker-compose.yml      # Development setup
├── docker-compose.prod.yml # Production setup
└── build.sh/build.bat      # Build scripts
```

### Testing
```bash
# Backend tester
cd Backend && python -m pytest

# Frontend tester
cd frontend && npm test

# E2E tester
cd frontend && npm run test:e2e
```

## 🏭 Produktion

### Docker Deployment
```bash
# Bygg och starta produktionscontainers
docker-compose -f docker-compose.prod.yml up -d

# Visa loggar
docker-compose -f docker-compose.prod.yml logs -f

# Stoppa tjänster
docker-compose -f docker-compose.prod.yml down
```

### Electron Desktop App
```bash
# Bygg för nuvarande plattform
cd frontend
npm run build:electron

# Bygg för alla plattformar
npm run build:electron:win
npm run build:electron:mac
npm run build:electron:linux
```

### Miljövariabler
```bash
# Backend .env
JWT_SECRET_KEY=your-secret-key
FIREBASE_CREDENTIALS=serviceAccountKey.json
OPENAI_API_KEY=your-openai-key

# Frontend .env
VITE_API_URL=http://localhost:5001
VITE_FIREBASE_API_KEY=your-firebase-key
```

## 📚 API Dokumentation

### Autentisering
```
POST /api/auth/login          # Inloggning
POST /api/auth/register       # Registrering
POST /api/auth/google-login   # Google OAuth
POST /api/auth/refresh        # Token refresh
POST /api/auth/logout         # Utloggning
```

### Humörhantering
```
GET  /api/mood/get            # Hämta humörloggar
POST /api/mood/log            # Logga nytt humör
GET  /api/mood/weekly-analysis # Veckovis analys
```

### Minneshantering
```
GET  /api/memory/list         # Lista minnen
POST /api/memory/create       # Skapa minne
PUT  /api/memory/update       # Uppdatera minne
DELETE /api/memory/delete     # Ta bort minne
```

### AI-tjänster
```
POST /api/ai/analyze-sentiment    # Sentimentanalys
POST /api/ai/generate-insights   # Generera insikter
POST /api/ai/therapeutic-chat    # Terapeutisk chatt
```

## 🏗 Arkitektur

### Systemarkitektur
```
┌─────────────────┐    ┌─────────────────┐
│   Electron App  │    │   Web Browser   │
│   (Desktop)     │    │   (Web App)     │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
          ┌─────────────────────┐
          │   Flask API Server  │
          │   (Python Backend)  │
          └─────────┬───────────┘
                    │
          ┌─────────┴───────────┐
          │                    │
┌─────────┴─────┐  ┌─────────┴─────┐
│   Firestore   │  │   Firebase    │
│   (Database)  │  │   Auth        │
└───────────────┘  └───────────────┘
```

### Säkerhetsarkitektur
- **JWT-tokens** med 15 minuters giltighetstid
- **Refresh tokens** för automatisk förnyelse
- **Rate limiting** på alla API-endpoints
- **CSP headers** för XSS-skydd
- **GDPR-kompatibel** datahantering

## 🔒 Säkerhet

### Autentisering & Auktorisering
- Firebase Authentication för användarhantering
- JWT-baserad API-autentisering
- Role-based access control
- Secure token storage

### Data Protection
- End-to-end encryption för känslig data
- GDPR-compliant data deletion
- Audit logging för alla åtgärder
- Secure API communication

### Content Security Policy
```javascript
// CSP regler för Electron app
{
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "connect-src": ["'self'", "https://*.googleapis.com"],
  "style-src": ["'self'", "'unsafe-inline'"]
}
```

## 🤝 Bidrag

Vi välkomnar bidrag! Se till att:

1. Följ kodstandarder (ESLint, Black)
2. Skriv tester för ny funktionalitet
3. Uppdatera dokumentation
4. Följ Git commit conventions

```bash
# Skapa feature branch
git checkout -b feature/amazing-feature

# Commit changes
git commit -m "feat: add amazing feature"

# Push och skapa PR
git push origin feature/amazing-feature
```

## 📄 Licens

Detta projekt är licensierat under MIT License - se [LICENSE](LICENSE) filen för detaljer.

## 🙏 Acknowledgments

- **OpenAI** för GPT-4o-mini API
- **Google Cloud** för NLP och Speech-to-Text
- **Firebase** för backend-tjänster
- **Electron** för cross-platform desktop support

## 📞 Support

För support och frågor:
- Skapa ett [GitHub Issue](https://github.com/omar1u7777/Lugn-Trygg/issues)
- Kontakta utvecklings-teamet
- Se [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) för teknisk dokumentation

---

**Byggd med ❤️ för bättre mental hälsa**
