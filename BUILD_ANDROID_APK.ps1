# =====================================================
# LUGN & TRYGG - Android APK Build Script
# =====================================================
# This script builds the Android APK using EAS Cloud Build
# 
# Prerequisites:
# - Node.js + npm installed
# - eas-cli installed
# - EAS account credentials
#
# Usage: .\BUILD_ANDROID_APK.ps1
# =====================================================

Write-Host "🚀 LUGN & TRYGG - Android APK Build Starting..." -ForegroundColor Cyan

# Configuration
$PROJECT_ROOT = "c:\Projekt\Lugn-Trygg-main_klar"
$MOBILE_DIR = "$PROJECT_ROOT\lugn-trygg-mobile"
$EAS_EMAIL = "omaralhaek97@gmail.com"
$EAS_PASSWORD = "Rudeyna.86123456"
$BUILD_PROFILE = "preview"  # preview builds APK quickly; production builds AAB for Play Store

# Step 1: Navigate to mobile project
Write-Host "📁 Navigating to mobile project..." -ForegroundColor Yellow
Set-Location $MOBILE_DIR
Write-Host "✅ Current dir: $(Get-Location)"

# Step 2: Check if eas-cli is installed
Write-Host "🔍 Checking eas-cli..." -ForegroundColor Yellow
$eas_version = npx eas-cli --version 2>&1
Write-Host "✅ eas-cli: $eas_version"

# Step 3: Authenticate with EAS (using environment variables or credential file)
Write-Host "🔐 Authenticating with EAS..." -ForegroundColor Yellow
# Try to authenticate - if already logged in, skip; if not, it will prompt
$whoami = npx eas-cli whoami 2>&1
if ($whoami -like "*Not logged in*") {
    Write-Host "⚠️  Not logged in. Attempting interactive login..." -ForegroundColor Magenta
    Write-Host "Please enter EAS credentials when prompted:"
    Write-Host "  Email: $EAS_EMAIL"
    Write-Host "  Password: (hidden)"
    # Run interactive login - user will input manually
    npx eas-cli login
} else {
    Write-Host "✅ Already logged in as: $whoami"
}

# Step 4: Verify eas.json exists
Write-Host "📋 Checking eas.json..." -ForegroundColor Yellow
if (-Not (Test-Path "eas.json")) {
    Write-Host "❌ eas.json not found!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ eas.json found"

# Step 5: Start EAS build for Android
Write-Host "🏗️  Starting EAS Cloud Build for Android ($BUILD_PROFILE profile)..." -ForegroundColor Cyan
Write-Host "This may take 5-15 minutes. You will receive a build link and status updates."

npx eas-cli build --platform android --profile $BUILD_PROFILE

# Step 6: Check if build succeeded
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ EAS build command completed successfully!" -ForegroundColor Green
    Write-Host "📲 Your APK/AAB will be ready shortly."
    Write-Host "Check your EAS dashboard for build status and download link."
} else {
    Write-Host "❌ EAS build failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Build script completed!" -ForegroundColor Green
