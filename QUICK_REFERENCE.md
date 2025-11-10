# ⚡ Quick Reference - Launch Commands

## 🚀 CRITICAL ACTIONS (Run These First)

### 1. Deploy Secrets (5 minutes)
```bash
# Backend directory
cd Backend

# Copy production environment
cp .env.production .env

# Delete sensitive backup
rm -rf secrets_backup/

# Verify secrets loaded
grep "JWT_SECRET_KEY" .env | head -c 50
```

### 2. Run Pre-Launch Check (2 minutes)
```bash
cd Backend
python pre_launch_check.py

# Should show 8/8 checks passed
# If not, follow the error messages
```

### 3. Run Load Test (15 minutes)
```bash
cd Backend
python run_load_test.py

# Select option 3: Full Test (1000 users)
# Wait for completion (~10 minutes)
# Verify results:
#   - Error rate < 1%
#   - p95 response time < 500ms
#   - Throughput > 200 req/sec
```

### 4. Setup SSL (30 minutes - Linux only)
```bash
# On production server (Linux)
sudo ./setup-ssl.sh

# Enter your domain: yourdomain.com
# Enter your email: admin@yourdomain.com

# Verify HTTPS working
curl https://yourdomain.com/api/health

# Check SSL rating (should be A+)
# https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

### 5. Configure Sentry (10 minutes)
```bash
# 1. Create account: https://sentry.io (free tier OK)
# 2. Create new project (Flask)
# 3. Copy DSN key
# 4. Add to .env:
echo "SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx" >> Backend/.env

# 5. Restart backend
cd Backend
python main.py

# 6. Test error tracking
curl http://localhost:5001/api/test-error  # Should appear in Sentry
```

---

## 📊 Monitoring Commands

### Check Backend Health
```bash
curl http://localhost:5001/api/health
# Should return: {"status": "healthy"}

curl http://localhost:5001/api/health/ready
# Should return: {"status": "ready", "firebase": "connected"}

curl http://localhost:5001/api/metrics
# Shows CPU, memory, requests
```

### Check Frontend
```bash
# Verify build exists
ls -lh dist/index.html

# Check bundle size
du -sh dist/assets/*.js

# Test locally
npm run preview
# Open: http://localhost:4173
```

### Monitor Logs
```bash
# Backend logs
tail -f Backend/app.log

# Nginx logs (if deployed)
tail -f /var/log/nginx/lugn-trygg-access.log
tail -f /var/log/nginx/lugn-trygg-error.log

# Docker logs
docker-compose -f docker-compose.production.yml logs -f
```

---

## 🔧 Deployment Commands

### Option 1: Docker (Recommended)
```bash
# Build and start all services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f backend

# Restart services
docker-compose -f docker-compose.production.yml restart

# Stop all
docker-compose -f docker-compose.production.yml down
```

### Option 2: Manual Deployment

#### Backend
```bash
cd Backend

# Linux/Mac
chmod +x deploy-production.sh
./deploy-production.sh

# Windows
.\deploy-production.ps1
```

#### Frontend
```bash
# Build
npm run build

# Test build
npm run preview

# Deploy to server
rsync -avz dist/ user@server:/var/www/lugn-trygg/

# Or with Vercel
vercel --prod
```

### Option 3: Cloud Platforms

#### Vercel (Frontend)
```bash
npm install -g vercel
vercel login
vercel --prod

# Configure:
# - Build Command: npm run build
# - Output Directory: dist
# - Environment Variables: Add from .env.example
```

#### Render (Backend)
```bash
# 1. Push to GitHub
git push origin main

# 2. Go to: https://render.com
# 3. New Web Service
# 4. Connect repository
# 5. Configure:
#    - Build Command: pip install -r requirements.txt
#    - Start Command: gunicorn -c gunicorn_config.py main:app
#    - Environment Variables: Add from .env.production
```

---

## 💾 Backup Commands

### Create Backup
```bash
cd Backend

# Backup all collections
python backup_firestore.py

# Backup specific collection
python backup_firestore.py --collection users

# Verify backup created
ls -lh backups/
```

### Restore Backup
```bash
cd Backend

# Restore all collections
for file in backups/*.json; do
    collection=$(basename "$file" | cut -d'_' -f1)
    python backup_firestore.py --restore "$file" --restore-collection "$collection"
done

# Restore specific collection
python backup_firestore.py --restore backups/users_20251110.json --restore-collection users
```

### Schedule Automated Backups

#### Linux (cron)
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/Backend && python backup_firestore.py >> /var/log/backup.log 2>&1
```

#### Windows (Task Scheduler)
```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "python" -Argument "backup_firestore.py" -WorkingDirectory "C:\path\to\Backend"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "LugnTryggBackup" -Action $action -Trigger $trigger
```

---

## 🧪 Testing Commands

### Run All Tests
```bash
# Backend tests
cd Backend
pytest tests/ -v

# Frontend tests
npm test

# E2E tests
npm run test:e2e
```

### Security Audit
```bash
# Frontend
npm audit --audit-level=moderate

# Backend
pip install pip-audit
pip-audit

# Check for outdated packages
npm outdated
pip list --outdated
```

### Performance Testing
```bash
# Lighthouse (Frontend)
npm install -g lighthouse
lighthouse http://localhost:3000 --view

# Load test (Backend)
cd Backend
locust -f load_test.py --host=http://localhost:5001 --users 1000 --spawn-rate 100

# Or interactive
python run_load_test.py
```

---

## 🔒 Security Commands

### Generate New Secrets
```bash
cd Backend
python generate_secrets.py

# Follow prompts
# Copy secrets to password manager
# Delete secrets_backup/ when done
```

### Check for Exposed Secrets
```bash
# Search for potential secrets in code
grep -r "api_key" src/
grep -r "secret" src/
grep -r "password" src/

# Check what's committed
git log --all --full-history --source -- "**/.env"

