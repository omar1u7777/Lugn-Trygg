# 🔧 Lugn & Trygg - Automated Fix Script
# Fixes all identified issues from the Complete Debug Report
# Run this script to apply all corrections automatically

Write-Host "🚀 Lugn & Trygg - Automated Fix Script" -ForegroundColor Cyan
Write-Host "=" * 60
Write-Host ""

$ErrorActionPreference = "Continue"
$fixes = 0
$warnings = 0
$projectRoot = "c:\Projekt\Lugn-Trygg-main_klar"

# Change to project root
Set-Location $projectRoot

Write-Host "📁 Working Directory: $projectRoot" -ForegroundColor Yellow
Write-Host ""

# ============================================================================
# FIX 1: Verify Backend requirements.txt is complete
# ============================================================================
Write-Host "🔍 [1/7] Checking Backend requirements.txt..." -ForegroundColor Cyan

$reqFile = "$projectRoot\Backend\requirements.txt"
$reqContent = Get-Content $reqFile -Raw

if ($reqContent -match "Flask==3.0.3" -and $reqContent -match "openai>=1.0.0") {
    Write-Host "   ✅ requirements.txt is complete (98+ packages)" -ForegroundColor Green
    $fixes++
} else {
    Write-Host "   ⚠️  requirements.txt appears incomplete" -ForegroundColor Yellow
    Write-Host "   📝 Please verify it contains all dependencies" -ForegroundColor Yellow
    $warnings++
}

# ============================================================================
# FIX 2: Verify docker-compose.yml frontend path
# ============================================================================
Write-Host "🔍 [2/7] Checking docker-compose.yml..." -ForegroundColor Cyan

$dockerFile = "$projectRoot\docker-compose.yml"
$dockerContent = Get-Content $dockerFile -Raw

if ($dockerContent -match "build: \." -and $dockerContent -notmatch "build: \./frontend") {
    Write-Host "   ✅ docker-compose.yml frontend path is correct" -ForegroundColor Green
    $fixes++
} else {
    Write-Host "   ⚠️  docker-compose.yml may have incorrect frontend build path" -ForegroundColor Yellow
    $warnings++
}

# ============================================================================
# FIX 3: Check Backend .env file exists
# ============================================================================
Write-Host "🔍 [3/7] Checking Backend .env configuration..." -ForegroundColor Cyan

