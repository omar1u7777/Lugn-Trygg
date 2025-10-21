# Quick debug script för att testa humörlagring
$backendUrl = "http://localhost:5001"

# 1. Login
Write-Host "Loggar in..." -ForegroundColor Cyan
$loginData = @{
    email = "test@lugntrygg.se"
    password = "Test123456!"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$backendUrl/api/auth/login" -Method POST -ContentType "application/json" -Body $loginData -ErrorAction Stop
$token = $loginResponse.access_token
$userId = $loginResponse.user_id

Write-Host "✅ Inloggad! User ID: $userId" -ForegroundColor Green
Write-Host "Token: $($token.Substring(0, 50))..." -ForegroundColor Gray
Write-Host ""

# 2. Spara humör
Write-Host "Sparar humör..." -ForegroundColor Cyan
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$moodData = @{
    mood_text = "Jag känner mig glad och energisk idag! 😊"
    timestamp = $timestamp
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "Request URL: $backendUrl/api/mood/log" -ForegroundColor Gray
Write-Host "Request Body: $moodData" -ForegroundColor Gray
Write-Host "Authorization: Bearer $($token.Substring(0, 30))..." -ForegroundColor Gray
Write-Host ""

try {
    $moodResponse = Invoke-RestMethod -Uri "$backendUrl/api/mood/log" -Method POST -Headers $headers -Body $moodData -ErrorAction Stop
    Write-Host "✅ Humör sparat!" -ForegroundColor Green
    Write-Host ($moodResponse | ConvertTo-Json -Depth 5) -ForegroundColor Yellow
} catch {
    Write-Host "❌ Fel vid sparning: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}
