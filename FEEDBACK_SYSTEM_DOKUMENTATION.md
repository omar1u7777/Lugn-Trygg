# 📝 Feedback System - Var Sparas Användarens Feedback?

**Uppdaterad**: 20 Oktober 2025

## 🎯 Översikt

Användares feedback sparas i **Firebase Firestore** databas under collection `feedback`.

## 📍 Var Sparas Feedback?

### Backend - Firebase Firestore

**Databas**: Firebase Firestore  
**Collection**: `feedback`  
**Dokument ID**: Auto-genererad unik ID

### Datastruktur i Firestore

Varje feedback sparas som ett dokument med följande struktur:

```javascript
{
  // Auto-genererad dokument-ID (t.ex. "abc123xyz")
  
  // Användarinformation
  "user_id": "UID_från_Firebase_Auth",
  
  // Betyg och kategori
  "rating": 5,                    // 1-5 stjärnor
  "category": "general",          // general, bug, feature, ui
  
  // Feedback-innehåll
  "message": "Jag älskar appen!",
  "feature_request": "...",       // Valfritt, om kategori = feature
  "bug_report": "...",            // Valfritt, om kategori = bug
  
  // Status och metadata
  "status": "pending",            // pending, reviewed, resolved
  "created_at": "2025-10-20T19:30:00Z",
  "timestamp": "2025-10-20T19:30:00Z"
}
```

## 🔄 Dataflöde

### 1. Användaren Skickar Feedback

**Frontend**: `frontend/src/components/Growth/FeedbackSystem.tsx`

```typescript
await api.post('/api/feedback/submit', {
  user_id: userId,
  rating: 5,
  category: 'general',
  message: 'Min feedback här...',
  timestamp: new Date().toISOString()
});
```

### 2. Backend Tar Emot och Sparar

**Backend**: `Backend/src/routes/feedback_routes.py`

```python
@feedback_bp.route("/submit", methods=["POST"])
def submit_feedback():
    # Tar emot feedback från frontend
    data = request.get_json()
    
    # Sparar i Firestore
    feedback_ref = db.collection("feedback").document()
    feedback_ref.set({
        "user_id": user_id,
        "rating": rating,
        "category": category,
        "message": message,
        # ... mer data
    })
    
    # Uppdaterar även användarens statistik
    user_ref.update({
        "feedback_submissions": feedback_count + 1,
        "last_feedback_at": datetime.now()
    })
```

### 3. Data Sparas i Firebase

**Firestore Console**: https://console.firebase.google.com/project/lugn-trygg-53d75/firestore

```
📁 Firestore Database
  └─ 📁 feedback (collection)
      ├─ 📄 abc123 (dokument)
      │   ├─ user_id: "xyz789"
      │   ├─ rating: 5
      │   ├─ category: "feature"
      │   ├─ message: "Vill ha mörkt tema"
      │   └─ created_at: "2025-10-20T..."
      │
      ├─ 📄 def456 (dokument)
      │   ├─ user_id: "abc123"
      │   ├─ rating: 4
      │   ├─ category: "bug"
      │   └─ ...
      │
      └─ ... (fler feedback-dokument)
```

## 📊 Hur Hämta Feedback (Admin)

### API Endpoints

#### 1. Lista All Feedback

```http
GET /api/feedback/list
Query Parameters:
  - status: all, pending, reviewed, resolved
  - category: all, general, bug, feature, ui
  - limit: antal resultat (default 50)
```

**Exempel**:
```bash
curl http://localhost:5001/api/feedback/list?status=pending&limit=20
```

#### 2. Feedback Statistik

```http
GET /api/feedback/stats
```

**Response**:
```json
{
  "total_feedback": 150,
  "average_rating": 4.5,
  "categories": {
    "general": 80,
    "bug": 30,
    "feature": 35,
    "ui": 5
  },
  "recent_count_30_days": 150
}
```

## 🗄️ Var Finns Filerna?

### Backend Kod

```
Backend/
├─ src/
│  └─ routes/
│     └─ feedback_routes.py    👈 API endpoints för feedback
│
└─ main.py                      👈 Registrerar feedback blueprint
```

### Frontend Kod

```
frontend/
└─ src/
   ├─ components/
   │  └─ Growth/
   │     └─ FeedbackSystem.tsx  👈 UI för att skicka feedback
   │
   ├─ components/
   │  └─ Feedback/
   │     └─ FeedbackForm.tsx    👈 Alternativ feedback-formulär
   │
   └─ App.tsx                   👈 Route: /feedback
```

## 🔐 Säkerhet och Åtkomst

### Vem Kan Skicka Feedback?

✅ **Alla inloggade användare** kan skicka feedback

### Vem Kan Läsa Feedback?

- 📖 **Användare**: Kan ENDAST skicka sin egen feedback
- 👨‍💼 **Admin**: Kan läsa ALL feedback via `/api/feedback/list`

### Firebase Security Rules (Bör Läggas Till)

