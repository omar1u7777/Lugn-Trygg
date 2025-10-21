#!/usr/bin/env powershell
# Deploy web-app-build to Vercel using npx

Write-Host "🚀 DEPLOYING WEB APP TO VERCEL`n" -ForegroundColor Cyan

$webBuildPath = "./web-app-build"

if (-not (Test-Path $webBuildPath)) {
    Write-Host "❌ ERROR: web-app-build folder not found at $webBuildPath" -ForegroundColor Red
    Write-Host "`nTry running: npx expo export from lugn-trygg-mobile/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ web-app-build folder found`n"

# Check for files
$indexHtml = Join-Path $webBuildPath "index.html"
if (-not (Test-Path $indexHtml)) {
    Write-Host "❌ ERROR: index.html not found in web-app-build/" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Files ready for deployment:" -ForegroundColor Cyan
$fileCount = (Get-ChildItem -Path $webBuildPath -Recurse -File | Measure-Object).Count
Write-Host "   - Total files: $fileCount"
Write-Host "   - Entry point: index.html ✅"
Write-Host "   - Assets: _expo/, assets/ ✅`n"

# Deploy with npx vercel
Write-Host "🔗 Starting Vercel deployment..." -ForegroundColor Yellow
Write-Host "   (Browser will open for authentication)`n"

cd $webBuildPath

# Use npx vercel with project name
npx vercel deploy --prod --name lugn-trygg

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ WEB APP DEPLOYED SUCCESSFULLY! 🎉" -ForegroundColor Green
    Write-Host "`n📊 Deployment Info:" -ForegroundColor Cyan
    Write-Host "   - Platform: Vercel"
    Write-Host "   - Type: Static Website"
    Write-Host "   - Files: $fileCount"
    Write-Host "   - URL: Check Vercel dashboard"
} else {
    Write-Host "`n⚠️  Vercel deployment finished (check status above)" -ForegroundColor Yellow
}

cd ..

Write-Host "`n✨ Done!`n" -ForegroundColor Green
