# 🎯 FEEDBACK SYSTEM - SNABBGUIDE

## Var Sparas Feedback? 

### ✅ KORT SVAR:
**Firebase Firestore Database → Collection: `feedback`**

---

## 📊 VISUELL ÖVERSIKT

```
┌─────────────────────────────────────────────────────────────────┐
│                      ANVÄNDAREN (Frontend)                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🖥️  FeedbackSystem.tsx                                  │  │
│  │                                                           │  │
│  │  [⭐⭐⭐⭐⭐] Betyg: 5 stjärnor                           │  │
│  │  ( ) General (•) Bug ( ) Feature ( ) UI                  │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │ "Fantastisk app! Men har hittat en bugg..."   │     │  │
│  │  │                                                │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  │                 [📤 Skicka Feedback]                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │ HTTP POST                        │
│                              ↓                                  │
└─────────────────────────────────────────────────────────────────┘

                              🌐 API
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND (http://localhost:5001)                    │
│                                                                 │
│  📁 Backend/src/routes/feedback_routes.py                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  @feedback_bp.route("/submit")                           │  │
│  │  def submit_feedback():                                  │  │
│  │      ✓ Validera data (rating 1-5, user_id finns)        │  │
│  │      ✓ Skapa dokument i Firestore                       │  │
│  │      ✓ Uppdatera användarstatistik                      │  │
│  │      ✓ Returnera success                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │ Firebase SDK                     │
│                              ↓                                  │
└─────────────────────────────────────────────────────────────────┘

                        🗄️ DATABAS
┌─────────────────────────────────────────────────────────────────┐
│           Firebase Firestore (Cloud Database)                   │
│                                                                 │
│  📁 Collection: "feedback"                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📄 Dokument ID: "abc123xyz" (auto-genererad)           │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  user_id:        "UID_från_firebase_auth"         │ │  │
│  │  │  rating:         5                                 │ │  │
│  │  │  category:       "bug"                             │ │  │
│  │  │  message:        "Fantastisk app! Men har..."     │ │  │
│  │  │  bug_report:     "När jag klickar på X händer Y"  │ │  │
│  │  │  status:         "pending"                         │ │  │
│  │  │  created_at:     "2025-10-20T19:30:00Z"          │ │  │
│  │  │  timestamp:      "2025-10-20T19:30:00Z"          │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📁 Collection: "users"                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📄 Dokument ID: "UID_från_firebase_auth"               │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  email:                "user@example.com"          │ │  │
│  │  │  feedback_submissions: 3      ← UPPDATERAS!        │ │  │
│  │  │  last_feedback_at:     "2025-10-20T..."           │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

                        👨‍💼 ADMIN
┌─────────────────────────────────────────────────────────────────┐
│              Admin Kan Hämta Feedback Via API                   │
│                                                                 │
│  GET /api/feedback/list?status=pending                         │
│  GET /api/feedback/stats                                       │
│                                                                 │
│  Eller direkt i Firebase Console:                              │
│  https://console.firebase.google.com/project/lugn-trygg-53d75  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 HUR HITTA FEEDBACK?

### Metod 1: Via Firebase Console (Rekommenderat)

1. Öppna: https://console.firebase.google.com/
2. Välj projekt: **lugn-trygg-53d75**
3. Gå till: **Firestore Database** (i sidomenyn)
4. Klicka på collection: **feedback**
5. Se alla dokument med användarfeedback!

### Metod 2: Via API (För Admin)

```bash
# Lista all pending feedback
curl http://localhost:5001/api/feedback/list?status=pending

# Få statistik
curl http://localhost:5001/api/feedback/stats
```

### Metod 3: Via Python (Backend)

```python
from src.firebase_config import db

# Hämta all feedback
feedback_docs = db.collection("feedback").stream()

for doc in feedback_docs:
    data = doc.to_dict()
    print(f"User: {data['user_id']}")
    print(f"Rating: {data['rating']} ⭐")
    print(f"Message: {data['message']}")
    print("-" * 50)
