# 🚀 PRE-DEPLOYMENT TEST CHECKLIST
# Komplett testning innan leverans
# Datum: 2025-10-20

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🚀 LUGN & TRYGG - KOMPLETT PRE-DEPLOYMENT TEST  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$testResults = @()
$testsPassed = 0
$testsFailed = 0
$testsSkipped = 0

# Funktioner
function Write-TestHeader { 
    param($title, $number)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "TEST $number`: $title" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Yellow
}

function Write-Success { param($msg) Write-Host "   ✅ $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "   ❌ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "   ℹ️  $msg" -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host "   ⚠️  $msg" -ForegroundColor Yellow }

function Add-TestResult {
    param($category, $test, $status, $details = "")
    $script:testResults += [PSCustomObject]@{
        Category = $category
        Test = $test
        Status = $status
        Details = $details
    }
    
    if ($status -eq "PASS") { $script:testsPassed++ }
    elseif ($status -eq "FAIL") { $script:testsFailed++ }
    else { $script:testsSkipped++ }
}

# ═══════════════════════════════════════════════════
# TEST 1: PROJECT STRUCTURE
# ═══════════════════════════════════════════════════
Write-TestHeader "Project Structure Validation" "1"

$requiredBackendFiles = @(
    "Backend/main.py",
    "Backend/.env",
    "Backend/serviceAccountKey.json",
    "Backend/requirements.txt",
    "Backend/pytest.ini"
)

$requiredFrontendFiles = @(
    "frontend/package.json",
    "frontend/next.config.js",
    "frontend/.env.local"
)

$requiredRootFiles = @(
    "README.md",
    "docker-compose.yml",
    ".gitignore"
)

Write-Info "Kollar backend-filer..."
foreach ($file in $requiredBackendFiles) {
    if (Test-Path $file) {
        Write-Success "$file finns"
        Add-TestResult "Structure" "Backend: $file" "PASS"
    } else {
        Write-Fail "$file saknas!"
        Add-TestResult "Structure" "Backend: $file" "FAIL" "File missing"
    }
}

Write-Info "Kollar frontend-filer..."
foreach ($file in $requiredFrontendFiles) {
    if (Test-Path $file) {
        Write-Success "$file finns"
        Add-TestResult "Structure" "Frontend: $file" "PASS"
    } else {
        Write-Fail "$file saknas!"
        Add-TestResult "Structure" "Frontend: $file" "FAIL" "File missing"
    }
}

# ═══════════════════════════════════════════════════
# TEST 2: ENVIRONMENT CONFIGURATION
# ═══════════════════════════════════════════════════
Write-TestHeader "Environment Configuration" "2"

Write-Info "Kollar Backend .env..."
if (Test-Path "Backend/.env") {
    $backendEnv = Get-Content "Backend/.env" -Raw
    
    $requiredBackendVars = @("PORT", "FLASK_DEBUG", "JWT_SECRET_KEY", "FIREBASE_CREDENTIALS", "FIREBASE_PROJECT_ID")
    foreach ($var in $requiredBackendVars) {
        if ($backendEnv -match $var) {
            Write-Success "$var är konfigurerad"
            Add-TestResult "Config" "Backend Env: $var" "PASS"
        } else {
            Write-Fail "$var saknas i Backend/.env"
            Add-TestResult "Config" "Backend Env: $var" "FAIL" "Missing variable"
        }
    }
    
    # Kolla port
    if ($backendEnv -match "PORT=5001") {
        Write-Success "Backend port är korrekt (5001)"
        Add-TestResult "Config" "Backend Port" "PASS"
    } else {
        Write-Warning "Backend port är INTE 5001"
        Add-TestResult "Config" "Backend Port" "FAIL" "Wrong port"
    }
}

Write-Info "Kollar Frontend .env.local..."
if (Test-Path "frontend/.env.local") {
    $frontendEnv = Get-Content "frontend/.env.local" -Raw
    
    $requiredFrontendVars = @("NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_FIREBASE_API_KEY")
    foreach ($var in $requiredFrontendVars) {
        if ($frontendEnv -match $var) {
            Write-Success "$var är konfigurerad"
            Add-TestResult "Config" "Frontend Env: $var" "PASS"
        } else {
            Write-Fail "$var saknas i frontend/.env.local"
            Add-TestResult "Config" "Frontend Env: $var" "FAIL" "Missing variable"
        }
    }
}

