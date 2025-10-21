# Production Deployment Guide - FASE 1

**Last Updated**: 2025-10-19  
**Status**: Ready for Production  
**Build Version**: 1.19 MB (386 KB gzipped)  
**Backend**: Flask on port 54112 (configurable)  
**Frontend**: React 18 + Vite + Electron  

---

## Pre-Deployment Checklist

### Code Quality ✅
- [x] 0 TypeScript errors
- [x] 9/9 tests passing
- [x] 0 ESLint errors (ignoring pre-existing)
- [x] WCAG 2.1 AA accessibility audit complete
- [x] Production build successful

### Documentation ✅
- [x] FASE1_COMPLETION_SUMMARY.md
- [x] ACCESSIBILITY_AUDIT_FINDINGS.md
- [x] ACCESSIBILITY_FIXES_COMPLETE.md
- [x] SESSION_SUMMARY_ACCESSIBILITY.md
- [x] AUTOMATED_ACCESSIBILITY_TEST_REPORT.md
- [x] INTEGRATION_TESTING_PLAN.md
- [x] This deployment guide

### Testing ✅
- [ ] Manual accessibility testing (In Progress)
- [ ] Integration testing (In Progress)
- [ ] Staging deployment (Next)
- [ ] Production sign-off (Final)

---

## Deployment Options

### Option 1: Firebase Hosting (Recommended)

**Pros**:
- ✅ Automatic HTTPS
- ✅ CDN global distribution
- ✅ Zero-config deployment
- ✅ Free tier available
- ✅ Integrated with Firebase auth
- ✅ Automatic SSL certificates

**Cons**:
- Vendor lock-in (Firebase)
- Limited backend integration

**Setup**:

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Initialize Firebase project
cd frontend
firebase init hosting

# 4. Configure firebase.json
cat > firebase.json << 'EOF'
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
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
        "source": "/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=3600, must-revalidate"
          }
        ]
      }
    ]
  }
}
EOF

# 5. Build and deploy
npm run build
firebase deploy --only hosting
```

**Firebaserc Configuration**:
```json
{
  "projects": {
    "default": "lugn-trygg-53d75"
  }
}
```

---

### Option 2: Vercel (Alternative)

**Pros**:
- ✅ Optimized for React/Next.js
- ✅ Built-in previews
- ✅ Analytics
- ✅ Edge functions
- ✅ Simple git integration

**Setup**:

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel --prod

# 3. Configure in Vercel dashboard (web)
# - Link to GitHub repo
# - Set environment variables
# - Configure build command: npm run build
# - Configure output directory: dist
```

**Vercel Config (vercel.json)**:
```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "env": {
    "VITE_FIREBASE_API_KEY": "@firebase_api_key",
    "VITE_FIREBASE_AUTH_DOMAIN": "@firebase_auth_domain"
  }
}
```

---

### Option 3: Docker + Cloud Run (Scalable)

**Pros**:
- ✅ Full control
- ✅ Scalable
- ✅ Works with backend
- ✅ Cost-effective (pay-per-use)

**Setup**:

```dockerfile
# Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

**Deploy to Cloud Run**:
```bash
# 1. Build image
docker build -f Dockerfile.prod -t lugn-trygg-frontend .

# 2. Push to Container Registry
docker tag lugn-trygg-frontend gcr.io/PROJECT_ID/lugn-trygg-frontend
docker push gcr.io/PROJECT_ID/lugn-trygg-frontend

# 3. Deploy to Cloud Run
gcloud run deploy lugn-trygg-frontend \
  --image gcr.io/PROJECT_ID/lugn-trygg-frontend \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --allow-unauthenticated
```

---

## Backend Deployment

### Flask Backend Deployment

**Current Setup**:
- Framework: Flask 2.x
- Port: 54112 (configurable)
- Tests: 43/43 passing
- Dependencies: requirements.txt

**Option A: Google Cloud App Engine**

```yaml
# app.yaml
runtime: python311

env: standard
entrypoint: gunicorn -w 4 -b :$PORT main:app

env_variables:
  FLASK_ENV: "production"
  FLASK_DEBUG: "false"

handlers:
- url: /static
  static_dir: static
  
automatic_scaling:
  min_instances: 1
  max_instances: 10
```

**Deploy**:
```bash
cd Backend
gcloud app deploy app.yaml
```

**Option B: Railway.app (Simple)**

```bash
# 1. Create Railway account
# 2. Link GitHub repo
# 3. Set environment variables
# 4. Deploy

# Or CLI:
railway up

# Access via: https://your-project.railway.app
```

**Option C: Heroku (Deprecating but still available)**

```bash
# 1. Create Procfile
echo "web: gunicorn -w 4 -b :$PORT main:app" > Procfile