```

---

## 📦 DATA SOM SPARAS

| Fält | Typ | Beskrivning | Exempel |
|------|-----|-------------|---------|
| **user_id** | string | Firebase UID för användare | `"abc123xyz..."` |
| **rating** | number | 1-5 stjärnor | `5` |
| **category** | string | Typ av feedback | `"bug"` / `"feature"` / `"general"` / `"ui"` |
| **message** | string | Huvudbudskap | `"Fantastisk app!"` |
| **feature_request** | string | Önskad funktion (valfri) | `"Vill ha mörkt tema"` |
| **bug_report** | string | Buggbeskrivning (valfri) | `"Kraschar när..."` |
| **status** | string | Status för feedback | `"pending"` / `"reviewed"` / `"resolved"` |
| **created_at** | string (ISO) | När feedback skapades | `"2025-10-20T19:30:00Z"` |
| **timestamp** | string (ISO) | Tidsstämpel från klient | `"2025-10-20T19:30:00Z"` |

---

## 🎯 SNABBKOMMANDON

### Skicka Test-Feedback (PowerShell)

```powershell
$body = @{
    user_id = "test_user_123"
    rating = 5
    category = "general"
    message = "Test feedback!"
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json

Invoke-RestMethod -Method POST `
    -Uri "http://localhost:5001/api/feedback/submit" `
    -ContentType "application/json" `
    -Body $body
```

### Hämta Feedback (PowerShell)

```powershell
# Lista feedback
Invoke-RestMethod -Uri "http://localhost:5001/api/feedback/list?limit=10"

# Statistik
Invoke-RestMethod -Uri "http://localhost:5001/api/feedback/stats"
```

---

## 📂 FILSTRUKTUR

```
Lugn-Trygg/
│
├─ Backend/
│  └─ src/
│     └─ routes/
│        └─ feedback_routes.py  👈 API för feedback (submit, list, stats)
│
├─ frontend/
│  └─ src/
│     ├─ components/
│     │  ├─ Growth/
│     │  │  └─ FeedbackSystem.tsx  👈 Huvudkomponent för feedback
│     │  │
│     │  └─ Feedback/
│     │     └─ FeedbackForm.tsx    👈 Alternativ feedback-form
│     │
│     └─ App.tsx  👈 Route: /feedback
│
└─ Firebase Firestore (Cloud)
   └─ Collection: "feedback"  👈 HÄR SPARAS ALL FEEDBACK!
```

---

## ✅ CHECKLISTA FÖR ATT LÄSA FEEDBACK

- [ ] Öppna Firebase Console
- [ ] Välj projekt: lugn-trygg-53d75
- [ ] Gå till Firestore Database
- [ ] Öppna collection: "feedback"
- [ ] Läs feedback-dokument
- [ ] Uppdatera status till "reviewed" eller "resolved"

---

## 🚨 VIKTIGT ATT VETA

1. **Feedback sparas PERMANENT** i Firestore (tas inte bort automatiskt)
2. **User_id krävs** - annars avvisas feedback
3. **Rating måste vara 1-5** - annars fel
4. **Admin-behörighet krävs** för att läsa all feedback
5. **Användare kan endast läsa sin egen feedback** (security rules)

---

## 📊 EXEMPEL PÅ FEEDBACK I FIRESTORE

```json
{
  "abc123": {
    "user_id": "xyz789",
    "rating": 5,
    "category": "general",
    "message": "Älskar appen! Hjälper mig verkligen.",
    "status": "pending",
    "created_at": "2025-10-20T19:30:00Z"
  },
  "def456": {
    "user_id": "abc123",
    "rating": 2,
    "category": "bug",
    "message": "Kraschar ofta",
    "bug_report": "När jag öppnar Mood sidan kraschar appen",
    "status": "reviewed",
    "created_at": "2025-10-20T18:15:00Z"
  },
  "ghi789": {
    "user_id": "xyz789",
    "rating": 4,
    "category": "feature",
    "message": "Jag vill ha mörkt tema!",
    "feature_request": "Lägg till mörkt/ljust tema-växlare",
    "status": "resolved",
    "created_at": "2025-10-19T12:00:00Z"
  }
}
```

---

**🎯 SAMMANFATTNING:**

Feedback sparas i **Firebase Firestore** → Collection: `feedback`  
Åtkomst via **Firebase Console** eller **API endpoints**  
Både feedback och användarstatistik uppdateras automatiskt!

---

**📞 Support:**  
Se fullständig dokumentation: `FEEDBACK_SYSTEM_DOKUMENTATION.md`
