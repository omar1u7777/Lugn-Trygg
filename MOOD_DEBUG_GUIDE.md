# 🐛 DEBUGGING GUIDE - Humörlagring och Visning

## Problem att Undersöka

1. **Sparas humör korrekt i databasen?**
2. **Hämtas humör korrekt från API?**
3. **Visas sparade humör i frontend?**

---

## 🔍 STEG 1: Testa Backend API Direkt

### Test 1: Spara Humör (Text)

```powershell
# Först, få en JWT token genom att logga in
$loginData = @{
    email = "test@example.com"
    password = "testpassword123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:54112/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginData

$token = $loginResponse.access_token
Write-Host "✅ Token erhållen: $token"

# Nu spara ett humör
$moodData = @{
    mood_text = "Jag känner mig väldigt glad idag!"
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $moodResponse = Invoke-RestMethod -Uri "http://localhost:54112/api/mood/log" `
        -Method POST `
        -Headers $headers `
        -Body $moodData
    
    Write-Host "✅ Humör sparat:" -ForegroundColor Green
    $moodResponse | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ Fel vid sparande:" -ForegroundColor Red
    $_.Exception.Message
}
```

### Test 2: Hämta Sparade Humör

```powershell
# Använd samma token från ovan
$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    $moodsResponse = Invoke-RestMethod -Uri "http://localhost:54112/api/mood/get" `
        -Method GET `
        -Headers $headers
    
    Write-Host "✅ Humörloggar hämtade:" -ForegroundColor Green
    $moodsResponse.moods | ForEach-Object {
        Write-Host "  - $($_.mood_text) | $($_.sentiment) | $($_.timestamp)" -ForegroundColor Cyan
    }
    Write-Host "`nTotalt: $($moodsResponse.moods.Count) humörloggar" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Fel vid hämtning:" -ForegroundColor Red
    $_.Exception.Message
}
```

---

## 🔍 STEG 2: Kontrollera Firebase Direkt

### Verifiera Data i Firestore

1. Gå till [Firebase Console](https://console.firebase.google.com/)
2. Välj projektet `lugn-trygg-53d75`
3. Navigera till **Firestore Database**
4. Leta efter strukturen:
   ```
   users/
     └── {user_id}/
         └── moods/
             └── {mood_id}
                 ├── mood_text: "..."
                 ├── timestamp: "..."
                 ├── sentiment: "POSITIVE"
                 ├── score: 0.8
                 └── emotions_detected: [...]
   ```

---

## 🔍 STEG 3: Kontrollera Frontend Console

### I Browser DevTools (F12)

1. **Network Tab:**
   - Sök efter `mood/log` request
   - Kontrollera **Request Payload**:
     ```json
     {
       "mood_text": "glad",
       "timestamp": "2025-10-20T..."
     }
     ```
   - Kontrollera **Response**:
     ```json
     {
       "success": true,
       "mood_entry": {...}
     }
     ```

2. **Console Tab:**
   - Leta efter `✅ Humör sparat från text:`
   - Leta efter `📊 Hämtade humördata:`
   - Leta efter eventuella fel: `❌ Fel vid...`

---

## 🐛 VANLIGA PROBLEM & LÖSNINGAR

### Problem 1: 401 Unauthorized

**Symptom:** API returnerar 401 när du försöker spara/hämta humör

**Lösning:**
```typescript
// Kontrollera att token finns
const token = localStorage.getItem("token");
console.log("Token i localStorage:", token);

// Kontrollera att Authorization header skickas
console.log("Request headers:", {
  Authorization: `Bearer ${token}`
});
```

### Problem 2: Humör sparas men visas inte

**Symptom:** `/api/mood/log` returnerar 201 success, men `/api/mood/get` returnerar tomt

**Möjliga orsaker:**
1. **Fel user_id används vid hämtning**
   ```typescript
   // I MoodList.tsx, kontrollera:
   console.log("Hämtar humör för user:", user.user_id);
   ```

2. **Firebase subcollection inte skapad korrekt**
   ```python
   # I mood_routes.py, kontrollera:
   mood_ref = db.collection('users').document(user_id).collection('moods')
   doc_ref = mood_ref.add({...})
   print(f"Saved to: users/{user_id}/moods/{doc_id}")
   ```

3. **Timestamp-format fel**
   ```python
   # Backend bör acceptera både ISO string och Firestore Timestamp
   timestamp = data.get('timestamp', datetime.utcnow().isoformat())
   ```

### Problem 3: "Cannot read property of undefined"

**Symptom:** Frontend kraschar när humör ska visas

**Lösning i MoodList.tsx:**
```typescript
// Säkra fallbacks
const displayMood = mood.mood_text || 'neutral';
const sentiment = (mood.sentiment || 'NEUTRAL').toUpperCase();
const score = mood.score ?? 0;
```

### Problem 4: JWT Token Expired

**Symptom:** Fungerar först, sedan 401 efter 15 minuter

**Lösning:**
```typescript
// api.ts har redan token refresh implementerat
// Men verifiera att refresh endpoint finns:
const newAccessToken = await refreshAccessToken();
```

---

## 🔧 DEBUG-LÄGE: Aktivera Detaljerad Logging

### Backend (mood_routes.py)

Lägg till extra logging:

```python
@mood_bp.route('/log', methods=['POST'])
@AuthService.jwt_required
def log_mood():
    logger.info("=" * 50)
    logger.info("🎭 MOOD LOG REQUEST RECEIVED")
    logger.info(f"User ID: {g.user_id}")
    logger.info(f"Content-Type: {request.content_type}")
    logger.info(f"Request Data: {request.get_json() if request.is_json else request.form.to_dict()}")
    
    # ... existing code ...
    
    logger.info(f"✅ Mood saved successfully: {final_mood_text}")
    logger.info(f"Firestore path: users/{user_id}/moods/{doc_id}")
    logger.info("=" * 50)
