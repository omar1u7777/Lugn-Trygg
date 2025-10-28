# PowerShell script för att verifiera Vercel env vars
# Kör detta efter att du lagt till alla env vars i Vercel

Write-Host "🔍 Kontrollerar Vercel Environment Variables..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Yellow

# Lista alla kritiska env vars som måste vara satta
$criticalVars = @(
    "VITE_BACKEND_URL",
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_ENCRYPTION_KEY"
)

$optionalVars = @(
    "VITE_AMPLITUDE_API_KEY",
    "VITE_SENTRY_DSN",
    "VITE_CLOUDINARY_CLOUD_NAME",
    "VITE_ENABLE_PERFORMANCE_MONITORING"
)

Write-Host "`n🔥 KRITISKA VARIABLER (Obligatoriska):" -ForegroundColor Red
foreach ($var in $criticalVars) {
    $envValue = [Environment]::GetEnvironmentVariable($var)
    if ($envValue) {
        Write-Host "✅ $var = $envValue" -ForegroundColor Green
    } else {
        Write-Host "❌ $var = INTE SATT!" -ForegroundColor Red
    }
}

Write-Host "`n📊 VALFRIA VARIABLER (Rekommenderade):" -ForegroundColor Yellow
foreach ($var in $optionalVars) {
    $envValue = [Environment]::GetEnvironmentVariable($var)
    if ($envValue) {
        Write-Host "✅ $var = $envValue" -ForegroundColor Green
    } else {
        Write-Host "⚠️  $var = INTE SATT (valfritt)" -ForegroundColor Gray
    }
}

Write-Host "`n==================================================" -ForegroundColor Yellow
Write-Host "📋 Kom ihåg att sätta dessa i Vercel Dashboard!" -ForegroundColor Cyan
Write-Host "🔗 https://vercel.com/dashboard" -ForegroundColor Blue