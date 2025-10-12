# Lugn & Trygg - Production Deployment Guide

This guide covers deploying the Lugn & Trygg application in production using Docker and building the Electron desktop application.

## 🚀 Quick Start

### Option 1: Web Application (Docker)
```bash
# Build and deploy web version
docker-compose -f docker-compose.prod.yml up -d

# Or use the build script
./build.sh docker
```

### Option 2: Desktop Application (Electron)
```bash
# Build desktop app for current platform
./build.bat electron

# Or manually
cd frontend
npm ci
npm run build:electron:win  # Windows
npm run build:electron:mac  # macOS
npm run build:electron:linux  # Linux
```

### Option 3: Build Everything
```bash
# Build all versions
./build.bat all
```

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ and npm
- For Electron builds: Python 3.7+ and Visual Studio Build Tools (Windows) or Xcode (macOS)

## 🏗️ Production Architecture

### Web Deployment
- **Frontend**: Nginx serving static React app built with Vite
- **Backend**: Python Flask API with Gunicorn
- **Database**: Redis for caching and rate limiting
- **Reverse Proxy**: Nginx handles static files and API routing

### Desktop Deployment
- **Electron App**: Cross-platform desktop application
- **Local Backend**: Flask API runs locally
- **Local Redis**: For caching and sessions

## 🔧 Environment Configuration

### Backend Environment Variables
Create `Backend/.env` with:
```env
FLASK_DEBUG=false
PORT=5001
JWT_SECRET_KEY=your-secret-key
FIREBASE_CREDENTIALS=serviceAccountKey.json
# ... other Firebase and Stripe keys
```

### Frontend Environment Variables
Create `frontend/.env` with:
```env
VITE_BACKEND_URL=http://localhost:5001
VITE_FIREBASE_API_KEY=your-api-key
# ... other Firebase config
```

## 🐳 Docker Deployment

### Production Setup
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### Scaling
```bash
# Scale backend services
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Update services
docker-compose -f docker-compose.prod.yml up -d --build
```

## 🖥️ Electron Desktop App

### Building for Distribution
```bash
cd frontend

# Install dependencies
npm ci

# Build web assets
npm run build

# Build Electron app
npm run build:electron:win   # Windows installer
npm run build:electron:mac   # macOS .dmg
npm run build:electron:linux # Linux AppImage
```

### Code Signing (Production)
For production builds, configure code signing in `package.json`:

```json
"build": {
  "win": {
    "certificateFile": "path/to/cert.p12",
    "certificatePassword": "cert-password"
  },
  "mac": {
    "identity": "Developer ID Application: Your Name"
  }
}
```

## 🔒 Security Considerations

### Content Security Policy
The application includes CSP headers that allow:
- Firebase services for authentication
- Google Analytics for tracking
- Font Awesome and Google Fonts for styling
- Local backend API communication

### Environment Variables
- Never commit secrets to version control
- Use different secrets for development and production
- Rotate API keys regularly

## 📊 Monitoring & Logging

### Docker Logs
```bash
# View all service logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Health Checks
- Backend: `GET /health`
- Frontend: `GET /` (served by Nginx)
- Redis: Built-in health checks

## 🚀 Deployment Checklist

- [ ] Environment variables configured
- [ ] SSL certificates (if using HTTPS)
- [ ] Domain name configured
- [ ] Firebase project set up
- [ ] Stripe/webhook endpoints configured
- [ ] Database backups configured
- [ ] Monitoring and alerting set up

## 🐛 Troubleshooting

### Common Issues

**Electron build fails**
- Ensure Python and build tools are installed
- Check Node.js version compatibility
- Clear node_modules and rebuild

**Docker containers won't start**
- Check environment variables
- Verify port availability
- Check Docker logs: `docker-compose logs`

**CSP blocking resources**
- Update CSP rules in `main.cjs` for new domains
- Ensure Firebase config is correct

## 📚 Additional Resources

- [Electron Builder Documentation](https://www.electron.build/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Vite Build Configuration](https://vitejs.dev/guide/build.html)
- [Flask Deployment](https://flask.palletsprojects.com/en/2.3.x/deploying/)

## 🤝 Support

For deployment issues, check:
1. Application logs
2. Docker container status
3. Network connectivity
4. Environment variable configuration