# 2. Deploy
git push heroku main
```

---

## Environment Variables

### Frontend (.env)

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyAxs7Monr1bJaXmUecl8eICvDaDhUkCFYY
VITE_FIREBASE_AUTH_DOMAIN=lugn-trygg-53d75.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lugn-trygg-53d75
VITE_FIREBASE_STORAGE_BUCKET=lugn-trygg-53d75.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID

# Analytics
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_AMPLITUDE_API_KEY=your-amplitude-key

# API Configuration
VITE_API_BASE_URL=https://api.lugn-trygg.com

# Feature Flags
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_NOTIFICATIONS=true
```

### Backend (.env)

```env
# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=false

# Firebase Admin
FIREBASE_PROJECT_ID=lugn-trygg-53d75
FIREBASE_PRIVATE_KEY_ID=your_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Database
DATABASE_URL=postgresql://user:password@localhost/lugn_trygg

# Email Service
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@lugn-trygg.com

# JWT Secret
JWT_SECRET_KEY=your-super-secret-key-change-in-production

# Stripe (for future monetization)
STRIPE_SECRET_KEY=your_stripe_key

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
```

---

## CI/CD Pipeline Setup

### GitHub Actions

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Run tests
        run: cd frontend && npm test -- --coverage
      
      - name: TypeScript check
        run: cd frontend && npm run type-check
      
      - name: ESLint
        run: cd frontend && npm run lint || true
      
      - name: Build
        run: cd frontend && npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Build
        run: cd frontend && npm run build
      
      - name: Deploy to Firebase
        run: firebase deploy --only hosting
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

**Setup Firebase Token**:
```bash
# 1. Generate token locally
firebase login:ci

# 2. Add to GitHub Secrets
# Settings → Secrets → New repository secret
# Name: FIREBASE_TOKEN
# Value: (paste token from step 1)
```

---

## Staging Environment

### Pre-Production Testing

**Staging URL**: `https://staging.lugn-trygg.com`

**Setup**:
1. Create separate Firebase project for staging
2. Use staging database (separate from production)
3. Deploy same code, different env vars
4. Test all features end-to-end

**Deploy to Staging**:
```bash
# Use different Firebase project
firebase use staging-project-id
firebase deploy --only hosting

# Or tag in git
git tag v1.0.0-staging
git push origin v1.0.0-staging
```

**Staging Checklist**:
- [ ] All routes work
- [ ] Authentication flows
- [ ] Offline mode functionality
- [ ] Analytics events logged
- [ ] Notifications sending
- [ ] Database operations
- [ ] File uploads/downloads
- [ ] Third-party integrations
- [ ] Performance acceptable
- [ ] Mobile responsive

---

## Health Checks & Monitoring

### Backend Health Endpoint

```python
# main.py
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat(),
        'database': check_database_connection()
    }), 200
```

**Monitor**:
```bash
# Check health every 30 seconds
while true; do
  curl https://api.lugn-trygg.com/api/health
  sleep 30
done
```

### Frontend Monitoring

**Sentry Setup**:
```javascript
// main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 0.1,
  release: import.meta.env.VITE_APP_VERSION,
});
```

**Amplitude Setup**:
```javascript
// services/analytics.ts
if (import.meta.env.VITE_AMPLITUDE_API_KEY) {
  amplitude.init(
    import.meta.env.VITE_AMPLITUDE_API_KEY,
    undefined,
    { logLevel: 'WARN' }
  );
}
```

### Monitoring Dashboard

Set up monitoring for:
- [ ] Error rate (target: < 0.1%)
- [ ] Page load time (target: < 3s)
- [ ] API response time (target: < 500ms)
- [ ] Uptime (target: 99.9%)
- [ ] Database response time (target: < 100ms)

---

## Rollback Plan

### Quick Rollback Procedure

**If deployment fails**:

```bash
# 1. Firebase rollback (automatic with versions)
firebase hosting:versions:list
firebase hosting:clone-version 1234567890 production

# 2. Or GitHub Actions rollback
git revert <failed-commit>
git push origin main

# 3. Immediate fallback
# Deploy previous stable version from backup
```

**Backup Strategy**:
- [ ] Daily automated backups
- [ ] Version control all deployments
- [ ] Keep last 5 versions available
- [ ] Test rollback procedure monthly

---

## Performance Optimization

### Pre-Deployment Checks

```bash
# 1. Bundle analysis
npm run build -- --analyze

# 2. Lighthouse audit
lighthouse https://staging.lugn-trygg.com --view

# 3. Performance metrics
npm run metrics

# 4. Security check
npm audit

# 5. Load testing
# Use: Artillery, K6, or Apache JMeter
artillery quick -r 100 https://staging.lugn-trygg.com
```