# Should return empty!
```

### Update Dependencies
```bash
# Frontend
npm update
npm audit fix

# Backend
pip install --upgrade -r requirements.txt
pip-audit --fix
```

---

## 📱 Mobile/PWA Commands

### Test PWA
```bash
# Check if service worker registered
# Open DevTools > Application > Service Workers

# Test offline mode
# DevTools > Network > Offline checkbox

# Test installation
# Chrome: Address bar "Install" button
# Mobile: "Add to Home Screen"
```

### Generate PWA Assets
```bash
# Install PWA asset generator
npm install -g pwa-asset-generator

# Generate icons
pwa-asset-generator public/logo.svg public/icons \
  --background "#1976d2" \
  --manifest public/manifest.json
```

---

## 🚨 Emergency Commands

### Rollback Deployment
```bash
# Docker
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d --force-recreate

# Git
git log --oneline  # Find previous version
git checkout <previous-commit>
npm run build
./Backend/deploy-production.sh
```

### Check System Resources
```bash
# CPU usage
top -n 1

# Memory usage
free -h

# Disk usage
df -h

# Process info
ps aux | grep python
ps aux | grep node

# Kill stuck process
pkill -f gunicorn
pkill -f python
```

### Database Issues
```bash
# Check Firebase connection
cd Backend
python -c "from firebase_admin import db; import firebase_admin; firebase_admin.initialize_app(); print('Connected')"

# Restore from backup
python backup_firestore.py --restore backups/latest.json --restore-collection users
```

---

## 📊 Useful Queries

### Check API Performance
```bash
# Response time distribution
curl -w "@-" -o /dev/null -s http://localhost:5001/api/health <<'EOF'
\ntime_total: %{time_total}s
EOF

# Test multiple endpoints
for endpoint in health ready live metrics; do
  echo "Testing /api/$endpoint"
  curl -w "  Time: %{time_total}s\n" -o /dev/null -s http://localhost:5001/api/$endpoint
done
```

### Monitor Active Users
```bash
# Check concurrent connections (if using Gunicorn)
ps aux | grep gunicorn | wc -l

# Check request rate
tail -f /var/log/nginx/access.log | pv -l -i 10 -r > /dev/null
```

---

## 🎯 Launch Day Commands

### T-minus 1 hour
```bash
# 1. Final health check
python Backend/pre_launch_check.py

# 2. Verify monitoring
curl https://sentry.io/api/0/projects/  # Check Sentry accessible

# 3. Clear logs
> Backend/app.log
> /var/log/nginx/error.log
```

### At Launch
```bash
# 1. Monitor error rate
watch -n 5 'tail -20 Backend/app.log | grep ERROR | wc -l'

# 2. Monitor response times
watch -n 5 'curl -w "%{time_total}\n" -o /dev/null -s http://localhost:5001/api/health'

# 3. Monitor system resources
watch -n 5 'free -h; echo ""; ps aux | grep python | awk "{print \$3,\$4,\$11}"'
```

### T-plus 1 hour
```bash
# 1. Generate load test report
cd Backend
python run_load_test.py

# 2. Check Sentry dashboard
# https://sentry.io/organizations/your-org/projects/

# 3. Verify backup completed
ls -lh backups/ | tail -1
```

---

## 📞 Quick Help

### Common Issues

**Backend won't start**
```bash
# Check port in use
lsof -i :5001
# Kill process: kill -9 <PID>

# Check Python environment
which python
python --version

# Reinstall dependencies
pip install -r requirements.txt
```

**Frontend build fails**
```bash
# Clear cache
rm -rf node_modules dist
npm install
npm run build
```

**SSL not working**
```bash
# Check certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Renew certificate
sudo certbot renew --force-renewal

# Reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

**Database connection fails**
```bash
# Check Firebase credentials
cat Backend/serviceAccountKey.json | jq .project_id

# Verify environment
grep FIREBASE_PROJECT_ID Backend/.env

# Test connection
cd Backend
python -c "import firebase_admin; firebase_admin.initialize_app(); print('OK')"
```

---

## 📚 Documentation Links

- **Full Checklist**: `PRODUCTION_LAUNCH_CHECKLIST.md`
- **Setup Guide**: `QUICK_START_PRODUCTION.md`
- **Summary**: `PRODUCTION_READINESS_SUMMARY.md`
- **API Docs**: http://localhost:5001/api/docs (when backend running)

---

**Last Updated**: November 10, 2025  
**For**: Lugn & Trygg Production Launch  
**Contact**: Development Team
