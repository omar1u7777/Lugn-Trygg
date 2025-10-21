# ================================================================
# SYNC FRONTEND TO WEB-APP
# Kopierar allt innehåll från frontend till web-app
# ================================================================

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   SYNKRONISERAR FRONTEND → WEB-APP" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Paths
$frontendPath = "c:\Projekt\Lugn-Trygg-main_klar\frontend"
$webAppPath = "c:\Projekt\Lugn-Trygg-main_klar\web-app"
$backupPath = "c:\Projekt\Lugn-Trygg-main_klar\web-app-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Kontrollera att frontend finns
if (-not (Test-Path $frontendPath)) {
    Write-Host "❌FEL: Frontend mappen finns inte!" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Källmapp: $frontendPath" -ForegroundColor Green
Write-Host "📁 Målmapp: $webAppPath" -ForegroundColor Green
Write-Host ""

# Backup av nuvarande web-app
Write-Host "💾 Skapar backup av nuvarande web-app..." -ForegroundColor Yellow
if (Test-Path $webAppPath) {
    Copy-Item -Path $webAppPath -Destination $backupPath -Recurse -Force
    Write-Host "✅ Backup skapad: $backupPath" -ForegroundColor Green
}
Write-Host ""

# Ta bort nuvarande web-app innehåll (behåll .git om den finns)
Write-Host "🗑️  Rensar web-app mappen..." -ForegroundColor Yellow
if (Test-Path $webAppPath) {
    # Ta bort allt utom .git
    Get-ChildItem -Path $webAppPath -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
    Write-Host "✅ Web-app mappen rensad" -ForegroundColor Green
} else {
    New-Item -Path $webAppPath -ItemType Directory -Force | Out-Null
    Write-Host "✅ Web-app mappen skapad" -ForegroundColor Green
}
Write-Host ""

# Kopiera allt från frontend till web-app
Write-Host "📋 Kopierar filer från frontend..." -ForegroundColor Yellow
Write-Host ""

$itemsToCopy = Get-ChildItem -Path $frontendPath -Force | Where-Object { $_.Name -ne '.git' }
$totalItems = $itemsToCopy.Count
$currentItem = 0

foreach ($item in $itemsToCopy) {
    $currentItem++
    $percentComplete = [math]::Round(($currentItem / $totalItems) * 100)
    
    Write-Progress -Activity "Kopierar filer" -Status "$percentComplete% Complete" -PercentComplete $percentComplete
    
    $destination = Join-Path $webAppPath $item.Name
    
    if ($item.PSIsContainer) {
        Copy-Item -Path $item.FullName -Destination $destination -Recurse -Force
        Write-Host "  📁 $($item.Name)/" -ForegroundColor Cyan
    } else {
        Copy-Item -Path $item.FullName -Destination $destination -Force
        Write-Host "  📄 $($item.Name)" -ForegroundColor Gray
    }
}

Write-Progress -Activity "Kopierar filer" -Completed
Write-Host ""
Write-Host "✅ Alla filer kopierade!" -ForegroundColor Green
Write-Host ""

# Visa sammanfattning
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   SAMMANFATTNING" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$frontendFiles = (Get-ChildItem -Path $frontendPath -Recurse -File | Measure-Object).Count
$webAppFiles = (Get-ChildItem -Path $webAppPath -Recurse -File | Measure-Object).Count

Write-Host "📊 Frontend filer: $frontendFiles" -ForegroundColor White
Write-Host "📊 Web-app filer: $webAppFiles" -ForegroundColor White
Write-Host ""

Write-Host "✅ KLART!" -ForegroundColor Green
Write-Host ""
Write-Host "Nästa steg:" -ForegroundColor Yellow
Write-Host "  1. cd web-app" -ForegroundColor White
Write-Host "  2. npm install" -ForegroundColor White
Write-Host "  3. npm run build" -ForegroundColor White
Write-Host "  4. vercel --prod" -ForegroundColor White
Write-Host ""
Write-Host "Backup finns i: $backupPath" -ForegroundColor Cyan
Write-Host ""