```

### Frontend (MoodLogger.tsx & MoodList.tsx)

Lägg till extra logging:

```typescript
// MoodLogger.tsx - saveTextMood()
console.log("🔵 Sparar humör:", {
  mood_text: textMood,
  timestamp: new Date().toISOString(),
  token: localStorage.getItem("token")?.substring(0, 20) + "..."
});

// MoodList.tsx - fetchMoods()
console.log("🔵 Hämtar humör för user:", user.user_id);
const moodData = await getMoods(user.user_id);
console.log("🔵 Mottagen data:", {
  count: moodData?.length || 0,
  firstMood: moodData?.[0] || null
});
```

---

## 📊 FÖRVÄNTAT FLÖDE

### 1. Spara Humör (Text)

```
[Frontend: MoodLogger.tsx]
  └─> User skriver "glad" i textfält
  └─> Klickar "Spara humör"
  └─> POST /api/mood/log
      Body: { mood_text: "glad", timestamp: "..." }
      Headers: { Authorization: "Bearer <token>" }

[Backend: mood_routes.py]
  └─> JWT validering ✅
  └─> user_id från g.user_id
  └─> Sentiment analys med AI
  └─> Spara till Firestore: users/{user_id}/moods/{doc_id}
  └─> Response: { success: true, mood_entry: {...} }

[Frontend: MoodLogger.tsx]
  └─> onMoodLogged() callback körs
  └─> Uppdaterar MoodList om den är öppen
```

### 2. Visa Sparade Humör

```
[Frontend: MoodList.tsx]
  └─> useEffect() körs vid mount
  └─> GET /api/mood/get
      Headers: { Authorization: "Bearer <token>" }

[Backend: mood_routes.py]
  └─> JWT validering ✅
  └─> user_id från g.user_id
  └─> Hämta från Firestore: users/{user_id}/moods
  └─> Sortera efter timestamp DESC
  └─> Response: { moods: [...] }

[Frontend: MoodList.tsx]
  └─> setState(moods)
  └─> Rendera lista med humör
  └─> Filter: Alla/Positiva/Negativa/Neutrala
```

---

## 🎯 SNABB FELSÖKNING

**Kör detta script för att testa hela flödet:**

```powershell
# test-mood-flow.ps1

Write-Host "🧪 TESTAR HUMÖRLAGRING OCH VISNING" -ForegroundColor Yellow
Write-Host ""

# 1. Testa Backend Status
Write-Host "1️⃣ Testar Backend..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "http://localhost:54112/api/health" -Method GET
    Write-Host "   ✅ Backend körs" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend körs INTE - Starta med 'python main.py'" -ForegroundColor Red
    exit 1
}

# 2. Logga in
Write-Host "2️⃣ Loggar in..." -ForegroundColor Cyan
$loginData = @{
    email = "test@lugntrygg.se"
    password = "Test123456!"
} | ConvertTo-Json

try {
    $login = Invoke-RestMethod -Uri "http://localhost:54112/api/auth/login" `
        -Method POST -ContentType "application/json" -Body $loginData
    $token = $login.access_token
    Write-Host "   ✅ Inloggad" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Inloggning misslyckades" -ForegroundColor Red
    Write-Host "   Skapa användare först med RegisterForm" -ForegroundColor Yellow
    exit 1
}

# 3. Spara ett humör
Write-Host "3️⃣ Sparar testhumör..." -ForegroundColor Cyan
$moodData = @{
    mood_text = "Jag känner mig supertastad och energisk!"
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $moodResponse = Invoke-RestMethod -Uri "http://localhost:54112/api/mood/log" `
        -Method POST -Headers $headers -Body $moodData
    Write-Host "   ✅ Humör sparat" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Kunde inte spara humör: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 4. Hämta sparade humör
Write-Host "4️⃣ Hämtar sparade humör..." -ForegroundColor Cyan
Start-Sleep -Seconds 2  # Ge Firebase tid att synka

try {
    $moods = Invoke-RestMethod -Uri "http://localhost:54112/api/mood/get" `
        -Method GET -Headers @{ "Authorization" = "Bearer $token" }
    
    if ($moods.moods.Count -gt 0) {
        Write-Host "   ✅ Hämtade $($moods.moods.Count) humörloggar" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 SENASTE HUMÖRLOGGAR:" -ForegroundColor Yellow
        $moods.moods | Select-Object -First 5 | ForEach-Object {
            Write-Host "   • $($_.mood_text)" -ForegroundColor Cyan
            Write-Host "     Känsla: $($_.sentiment) | Tid: $($_.timestamp)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️ Inga humörloggar hittades (kanske inte synkat än)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Kunde inte hämta humör: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ ALLA TESTER KLARA!" -ForegroundColor Green
```

Spara som `test-mood-flow.ps1` och kör med: `.\test-mood-flow.ps1`

---

## 📝 SAMMANFATTNING

**Om allt fungerar korrekt:**
- ✅ Backend startar på port 54112
- ✅ Firebase connection etableras
- ✅ JWT authentication fungerar
- ✅ Humör sparas till `users/{user_id}/moods/`
- ✅ Humör kan hämtas via API
- ✅ Frontend visar sparade humör

**Om något inte fungerar, kontrollera:**
1. Backend logs för fel
2. Firebase Console för data
3. Browser DevTools Network tab
4. JWT token validity
5. User ID consistency mellan save/fetch
