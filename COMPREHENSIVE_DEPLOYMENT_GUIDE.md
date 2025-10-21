# 🚀 Comprehensive Deployment Guide - Lugn & Trygg

**Last Updated**: October 19, 2025  
**Status**: Production Deployment Guide - Step 8 Complete

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Frontend Deployment Options](#frontend-deployment-options)
3. [Backend Deployment Options](#backend-deployment-options)
4. [Database & Storage Setup](#database--storage-setup)
5. [Environment Configuration](#environment-configuration)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 🎯 Overview

### Architecture

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   Frontend      │       │   Backend API    │       │   Firebase      │
│   (React SPA)   │◄─────►│   (Flask)        │◄─────►│   (Firestore)   │
│   Vite Build    │ HTTPS │   Python 3.11    │ Admin │   Storage       │
└─────────────────┘       └──────────────────┘  SDK  │   Auth          │
                                                      └─────────────────┘
```

### Recommended Stack

**Option 1: Full Google Cloud** (Recommended)
- Frontend: Firebase Hosting
- Backend: Google Cloud Run
- Database: Firestore
- Storage: Firebase Storage
- Auth: Firebase Auth

**Option 2: Mixed Platform**
- Frontend: Vercel/Netlify
- Backend: Heroku/Railway
- Database: Firestore
- Storage: Firebase Storage

**Option 3: Electron Desktop App**
- Package as desktop app with Electron
- Backend runs locally or connects to cloud API

---

## 🌐 Frontend Deployment Options

### Option 1: Firebase Hosting (Recommended)

**Pros**:
- ✅ Automatic HTTPS & SSL
- ✅ Global CDN
- ✅ Easy integration with Firebase services
- ✅ Free tier available
- ✅ Automatic cache invalidation

**Setup Steps**:

1. **Install Firebase CLI**:
```powershell
npm install -g firebase-tools
firebase login
```

2. **Initialize Firebase Hosting**:
```powershell
cd c:\Projekt\Lugn-Trygg-main_klar
firebase init hosting

# Select:
# - Use existing project (select your Firebase project)
# - Public directory: frontend/dist
# - Configure as SPA: Yes
# - Set up automatic builds: No (we'll build manually)
```

3. **Update `firebase.json`**:
```json
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains; preload"
          }
        ]
      }
    ],
    "cleanUrls": true,
    "trailingSlash": false
  }
}
```

4. **Create Production Environment File**:
```powershell
# Create frontend/.env.production
cd frontend
New-Item -Path ".env.production" -ItemType File -Force
```

**frontend/.env.production**:
```bash
# Backend API (Update with your Cloud Run URL)
VITE_BACKEND_URL=https://your-backend-xxxxx.run.app

# Firebase Configuration (from Firebase Console)
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_FIREBASE_VAPID_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXXXXXXXXXX

# Other
VITE_ENCRYPTION_KEY=your-32-char-encryption-key-here
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

5. **Build and Deploy**:
```powershell
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

6. **Custom Domain (Optional)**:
```powershell
firebase hosting:channel:deploy production
# Then add custom domain in Firebase Console
```

**Deployment URL**: `https://your-project.web.app` or `https://your-project.firebaseapp.com`

---

### Option 2: Vercel

**Pros**:
- ✅ Extremely fast deployments
- ✅ Edge network
- ✅ Git integration
- ✅ Preview deployments
- ✅ Free tier for personal projects

**Setup Steps**:

1. **Install Vercel CLI**:
```powershell
npm install -g vercel
vercel login
```

2. **Create `vercel.json`**:
```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

3. **Deploy**:
```powershell
cd frontend
vercel --prod
```

4. **Set Environment Variables**:
```powershell
vercel env add VITE_FIREBASE_API_KEY production
vercel env add VITE_BACKEND_URL production
# ... add all VITE_* variables
```

**Deployment URL**: `https://your-app.vercel.app`

---

### Option 3: Netlify

**Setup Steps**:

1. **Create `netlify.toml`**:
```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
```

2. **Deploy**:
```powershell
npm install -g netlify-cli
netlify login
cd frontend
netlify deploy --prod
```

**Deployment URL**: `https://your-app.netlify.app`

---

## 🔧 Backend Deployment Options

### Option 1: Google Cloud Run (Recommended)

**Pros**:
- ✅ Serverless, auto-scaling
- ✅ Pay-per-use
- ✅ Native Firebase integration
- ✅ HTTPS automatic
- ✅ Container-based

**Setup Steps**:

1. **Install Google Cloud SDK**:
```powershell
# Download from: https://cloud.google.com/sdk/docs/install
gcloud init
gcloud auth login
```

