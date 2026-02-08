# Lugn & Trygg Backend

Production-grade Flask API powering the Lugn & Trygg platform.

## 1. Prerequisites
- Python 3.11+
- Node.js 18+ (for shared tooling)
- Redis 7.x (rate limiting, adaptive throttling)
- Service account JSON for the live Firebase project
- Optional: Docker / Docker Compose for containerised deploys

## 2. Environment Configuration
1. Copy `.env.example` to `.env`.
2. Provide a valid Firebase service-account JSON:
   - Either mount the file and set `FIREBASE_CREDENTIALS_PATH` to the absolute path, **or**
   - Paste the raw JSON (single line) into `FIREBASE_CREDENTIALS`.
3. Fill in required secrets:
   - `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`
   - `FIREBASE_WEB_API_KEY`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`
   - Any third-party keys (Stripe, OpenAI, Resend, etc.)
4. Configure `CORS_ALLOWED_ORIGINS` to the production front-end domains.
5. Add `REDIS_URL` when using the advanced rate limiter (e.g. `redis://redis:6379/0`).
6. Challenges service (prod defaults):
   - `ALLOW_IN_MEMORY_CHALLENGES=false` (avoid in-memory fallback in prod)
   - `PUBLIC_CHALLENGES_GET=false` (set to `true` only if challenge listings must be public)
   - Ensure Firestore credentials are present (via `FIREBASE_CREDENTIALS` or file path) so 503 fallback never triggers.

> **Never** commit `.env`, credentials, or secrets. Use your cloud secret manager in production.

## 3. Local Setup
```bash
cd Backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux
pip install --upgrade pip
pip install -r requirements.txt
```

Run the API locally:
```bash
venv\Scripts\python.exe main.py
```
The server runs on `http://127.0.0.1:5001` by default.

## 4. Tests & Quality Gates
```bash
pytest --maxfail=1 --disable-warnings
pytest --cov=src --cov-report=term-missing
flake8 src
black --check src
pylint src
```

Include these checks in CI to prevent regressions before deployment.

## 5. Production Deployment
- Build the Docker image located in `Backend/Dockerfile`.
- Provide the Firebase credentials via a mounted file or secret volume (mapped to `/app/firebase-credentials.json`).
- Set `FLASK_ENV=production` and disable `FLASK_DEBUG`.
- Ensure Redis, Postgres, and other dependencies are reachable (see `docker-compose.prod.yml`).
- Configure logging to stdout + centralised log aggregation (e.g. Cloud Logging, Datadog).
- Set up health checks on `/health` and use `/api/metrics` for Prometheus scraping.

## 6. Background Services
The application starts several background workers when `TESTING` is false:
- API key rotation scheduler
- Automated backups
- Monitoring service

### Scheduled maintenance (challenges cleanup)
- Schedule a daily POST to `/api/challenges/maintenance/cleanup` with `Authorization: Bearer <JWT>`.
- Cloud Scheduler example: HTTP target → URL to your backend → method POST → add header `Authorization: Bearer <JWT_TOKEN>`.
- Use a short-lived JWT from a secure generator (Cloud Function/Run) or a service account flow.

Confirm these services are permitted to run in your hosting environment and have required permissions (Firestore/Storage access).

## 7. Incident Readiness Checklist
- Alerts on 5xx rates, latency, and error spikes
- Rate limiter backed by Redis to defend against abuse
- Backups stored in secure bucket with retention policy
- Audit logs enabled via `AuditService`
- Documented runbook for redeploy/rollback

---
For the full system picture (web, mobile, infrastructure), coordinate with the platform README and deployment guides in the repo root.