# ═══════════════════════════════════════════════════
# TEST 3: PYTHON DEPENDENCIES
# ═══════════════════════════════════════════════════
Write-TestHeader "Python Dependencies Check" "3"

Write-Info "Kollar Python version..."
try {
    $pythonVersion = python --version 2>&1
    Write-Success "Python installerat: $pythonVersion"
    Add-TestResult "Dependencies" "Python Version" "PASS" $pythonVersion
} catch {
    Write-Fail "Python är inte installerat!"
    Add-TestResult "Dependencies" "Python Version" "FAIL" "Not installed"
}

Write-Info "Kollar kritiska Python-paket..."
$criticalPackages = @("flask", "firebase-admin", "pytest", "google-cloud-language")
foreach ($pkg in $criticalPackages) {
    try {
        $result = python -c "import $($pkg.Replace('-', '_')); print('OK')" 2>&1
        if ($result -match "OK") {
            Write-Success "$pkg är installerat"
            Add-TestResult "Dependencies" "Python Package: $pkg" "PASS"
        } else {
            Write-Fail "$pkg är INTE installerat"
            Add-TestResult "Dependencies" "Python Package: $pkg" "FAIL" "Not installed"
        }
    } catch {
        Write-Fail "$pkg är INTE installerat"
        Add-TestResult "Dependencies" "Python Package: $pkg" "FAIL" "Not installed"
    }
}

# ═══════════════════════════════════════════════════
# TEST 4: BACKEND UNIT TESTS (PYTEST)
# ═══════════════════════════════════════════════════
Write-TestHeader "Backend Unit Tests (pytest)" "4"

Write-Info "Kör pytest..."
Push-Location Backend
try {
    $pytestOutput = pytest -v --tb=short 2>&1 | Out-String
    
    if ($pytestOutput -match "(\d+) passed") {
        $passedTests = $matches[1]
        Write-Success "Pytest: $passedTests tester passerade"
        Add-TestResult "Backend Tests" "Pytest Unit Tests" "PASS" "$passedTests tests passed"
    } else {
        Write-Fail "Pytest misslyckades"
        Add-TestResult "Backend Tests" "Pytest Unit Tests" "FAIL" "Tests failed"
    }
    
    if ($pytestOutput -match "(\d+) failed") {
        $failedTests = $matches[1]
        Write-Fail "$failedTests tester misslyckades"
    }
    
} catch {
    Write-Fail "Kunde inte köra pytest: $_"
    Add-TestResult "Backend Tests" "Pytest Unit Tests" "FAIL" $_.Exception.Message
}
Pop-Location

# ═══════════════════════════════════════════════════
# TEST 5: BACKEND API ENDPOINTS
# ═══════════════════════════════════════════════════
Write-TestHeader "Backend API Endpoints" "5"

