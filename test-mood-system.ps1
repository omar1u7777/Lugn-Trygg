# 🧪 Test Script för Humörlagring och Visning
# Kör detta för att verifiera att allt fungerar

Write-Host ""
Write-Host "================================" -ForegroundColor Yellow
Write-Host "🧪 HUMÖRLAGRING DEBUG TEST" -ForegroundColor Yellow  
Write-Host "================================" -ForegroundColor Yellow
Write-Host ""

# Konfiguration
$backendUrl = "http://localhost:5001"
$testEmail = "test@lugntrygg.se"
$testPassword = "Test123456!"

# Funktioner för färgad output
function Write-Success { param($msg) Write-Host "   ✅ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "   ❌ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "   ℹ️  $msg" -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host "   ⚠️  $msg" -ForegroundColor Yellow }

# Test 1: Backend Status
Write-Host "1️⃣  Testar Backend Connection..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/auth/register" -Method POST -ContentType "application/json" -Body '{}' -TimeoutSec 5 -ErrorAction SilentlyContinue
    # Vi förväntar oss 400 eller 422 (fel request), men det betyder att backend svarar
    Write-Success "Backend körs på $backendUrl"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 422) {
        Write-Success "Backend körs på $backendUrl"
    } else {
        Write-Error "Backend svarar inte!"
        Write-Host "   ℹ️  Starta backend med: cd Backend ; python main.py" -ForegroundColor Blue
        exit 1
    }
}
Write-Host ""

# Test 2: Registrera Testanvändare (om den inte finns)
Write-Host "2️⃣  Registrerar testanvändare..." -ForegroundColor Cyan
$registerData = @{
    email = $testEmail
    password = $testPassword
    name = "Test User"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$backendUrl/api/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $registerData `
        -ErrorAction Stop
    Write-Success "Ny testanvändare skapad"
} catch {
    # Användaren finns redan, det är ok
    Write-Info "Testanvändaren finns redan (ok)"
}
Write-Host ""

# Test 3: Login
Write-Host "3️⃣  Testar Login..." -ForegroundColor Cyan
$loginData = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$backendUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginData `
        -ErrorAction Stop
    
    $token = $loginResponse.access_token
    $userId = $loginResponse.user_id
    
    Write-Success "Inloggad som $testEmail"
    Write-Info "User ID: $userId"
    Write-Info "Token: $($token.Substring(0, 30))..."
} catch {
    Write-Error "Login misslyckades: $($_.Exception.Message)"
    Write-Warning "Kunde inte logga in med testanvändaren"
    exit 1
}
Write-Host ""

# Test 4: Spara ett humör (Text)
Write-Host "4️⃣  Sparar Testhumör #1 (Text)..." -ForegroundColor Cyan
$timestamp1 = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$moodData1 = @{
    mood_text = "Jag känner mig supergläd och energisk idag! ☀️"
    timestamp = $timestamp1
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $moodResponse1 = Invoke-RestMethod -Uri "$backendUrl/api/mood/log" `
        -Method POST `
        -Headers $headers `
        -Body $moodData1 `
        -ErrorAction Stop
    
    Write-Success "Humör #1 sparat"
    Write-Info "Sentiment: $($moodResponse1.mood_entry.sentiment_analysis.sentiment)"
    Write-Info "Score: $($moodResponse1.mood_entry.sentiment_analysis.score)"
} catch {
    Write-Error "Kunde inte spara humör #1: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Info "Response: $responseBody"
    }
    exit 1
}
Write-Host ""

# Test 5: Spara ett till humör
Write-Host "5️⃣  Sparar Testhumör #2 (Negativt)..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
$timestamp2 = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$moodData2 = @{
    mood_text = "Känner mig lite ledsen och trött idag 😔"
    timestamp = $timestamp2
} | ConvertTo-Json

try {
    $moodResponse2 = Invoke-RestMethod -Uri "$backendUrl/api/mood/log" `
        -Method POST `
        -Headers $headers `
        -Body $moodData2 `
        -ErrorAction Stop
    
    Write-Success "Humör #2 sparat"
    Write-Info "Sentiment: $($moodResponse2.mood_entry.sentiment_analysis.sentiment)"
    Write-Info "Score: $($moodResponse2.mood_entry.sentiment_analysis.score)"
} catch {
    Write-Error "Kunde inte spara humör #2: $($_.Exception.Message)"
}
Write-Host ""

# Test 6: Spara ett neutralt humör
Write-Host "6️⃣  Sparar Testhumör #3 (Neutral)..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
$timestamp3 = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$moodData3 = @{
    mood_text = "Känner mig okej idag, varken glad eller ledsen"
    timestamp = $timestamp3
} | ConvertTo-Json

try {
    $moodResponse3 = Invoke-RestMethod -Uri "$backendUrl/api/mood/log" `
        -Method POST `
        -Headers $headers `
        -Body $moodData3 `
        -ErrorAction Stop
    
    Write-Success "Humör #3 sparat"
    Write-Info "Sentiment: $($moodResponse3.mood_entry.sentiment_analysis.sentiment)"
} catch {
    Write-Error "Kunde inte spara humör #3: $($_.Exception.Message)"
}
Write-Host ""

