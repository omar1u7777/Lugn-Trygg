# Contributing to Lugn & Trygg

Thank you for your interest in contributing to Lugn & Trygg.

## Getting Started

1. Fork the repository
2. Clone your fork and create a feature branch from `master`
3. Follow the setup instructions in [README.md](README.md#getting-started)

## Development

### Frontend (React + TypeScript)

```bash
npm install
npm run dev           # Start dev server on port 3000
npm run type-check    # TypeScript validation
npm run lint          # ESLint
npm run test          # Vitest unit tests
npm run build         # Production build
```

### Backend (Flask + Python)

```bash
cd Backend
python -m venv venv
.\venv\Scripts\activate    # Windows
source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python main.py             # Start server on port 5001
pytest                     # Run tests
```

## Code Standards

- **TypeScript**: Strict mode enabled, no unused variables
- **Python**: Type hints, docstrings on public functions
- **Styling**: Tailwind CSS only — no Material-UI or inline styles
- **Imports**: Use `@/` path alias for frontend (`import { Button } from '@/components/ui/Button'`)
- **Auth**: Use `@AuthService.jwt_required` decorator on protected routes

## Pull Request Process

1. Ensure `npm run build` and `pytest` both pass
2. Update documentation if you changed APIs or configuration
3. Fill out the PR template completely
4. Request review from a maintainer

## Reporting Issues

Use the issue templates for:

- **Bug reports** — include reproduction steps and expected behavior
- **Feature requests** — describe the use case and proposed solution

## License

This project is proprietary. By contributing, you agree that your contributions become the property of the project owner. See [LICENSE](LICENSE) for details.
