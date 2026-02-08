# Lugn & Trygg - AI Agent Instructions

**Mental health platform with React/Tailwind frontend + Flask/Firebase backend**

## Architecture Overview

### Full-Stack Monorepo Structure
- **Frontend**: `src/` - React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: `Backend/` - Flask 3.0 + Firebase Admin SDK + Python 3.11+
- **Shared**: Firebase Firestore database, Firebase Auth, Firebase Storage

### Key Architectural Decisions
1. **NO Material-UI** - Migrated to Tailwind CSS + Headless UI (Nov 2025). Never import from `@mui/*`
2. **Direct imports over lazy loading** - `App.tsx` uses direct imports to prevent React instance conflicts (see lines 21-35)
3. **Dual auth system** - Backend uses custom JWT tokens (`AuthService.jwt_required` decorator) + Firebase Auth for client-side
4. **Blueprint-based routing** - Backend has 18+ Flask blueprints (auth, mood, memory, ai, dashboard, etc.)

## Development Workflows

### Frontend Development
```powershell
npm run dev              # Start Vite dev server (port 3000)
npm run build            # Production build with manual chunks
npm run test             # Vitest unit tests
npm run test:e2e         # Playwright E2E tests
npm run type-check       # TypeScript validation
```

**Build artifacts**: `dist/` with vendor chunking (vendor-react, vendor-ui, vendor-firebase, vendor-charts)

### Backend Development
```powershell
cd Backend
.\venv\Scripts\activate  # Windows venv activation
python main.py           # Start Flask on port 5001
pytest                   # Run tests with Firebase mocks
```

**Critical**: Backend requires `serviceAccountKey.json` at `Backend/serviceAccountKey.json` or `FIREBASE_CREDENTIALS` env var

### Full Stack Local Setup
```powershell
docker-compose up        # Runs backend (5001), frontend (3000), Redis (6379)
```

## Project-Specific Patterns

### Authentication Flow
1. **Frontend**: User logs in → Firebase Auth → receives Firebase ID token
2. **Backend**: Verify Firebase token OR custom JWT (both supported)
3. **Protected routes**: Use `@AuthService.jwt_required` decorator (NOT `@jwt_required` from flask-jwt-extended)
4. **Frontend context**: `AuthContext` provides `token`, `user`, `login()`, `logout()` globally

Example backend protected route:
```python
from ..services.auth_service import AuthService

@mood_bp.route('/log', methods=['POST'])
@AuthService.jwt_required  # This sets flask.g.user_id
def log_mood():
    user_id = g.user_id  # Extracted from JWT by decorator
```

### Design System (Post-MUI Migration)
- **DO**: Import from `src/components/ui/` (Button, Card, Input) - these are Tailwind-based
- **DO**: Use Tailwind utility classes: `className="bg-primary-500 text-white rounded-lg p-4"`
- **DON'T**: Import anything from `@mui/material` or `@emotion/*`
- **Theme**: `tailwind.config.js` defines color scales (primary, secondary, success, error, warning)
- **Dark mode**: Managed by `ThemeContext` using Tailwind's `class` strategy

### Frontend Component Structure
Components are organized by feature hubs:
- `src/components/` - Base UI components and feature hubs
- `src/components/ui/` - Reusable Tailwind components (Button, Card, Input, etc.)
- `src/components/Layout/` - Navigation, ProtectedRoute
- Feature hubs: `WellnessHub`, `SocialHub`, `JournalHub`, `InsightsHub`, `RewardsHub`, `ProfileHub`

**Direct imports required**: `App.tsx` directly imports ALL route components to avoid lazy loading issues (see comment at line 19-20)

### Backend Service Layer Pattern
Services in `Backend/src/services/`:
- `auth_service.py` - JWT generation, Firebase token verification, `@jwt_required` decorator
- `audit_service.py` - Use `audit_log(action, user_id, metadata)` for security events
- `backup_service.py` - Automated Firestore backups
- `rate_limiting.py` - Redis-backed rate limiting (use `@rate_limit_by_endpoint()` decorator)
- `monitoring_service.py` - Sentry integration (auto-initialized in `main.py`)

### Firebase Integration
**Backend** (`Backend/src/firebase_config.py`):
```python
from src.firebase_config import db, auth, storage
# db = Firestore client
# auth = Firebase Admin Auth
# storage = Firebase Storage
```

**Frontend** (`src/firebase-config.ts`):
```typescript
import { auth, db, storage } from './firebase-config';
// Client-side Firebase SDK
```