2. **Create `Dockerfile`** in `Backend/`:
```dockerfile
# Backend/Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Expose port
EXPOSE 8080

# Run application
CMD exec gunicorn --bind :$PORT --workers 2 --threads 4 --timeout 0 main:app
```

3. **Update `requirements.txt`** (add Gunicorn):
```
gunicorn==21.2.0
```

4. **Create `.dockerignore`**:
```
Backend/.dockerignore

__pycache__
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.env
.env.local
*.log
.pytest_cache
.coverage
htmlcov/
dist/
build/
*.egg-info
.git
.gitignore
README.md
```

5. **Build and Deploy**:
```powershell
cd Backend

# Set project
gcloud config set project your-project-id

# Build container
gcloud builds submit --tag gcr.io/your-project-id/backend

# Deploy to Cloud Run
gcloud run deploy backend `
  --image gcr.io/your-project-id/backend `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars "FLASK_DEBUG=False,JWT_SECRET_KEY=your-secret" `
  --set-secrets "OPENAI_API_KEY=openai-key:latest,STRIPE_SECRET_KEY=stripe-key:latest"
```

6. **Set Environment Variables via Secret Manager**:
```powershell
# Create secrets in Google Secret Manager
gcloud secrets create openai-key --replication-policy="automatic"
echo -n "sk-..." | gcloud secrets versions add openai-key --data-file=-

gcloud secrets create jwt-secret --replication-policy="automatic"
echo -n "your-jwt-secret" | gcloud secrets versions add jwt-secret --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding openai-key `
  --member="serviceAccount:your-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

**Deployment URL**: `https://backend-xxxxx-uc.a.run.app`

---

### Option 2: Heroku

**Setup Steps**:

1. **Install Heroku CLI**:
```powershell
# Download from: https://devcenter.heroku.com/articles/heroku-cli
heroku login
```

2. **Create `Procfile`**:
```
Backend/Procfile

web: gunicorn --bind 0.0.0.0:$PORT main:app
```

3. **Create `runtime.txt`**:
```
Backend/runtime.txt

python-3.11.5
```

4. **Deploy**:
```powershell
cd Backend
git init
heroku create your-app-name
heroku config:set FLASK_DEBUG=False
heroku config:set JWT_SECRET_KEY=your-secret
heroku config:set OPENAI_API_KEY=sk-...
git add .
git commit -m "Initial deploy"
git push heroku main
```

**Deployment URL**: `https://your-app-name.herokuapp.com`

---

### Option 3: Railway

**Setup Steps**:

1. **Create `railway.toml`**:
```toml
[build]
  builder = "NIXPACKS"
  buildCommand = "pip install -r requirements.txt"

[deploy]
  startCommand = "gunicorn --bind 0.0.0.0:$PORT main:app"
  healthcheckPath = "/health"
  healthcheckTimeout = 100
```

2. **Deploy**:
```powershell
npm install -g @railway/cli
railway login
cd Backend
railway init
railway up
```

**Deployment URL**: `https://your-app.up.railway.app`

---

## 🗄️ Database & Storage Setup

### Firebase Setup (Required)

1. **Create Firebase Project**:
   - Go to https://console.firebase.google.com
   - Click "Add project"
   - Enter project name: `lugn-trygg-production`
   - Disable Google Analytics (optional)
   - Click "Create project"

2. **Enable Firestore**:
   - Navigate to "Firestore Database"
   - Click "Create database"
   - Choose "Production mode"
   - Select region: `us-central1` (or closest)

3. **Set Firestore Security Rules**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read, write: if isSignedIn() && isOwner(userId);
    }
    
    // Moods collection
    match /moods/{moodId} {
      allow read, write: if isSignedIn() && isOwner(resource.data.userId);
      allow create: if isSignedIn() && isOwner(request.resource.data.userId);
    }
    
    // Memories collection
    match /memories/{memoryId} {
      allow read, write: if isSignedIn() && isOwner(resource.data.userId);
      allow create: if isSignedIn() && isOwner(request.resource.data.userId);
    }
    
    // Token blacklist (admin only)
    match /token_blacklist/{tokenId} {
      allow read: if isSignedIn();
      allow write: if false; // Only backend can write
    }
  }
}
```

4. **Deploy Security Rules**:
```powershell
firebase deploy --only firestore:rules
```

5. **Create Firestore Indexes**:
```powershell
firebase deploy --only firestore:indexes
```

6. **Enable Firebase Storage**:
   - Navigate to "Storage"
   - Click "Get started"
   - Use production mode
   - Select same region as Firestore

7. **Download Service Account Key**:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save as `serviceAccountKey.json`
   - **DO NOT commit to Git!**
   - Store in Google Secret Manager or secure vault

---

## ⚙️ Environment Configuration

### Backend Environment Variables

**For Google Cloud Run** (via Secret Manager):
```powershell
# Create all required secrets
gcloud secrets create jwt-secret
gcloud secrets create jwt-refresh-secret
gcloud secrets create openai-key
gcloud secrets create stripe-secret-key
gcloud secrets create google-client-id

