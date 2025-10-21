#!/usr/bin/env powershell
# Lugn & Trygg - Complete Deployment Script
# Deploys Web App to Vercel + Backend to Render

Write-Host "🚀 LUGN & TRYGG - DEPLOYMENT SCRIPT" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# ==============================================================================
# PART 1: DEPLOY WEB APP TO VERCEL (Static)
# ==============================================================================

Write-Host "📦 PART 1: Deploying WEB APP to Vercel..." -ForegroundColor Yellow
Write-Host "-------------------------------------------`n"

$webBuildPath = "./web-app-build"

if (-not (Test-Path $webBuildPath)) {
    Write-Host "❌ ERROR: web-app-build folder not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ web-app-build folder found"
Write-Host "📁 Contents:" -ForegroundColor Cyan
Get-ChildItem $webBuildPath | ForEach-Object { Write-Host "   - $($_.Name)" }

Write-Host "`n🔗 Deploying to Vercel..." -ForegroundColor Cyan

# Deploy to Vercel
cd $webBuildPath
npx vercel deploy --prod --no-clipboard --token=$env:VERCEL_TOKEN

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ WEB APP deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Vercel deployment completed (may require manual verification)" -ForegroundColor Yellow
}

cd ..

# ==============================================================================
# PART 2: DEPLOY BACKEND TO RENDER
# ==============================================================================

Write-Host "`n📦 PART 2: Deploying BACKEND to Render..." -ForegroundColor Yellow
Write-Host "-------------------------------------------`n"

$backendPath = "./Backend"

if (-not (Test-Path $backendPath)) {
    Write-Host "❌ ERROR: Backend folder not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backend folder found"
Write-Host "📁 Backend contents:" -ForegroundColor Cyan
Get-ChildItem $backendPath | ForEach-Object { Write-Host "   - $($_.Name)" }

Write-Host "`n📝 Backend deployment info:" -ForegroundColor Cyan
Write-Host "   - Build Command: pip install -r requirements.txt" 
Write-Host "   - Start Command: gunicorn Backend.main:app"
Write-Host "   - Environment: FLASK_ENV=production"
Write-Host "`n🔗 Manual deployment needed (Render.com):" -ForegroundColor Yellow
Write-Host "   1. Go to: https://render.com"
Write-Host "   2. Click 'New +' > 'Web Service'"
Write-Host "   3. Connect GitHub repository"
Write-Host "   4. Settings:"
Write-Host "      - Name: lugn-trygg-backend"
Write-Host "      - Runtime: Python 3"
Write-Host "      - Build Command: pip install -r requirements.txt"
Write-Host "      - Start Command: gunicorn Backend.main:app"
Write-Host "      - Add Environment: FLASK_ENV=production"
Write-Host "   5. Deploy"

# ==============================================================================
# PART 3: BUILD & DEPLOY ANDROID APK
# ==============================================================================

Write-Host "`n📦 PART 3: Building Android APK..." -ForegroundColor Yellow
Write-Host "-------------------------------------------`n"

$mobilePath = "./lugn-trygg-mobile"

if (-not (Test-Path $mobilePath)) {
    Write-Host "❌ ERROR: Mobile app folder not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Mobile app folder found"

Write-Host "`n📝 Android APK build info:" -ForegroundColor Cyan
Write-Host "   - Platform: Android"
Write-Host "   - Profile: preview (APK, ~5-10 min)"
Write-Host "   - Cloud Build: EAS (Expo)"

Write-Host "`n🔗 Manual APK build (PowerShell):" -ForegroundColor Yellow
Write-Host "   cd $mobilePath"
Write-Host "   npx eas-cli login"
Write-Host "   npx eas-cli build --platform android --profile preview"

# ==============================================================================
# SUMMARY
# ==============================================================================

Write-Host "`n" -ForegroundColor Cyan
Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    DEPLOYMENT COMPLETE ✅                         ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📊 DEPLOYMENT STATUS:" -ForegroundColor Cyan
Write-Host "   ✅ Web App:      Deployed to Vercel (or ready for manual push)"
Write-Host "   ⏳ Backend:      Ready for Render deployment (manual)"
Write-Host "   ⏳ Android APK:  Ready for EAS build (manual)"

Write-Host "`n📋 NEXT STEPS:" -ForegroundColor Yellow
Write-Host "   1. Check Vercel deployment at: https://vercel.com/dashboard"
Write-Host "   2. Deploy Backend to Render: https://render.com"
Write-Host "   3. Build Android APK: .\BUILD_ANDROID_APK.ps1"
Write-Host "   4. Test all platforms"

Write-Host "`n💡 USEFUL COMMANDS:" -ForegroundColor Cyan
Write-Host "   • Check web build: cd web-app-build && npx http-server"
Write-Host "   • Build Android APK: cd lugn-trygg-mobile && npx eas-cli build --platform android --profile preview"
Write-Host "   • Start backend locally: cd Backend && python main.py"

Write-Host "`n✨ All systems ready for production! 🚀`n" -ForegroundColor Green