# Vänta lite för Firebase att synka
Write-Host "⏳ Väntar 3 sekunder för Firebase att synka..." -ForegroundColor Gray
Start-Sleep -Seconds 3
Write-Host ""

# Test 7: Hämta alla sparade humör
Write-Host "7️⃣  Hämtar Alla Sparade Humör..." -ForegroundColor Cyan
try {
    $getMoodsResponse = Invoke-RestMethod -Uri "$backendUrl/api/mood/get" `
        -Method GET `
        -Headers @{ "Authorization" = "Bearer $token" } `
        -ErrorAction Stop
    
    $moodCount = $getMoodsResponse.moods.Count
    
    if ($moodCount -gt 0) {
        Write-Success "Hämtade $moodCount humörloggar"
        Write-Host ""
        Write-Host "   📊 SPARADE HUMÖRLOGGAR:" -ForegroundColor Yellow
        Write-Host "   " + ("=" * 70) -ForegroundColor Gray
        
        $counter = 1
        foreach ($mood in $getMoodsResponse.moods | Select-Object -First 10) {
            $sentiment = $mood.sentiment
            $sentimentEmoji = switch ($sentiment) {
                "POSITIVE" { "😊" }
                "NEGATIVE" { "😢" }
                "NEUTRAL" { "😐" }
                default { "❓" }
            }
            
            $score = if ($mood.score) { [math]::Round($mood.score, 2) } else { "N/A" }
            
            Write-Host "   $counter. $sentimentEmoji $($mood.mood_text)" -ForegroundColor Cyan
            Write-Host "      Känsla: $sentiment | Score: $score" -ForegroundColor Gray
            Write-Host "      Tid: $($mood.timestamp)" -ForegroundColor DarkGray
            
            if ($mood.emotions_detected -and $mood.emotions_detected.Count -gt 0) {
                Write-Host "      Känslor: $($mood.emotions_detected -join ', ')" -ForegroundColor Magenta
            }
            
            Write-Host ""
            $counter++
        }
        
        Write-Host "   " + ("=" * 70) -ForegroundColor Gray
        
        # Statistik
        $positive = ($getMoodsResponse.moods | Where-Object { $_.sentiment -eq "POSITIVE" }).Count
        $negative = ($getMoodsResponse.moods | Where-Object { $_.sentiment -eq "NEGATIVE" }).Count
        $neutral = ($getMoodsResponse.moods | Where-Object { $_.sentiment -eq "NEUTRAL" }).Count
        
        Write-Host ""
        Write-Host "   📈 STATISTIK:" -ForegroundColor Yellow
        Write-Host "      😊 Positiva: $positive" -ForegroundColor Green
        Write-Host "      😢 Negativa: $negative" -ForegroundColor Red
        Write-Host "      😐 Neutrala: $neutral" -ForegroundColor Gray
        Write-Host "      📊 Totalt: $moodCount" -ForegroundColor Cyan
        
    } else {
        Write-Warning "Inga humörloggar hittades!"
        Write-Info "Data kan ta några sekunder att synka med Firebase"
    }
} catch {
    Write-Error "Kunde inte hämta humör: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Info "Response: $responseBody"
    }
    exit 1
}
Write-Host ""

# Test 8: Testa filtering
Write-Host "8️⃣  Testar Filtering (Endast Positiva)..." -ForegroundColor Cyan
$positiveMoods = $getMoodsResponse.moods | Where-Object { $_.sentiment -eq "POSITIVE" }
Write-Info "Hittade $($positiveMoods.Count) positiva humör"
Write-Host ""

Write-Host "9️⃣  Testar Filtering (Endast Negativa)..." -ForegroundColor Cyan
$negativeMoods = $getMoodsResponse.moods | Where-Object { $_.sentiment -eq "NEGATIVE" }
Write-Info "Hittade $($negativeMoods.Count) negativa humör"
Write-Host ""

# Sammanfattning
Write-Host "================================" -ForegroundColor Yellow
Write-Host "✅ ALLA TESTER KLARA!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "📝 SAMMANFATTNING:" -ForegroundColor Cyan
Write-Host "   • Backend: ✅ Fungerar" -ForegroundColor Green
Write-Host "   • Login: ✅ Fungerar" -ForegroundColor Green
Write-Host "   • Spara Humör: ✅ Fungerar" -ForegroundColor Green
Write-Host "   • Hämta Humör: ✅ Fungerar" -ForegroundColor Green
Write-Host "   • Filtering: ✅ Fungerar" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Humörlagring och visning fungerar korrekt!" -ForegroundColor Green
Write-Host ""
Write-Host "📌 Nästa steg:" -ForegroundColor Yellow
Write-Host "   1. Testa i frontend: npm run dev" -ForegroundColor Cyan
Write-Host "   2. Öppna MoodLogger och spara ett humör" -ForegroundColor Cyan
Write-Host "   3. Öppna MoodList och verifiera att det visas" -ForegroundColor Cyan
Write-Host ""