# Add values
echo -n "your-jwt-secret-here" | gcloud secrets versions add jwt-secret --data-file=-
```

**For Heroku**:
```powershell
heroku config:set JWT_SECRET_KEY="your-secret"
heroku config:set JWT_REFRESH_SECRET_KEY="your-refresh-secret"
heroku config:set OPENAI_API_KEY="sk-..."
heroku config:set STRIPE_SECRET_KEY="sk_live_..."
heroku config:set FIREBASE_PROJECT_ID="your-project"
heroku config:set CORS_ALLOWED_ORIGINS="https://your-app.com"
heroku config:set FRONTEND_URL="https://your-app.com"
```

### Frontend Environment Variables

**For Firebase Hosting**:
- Create `.env.production` (shown above)
- Build with production env: `npm run build`
- Secrets are baked into build (public safe)

**For Vercel**:
```powershell
vercel env add VITE_BACKEND_URL production
vercel env add VITE_FIREBASE_API_KEY production
# ... add all VITE_* variables
```

**For Netlify**:
```powershell
netlify env:set VITE_BACKEND_URL "https://api.your-app.com"
netlify env:set VITE_FIREBASE_API_KEY "AIza..."
# ... or use Netlify UI
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions for Firebase Hosting

**`.github/workflows/deploy-frontend.yml`**:
```yaml
name: Deploy Frontend to Firebase

on:
  push:
    branches:
      - main
    paths:
      - 'frontend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci
      
      - name: Build
        working-directory: ./frontend
        env:
          VITE_BACKEND_URL: ${{ secrets.VITE_BACKEND_URL }}
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
        run: npm run build
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: your-project-id
```

### GitHub Actions for Cloud Run

**`.github/workflows/deploy-backend.yml`**:
```yaml
name: Deploy Backend to Cloud Run

on:
  push:
    branches:
      - main
    paths:
      - 'Backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}
      
      - name: Configure Docker
        run: gcloud auth configure-docker
      
      - name: Build Docker image
        working-directory: ./Backend
        run: |
          docker build -t gcr.io/${{ secrets.GCP_PROJECT_ID }}/backend:${{ github.sha }} .
          docker push gcr.io/${{ secrets.GCP_PROJECT_ID }}/backend:${{ github.sha }}
      
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy backend \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/backend:${{ github.sha }} \
            --platform managed \
            --region us-central1 \
            --allow-unauthenticated
```

---

## ✅ Post-Deployment Verification

### 1. Health Check Endpoint

**Add to `Backend/main.py`**:
```python
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    }), 200
```

### 2. Verification Checklist

```powershell
# Test backend health
curl https://your-backend.run.app/health

# Test frontend loads
curl -I https://your-app.web.app

# Test API authentication
curl -X POST https://your-backend.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Test CORS
curl -H "Origin: https://your-app.web.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  https://your-backend.run.app/api/auth/login
```

### 3. Manual Testing

- [ ] Can load frontend
- [ ] Can register new account
- [ ] Can login
- [ ] Can add mood entry
- [ ] Can create memory
- [ ] Push notifications work
- [ ] Offline mode works
- [ ] Theme switching works
- [ ] Language switching works

---

## 📊 Monitoring & Maintenance

### Google Cloud Monitoring

```powershell
# Enable Cloud Monitoring
gcloud services enable monitoring.googleapis.com

# Create uptime check
gcloud alpha monitoring uptime-check-configs create backend-uptime \
  --display-name="Backend Uptime Check" \
  --http-check-path=/health \
  --monitored-resource-type=gce_instance
```

### Sentry Integration

**Backend**:
```python
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn=os.getenv('SENTRY_DSN'),
    integrations=[FlaskIntegration()],
    traces_sample_rate=1.0,
    environment='production'
)
```

**Frontend**:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 1.0,
});
```

---

## 🎯 Quick Deploy Commands

### Full Deployment (All Platforms)

```powershell
# Build frontend
cd frontend
npm run build

# Deploy frontend to Firebase
cd ..
firebase deploy --only hosting

# Deploy backend to Cloud Run
cd Backend
gcloud builds submit --tag gcr.io/your-project/backend
gcloud run deploy backend --image gcr.io/your-project/backend

# Deploy Firestore rules and indexes
cd ..
firebase deploy --only firestore
```

---

## 📚 Additional Resources

- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Heroku Python Docs](https://devcenter.heroku.com/categories/python-support)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

**Last Updated**: October 19, 2025  
**Status**: ✅ Deployment guide complete  
**Next**: Execute deployment following this guide