**Collections**: users (807), moods (41k+), memories (6.8k+), feedback, referrals, chat_sessions, achievements

### Testing Patterns
**Frontend**:
- Unit tests: Vitest with `src/setupTests.ts` - wrap components in `TestProviders` (provides AuthContext, ThemeContext, i18n)
- E2E tests: Playwright in `tests/e2e/` - baseURL `http://localhost:3000`

**Backend**:
- Tests in `Backend/tests/` - use pytest fixtures to mock Firebase
- Mock pattern: Patch `firebase_admin.auth` and `firebase_admin.firestore` 
- DO NOT call real Firebase in tests - see `tests/test_auth_routes.py` for examples

## Common Pitfalls & Solutions

### 1. React Undefined Errors
**Symptom**: "React is not defined" or hooks errors
**Cause**: Lazy loading created multiple React instances
**Solution**: Already fixed - use direct imports in `App.tsx` (lines 21-72)

### 2. Authentication Decorator Confusion
**Wrong**: `@jwt_required()` (flask-jwt-extended - NOT USED)
**Right**: `@AuthService.jwt_required` (custom decorator in `auth_service.py`)

### 3. CORS Issues
Backend CORS configured for:
- `http://localhost:3000` (Vite dev)
- `https://lugn-trygg.vercel.app` (production)
- `https://*.vercel.app` (preview deployments)

Update `CORS_ALLOWED_ORIGINS` in `Backend/.env` for new domains

### 4. Build Failures
- Check `vite.config.ts` for manual chunks config (lines 38-61)
- Ensure no `@mui/*` imports remain
- Run `npm run type-check` before build

### 5. Firebase Credential Issues
**Backend needs ONE of**:
- `FIREBASE_CREDENTIALS_PATH=/app/serviceAccountKey.json` (file path)
- `FIREBASE_CREDENTIALS={"type":"service_account",...}` (raw JSON)

**Frontend needs** (in `.env`):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

## Key Files to Reference

### Configuration
- `vite.config.ts` - Frontend build, path aliases (`@/`), chunking strategy
- `tailwind.config.js` - Design tokens, color scales, animations
- `Backend/src/config.py` - Backend configuration, env vars
- `docker-compose.yml` - Full stack setup with Redis

### Core Logic
- `src/App.tsx` (580 lines) - Route definitions, all imports
- `Backend/main.py` (308 lines) - Flask app initialization, blueprint registration
- `Backend/src/services/auth_service.py` (419 lines) - Auth logic, JWT decorator
- `src/contexts/AuthContext.tsx` (165 lines) - Global auth state management

### Documentation
- `Backend/README.md` - Backend setup, deployment
- `MUI_REMOVAL_SUCCESS_REPORT.md` - Design system migration details
- `PRODUCTION_ROADMAP.md` - 6-day launch plan (currently Day 1)
- `HONEST_PROJECT_ASSESSMENT.md` - Real project status (807 users, 41k moods)

## External Dependencies

### Frontend (package.json)
- React Router v6 (`react-router-dom`)
- Headless UI + Heroicons (replaces Material-UI)
- Framer Motion (animations)
- Recharts (analytics charts)
- i18next (internationalization)
- Amplitude, Sentry (analytics/monitoring)

### Backend (requirements.txt)
- Flask 3.0 + Flask-CORS + Flask-Limiter
- firebase-admin (Firestore, Auth, Storage)
- PyJWT (custom JWT tokens)
- Redis (rate limiting)
- OpenAI (AI features)
- Stripe (payments)
- Sentry (error tracking)

## Rate Limiting Strategy
- **Development**: In-memory rate limiter (`memory://`)
- **Production**: Redis-backed (`redis://redis:6379`)
- Default limits: 5000/day, 1000/hour, 300/min per IP
- Endpoint-specific: Use `@rate_limit_by_endpoint()` with custom limits

## Deployment
- **Frontend**: Vercel (auto-deploy from main branch)
- **Backend**: Render or Docker container (see `Backend/Dockerfile.production`)
- **Database**: Firebase Firestore (already has 49k+ documents)
- **Secrets**: Use environment variables, NEVER commit `.env` or `serviceAccountKey.json`

## When in Doubt
1. Check existing patterns in similar files (e.g., look at `mood_routes.py` for new routes)
2. Use Tailwind classes, not inline styles or MUI components
3. All protected routes need `@AuthService.jwt_required` decorator
4. Test authentication flows end-to-end (login → token → protected endpoint)
5. Run both `npm run build` and `pytest` before pushing changes