**Rekommenderad**: Skapa `firestore.rules` fil:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Feedback collection
    match /feedback/{feedbackId} {
      // Användare kan skapa sin egen feedback
      allow create: if request.auth != null 
                    && request.resource.data.user_id == request.auth.uid;
      
      // Användare kan läsa sin egen feedback
      allow read: if request.auth != null 
                  && resource.data.user_id == request.auth.uid;
      
      // Endast admin kan läsa all feedback
      allow read: if request.auth != null 
                  && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      
      // Endast admin kan uppdatera status
      allow update: if request.auth != null 
                    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## 📈 Användarstatistik

När en användare skickar feedback uppdateras även deras användardata:

**Collection**: `users/{userId}`

```javascript
{
  "user_id": "xyz789",
  "email": "user@example.com",
  // ... annan användardata
  
  // Feedback-statistik
  "feedback_submissions": 3,           // Antal inskickade feedback
  "last_feedback_at": "2025-10-20T..." // Senaste feedback-datum
}
```

## 🧪 Testa Feedback-Systemet

### Via Frontend UI

1. Logga in i appen
2. Gå till `/feedback` eller använd FeedbackSystem-komponenten
3. Fyll i formuläret och skicka

### Via API (Postman/Curl)

```bash
# Skicka feedback
curl -X POST http://localhost:5001/api/feedback/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "user_id": "test_user_123",
    "rating": 5,
    "category": "general",
    "message": "Fantastisk app!",
    "timestamp": "2025-10-20T19:30:00Z"
  }'

# Lista feedback (admin)
curl http://localhost:5001/api/feedback/list?status=pending

# Statistik (admin)
curl http://localhost:5001/api/feedback/stats
```

### Via PowerShell Script

```powershell
# Kör test-scriptet
.\test-integrations-feedback.ps1
```

## 📊 Visa Feedback i Firebase Console

1. Gå till: https://console.firebase.google.com/
2. Välj projekt: `lugn-trygg-53d75`
3. Gå till: **Firestore Database**
4. Öppna collection: `feedback`
5. Se alla feedback-dokument

**Direct Link**: https://console.firebase.google.com/project/lugn-trygg-53d75/firestore/data/feedback

## 🔄 Feedback Livscykel

```
1. Användare Skickar
   ↓
2. Sparas i Firestore (status: "pending")
   ↓
3. Admin Granskar (via /api/feedback/list)
   ↓
4. Status Uppdateras till "reviewed"
   ↓
5. Åtgärd Tas
   ↓
6. Status Uppdateras till "resolved"
```

## 📝 Feedback Kategorier

- **general**: Allmän feedback om appen
- **bug**: Buggrapporter
- **feature**: Önskemål om nya funktioner
- **ui**: Kommentarer om användargränssnittet

## ⭐ Betygsystem

Användare kan ge betyg från **1-5 stjärnor**:

- ⭐ 1: Mycket missnöjd
- ⭐⭐ 2: Missnöjd
- ⭐⭐⭐ 3: Neutral
- ⭐⭐⭐⭐ 4: Nöjd
- ⭐⭐⭐⭐⭐ 5: Mycket nöjd

## 🎯 Användningsexempel

### Skicka Enkel Feedback

```typescript
<FeedbackSystem userId={currentUser.uid} />
```

### Feedback med Quick Tags

Användare kan klicka på fördefinierade taggar:
- "Easy to use"
- "Helpful insights"
- "Great design"
- "Bug found"
- "Feature request"
- etc.

## 📧 Notifikationer (Framtida)

**TODO**: Lägg till email-notifikationer till admin när:
- Ny feedback tas emot
- Kritisk buggrapport skickas (rating ≤ 2)
- Feature request med många röster

## 🔍 Söka i Feedback

För att hitta specifik feedback i Firestore:

```python
# Sök efter kategori
feedback = db.collection("feedback").where("category", "==", "bug").get()

# Sök efter användare
user_feedback = db.collection("feedback").where("user_id", "==", "xyz789").get()

# Sök efter betyg
low_ratings = db.collection("feedback").where("rating", "<=", 2).get()

# Sortera efter datum
recent = db.collection("feedback").order_by("created_at", direction="DESCENDING").limit(10).get()
```

## 🎨 UI Komponenter

### FeedbackSystem (Huvudkomponent)

**Fil**: `frontend/src/components/Growth/FeedbackSystem.tsx`

**Features**:
- ⭐ Betygssystem (1-5 stjärnor)
- 📝 Kategoriväljare (radio buttons)
- 🏷️ Quick tags (klickbara chips)
- 📄 Textfält för feedback
- 🐛 Specialfält för buggrapporter
- ✨ Specialfält för feature requests
- ✅ Success/error meddelanden

### FeedbackForm (Alternativ)

**Fil**: `frontend/src/components/Feedback/FeedbackForm.tsx`

Enklare variant av feedback-formulär.

## 🎓 Best Practices

1. **Validera Input**: Kolla alltid att rating är 1-5
2. **Anonymisera**: Spara aldrig känslig personlig info
3. **Rate Limiting**: Begränsa antal feedback per dag/användare
4. **Moderation**: Granska feedback regelbundet
5. **Respondera**: Svara på viktiga feedback (via email/in-app)

## 🚀 Framtida Förbättringar

- [ ] Email-notifikationer till admin
- [ ] In-app notifications för feedback-uppdateringar
- [ ] Voting system (användare röstar på feature requests)
- [ ] Feedback dashboard för admin
- [ ] Automatisk sentiment-analys (AI)
- [ ] Export till CSV/Excel
- [ ] Integration med support-ticket system

---

**Sammanfattning**: 
Feedback från användare sparas i **Firebase Firestore** under collection `feedback`. Varje feedback-dokument innehåller rating, kategori, meddelande och metadata. Admin kan hämta och granska feedback via API endpoints `/api/feedback/list` och `/api/feedback/stats`.
