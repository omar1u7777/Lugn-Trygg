# AGENTS.md - Lugn & Trygg Development Guide

## Commands

### Frontend (React/TypeScript/Tailwind)
```bash
npm run dev                    # Start Vite dev server (port 3000)
npm run build                  # Production build
npm run test                   # Run Vitest unit tests
npm run test -- --watch       # Watch mode
npm run test -- src/file.test.ts  # Single test file
npm run test:e2e               # Playwright E2E tests
npm run type-check             # TypeScript validation
npm run lint                   # ESLint check
```

### Backend (Flask/Python)
```bash
cd Backend
python -m venv venv
.\venv\Scripts\activate        # Windows
python main.py                 # Start server (port 5001)
pytest                         # Run all tests
pytest -k test_name           # Single test
pytest -v --tb=short          # Verbose output
pytest --cov=src              # Coverage report
```

## Architecture

**Monorepo structure:**
- `src/` - React 18 + TypeScript + Vite (frontend)
- `Backend/` - Flask 3.0 + Firebase Admin SDK (backend)
- **Database:** Firebase Firestore (shared)
- **Auth:** Firebase Auth + Custom JWT tokens
- **Design:** Tailwind CSS + Headless UI (NO MUI)

**Key patterns:**
- Direct imports in `App.tsx` (no lazy loading - prevents React conflicts)
- Backend uses `@AuthService.jwt_required` decorator (NOT `@jwt_required` from flask-jwt-extended)
- Blueprint-based Flask routing (18+ blueprints: auth, mood, memory, ai, dashboard, etc.)
- Services: `auth_service.py`, `audit_service.py`, `rate_limiting.py`, `backup_service.py`

## Code Style

**TypeScript/React:**
- Use `@/` path alias for imports: `import { Button } from '@/components/ui/Button'`
- Components in `src/components/` organized by feature hubs
- Use Tailwind: `className="bg-primary-500 text-white rounded-lg p-4"`
- Never import from `@mui/*` (MUI removed Nov 2025)
- Strict mode enabled: `strict: true` in tsconfig

**Python:**
- Flask routes in `Backend/src/routes/` (blueprint pattern)
- Services in `Backend/src/services/` (business logic)
- Type hints: `from typing import Optional, Dict` (Pydantic models for validation)
- Protected routes: `@AuthService.jwt_required` sets `g.user_id`
- Error handling: Use `werkzeug.exceptions` for HTTP responses

**General:**
- ESLint enforced: `npm run lint` (0 warnings allowed)
- No unused variables: `noUnusedLocals: true`, `noUnusedParameters: true`
- Case sensitivity: `forceConsistentCasingInFileNames: true` (Windows/Linux compatibility)

## Testing

- **Frontend unit tests:** Wrap in `TestProviders` (AuthContext, ThemeContext, i18n)
- **Frontend E2E:** Playwright from `tests/e2e/` (baseURL: `http://localhost:3000`)
- **Backend tests:** Mock Firebase using pytest fixtures - never call real Firebase
- Single test: `npm run test src/Button.test.tsx` or `pytest tests/test_auth_routes.py::test_login`

## External Rules

Include `.github/copilot-instructions.md` - contains full stack patterns, authentication flow, Firebase integration, common pitfalls.
