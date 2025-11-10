# 🚀 QUICK START GUIDE - Deploy Lugn & Trygg for 1000 Users

## 📋 Pre-Deployment Checklist

### 1. Environment Setup
```bash
# Backend: Copy and configure production environment
cd Backend
cp .env.production .env
# Edit .env and replace ALL ${VARIABLE} with actual secrets!
```

### 2. Firebase Setup
- ✅ `serviceAccountKey.json` exists in Backend/
- ✅ Firebase project created
- ✅ Firestore database initialized
- ✅ Authentication enabled

### 3. Dependencies
```bash
# Backend
cd Backend
pip install -r requirements.txt

# Frontend
cd ..
npm install
```

## 🎯 Option 1: Quick Local Production Test

### Start Backend (Production Mode)
```powershell
# Windows PowerShell
cd Backend
.\deploy-production.ps1
```

```bash
# Linux/Mac
cd Backend
chmod +x deploy-production.sh
./deploy-production.sh
```

### Build & Serve Frontend
```bash
# Build production bundle
npm run build

# Serve with preview server
npm run preview
# OR use a static server
npx serve -s dist -p 3000
```

### Test Everything
```bash
# Health check
curl http://localhost:5001/api/health

# Frontend
open http://localhost:3000
```

## 🐳 Option 2: Docker Deployment (RECOMMENDED)

### Build & Start All Services
```bash
# Build images
docker-compose -f docker-compose.production.yml build

# Start services
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose -f docker-compose.production.yml logs -f
```

### Verify Services
```bash
# Backend health
curl http://localhost:5001/api/health

# Frontend
curl http://localhost:80

# All services status
docker-compose -f docker-compose.production.yml ps
```

## ☁️ Option 3: Cloud Deployment

### Vercel (Frontend)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard:
# VITE_API_URL=https://your-backend-url.com
```

### Render/Railway (Backend)
1. Connect GitHub repository
2. Set environment variables from `.env.production`
3. Deploy with:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn -c gunicorn_config.py main:app`

### Google Cloud Run (Full Stack)
```bash
# Backend
cd Backend
gcloud builds submit --tag gcr.io/PROJECT_ID/lugn-trygg-backend
gcloud run deploy lugn-trygg-backend --image gcr.io/PROJECT_ID/lugn-trygg-backend

# Frontend
cd ..
gcloud builds submit --tag gcr.io/PROJECT_ID/lugn-trygg-frontend
gcloud run deploy lugn-trygg-frontend --image gcr.io/PROJECT_ID/lugn-trygg-frontend
```

## 🧪 Testing 1000 Users

### Load Test with Locust
```bash
cd Backend

# Install Locust
pip install locust

# Start load test
locust -f load_test.py --host=http://localhost:5001

# Open web UI: http://localhost:8089
# Set: 1000 users, spawn rate 100/sec
```

### Performance Targets
- ✅ Response time (95th): < 500ms
- ✅ Error rate: < 1%
- ✅ Requests/sec: > 200
- ✅ Health endpoint: < 50ms

## 📊 Monitoring

### Health Checks
```bash
# Liveness (is server alive?)
curl http://localhost:5001/api/health/live

# Readiness (can handle traffic?)
curl http://localhost:5001/api/health/ready

# System metrics
curl http://localhost:5001/api/metrics

# Database health
curl http://localhost:5001/api/health/db
```

### Logs
```bash
# Docker
docker-compose -f docker-compose.production.yml logs -f backend

# Local
tail -f Backend/logs/app.log
```

## 🔄 Backup & Restore

### Create Backup
```bash
cd Backend
python backup_firestore.py

# Backup specific collection
python backup_firestore.py --collection users

# Backups saved to: Backend/backups/
```

### Restore from Backup
```bash
python backup_firestore.py \\
  --restore backups/users_20251110_120000.json \\
  --restore-collection users
```

## 🆘 Troubleshooting

### Backend won't start
```bash
# Check Python version (need 3.11+)
python --version

# Check dependencies
pip install -r requirements.txt --force-reinstall

# Check Firebase credentials
ls -la serviceAccountKey.json

# Check logs
cat logs/error.log
```

### Frontend build fails
```bash
# Clear cache
rm -rf node_modules/.vite
rm -rf dist

# Reinstall
rm -rf node_modules
npm install

# Build again
npm run build
```

### Database connection issues
```bash
# Test Firebase connection
python -c "from src.firebase_config import initialize_firebase; initialize_firebase(); print('✅ OK')"

# Check Firestore rules in Firebase Console
```

## 📈 Scaling for More Users

### 2000+ Users
- Increase Gunicorn workers: `workers = CPU * 3 + 1`
- Add Redis caching
- Use CDN for frontend assets
- Enable database indexes

### 5000+ Users
- Use multiple backend instances
- Load balancer (nginx/HAProxy)
- Redis cluster
- Firestore composite indexes

### 10000+ Users
- Kubernetes deployment
- Auto-scaling groups
- Database sharding
- Multi-region deployment

## ✅ Success Criteria

Deployment is successful when:
- [ ] All services start without errors
- [ ] Health checks return 200 OK
- [ ] Users can register/login
- [ ] API response time < 500ms
- [ ] Load test passes 1000 users
- [ ] No critical bugs in first hour
- [ ] Backups working
- [ ] Monitoring active

## 📞 Emergency Contacts

- Backend issues: Check logs first
- Frontend issues: Check browser console
- Database issues: Firebase Console
- Critical bugs: Create GitHub issue

---

**Last Updated:** 2025-11-10
**Version:** 1.0.0
**Tested for:** 1000 concurrent users
