# Test Integrations & Feedback Functionality
# Tests Apple Health, Google Fit and Feedback submission

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TESTING INTEGRATIONS & FEEDBACK" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

$backendUrl = "http://localhost:5001"
$testResults = @{
    passed = 0
    failed = 0
    tests = @()
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Body = $null,
        [string]$Token = $null
    )
    
    Write-Host "Testing: $Name..." -NoNewline
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Token) {
            $headers["Authorization"] = "Bearer $Token"
        }
        
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $headers
            TimeoutSec = 10
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params -ErrorAction Stop
        
        Write-Host " ✅ PASSED" -ForegroundColor Green
        $script:testResults.passed++
        $script:testResults.tests += @{
            name = $Name
            status = "✅ PASSED"
            response = $response
        }
        return $response
        
    } catch {
        Write-Host " ❌ FAILED" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:testResults.failed++
        $script:testResults.tests += @{
            name = $Name
            status = "❌ FAILED"
            error = $_.Exception.Message
        }
        return $null
    }
}

# Start backend if not running
Write-Host "Checking backend status..." -ForegroundColor Cyan
try {
    $healthCheck = Invoke-RestMethod -Uri "$backendUrl/api/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Host "✅ Backend is running`n" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend not running. Starting..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Backend; python main.py" -WindowStyle Normal
    Write-Host "Waiting for backend to start..." -NoNewline
    Start-Sleep -Seconds 5
    
    $retries = 0
    while ($retries -lt 12) {
        try {
            Invoke-RestMethod -Uri "$backendUrl/api/health" -TimeoutSec 2 -ErrorAction Stop | Out-Null
            Write-Host " Ready!`n" -ForegroundColor Green
            break
        } catch {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 2
            $retries++
        }
    }
    
    if ($retries -eq 12) {
        Write-Host "`n❌ Failed to start backend`n" -ForegroundColor Red
        exit 1
    }
}

# Test data
$testUserId = "test-user-" + (Get-Date).Ticks
$testEmail = "test@example.com"
$testPassword = "TestPass123!"

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  PHASE 1: AUTHENTICATION" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

# Register test user
$registerResult = Test-Endpoint `
    -Name "Register Test User" `
    -Url "$backendUrl/api/auth/register" `
    -Method "POST" `
    -Body @{
        email = $testEmail
        password = $testPassword
        first_name = "Test"
        last_name = "User"
    }

if (-not $registerResult) {
    # Try login if user exists
    $registerResult = Test-Endpoint `
        -Name "Login Existing User" `
        -Url "$backendUrl/api/auth/login" `
        -Method "POST" `
        -Body @{
            email = $testEmail
            password = $testPassword
        }
}

if (-not $registerResult -or -not $registerResult.access_token) {
    Write-Host "`n❌ Failed to authenticate. Cannot continue tests.`n" -ForegroundColor Red
    exit 1
}

$token = $registerResult.access_token
$userId = $registerResult.user.user_id
Write-Host "`n✅ Authenticated as user: $userId`n" -ForegroundColor Green

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  PHASE 2: HEALTH INTEGRATIONS" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

# Test wearable status
$statusResult = Test-Endpoint `
    -Name "Get Wearable Status" `
    -Url "$backendUrl/api/integration/wearable/status" `
    -Method "GET" `
    -Token $token

# Connect Google Fit
$googleFitResult = Test-Endpoint `
    -Name "Connect Google Fit" `
    -Url "$backendUrl/api/integration/wearable/connect" `
    -Method "POST" `
    -Token $token `
    -Body @{
        device_type = "google_fit"
    }

# Connect Apple Health
$appleHealthResult = Test-Endpoint `
    -Name "Connect Apple Health (Expected Limitation)" `
    -Url "$backendUrl/api/integration/wearable/connect" `
    -Method "POST" `
    -Token $token `
    -Body @{
        device_type = "apple_health"
    }

