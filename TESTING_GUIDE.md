# 🧪 Test Guide - Lugn & Trygg

## Snabbstart

### Metod 1: Automatisk start (REKOMMENDERAT)
```powershell
.\start.ps1
```
Detta startar backend automatiskt i ett nytt fönster och kör alla tester.

---

## Olika sätt att köra tester

### ✅ Metod 1: Automatiskt (Enklast)
Startar backend + kör alla tester:
```powershell
.\run-tests.ps1
```

### ✅ Metod 2: Snabbtest
Startar backend + kör snabbtest:
```powershell
.\run-tests.ps1 -QuickTest
```

### ✅ Metod 3: Backend körs redan
Om backend redan körs i en annan terminal:
```powershell
.\run-tests.ps1 -SkipBackendStart
```

### ✅ Metod 4: Manuell kontroll
**Terminal 1 (Backend):**
```powershell
cd Backend
python main.py
```

**Terminal 2 (Tester):**
```powershell
# Fullständiga tester
.\test-mood-system.ps1

# ELLER snabbtest
.\debug-mood-save.ps1
```

---

## 📋 Test Scripts

### `test-mood-system.ps1` - Fullständig testsvit
Testar:
- ✅ Backend connection
- ✅ User registration
- ✅ User login
- ✅ Spara 3 olika humör
- ✅ Hämta alla humör
- ✅ Filtrera humör efter datum
- ✅ Humörstatistik
- ✅ Tidszon-hantering
- ✅ Felhantering

### `debug-mood-save.ps1` - Snabbtest
Testar bara:
- ✅ Login
- ✅ Spara ett humör
- ✅ Visa resultat

---

## 🔧 Felsökning

### Backend startar inte
```powershell
# Kolla om porten är upptagen
netstat -ano | findstr "5001"

# Stoppa eventuell Python-process
Stop-Process -Name python -Force
```

### Tester hittar inte backend
```powershell
# Verifiera att backend körs
curl http://localhost:5001/api/auth/register -Method POST -ContentType "application/json" -Body '{}'

# Förväntat svar: 400 eller 422 (inte 404)
```

### Port conflict
Om port 5001 är upptagen, ändra i:
- `Backend/.env` → `PORT=5002`
- `test-mood-system.ps1` → `$backendUrl = "http://localhost:5002"`
- `debug-mood-save.ps1` → `$backendUrl = "http://localhost:5002"`

---

## 📊 Förväntat resultat

### ✅ Lyckat test
```
================================
🧪 HUMÖRLAGRING DEBUG TEST
================================

1️⃣  Testar Backend Connection...
   ✅ Backend körs på http://localhost:5001

2️⃣  Testar User Registration...
   ✅ Användare registrerad

3️⃣  Testar User Login...
   ✅ Login lyckades

4️⃣  Sparar testhumör #1 (Glatt - 8/10)...
   ✅ Humör sparat

...
```

### ❌ Misslyckat test
```
1️⃣  Testar Backend Connection...
   ❌ Backend svarar inte!
   ℹ️  Starta backend med: cd Backend ; python main.py
```

**Lösning:** Kör `.\run-tests.ps1` istället (startar backend automatiskt)

---

## 🎯 Manual API Testing

### 1. Registrera användare
```powershell
Invoke-RestMethod -Uri "http://localhost:5001/api/auth/register" -Method POST -ContentType "application/json" -Body (@{
    email = "test@example.com"
    password = "Test123456!"
    name = "Test User"
} | ConvertTo-Json)
```

### 2. Logga in
```powershell
$login = Invoke-RestMethod -Uri "http://localhost:5001/api/auth/login" -Method POST -ContentType "application/json" -Body (@{
    email = "test@example.com"
    password = "Test123456!"
} | ConvertTo-Json)

$token = $login.access_token
```

### 3. Spara humör
```powershell
Invoke-RestMethod -Uri "http://localhost:5001/api/mood/log" -Method POST -ContentType "application/json" -Headers @{
    Authorization = "Bearer $token"
} -Body (@{
    mood_level = 8
    notes = "Känner mig bra idag!"
    activities = @("träning", "promenad")
} | ConvertTo-Json)
```

### 4. Hämta humör
```powershell
Invoke-RestMethod -Uri "http://localhost:5001/api/mood/get" -Method GET -Headers @{
    Authorization = "Bearer $token"
}
```

### 5. Filtrera efter datum
```powershell
$today = (Get-Date).ToString("yyyy-MM-dd")
Invoke-RestMethod -Uri "http://localhost:5001/api/mood/get?start_date=$today" -Method GET -Headers @{
    Authorization = "Bearer $token"
}
```

---

## 📝 Testanvändare

Alla test-scripts använder:
- **Email:** `test@lugntrygg.se`
- **Password:** `Test123456!`

---

## 🔍 Loggar

Backend loggar syns i:
- Backend-terminalfönstret (om startat med `run-tests.ps1`)
- Console output (om startat manuellt med `python main.py`)

Firebase-data kan verifieras i:
- Firebase Console → Firestore → `users/{user_id}/moods`

---

## 💡 Tips

1. **Håll backend-fönstret öppet** under testerna
2. **Använd `run-tests.ps1`** för enklast workflow
3. **Kör `-QuickTest`** för snabb validering
4. **Kolla Firebase Console** för att se lagrad data
5. **Läs loggar** i backend-terminalen för debug-info

---

## 🆘 Support

Om problem kvarstår:
1. Kolla att Firebase credentials finns: `Backend/serviceAccountKey.json`
2. Verifiera att alla dependencies är installerade: `pip install -r requirements.txt`
3. Kolla att Python 3.11+ är installerat: `python --version`
4. Se till att port 5001 är ledig: `netstat -ano | findstr "5001"`

---

**Skapad:** 2025-10-20  
**Version:** 1.0
