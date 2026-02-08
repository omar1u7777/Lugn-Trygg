# 🚀 PRODUCTION DEPLOYMENT SCRIPT - Lugn & Trygg Backend (Windows PowerShell)
# Run this script to deploy backend for 1000 users on Windows

Write-Host "🚀 Starting Lugn & Trygg Backend Production Deployment..." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan

# Check if running in Backend directory
if (-not (Test-Path "main.py")) {
    Write-Host "❌ Error: Must run from Backend directory!" -ForegroundColor Red
    exit 1
}

# 1. Load production environment
Write-Host "📝 Loading production environment..." -ForegroundColor Yellow
if (Test-Path ".env.production") {
    Get-Content ".env.production" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
    Write-Host "✅ Production environment loaded" -ForegroundColor Green
} else {
    Write-Host "⚠️  Warning: .env.production not found, using .env" -ForegroundColor Yellow
}

# 2. Install dependencies
Write-Host "📦 Installing Python dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt --no-cache-dir
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# 3. Verify critical packages
Write-Host "🔍 Verifying critical packages..." -ForegroundColor Yellow
python -c "import flask; import firebase_admin; import pandas; print('✅ All critical packages available')"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Critical packages missing!" -ForegroundColor Red
    exit 1
}

# 4. Check Firebase credentials
Write-Host "🔥 Checking Firebase credentials..." -ForegroundColor Yellow
if (-not (Test-Path "serviceAccountKey.json")) {
    Write-Host "❌ Error: serviceAccountKey.json not found!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Firebase credentials found" -ForegroundColor Green

# 5. Create logs directory
Write-Host "📁 Creating logs directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
Write-Host "✅ Logs directory ready" -ForegroundColor Green

# 6. Start Gunicorn with production config
Write-Host "🌟 Starting Gunicorn production server..." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Workers: CPU * 2 + 1 (auto-detected)" -ForegroundColor Cyan
$port = if ($env:PORT -ne $null -and $env:PORT -ne '') { $env:PORT } else { '5001' }
Write-Host "Port: $port" -ForegroundColor Cyan
Write-Host "Environment: production" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if Gunicorn is installed
try {
    gunicorn --version | Out-Null
} catch {
    Write-Host "❌ Gunicorn not found! Installing..." -ForegroundColor Yellow
    pip install gunicorn
}

# Start Gunicorn
Write-Host ""
Write-Host "🚀 Starting server..." -ForegroundColor Green
gunicorn -c gunicorn_config.py main:app

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Gunicorn failed to start!" -ForegroundColor Red
    Write-Host "Check logs for details" -ForegroundColor Yellow
    exit 1
}
