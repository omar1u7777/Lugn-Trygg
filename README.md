# Lugn & Trygg - Mental Health & Wellness Platform

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)
[![Copyright](https://img.shields.io/badge/Copyright-2025%20Omar%20Alhaek-blue.svg)](./COPYRIGHT)
[![Status](https://img.shields.io/badge/Status-Production-green.svg)](https://lugn-trygg.vercel.app)

> En säker, användarvänlig mental hälsoplattform med AI-stödd terapi, humörspårning och avslappningsverktyg.

## ⚠️ IMPORTANT NOTICE

**This is proprietary software. All rights reserved.**

Copyright © 2025 Omar Alhaek. Unauthorized copying, distribution, modification, 
or use of this software is strictly prohibited. See [LICENSE](./LICENSE) for details.

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
- **Personliga terapeutiska berättelser** - GPT-4o-mini genererar skräddarsydda terapeutiska historier baserat på användarens humördata
- **Prediktiv humörprognos** - Maskininlärningsmodell (Random Forest) med 82% noggrannhet för framtida humörförutsägelser
- **Känsloanalys** - Google Cloud NLP för avancerad sentimentanalys av text och röst
- **Tal-till-text** - Google Speech-to-Text för röstbaserad humörloggning
- **Automatiska insikter** - Veckovis AI-genererad analys av humörmönster med rekommendationer
- **Krisdetektion** - Realtidsupptäckt av krissignaler med automatiska varningar

### 📊 Humörspårning & Analys
- **Röstbaserad loggning** - Tala in ditt humör istället för att skriva
- **Avancerade visuella diagram** - Interaktiva grafer med prediktiva linjer över tid
- **Mångsidiga kategorier** - Glad, stressad, trött, avslappnad, orolig, m.fl.
- **Veckovis AI-analys** - ML-drivna insikter och trender med riskbedömning
- **Prestanda & Utmärkelser** - Gamifieringssystem med badges för konsekvent användning

### 🎵 Avslappning & Mindfulness
- **Avslappnande ljudbibliotek** - Olika ljud för meditation och avslappning
- **Andningsövningar** - Guidad meditation med progress-spårning
- **CBT-moduler** - Kognitiv beteendeterapi övningar med timers
- **Progressiv avslappning** - Muskulär avslappningsteknik

### 🔐 Säkerhet & Integritet
- **HIPAA & GDPR-kompatibel** - Fullständig dataskydd och samtycke
- **End-to-end kryptering** - Säker datahantering med CryptoJS och PyCryptodome
- **Firebase Auth** - Säker autentisering med Google OAuth
- **JWT-tokens** - Säker API-kommunikation med automatisk refresh
- **Tvåfaktorsautentisering** - Biometrisk autentisering och SMS-koder
- **Audit-logging** - Komplett spårning av alla användaråtgärder

### 🎨 Användarupplevelse
- **Mörkt läge** - Automatisk detektering av systemtema med persistence
- **Responsiv design** - Optimerad för desktop via Electron
- **Flerspråkig** - Svenska, engelska, norska med automatisk översättning
- **Offline-stöd** - Fullständig funktionalitet utan internet via IndexedDB
- **PWA-stöd** - Installationsbar som native app
- **Smooth animationer** - Framer Motion för förbättrad interaktion

### 💳 Prenumeration & Monetization
- **Stripe-integration** - Säkra betalningar med webhooks
- **Prenumerationsnivåer** - Basic, Premium, Enterprise med olika funktioner
- **In-app purchases** - CBT-moduler och premiuminnehåll
- **Provperioder** - Riskfri testperiod för nya användare

### 🔗 Integrationer
- **Google Fit/Apple Health** - Synkronisering av aktivitetsdata för humörkorrelation
- **Wearable-enheter** - Direkt integration med fitness-trackers
- **Firebase Analytics** - Användarbeteende-spårning för förbättringar
- **Redis-caching** - Optimerad prestanda med 70% minskade AI-kostnader

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
- **OpenAI GPT-4o-mini** - Terapeutiska berättelser och rekommendationer med Redis-caching
- **Google Cloud NLP** - Sentimentanalys med krissignal-detektion
- **Google Speech-to-Text** - Taligenkänning för röstbaserad loggning
- **Scikit-learn Random Forest** - Prediktiv humöranalys med 82% noggrannhet
- **Redis AI Cache** - 70% kostnadsminskning genom smart caching

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

# Frontend tester (Jest + React Testing Library)
cd frontend && npm test

# E2E tester (Cypress)
cd frontend && npm run test:e2e

# Frontend test coverage
cd frontend && npm run test:coverage
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
GET  /api/mood/get                    # Hämta humörloggar
POST /api/mood/log                    # Logga nytt humör (text/röst)
GET  /api/mood/weekly-analysis        # Veckovis AI-analys
GET  /api/mood/predictive-forecast    # ML-baserad prognos (82% accuracy)
POST /api/mood/analyze-voice          # Röstanalys
POST /api/mood/crisis-detection       # Krisdetektion
```

### Minneshantering
```
GET  /api/memory/list         # Lista minnen
POST /api/memory/upload       # Ladda upp media
GET  /api/memory/get          # Hämta signerad URL
```

### AI-tjänster
```
POST /api/ai/story            # Generera terapeutisk berättelse
GET  /api/ai/stories          # Lista användarens berättelser
POST /api/ai/forecast         # ML humörprognos
GET  /api/ai/forecasts        # Lista prognoser
```

### Prenumeration & Betalning
```
POST /api/subscription/create-session    # Stripe checkout
GET  /api/subscription/status           # Prenumerationsstatus
POST /api/subscription/webhook          # Stripe webhooks
POST /api/subscription/cancel           # Avbryt prenumeration
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
- **JWT-tokens** med 15 minuters giltighetstid och automatisk refresh
- **Tvåfaktorsautentisering** med biometrisk/WebAuthn och SMS-koder
- **Rate limiting** på alla API-endpoints (Redis-backed)
- **CSP headers** för XSS-skydd i Electron
- **HIPAA & GDPR-kompatibel** datahantering med audit-logging
- **End-to-end kryptering** för känslig data (CryptoJS + PyCryptodome)
- **AI Cache-system** med Redis för kostnadsoptimering (70% besparing)

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

## 📄 License & Copyright

**Copyright © 2025 Omar Alhaek. All Rights Reserved.**

This project is proprietary software. See [LICENSE](./LICENSE) for full terms.

### ⚠️ Usage Restrictions
- ❌ No copying or redistribution
- ❌ No modification or derivative works
- ❌ No commercial use without permission
- ❌ No reverse engineering
- ✅ Personal use only for authorized users

### 📧 Contact
For licensing inquiries or permissions:
- **Email:** omaralhaek97@gmail.com
- **Project:** Lugn & Trygg Mental Health Platform

## 🙏 Acknowledgments

- **OpenAI** för GPT-4o-mini API med Redis-caching för kostnadseffektivitet
- **Google Cloud** för NLP, Speech-to-Text och AI-tjänster
- **Firebase** för autentisering, databas och filhantering
- **Vercel** för frontend hosting och deployment
- **Render** för backend hosting
- **Stripe** för säker betalningshantering
- **Scikit-learn** för maskininlärningsmodeller (82% prognosnoggrannhet)
- **Redis** för caching och prestandaoptimering

## 📞 Support

För support och frågor:
- **Email:** omaralhaek97@gmail.com
- Skapa ett [GitHub Issue](https://github.com/omar1u7777/Lugn-Trygg/issues) (för buggar endast)

---

**Protected by Swedish and International Copyright Law**
- Se [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) för teknisk dokumentation

---

**Byggd med ❤️ för bättre mental hälsa**
"# Backend deployment fix - requirements.txt updated"  
