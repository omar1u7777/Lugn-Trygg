# Lugn & Trygg - Mental Health Platform

A comprehensive mental health platform built with React, TypeScript, Tailwind CSS, and Flask, designed to help users track their mood, manage mental wellness, and access AI-powered insights.

## 🏗️ Architecture

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Headless UI (✅ hela design-systemet är flyttat hit; inga `@mui/*` beroenden får användas)
- **State Management**: React Context API
- **Routing**: React Router v6
- **Testing**: Vitest + Playwright E2E

### Backend
- **Framework**: Flask 3.0 + Python 3.11+
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth + Custom JWT
- **Caching**: Redis (production) / In-memory (development)
- **Testing**: pytest + comprehensive test suite

### Key Features
- 📊 Mood tracking and analytics
- 🎯 AI-powered insights and recommendations
- 🎙️ Voice emotion analysis
- 📱 Mobile-responsive design
- 🔒 Enterprise-grade security
- 🚀 Production-ready deployment

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Firebase project with Firestore enabled
- Redis (optional, for production caching)

### Frontend Setup
```bash
npm install
npm run dev
```

### Backend Setup
```bash
cd Backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
# Lokal utveckling
python main.py

# Produktion (samma kommando som Render kör)
python start_waitress.py
```

### Full Stack (Docker)
```bash
docker-compose up
```

## 📁 Project Structure

```
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── contexts/          # React Context providers
│   ├── hooks/             # Custom React hooks
│   ├── api/               # API client and utilities
│   ├── firebase-config.ts # Firebase configuration
│   └── types/             # TypeScript type definitions
├── Backend/               # Flask API server
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── services/      # Business logic services
│   │   ├── models/        # Data models
│   │   └── utils/         # Utility functions
│   └── tests/             # Backend test suite
├── tests/e2e/             # End-to-end tests
└── docs/                  # Documentation
```

## 🧪 Testing

### Frontend Tests
```bash
npm run test              # Unit tests
npm run test:e2e          # E2E tests
npm run test:coverage     # Coverage report
```

### Backend Tests
```bash
cd Backend
pytest                    # Run all tests
pytest --cov=src          # Coverage report
```

## 🔒 Security Features

- JWT token authentication with refresh tokens
- Input sanitization and XSS prevention
- Rate limiting (Redis-backed in production)
- CORS protection
- Audit logging for security events
- Secure token storage in browser

## 🚀 Deployment

### Frontend (Vercel)
```bash
npm run build
# Deploy to Vercel
```

### Backend (Render/Docker)
```bash
cd Backend
docker build -t lugn-trygg-backend .
docker run -p 5001:5001 lugn-trygg-backend

# Eller kör samma entrypoint som i render.yaml
python start_waitress.py
```

## 📊 Performance

- Code splitting with lazy loading
- Bundle analysis with rollup-plugin-visualizer
- Redis caching for API responses
- Optimized Firestore queries
- Mobile-first responsive design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm test && cd Backend && pytest`
4. Ensure code quality: `npm run lint && npm run type-check`
5. Submit a pull request

## 📄 License

Copyright 2025 - All rights reserved.

## 📞 Support

For support or questions, please contact the development team.

---

**Built with ❤️ for mental health awareness and support**</content>
<filePath>c:\Projekt\Lugn-Trygg-main_klar\README.md