# Lugn & Trygg

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

> A full-stack mental health platform for mood tracking, AI-powered insights, peer support, and personal wellness — built with React, Flask, and Firebase.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [API Overview](#api-overview)
- [License](#license)

---

## Overview

Lugn & Trygg (Swedish for "Calm & Safe") is a production-grade mental health web application serving 800+ registered users with 41 000+ mood logs. The platform combines evidence-based tools — mood journaling, CBT exercises, breathing guidance, and gamified wellness challenges — with AI-driven analytics and an anonymous peer-support chat.

The application is a **monorepo** with a React single-page application at the root and a Flask REST API under `Backend/`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Client (Browser / PWA)                                      │
│  React 18 · TypeScript · Tailwind CSS · Vite                │
└────────────────────┬─────────────────────────────────────────┘
                     │  HTTPS (Axios)
┌────────────────────▼─────────────────────────────────────────┐
│  API Gateway — Flask 3.0                                     │
│  34 Blueprints · JWT Auth · Rate limiting · CORS             │
├──────────────┬───────────────┬────────────────┬──────────────┤
│  Firebase    │  Redis        │  Stripe        │  OpenAI      │
│  Auth +      │  Rate limits  │  Subscriptions │  AI chat &   │
│  Firestore   │  (production) │  & payments    │  insights    │
└──────────────┴───────────────┴────────────────┴──────────────┘
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18, TypeScript, Vite | SPA with code-split lazy routes |
| Styling | Tailwind CSS, Headless UI, Framer Motion | Responsive UI, dark mode, animations |
| State | React Context (Auth, Theme, Subscription, i18n) | Global state without external libs |
| Backend | Flask 3.0, Python 3.11+ | REST API with 34 blueprint modules |
| Database | Firebase Firestore | NoSQL document store (49 000+ documents) |
| Auth | Firebase Auth + custom JWT | Dual token system with refresh flow |
| Cache | Redis 7 (prod) / in-memory (dev) | Rate limiting, session data |
| Payments | Stripe Checkout + Webhooks | Premium subscriptions, CBT modules |
| AI | OpenAI API | Chat assistant, mood analysis, recommendations |
| Monitoring | Sentry, Amplitude, Prometheus | Error tracking, analytics, metrics |
| Deployment | Vercel (frontend), Render / Docker (backend) | CI/CD with GitHub Actions |

---

## Features

### Core
- **Mood Tracking** — log mood with intensity, notes, and tags; daily/weekly/monthly analytics
- **AI Chat Assistant** — context-aware conversations powered by OpenAI
- **Voice Emotion Analysis** — record voice and get sentiment feedback
- **Memory Journal** — save meaningful moments with text, audio, and photos
- **Daily Insights & Recommendations** — personalised tips based on mood history

### Wellness
- **Breathing Exercises** — guided breathing with visual animations
- **Relaxing Sounds** — ambient soundscapes for mindfulness
- **CBT Modules** — cognitive behavioural therapy exercises (premium)
- **Wellness Goals** — onboarding-driven goal setting and tracking

### Social
- **Anonymous Peer Support Chat** — real-time rooms by topic (anxiety, depression, stress, sleep, recovery)
- **Group Challenges** — community wellness challenges with progress tracking
- **Leaderboard & Achievements** — gamified engagement with badges and XP
- **Referral Programme** — invite friends, earn premium time

### Platform
- **Premium Subscription** — Stripe-powered with free, trial, premium, and enterprise tiers
- **Dark Mode** — system-aware theme with manual toggle
- **Internationalisation** — Swedish (default) and English via i18next
- **PWA** — installable progressive web app with offline support
- **Privacy Controls** — data export, deletion, consent management

---

## Tech Stack

### Frontend

| Package | Version | Role |
|---------|---------|------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool & dev server |
| Tailwind CSS | 3.x | Utility-first styling |
| Headless UI | 2.x | Accessible UI primitives |
| Heroicons | 2.x | Icon system |
| React Router | 6.x | Client-side routing |
| Axios | 1.x | HTTP client |
| Framer Motion | 10.x | Animations |
| Recharts | 2.x | Charts and data viz |
| i18next | 25.x | Internationalisation |
| Firebase JS SDK | 10.x | Client auth & realtime |

### Backend

| Package | Version | Role |
|---------|---------|------|
| Flask | 3.0 | Web framework |
| firebase-admin | 6.x | Firestore, Auth, Storage |
| PyJWT | 2.x | Custom JWT tokens |
| Flask-Limiter | 3.x | Rate limiting |
| Stripe | 7.x | Payment processing |
| OpenAI | 1.x | AI features |
| Redis | 5.x | Production cache |
| Sentry SDK | 1.x | Error tracking |
| gunicorn / waitress | — | Production WSGI server |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- A **Firebase** project with Firestore, Auth, and Storage enabled
- *(Optional)* Redis 7+ for production-grade rate limiting
- *(Optional)* Stripe account for payment features

### 1. Clone the repository

```bash
git clone https://github.com/omar1u7777/Lugn-Trygg.git
cd Lugn-Trygg
```

### 2. Frontend setup

```bash
cp .env.example .env          # Fill in your Firebase and API keys
npm install
npm run dev                    # http://localhost:3000
```

### 3. Backend setup

```bash
cd Backend
cp .env.example .env           # Fill in Firebase credentials, JWT secrets, etc.
python -m venv venv
venv\Scripts\activate           # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
python main.py                 # http://localhost:5001
```

### 4. Full stack with Docker

```bash
docker-compose up              # Frontend :3000, Backend :5001, Redis :6379
```

---

## Project Structure

```
lugn-trygg/
├── src/                        # ── Frontend (React + TypeScript) ──
│   ├── api/                    #   API client modules (33 files, one per domain)
│   ├── components/             #   UI components organised by feature
│   │   ├── ui/                 #   Reusable primitives (Button, Card, Input, …)
│   │   ├── Auth/               #   Login, Register, ForgotPassword, Consent
│   │   ├── Dashboard/          #   Dashboard widgets and quick actions
│   │   ├── Feedback/           #   User feedback forms
│   │   ├── Integrations/       #   OAuth health integrations
│   │   ├── Referral/           #   Referral programme UI
│   │   ├── Layout/             #   App shell, protected routes, navigation
│   │   ├── Wellness/           #   Wellness goals and onboarding
│   │   └── *.tsx               #   Feature hub pages (WellnessHub, SocialHub, …)
│   ├── config/                 #   Environment config and validation
│   ├── contexts/               #   React Context providers (Auth, Theme, Subscription)
│   ├── features/               #   Feature modules (chat, gamification)
│   ├── hooks/                  #   Custom React hooks
│   ├── i18n/                   #   Internationalisation setup
│   ├── pages/                  #   Route-level page components
│   ├── services/               #   Client-side services (analytics, PWA, offline)
│   ├── translations/           #   Language JSON files (sv, en)
│   ├── types/                  #   TypeScript type definitions
│   ├── utils/                  #   Utility functions (encryption, performance, …)
│   ├── App.tsx                 #   Root component with route definitions
│   └── main.tsx                #   Application entry point
│
├── Backend/                    # ── Backend (Flask + Python) ──
│   ├── src/
│   │   ├── routes/             #   34 Flask blueprint modules
│   │   ├── services/           #   Business logic (auth, AI, subscription, …)
│   │   ├── models/             #   Data models and schemas
│   │   ├── middleware/         #   Security headers, validation, CORS
│   │   ├── config/             #   App configuration
│   │   ├── utils/              #   Input sanitisation, response helpers
│   │   └── firebase_config.py  #   Firebase Admin SDK initialisation
│   ├── tests/                  #   pytest test suite with Firebase mocks
│   ├── scripts/                #   Deployment and maintenance scripts
│   ├── main.py                 #   Application entry point
│   └── requirements.txt        #   Python dependencies
│
├── shared/                     #   Shared config (subscription plans JSON)
├── public/                     #   Static assets served by Vite
├── tests/e2e/                  #   Playwright end-to-end tests
├── k8s/                        #   Kubernetes manifests
├── helm/                       #   Helm chart for K8s deployment
├── infra/                      #   Infrastructure documentation
├── docker-compose.yml          #   Local development stack
├── docker-compose.prod.yml     #   Production Docker Compose
├── Dockerfile                  #   Frontend container (Nginx)
├── vite.config.js              #   Vite build configuration
├── tailwind.config.js          #   Design system tokens and theme
├── eslint.config.js            #   Linting rules
├── tsconfig.json               #   TypeScript configuration
└── .env.example                #   Environment variable template
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_BACKEND_URL` | Yes | Backend API base URL |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_ENCRYPTION_KEY` | Yes | 64-char hex key for client-side encryption |
| `VITE_SENTRY_DSN` | No | Sentry error tracking DSN |
| `VITE_AMPLITUDE_API_KEY` | No | Amplitude analytics key |
| `VITE_GOOGLE_CLIENT_ID` | No | Google OAuth client ID |

Backend environment is configured in `Backend/.env` — see `Backend/README.md` for full details.

---

## Available Scripts

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Production build with code splitting |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:coverage` | Generate test coverage report |
| `npm run lint` | ESLint check (zero warnings enforced) |
| `npm run type-check` | TypeScript type validation |
| `npm run build:analyze` | Build with bundle visualiser |

### Backend

| Command | Description |
|---------|-------------|
| `python main.py` | Start Flask dev server on port 5001 |
| `pytest` | Run all backend tests |
| `pytest --cov=src` | Run tests with coverage report |
| `pytest -k test_name` | Run a single test |

---

## Testing

### Frontend

- **Unit tests**: Vitest — components wrapped in `TestProviders` (Auth, Theme, i18n contexts)
- **E2E tests**: Playwright from `tests/e2e/` against `http://localhost:3000`

### Backend

- **Unit tests**: pytest with Firebase mocks — no real Firebase calls in tests
- **Fixtures**: see `Backend/tests/conftest.py` for shared setup
- **Pattern**: patch `firebase_admin.auth` and `firebase_admin.firestore`

---

## Deployment

### Frontend → Vercel

The frontend auto-deploys from the `master` branch via Vercel. Environment variables are configured in the Vercel dashboard.

### Backend → Render / Docker

```bash
# Option A: Render (see render.yaml)
# Push to master — Render auto-deploys

# Option B: Docker
cd Backend
docker build -f Dockerfile.production -t lugn-trygg-backend .
docker run -p 5001:5001 --env-file .env lugn-trygg-backend
```

### Full Stack → Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Includes backend, frontend (Nginx), and Redis.

---

## Security

- **Authentication**: Dual system — Firebase Auth (client-side) + custom JWT (API)
- **Authorisation**: `@AuthService.jwt_required` decorator on all protected endpoints
- **Rate Limiting**: Redis-backed in production (5 000/day, 1 000/hour, 300/min per IP)
- **Input Sanitisation**: server-side sanitisation on all user inputs
- **CORS**: restricted to configured origins
- **Audit Logging**: security events logged with `audit_log()` service
- **Encryption**: client-side AES encryption for sensitive localStorage data
- **Headers**: strict CSP, HSTS, X-Frame-Options via security middleware

---

## API Overview

The backend exposes **170+ endpoints** across 34 Flask blueprints:

| Blueprint | Prefix | Key Endpoints |
|-----------|--------|---------------|
| Auth | `/api/v1/auth` | Login, register, refresh, Google OAuth |
| Mood | `/api/v1/mood` | Log, history, stats, analytics |
| Memory | `/api/v1/memory` | CRUD, audio upload, URL generation |
| AI / Chat | `/api/v1/ai`, `/api/v1/chat` | AI conversations, sentiment analysis |
| Journal | `/api/v1/journal` | Entries CRUD, search, export |
| Subscription | `/api/v1/subscription` | Stripe checkout, status, webhooks |
| Rewards | `/api/v1/rewards` | XP, badges, premium time claims |
| Referral | `/api/v1/referral` | Codes, tracking, leaderboard |
| Challenges | `/api/v1/challenges` | Group challenges, contributions |
| Peer Chat | `/api/v1/peer-chat` | Rooms, messages, presence |
| Dashboard | `/api/v1/dashboard` | Aggregated user statistics |
| Health | `/api/v1/health` | Readiness, liveness probes |
| Privacy | `/api/v1/privacy` | Data export, deletion, consent |

Full Swagger documentation is available at `/api/docs` when the backend is running.

---

## License

Copyright &copy; 2025 Omar Alhaek. All rights reserved.

This software is proprietary. Unauthorized copying, distribution, or modification is prohibited. See [COPYRIGHT](COPYRIGHT) for details.</content>
<filePath>c:\Projekt\Lugn-Trygg-main_klar\README.md