### CDN Configuration

```json
{
  "caching": {
    "js-bundles": "31536000",  // 1 year (hashed filenames)
    "css-files": "31536000",
    "index.html": "3600",      // 1 hour (check updates)
    "api-calls": "0"           // No cache
  },
  "compression": {
    "enabled": true,
    "formats": ["gzip", "brotli"]
  }
}
```

---

## Post-Deployment Verification

### 24 Hours After Deployment

- [ ] Monitor error rates (Sentry dashboard)
- [ ] Check page load times (Lighthouse)
- [ ] Verify database performance (logs)
- [ ] Test key user flows
- [ ] Monitor server resources
- [ ] Check analytics data flow
- [ ] Verify notification delivery
- [ ] Test offline mode behavior
- [ ] Monitor user feedback
- [ ] Check uptime monitoring

---

## Rollout Strategy

### Phased Rollout (Recommended)

**Phase 1**: Early Adopters (10%)
- Duration: 1 day
- Monitoring: Intensive
- Rollback: Immediate if issues

**Phase 2**: Beta Users (50%)
- Duration: 3 days
- Monitoring: Normal
- Feedback collection

**Phase 3**: General Availability (100%)
- Full rollout
- Standard monitoring
- Support team on standby

---

## Troubleshooting Guide

### Issue: Build Fails

```bash
# 1. Clear cache
rm -rf node_modules dist
npm cache clean --force
npm install

# 2. Check Node version
node -v  # Should be 16+

# 3. Check environment variables
echo $VITE_FIREBASE_API_KEY

# 4. Build with verbose output
npm run build -- --verbose
```

### Issue: Deployment Fails

```bash
# Check deployment logs
firebase hosting:channel:list
firebase deploy --debug

# Check deployment status
gcloud app versions list  # for App Engine

# Verify target directory
ls -la dist/
```

### Issue: Runtime Errors

```bash
# Check Sentry dashboard
# https://sentry.io/organizations/your-org/issues/

# Check browser console errors
# F12 → Console tab

# Check network requests
# F12 → Network tab

# Check service worker
# chrome://serviceworker-internals/
```

---

## Post-Launch Support

### Week 1 (Critical)
- [ ] Monitor error rates hourly
- [ ] Quick response to user issues
- [ ] Bug fixes deployed immediately
- [ ] Team on call 24/7

### Week 2-4 (Standard)
- [ ] Regular monitoring (4x daily)
- [ ] Standard issue response time (4 hours)
- [ ] Schedule non-critical updates
- [ ] Gather user feedback

### Month 2+ (Maintenance)
- [ ] Weekly status reports
- [ ] Performance optimization
- [ ] Feature requests prioritization
- [ ] Plan FASE 2 updates

---

## Success Criteria

**Deployment Successful When**:
- [x] Code built successfully (1.19MB bundle)
- [x] All tests passing (9/9)
- [x] Accessibility audit complete (WCAG 2.1 AA)
- [ ] Staging deployment tested
- [ ] Production health checks passing
- [ ] Error rate < 0.1% first 24 hours
- [ ] Users can onboard successfully
- [ ] Notifications delivered reliably
- [ ] Offline mode functioning
- [ ] Analytics events logged
- [ ] No critical issues reported
- [ ] Team approval obtained

---

## Deployment Sign-Off

**Product Owner**: ___________________ Date: ___________

**Engineering Lead**: ___________________ Date: ___________

**QA Lead**: ___________________ Date: ___________

**Approved for Production**: ☐ Yes ☐ No ☐ Conditional

**Deployment Date**: ___________________

**Estimated Rollout Time**: 1-2 hours

**Rollback Plan**: Tested ☐ Yes ☐ No

**Notes**:
```
(Add any special deployment notes or warnings)



```

---

## Contact & Support

**During Deployment**:
- Slack: #lugn-trygg-deployment
- On-Call: +46-XXX-XXXXX
- Escalation: deployment@lugn-trygg.com

**Post-Deployment Support**:
- Email: support@lugn-trygg.com
- Community: [Discord/Slack channel]
- Bug Reports: GitHub Issues

---

## References

- Firebase Deployment: https://firebase.google.com/docs/hosting/quickstart
- Vercel Deployment: https://vercel.com/docs
- Docker on Cloud Run: https://cloud.google.com/run/docs
- GitHub Actions: https://github.com/features/actions
- Sentry Monitoring: https://docs.sentry.io/
- Amplitude Analytics: https://developers.amplitude.com/