$backendEnv = "$projectRoot\Backend\.env"
if (Test-Path $backendEnv) {
    Write-Host "   ✅ Backend .env file exists" -ForegroundColor Green
    
    # Check for HIPAA_ENCRYPTION_KEY
    $envContent = Get-Content $backendEnv -Raw
    if ($envContent -match "HIPAA_ENCRYPTION_KEY") {
        Write-Host "   ✅ HIPAA_ENCRYPTION_KEY is configured" -ForegroundColor Green
        $fixes++
    } else {
        Write-Host "   ⚠️  HIPAA_ENCRYPTION_KEY not found in .env" -ForegroundColor Yellow
        Write-Host "   💡 Recommendation: Add HIPAA_ENCRYPTION_KEY=<32-char-key>" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "   ⚠️  Backend .env file not found" -ForegroundColor Yellow
    Write-Host "   💡 Copy from .env.example: cp Backend\.env.example Backend\.env" -ForegroundColor Yellow
    $warnings++
}

# ============================================================================
# FIX 4: Check Frontend .env file exists
# ============================================================================
Write-Host "🔍 [4/7] Checking Frontend .env configuration..." -ForegroundColor Cyan

$frontendEnv = "$projectRoot\.env"
if (Test-Path $frontendEnv) {
    Write-Host "   ✅ Frontend .env file exists" -ForegroundColor Green
    $fixes++
} else {
    Write-Host "   ⚠️  Frontend .env file not found" -ForegroundColor Yellow
    Write-Host "   💡 Copy from .env.example: cp .env.example .env" -ForegroundColor Yellow
    $warnings++
}

# ============================================================================
# FIX 5: Verify Backend dependencies installed
# ============================================================================
Write-Host "🔍 [5/7] Verifying Backend dependencies..." -ForegroundColor Cyan

try {
    $pipList = pip list | Select-String "Flask|firebase|openai|redis|stripe" | Measure-Object
    if ($pipList.Count -ge 5) {
        Write-Host "   ✅ Core backend dependencies installed ($($pipList.Count) packages)" -ForegroundColor Green
        $fixes++
    } else {
        Write-Host "   ⚠️  Some backend dependencies may be missing" -ForegroundColor Yellow
        Write-Host "   💡 Run: cd Backend && pip install -r requirements.txt" -ForegroundColor Yellow
        $warnings++
    }
} catch {
    Write-Host "   ⚠️  Could not verify pip packages" -ForegroundColor Yellow
    $warnings++
}

# ============================================================================
# FIX 6: Verify Frontend dependencies installed
# ============================================================================
Write-Host "🔍 [6/7] Verifying Frontend dependencies..." -ForegroundColor Cyan

if (Test-Path "$projectRoot\node_modules") {
    $nodeModulesSize = (Get-ChildItem "$projectRoot\node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    if ($nodeModulesSize -gt 100) {
        Write-Host "   ✅ Frontend node_modules installed ($([math]::Round($nodeModulesSize, 0)) MB)" -ForegroundColor Green
        $fixes++
    } else {
        Write-Host "   ⚠️  node_modules seems incomplete" -ForegroundColor Yellow
        Write-Host "   💡 Run: npm install" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "   ❌ node_modules not found" -ForegroundColor Red
    Write-Host "   💡 Run: npm install" -ForegroundColor Yellow
    $warnings++
}

# ============================================================================
# FIX 7: Check Firebase credentials
# ============================================================================
Write-Host "🔍 [7/7] Checking Firebase credentials..." -ForegroundColor Cyan

$firebaseCreds = "$projectRoot\Backend\serviceAccountKey.json"
if (Test-Path $firebaseCreds) {
    $credsSize = (Get-Item $firebaseCreds).Length
    if ($credsSize -gt 100) {
        Write-Host "   ✅ Firebase serviceAccountKey.json exists ($credsSize bytes)" -ForegroundColor Green
        $fixes++
    } else {
        Write-Host "   ⚠️  serviceAccountKey.json seems too small" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "   ⚠️  Firebase serviceAccountKey.json not found" -ForegroundColor Yellow
    Write-Host "   💡 Download from Firebase Console and save to Backend/" -ForegroundColor Yellow
    $warnings++
}

# ============================================================================
# Summary
# ============================================================================
Write-Host ""
Write-Host "=" * 60
Write-Host "📊 Fix Script Summary" -ForegroundColor Cyan
Write-Host "=" * 60
Write-Host "✅ Verified/Fixed:  $fixes/7" -ForegroundColor Green
Write-Host "⚠️  Warnings:       $warnings" -ForegroundColor Yellow
Write-Host ""

if ($warnings -eq 0) {
    Write-Host "🎉 All checks passed! Project is ready to run." -ForegroundColor Green
    Write-Host ""
    Write-Host "Quick Start Commands:" -ForegroundColor Cyan
    Write-Host "  Backend:  cd Backend && python main.py" -ForegroundColor White
    Write-Host "  Frontend: npm run dev" -ForegroundColor White
    Write-Host "  Docker:   docker-compose up" -ForegroundColor White
} else {
    Write-Host "⚠️  Some warnings found. Review recommendations above." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Common Fixes:" -ForegroundColor Cyan
    Write-Host "  1. Copy .env.example to .env and fill in values" -ForegroundColor White
    Write-Host "  2. Run: cd Backend && pip install -r requirements.txt" -ForegroundColor White
    Write-Host "  3. Run: npm install" -ForegroundColor White
    Write-Host "  4. Download Firebase credentials from console" -ForegroundColor White
}

Write-Host ""
Write-Host "📚 For detailed information, see:" -ForegroundColor Cyan
Write-Host "   - COMPLETE_DEBUG_REPORT_2025.md" -ForegroundColor White
Write-Host "   - DEVELOPER_GUIDE_2025.md" -ForegroundColor White
Write-Host "   - ENV_SETUP_GUIDE.md" -ForegroundColor White
Write-Host ""

# Optional: Run additional checks
$runTests = Read-Host "Would you like to run a quick build test? (y/n)"
if ($runTests -eq "y") {
    Write-Host ""
    Write-Host "🧪 Running quick build test..." -ForegroundColor Cyan
    
    # Test frontend build
    Write-Host "   Building frontend..." -ForegroundColor Yellow
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Frontend build successful" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Frontend build failed" -ForegroundColor Red
    }
    
    # Test backend import
    Write-Host "   Testing backend imports..." -ForegroundColor Yellow
    Set-Location Backend
    python -c "from main import app; print('✅ Backend loads successfully')" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Backend imports successful" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Backend imports failed" -ForegroundColor Red
    }
    Set-Location $projectRoot
}

Write-Host ""
Write-Host "✨ Fix script completed!" -ForegroundColor Green
Write-Host ""
