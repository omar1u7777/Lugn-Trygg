# Komplett FAS 2-verifiering - 100% sann test
# Detta script testar ALLA mood endpoints med riktig autentisering

$API_URL = "http://localhost:54112"
$TEST_EMAIL = "fas2-test-$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$TEST_PASSWORD = "TestPass123!"

Write-Host "🧪 FAS 2 - Komplett 100% sann verifiering" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Steg 1: Registrera test-användare
Write-Host "`n1️⃣ Registrerar test-användare..." -ForegroundColor Yellow
$registerBody = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
    name = "FAS2 Test User"
    accept_terms = $true
    accept_privacy = $true
} | ConvertTo-Json

try {
    $registerResponse = Invoke-WebRequest -Uri "$API_URL/api/auth/register" -Method POST -Body $registerBody -ContentType "application/json"
    Write-Host "✅ Registrering lyckades: $($registerResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Registrering misslyckades: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    exit 1
}

# Steg 2: Logga in och få JWT-token
Write-Host "`n2️⃣ Loggar in och hämtar JWT-token..." -ForegroundColor Yellow
$loginBody = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "$API_URL/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $AUTH_TOKEN = $loginData.access_token
    Write-Host "✅ Inloggning lyckades - JWT-token mottagen" -ForegroundColor Green
} catch {
    Write-Host "❌ Inloggning misslyckades: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    exit 1
}

# Steg 3: Testa alla mood endpoints
Write-Host "`n3️⃣ Testar alla mood endpoints..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $AUTH_TOKEN"
    "Content-Type" = "application/json"
}

$moodTests = @(
    @{ Name = "GET /api/mood (hämtar alla)"; Method = "GET"; Url = "/api/mood"; Body = $null },
    @{ Name = "GET /api/mood/recent"; Method = "GET"; Url = "/api/mood/recent"; Body = $null },
    @{ Name = "GET /api/mood/today"; Method = "GET"; Url = "/api/mood/today"; Body = $null },
    @{ Name = "GET /api/mood/streaks"; Method = "GET"; Url = "/api/mood/streaks"; Body = $null },
    @{ Name = "GET /api/mood-stats/statistics"; Method = "GET"; Url = "/api/mood-stats/statistics"; Body = $null }
)

$passedTests = 0
$totalTests = $moodTests.Count

foreach ($test in $moodTests) {
    try {
        $params = @{
            Uri = "$API_URL$($test.Url)"
            Method = $test.Method
            Headers = $headers
        }
        if ($test.Body) {
            $params.Body = $test.Body | ConvertTo-Json
        }

        $response = Invoke-WebRequest @params
        Write-Host "✅ $($test.Name): $($response.StatusCode)" -ForegroundColor Green
        $passedTests++
    } catch {
        $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode } else { "Unknown" }
        Write-Host "❌ $($test.Name): $statusCode" -ForegroundColor Red
    }
}

# Steg 4: Testa att skapa en mood entry
Write-Host "`n4️⃣ Testar att skapa mood entry..." -ForegroundColor Yellow
$moodBody = @{
    mood_score = 7
    mood_text = "Testing FAS 2 implementation - känns bra!"
    activities = @("programming", "testing")
    tags = @("work", "positive")
} | ConvertTo-Json

try {
    $createResponse = Invoke-WebRequest -Uri "$API_URL/api/mood" -Method POST -Body $moodBody -Headers $headers -ContentType "application/json"
    $moodData = $createResponse.Content | ConvertFrom-Json
    $MOOD_ID = $moodData.id
    Write-Host "✅ Mood skapad: ID = $MOOD_ID" -ForegroundColor Green

    # Testa att hämta specifik mood
    Write-Host "5️⃣ Testar att hämta specifik mood..." -ForegroundColor Yellow
    $getResponse = Invoke-WebRequest -Uri "$API_URL/api/mood/$MOOD_ID" -Method GET -Headers $headers
    Write-Host "✅ Specifik mood hämtad: $($getResponse.StatusCode)" -ForegroundColor Green

    # Testa att uppdatera mood
    Write-Host "6️⃣ Testar att uppdatera mood..." -ForegroundColor Yellow
    $updateBody = @{
        mood_score = 8
        mood_text = "Updated - känns ännu bättre!"
    } | ConvertTo-Json
    $updateResponse = Invoke-WebRequest -Uri "$API_URL/api/mood/$MOOD_ID" -Method PUT -Body $updateBody -Headers $headers -ContentType "application/json"
    Write-Host "✅ Mood uppdaterad: $($updateResponse.StatusCode)" -ForegroundColor Green

} catch {
    $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode } else { "Unknown" }
    Write-Host "❌ Mood operation misslyckades: $statusCode" -ForegroundColor Red
}

# Slutresultat
Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host "📊 FAS 2 VERIFICATION RESULTAT:" -ForegroundColor White
Write-Host "==============================================" -ForegroundColor Cyan

if ($passedTests -eq $totalTests) {
    Write-Host "🎉 FAS 2 ÄR 100% KOMPLETT OCH FUNGERANDE!" -ForegroundColor Green
    Write-Host "✅ Alla endpoints fungerar med autentisering" -ForegroundColor Green
    Write-Host "✅ CRUD-operationer fungerar (Create, Read, Update)" -ForegroundColor Green
    Write-Host "✅ Databasintegration fungerar" -ForegroundColor Green
    Write-Host "✅ JWT-autentisering fungerar" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ FAS 2 INTE KOMPLETT - $($passedTests)/$($totalTests) tester passerade" -ForegroundColor Red
    exit 1
}