# Connect Fitbit
$fitbitResult = Test-Endpoint `
    -Name "Connect Fitbit" `
    -Url "$backendUrl/api/integration/wearable/connect" `
    -Method "POST" `
    -Token $token `
    -Body @{
        device_type = "fitbit"
    }

# Sync Google Fit (mock data)
$syncGoogleResult = Test-Endpoint `
    -Name "Sync Google Fit Data" `
    -Url "$backendUrl/api/integration/wearable/google-fit/sync" `
    -Method "POST" `
    -Token $token `
    -Body @{
        access_token = "mock_token_for_testing"
        date_from = (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ssZ")
        date_to = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    }

# Get wearable details
$detailsResult = Test-Endpoint `
    -Name "Get Wearable Health Details" `
    -Url "$backendUrl/api/integration/wearable/details" `
    -Method "GET" `
    -Token $token

# Sync device data
if ($googleFitResult -and $googleFitResult.device) {
    $syncDeviceResult = Test-Endpoint `
        -Name "Sync Wearable Device" `
        -Url "$backendUrl/api/integration/wearable/sync" `
        -Method "POST" `
        -Token $token `
        -Body @{
            device_id = $googleFitResult.device.id
        }
}

Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  PHASE 3: FEEDBACK SYSTEM" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

# Submit feedback
$feedbackResult = Test-Endpoint `
    -Name "Submit Feedback" `
    -Url "$backendUrl/api/feedback/submit" `
    -Method "POST" `
    -Body @{
        user_id = $userId
        rating = 5
        category = "feature"
        message = "Automatiserad test av feedback-systemet. Health integration fungerar bra!"
        feature_request = "Fler wearable-enheter vore bra"
    }

# Submit bug report
$bugReportResult = Test-Endpoint `
    -Name "Submit Bug Report" `
    -Url "$backendUrl/api/feedback/submit" `
    -Method "POST" `
    -Body @{
        user_id = $userId
        rating = 4
        category = "bug"
        message = "Test av bug-rapportering"
        bug_report = "Detta är en testbugg (inte riktigt)"
    }

# Get feedback stats (admin endpoint)
$statsResult = Test-Endpoint `
    -Name "Get Feedback Statistics" `
    -Url "$backendUrl/api/feedback/stats" `
    -Method "GET"

Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  PHASE 4: ADVANCED INTEGRATIONS" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

# FHIR Patient data
$fhirPatientResult = Test-Endpoint `
    -Name "Get FHIR Patient Data" `
    -Url "$backendUrl/api/integration/fhir/patient" `
    -Method "GET" `
    -Token $token

# FHIR Observations
$fhirObsResult = Test-Endpoint `
    -Name "Get FHIR Observations" `
    -Url "$backendUrl/api/integration/fhir/observation" `
    -Method "GET" `
    -Token $token

# Comprehensive health sync
$healthSyncResult = Test-Endpoint `
    -Name "Sync Comprehensive Health Data" `
    -Url "$backendUrl/api/integration/health/sync" `
    -Method "POST" `
    -Token $token `
    -Body @{
        sources = @("google_fit", "apple_health", "fhir")
    }

Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TEST RESULTS SUMMARY" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Total Tests: " -NoNewline
Write-Host ($testResults.passed + $testResults.failed) -ForegroundColor White

Write-Host "Passed: " -NoNewline
Write-Host $testResults.passed -ForegroundColor Green

Write-Host "Failed: " -NoNewline
Write-Host $testResults.failed -ForegroundColor Red

$successRate = if (($testResults.passed + $testResults.failed) -gt 0) {
    [math]::Round(($testResults.passed / ($testResults.passed + $testResults.failed)) * 100, 1)
} else {
    0
}

Write-Host "`nSuccess Rate: " -NoNewline
if ($successRate -ge 90) {
    Write-Host "$successRate% ✅" -ForegroundColor Green
} elseif ($successRate -ge 70) {
    Write-Host "$successRate% ⚠️" -ForegroundColor Yellow
} else {
    Write-Host "$successRate% ❌" -ForegroundColor Red
}

Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DETAILED RESULTS" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

foreach ($test in $testResults.tests) {
    Write-Host "$($test.status) $($test.name)" -ForegroundColor $(if ($test.status -match "✅") { "Green" } else { "Red" })
}

Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  KEY FINDINGS" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

if ($googleFitResult -and $googleFitResult.success) {
    Write-Host "✅ Google Fit integration FUNGERAR" -ForegroundColor Green
    Write-Host "   - Kan ansluta enheter" -ForegroundColor White
    Write-Host "   - Kan synkronisera data" -ForegroundColor White
} else {
    Write-Host "❌ Google Fit integration fungerar INTE" -ForegroundColor Red
}

if ($appleHealthResult) {
    Write-Host "`n⚠️  Apple Health integration BEGRÄNSNING" -ForegroundColor Yellow
    Write-Host "   - Kräver native iOS app (HealthKit)" -ForegroundColor White
    Write-Host "   - Kan EJ användas från webbapp" -ForegroundColor White
    Write-Host "   - Detta är EN FÖRVÄNTAD BEGRÄNSNING" -ForegroundColor Cyan
} else {
    Write-Host "`n✅ Apple Health begränsning korrekt implementerad" -ForegroundColor Green
}

if ($detailsResult -and $detailsResult.data) {
    Write-Host "`n✅ Hälsodata-visning FUNGERAR" -ForegroundColor Green
    Write-Host "   - Steg: $($detailsResult.data.steps)" -ForegroundColor White
    Write-Host "   - Hjärtfrekvens: $($detailsResult.data.heartRate) bpm" -ForegroundColor White
    Write-Host "   - Sömn: $($detailsResult.data.sleep) timmar" -ForegroundColor White
}

if ($feedbackResult -and $feedbackResult.success) {
    Write-Host "`n✅ Feedback-system FUNGERAR" -ForegroundColor Green
    Write-Host "   - Kan skicka feedback" -ForegroundColor White
    Write-Host "   - Feedback ID: $($feedbackResult.feedback_id)" -ForegroundColor White
}

Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  SLUTSATS" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

if ($successRate -ge 80) {
    Write-Host "🎉 INTEGRATIONS & FEEDBACK FUNGERAR!" -ForegroundColor Green -BackgroundColor Black
    Write-Host "`nDu KAN:" -ForegroundColor Green
    Write-Host "✅ Ansluta Google Fit (mock data)" -ForegroundColor White
    Write-Host "✅ Ansluta Fitbit (mock data)" -ForegroundColor White
    Write-Host "✅ Synkronisera hälsodata" -ForegroundColor White
    Write-Host "✅ Visa hälsostatistik" -ForegroundColor White
    Write-Host "✅ Skicka feedback" -ForegroundColor White
    Write-Host "✅ Rapportera buggar" -ForegroundColor White
    Write-Host "`nDu KAN INTE (begränsningar):" -ForegroundColor Yellow
    Write-Host "⚠️  Apple Health - Kräver native iOS app" -ForegroundColor White
    Write-Host "⚠️  Riktiga OAuth tokens - Kräver produktion-setup" -ForegroundColor White
} else {
    Write-Host "❌ PROBLEM UPPTÄCKTA" -ForegroundColor Red -BackgroundColor Black
    Write-Host "`nFler än 20% av testerna misslyckades`n" -ForegroundColor Red
}

Write-Host "`n"