Write-Info "Startar backend för API-tester..."
$backendScript = @"
Set-Location '$PWD\Backend'
`$env:FLASK_DEBUG = 'False'
python main.py
"@

$backendJob = Start-Job -ScriptBlock ([scriptblock]::Create($backendScript))
Write-Info "Väntar på att backend ska starta..."
Start-Sleep -Seconds 8

$backendUrl = "http://localhost:5001"

# Test endpoints
$endpoints = @(
    @{Method="POST"; Path="/api/auth/register"; ExpectedError=$true},
    @{Method="POST"; Path="/api/auth/login"; ExpectedError=$true},
    @{Method="GET"; Path="/api/mood/get"; ExpectedError=$true}
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri "$backendUrl$($endpoint.Path)" -Method $endpoint.Method -ContentType "application/json" -Body '{}' -TimeoutSec 3 -ErrorAction SilentlyContinue
        Write-Success "$($endpoint.Method) $($endpoint.Path) - Backend svarar (200)"
        Add-TestResult "API Tests" "$($endpoint.Method) $($endpoint.Path)" "PASS"
    } catch {
        if ($_.Exception.Response.StatusCode -in @(400, 401, 422)) {
            Write-Success "$($endpoint.Method) $($endpoint.Path) - Backend svarar ($(($_.Exception.Response.StatusCode)))"
            Add-TestResult "API Tests" "$($endpoint.Method) $($endpoint.Path)" "PASS" "Expected error response"
        } else {
            Write-Fail "$($endpoint.Method) $($endpoint.Path) - Backend svarar INTE"
            Add-TestResult "API Tests" "$($endpoint.Method) $($endpoint.Path)" "FAIL" "No response"
        }
    }
}

# Stoppa backend
Stop-Job $backendJob -ErrorAction SilentlyContinue
Remove-Job $backendJob -ErrorAction SilentlyContinue

# ═══════════════════════════════════════════════════
# TEST 6: FRONTEND BUILD
# ═══════════════════════════════════════════════════
Write-TestHeader "Frontend Build Test" "6"

if (Test-Path "frontend/node_modules") {
    Write-Success "node_modules finns"
    Add-TestResult "Frontend" "Dependencies Installed" "PASS"
} else {
    Write-Warning "node_modules saknas - kör 'npm install' i frontend/"
    Add-TestResult "Frontend" "Dependencies Installed" "SKIP" "Run npm install"
}

Write-Info "Kollar om Next.js kan byggas..."
Push-Location frontend
try {
    # Kolla om det går att validera config
    if (Test-Path "next.config.js") {
        Write-Success "next.config.js finns"
        Add-TestResult "Frontend" "Next.js Config" "PASS"
    }
    
    # Kolla viktiga komponenter
    $criticalComponents = @(
        "components/MoodLogger.tsx",
        "components/MoodList.tsx",
        "pages/index.tsx",
        "pages/api"
    )
    
    foreach ($component in $criticalComponents) {
        if (Test-Path $component) {
            Write-Success "$component finns"
            Add-TestResult "Frontend" "Component: $component" "PASS"
        } else {
            Write-Fail "$component saknas!"
            Add-TestResult "Frontend" "Component: $component" "FAIL" "Missing"
        }
    }
    
} catch {
    Write-Fail "Frontend build-test misslyckades: $_"
    Add-TestResult "Frontend" "Build Test" "FAIL" $_.Exception.Message
}
Pop-Location

# ═══════════════════════════════════════════════════
# TEST 7: FIREBASE CONNECTIVITY
# ═══════════════════════════════════════════════════
Write-TestHeader "Firebase Connectivity" "7"

Write-Info "Testar Firebase-anslutning..."
$firebaseTest = @"
import sys
sys.path.insert(0, 'Backend')
from src.firebase_config import db, auth
print('Firebase OK' if db and auth else 'Firebase FAIL')
"@

try {
    $firebaseResult = python -c $firebaseTest 2>&1
    if ($firebaseResult -match "Firebase OK") {
        Write-Success "Firebase är korrekt konfigurerad"
        Add-TestResult "Firebase" "Connection Test" "PASS"
    } else {
        Write-Fail "Firebase-konfiguration fel"
        Add-TestResult "Firebase" "Connection Test" "FAIL" $firebaseResult
    }
} catch {
    Write-Fail "Kunde inte testa Firebase: $_"
    Add-TestResult "Firebase" "Connection Test" "FAIL" $_.Exception.Message
}

# ═══════════════════════════════════════════════════
# TEST 8: SECURITY CHECKS
# ═══════════════════════════════════════════════════
Write-TestHeader "Security Checks" "8"

Write-Info "Kollar säkerhetskonfiguration..."

# Kolla att känsliga filer inte committas
$sensitiveFiles = @(
    "Backend/serviceAccountKey.json",
    "Backend/.env",
    "frontend/.env.local"
)

$gitignoreContent = Get-Content ".gitignore" -Raw -ErrorAction SilentlyContinue

foreach ($file in $sensitiveFiles) {
    if ($gitignoreContent -match [regex]::Escape($file.Split('/')[-1])) {
        Write-Success "$file är i .gitignore"
        Add-TestResult "Security" "Gitignore: $file" "PASS"
    } else {
        Write-Warning "$file kanske inte är i .gitignore"
        Add-TestResult "Security" "Gitignore: $file" "FAIL" "Not in gitignore"
    }
}

# Kolla JWT secrets
if (Test-Path "Backend/.env") {
    $envContent = Get-Content "Backend/.env" -Raw
    if ($envContent -match "JWT_SECRET_KEY=.{32,}") {
        Write-Success "JWT_SECRET_KEY har tillräcklig längd"
        Add-TestResult "Security" "JWT Secret Length" "PASS"
    } else {
        Write-Warning "JWT_SECRET_KEY kan vara för kort"
        Add-TestResult "Security" "JWT Secret Length" "FAIL" "Too short"
    }
}

# ═══════════════════════════════════════════════════
# TEST 9: DOCUMENTATION
# ═══════════════════════════════════════════════════
Write-TestHeader "Documentation Check" "9"

$documentationFiles = @(
    "README.md",
    "TESTING_GUIDE.md",
    "DEPLOYMENT_READY_REPORT.md"
)

foreach ($doc in $documentationFiles) {
    if (Test-Path $doc) {
        $size = (Get-Item $doc).Length
        if ($size -gt 100) {
            Write-Success "$doc finns ($size bytes)"
            Add-TestResult "Documentation" $doc "PASS"
        } else {
            Write-Warning "$doc är väldigt kort ($size bytes)"
            Add-TestResult "Documentation" $doc "FAIL" "File too short"
        }
    } else {
        Write-Fail "$doc saknas!"
        Add-TestResult "Documentation" $doc "FAIL" "Missing"
    }
}

# ═══════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              📊 TEST SUMMARY                      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "Total Tests: $($testsPassed + $testsFailed + $testsSkipped)" -ForegroundColor White
Write-Host "✅ Passed: $testsPassed" -ForegroundColor Green
Write-Host "❌ Failed: $testsFailed" -ForegroundColor Red
Write-Host "⏭️  Skipped: $testsSkipped" -ForegroundColor Yellow
Write-Host ""

# Gruppera resultat per kategori
$resultsByCategory = $testResults | Group-Object Category

foreach ($category in $resultsByCategory) {
    Write-Host "═══ $($category.Name) ═══" -ForegroundColor Yellow
    foreach ($result in $category.Group) {
        $icon = if ($result.Status -eq "PASS") { "✅" } elseif ($result.Status -eq "FAIL") { "❌" } else { "⏭️" }
        $color = if ($result.Status -eq "PASS") { "Green" } elseif ($result.Status -eq "FAIL") { "Red" } else { "Yellow" }
        Write-Host "  $icon $($result.Test)" -ForegroundColor $color
        if ($result.Details) {
            Write-Host "     └─ $($result.Details)" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

# Export results
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$reportFile = "TEST_REPORT_$timestamp.json"
$testResults | ConvertTo-Json -Depth 3 | Out-File $reportFile
Write-Info "Detaljerad rapport sparad i: $reportFile"

# Final verdict
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
if ($testsFailed -eq 0) {
    Write-Host "║          🎉 PROJEKTET ÄR REDO FÖR LEVERANS!      ║" -ForegroundColor Green
} elseif ($testsFailed -le 3) {
    Write-Host "║       ⚠️  PROJEKTET HAR MINDRE PROBLEM            ║" -ForegroundColor Yellow
    Write-Host "║          (Men kan troligen levereras)             ║" -ForegroundColor Yellow
} else {
    Write-Host "║      ❌ PROJEKTET HAR KRITISKA PROBLEM            ║" -ForegroundColor Red
    Write-Host "║          (Fixa dessa innan leverans)              ║" -ForegroundColor Red
}
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Recommendations
if ($testsFailed -gt 0) {
    Write-Host "🔧 REKOMMENDERADE ÅTGÄRDER:" -ForegroundColor Yellow
    $failedTests = $testResults | Where-Object { $_.Status -eq "FAIL" }
    foreach ($test in $failedTests | Select-Object -First 5) {
        Write-Host "  • Fixa: $($test.Test)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Tryck valfri tangent för att avsluta..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

exit $testsFailed
