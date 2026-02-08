# Lugn & Trygg — Backend API

Production-grade Flask REST API powering the Lugn & Trygg mental health platform.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Configuration](#environment-configuration)
- [Running the Server](#running-the-server)
- [Architecture](#architecture)
- [API Blueprints](#api-blueprints)
- [Authentication](#authentication)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Background Services](#background-services)

---

## Prerequisites

| Dependency | Version | Required |
|-----------|---------|----------|
| Python | 3.11+ | Yes |
| Firebase project | — | Yes (Firestore, Auth, Storage) |
| Redis | 7.x | Production only |
| Stripe account | — | For payment features |
| OpenAI API key | — | For AI features |

---

## Local Setup

```bash
cd Backend
python -m venv venv
venv\Scripts\activate           # Windows
# source venv/bin/activate      # macOS / Linux
pip install --upgrade pip
pip install -r requirements.txt
```

---

## Environment Configuration

1. Copy `.env.example` to `.env`.
2. Provide Firebase credentials — **one of**:
   - Set `FIREBASE_CREDENTIALS_PATH` to the path of your `serviceAccountKey.json`
   - Set `FIREBASE_CREDENTIALS` to the raw JSON string (single line)
3. Fill in required secrets:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET_KEY` | Yes | Secret for signing access tokens |
| `JWT_REFRESH_SECRET_KEY` | Yes | Secret for signing refresh tokens |
| `FIREBASE_WEB_API_KEY` | Yes | Firebase Web API key |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated allowed frontend origins |
| `REDIS_URL` | Prod | Redis connection string (e.g. `redis://redis:6379/0`) |
| `STRIPE_SECRET_KEY` | Payments | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Payments | Stripe webhook signing secret |
| `OPENAI_API_KEY` | AI | OpenAI API key |
| `RESEND_API_KEY` | Email | Resend email service key |

> **Never** commit `.env`, `serviceAccountKey.json`, or any credentials.

---

## Running the Server

```bash
# Development
python main.py                  # http://127.0.0.1:5001

# Production
gunicorn main:app -b 0.0.0.0:5001 -w 4
```

Health check: `GET /health`

---

## Architecture

```
Backend/
├── main.py                     # Flask app factory, blueprint registration
├── requirements.txt            # Python dependencies
├── src/
│   ├── config/                 # App configuration, env loading
│   ├── docs/                   # Swagger / OpenAPI config
│   ├── firebase_config.py      # Firebase Admin SDK init (db, auth, storage)
│   ├── middleware/              # Security headers, validation, CORS, correlation IDs
│   ├── models/                 # Data models and Pydantic schemas
│   ├── routes/                 # 34 Flask blueprint modules (see below)
│   ├── services/               # Business logic layer
│   │   ├── auth_service.py     #   JWT generation, verification, @jwt_required
│   │   ├── subscription_service.py  #   Plan management, usage tracking, quotas
│   │   ├── ai_service.py       #   OpenAI integration
│   │   ├── audit_service.py    #   Security event logging
│   │   ├── backup_service.py   #   Automated Firestore backups
│   │   ├── rate_limiting.py    #   Redis-backed rate limiting
│   │   └── ...                 #   20+ additional services
│   └── utils/                  # Input sanitisation, response helpers, logging
├── tests/                      # pytest suite with Firebase mocks
└── scripts/                    # Deployment and maintenance utilities
```

### Key Design Patterns

- **Blueprint-based routing** — each domain has its own blueprint with a `/api/v1/` prefix
- **Service layer** — routes delegate business logic to service modules
- **Decorator-based auth** — `@AuthService.jwt_required` sets `g.user_id` from JWT
- **APIResponse utility** — standardised JSON responses: `{ success, data, message }`
- **camelCase API output** — all responses use camelCase for frontend compatibility

---

## API Blueprints

| Blueprint | Prefix | Endpoints | Description |
|-----------|--------|-----------|-------------|
| `auth` | `/api/v1/auth` | 8 | Login, register, refresh, Google OAuth, password reset |
| `mood` | `/api/v1/mood` | 6 | Mood logging, history, delete |
| `mood_stats` | `/api/v1/mood-stats` | 5 | Analytics, trends, averages |
| `memory` | `/api/v1/memory` | 7 | CRUD, audio upload, signed URLs |
| `journal` | `/api/v1/journal` | 6 | Journal entries, search, export |
| `ai` | `/api/v1/ai` | 5 | AI conversations, analysis |
| `chatbot` | `/api/v1/chat` | 4 | Chat sessions, history |
| `voice` | `/api/v1/voice` | 3 | Transcription, emotion analysis |
| `dashboard` | `/api/v1/dashboard` | 4 | Aggregated stats, streaks |
| `subscription` | `/api/v1/subscription` | 8 | Stripe checkout, webhooks, status |
| `rewards` | `/api/v1/rewards` | 6 | XP, badges, premium claims |
| `referral` | `/api/v1/referral` | 8 | Codes, tracking, leaderboard |
| `challenges` | `/api/v1/challenges` | 6 | Group challenges, contributions |
| `peer_chat` | `/api/v1/peer-chat` | 10 | Anonymous chat rooms, presence |
| `leaderboard` | `/api/v1/leaderboard` | 3 | Rankings, user position |
| `feedback` | `/api/v1/feedback` | 3 | User feedback submission |
| `privacy` | `/api/v1/privacy` | 5 | Data export, deletion, consent |
| `health` | `/api/v1/health` | 3 | Readiness, liveness probes |
| `metrics` | `/api/v1/metrics` | 3 | Prometheus metrics (auth-protected) |
| `admin` | `/api/v1/admin` | 5 | User management, system stats |
| `cbt` | `/api/v1/cbt` | 4 | CBT exercises and modules |
| `integration` | `/api/v1/integrations` | 5 | OAuth health data sync |
| Additional | various | ~20 | Security, notifications, onboarding, etc. |

---

## Authentication

The API uses a **dual authentication system**:

1. **Firebase Auth** — handles user registration, Google OAuth, and password management
2. **Custom JWT** — issued by the backend for API access; verified by the `@AuthService.jwt_required` decorator

```python
from src.services.auth_service import AuthService

@mood_bp.route('/log', methods=['POST'])
@AuthService.jwt_required          # Verifies JWT, sets g.user_id
def log_mood():
    user_id = g.user_id            # Extracted from token
    # ...
```

**Important**: Do not use `@jwt_required` from flask-jwt-extended — the project uses a custom implementation in `auth_service.py`.

---

## Testing

```bash
pytest                             # Run all tests
pytest --maxfail=1 --tb=short      # Stop on first failure
pytest --cov=src --cov-report=term # Coverage report
pytest -k test_login               # Run specific test
```

### Testing Rules

- **Never** call real Firebase in tests — mock `firebase_admin.auth` and `firebase_admin.firestore`
- Use fixtures from `tests/conftest.py` for shared setup
- See `tests/test_auth_routes.py` for the canonical mock pattern

---

## Production Deployment

### Docker

```bash
docker build -f Dockerfile.production -t lugn-trygg-backend .
docker run -p 5001:5001 --env-file .env lugn-trygg-backend
```

### Docker Compose (full stack)

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Checklist

- [ ] `FLASK_ENV=production`, `FLASK_DEBUG=0`
- [ ] Firebase credentials via mounted file or `FIREBASE_CREDENTIALS` env var
- [ ] `REDIS_URL` set for production rate limiting
- [ ] `STRIPE_WEBHOOK_SECRET` set for secure webhook verification
- [ ] `CORS_ALLOWED_ORIGINS` restricted to production domains
- [ ] Health check configured on `/health`
- [ ] Logging to stdout with centralised log aggregation

---

## Background Services

The application initialises background workers on startup (when `TESTING=false`):

- **API key rotation** — periodic credential rotation
- **Automated backups** — scheduled Firestore backups
- **Monitoring** — Sentry integration and Prometheus metrics

### Scheduled Maintenance

Schedule a daily `POST /api/v1/challenges/maintenance/cleanup` with a valid JWT to expire completed challenges.
- Backups stored in secure bucket with retention policy
- Audit logs enabled via `AuditService`
- Documented runbook for redeploy/rollback

---
For the full system picture (web, mobile, infrastructure), coordinate with the platform README and deployment guides in the repo root.
