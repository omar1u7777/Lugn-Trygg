# 🧪 Automatisk Test-Runner för Lugn & Trygg
# Detta script startar backend och kör alla tester

param(
    [switch]$SkipBackendStart,
    [switch]$QuickTest
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   🧪 LUGN & TRYGG - TEST RUNNER" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Färgfunktioner
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Write-Step { param($msg) Write-Host "`n▶️  $msg" -ForegroundColor Yellow }

# Konfiguration
$backendPath = "C:\Projekt\Lugn-Trygg-main_klar\Backend"
$rootPath = "C:\Projekt\Lugn-Trygg-main_klar"
$backendUrl = "http://localhost:5001"
$backendStartTimeout = 15

# Steg 1: Kolla om backend redan körs
Write-Step "Kollar om backend redan körs..."
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/auth/register" -Method POST -ContentType "application/json" -Body '{}' -TimeoutSec 2 -ErrorAction SilentlyContinue
    $backendRunning = $true
} catch {
    if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 422) {
        $backendRunning = $true
    } else {
        $backendRunning = $false
    }
}

if ($backendRunning) {
    Write-Success "Backend körs redan på $backendUrl"
} else {
    Write-Info "Backend körs inte, startar nu..."
    
    if ($SkipBackendStart) {
        Write-Error "Backend körs inte och -SkipBackendStart är satt"
        Write-Info "Starta backend manuellt med: cd Backend ; python main.py"
        exit 1
    }
    
    # Steg 2: Starta backend i en ny PowerShell-process
    Write-Step "Startar backend i nytt fönster..."
    
    $backendScript = @"
`$Host.UI.RawUI.WindowTitle = 'Lugn & Trygg - Backend Server'
Write-Host '═══════════════════════════════════════════' -ForegroundColor Green
Write-Host '   🚀 BACKEND SERVER' -ForegroundColor Green
Write-Host '═══════════════════════════════════════════' -ForegroundColor Green
Write-Host ''
Write-Host '📍 URL: http://localhost:5001' -ForegroundColor Cyan
Write-Host '⚠️  Stäng INTE detta fönster under testerna!' -ForegroundColor Yellow
Write-Host ''

Set-Location '$backendPath'
`$env:FLASK_DEBUG = 'False'
python main.py

Write-Host ''
Write-Host '❌ Backend har stoppats' -ForegroundColor Red
Write-Host 'Tryck valfri tangent för att stänga...' -ForegroundColor Gray
`$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
"@
    
    # Starta backend i nytt PowerShell-fönster
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript
    
    Write-Info "Väntar på att backend ska starta..."
    
    # Vänta på backend
    $maxAttempts = $backendStartTimeout
    $attempt = 0
    $backendReady = $false
    
    while ($attempt -lt $maxAttempts -and -not $backendReady) {
        $attempt++
        Write-Host "." -NoNewline -ForegroundColor Gray
        Start-Sleep -Seconds 1
        
        try {
            $response = Invoke-WebRequest -Uri "$backendUrl/api/auth/register" -Method POST -ContentType "application/json" -Body '{}' -TimeoutSec 2 -ErrorAction SilentlyContinue
            $backendReady = $true
        } catch {
            if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 422) {
                $backendReady = $true
            }
        }
    }
    
    Write-Host ""
    
    if ($backendReady) {
        Write-Success "Backend är redo efter $attempt sekunder!"
    } else {
        Write-Error "Backend svarar inte efter $maxAttempts sekunder"
        Write-Warning "Starta backend manuellt och kör sedan testerna igen"
        exit 1
    }
}

# Steg 3: Kör testerna
Write-Step "Kör tester..."
Write-Host ""

if ($QuickTest) {
    Write-Info "Kör snabbtest (debug-mood-save.ps1)..."
    & "$rootPath\debug-mood-save.ps1"
} else {
    Write-Info "Kör fullständig testsvit (test-mood-system.ps1)..."
    & "$rootPath\test-mood-system.ps1"
}

$testExitCode = $LASTEXITCODE

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

if ($testExitCode -eq 0) {
    Write-Success "ALLA TESTER LYCKADES! 🎉"
} else {
    Write-Error "VISSA TESTER MISSLYCKADES"
    Write-Info "Exitkod: $testExitCode"
}

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Fråga om backend ska stoppas
if (-not $SkipBackendStart -and -not $backendRunning) {
    Write-Host "Backend körs fortfarande i separat fönster" -ForegroundColor Yellow
    Write-Host "Stäng backend-fönstret när du är klar" -ForegroundColor Gray
}

exit $testExitCode
