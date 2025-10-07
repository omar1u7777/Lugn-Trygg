# Lugn & Trygg - AI-driven Mental Health App

🧘 Lugn & Trygg är en modern webbapplikation för mental hälsa och välbefinnande, utrustad med AI-driven analys, röststyrd interaktion och omfattande välmående-verktyg.

## ✨ Funktioner

### 🤖 AI-driven Funktioner
- **AI Chatbot**: Terapeutisk konversation med krisdetektion och personliga råd
- **Humöranalys**: Avancerad mönsteranalys med AI-genererade insikter
- **Känsloigenkänning**: Automatisk analys av känslor från text och röst
- **Personliga Rekommendationer**: AI-baserade coping-strategier och välmående-tips

### 📊 Humörhantering
- **Röstbaserad Loggning**: Logga humör genom att prata naturligt
- **Veckovis Analys**: Detaljerade rapporter över humörmönster
- **Trendanalys**: Identifiera förbättringar eller utmaningar över tid
- **Känslofördelning**: Visualisering av humörfördelning

### 🎵 Välbefinnande-verktyg
- **Avslappningsljud**: Inbyggda ljud för meditation och avslappning
- **Minnesbank**: Spara och återuppleva positiva minnen
- **Röstinspelning**: Spela in personliga minnen och reflektioner

### 🔐 Säkerhet & Användarhantering
- **Firebase Autentisering**: Säker inloggning med e-post/lösenord och Google
- **JWT Tokens**: Säker API-kommunikation
- **Krypterad Lagring**: Alla data krypteras i Firestore

## 🛠 Teknologier och Beroenden

### Backend (Flask/Python)
- **Flask**: REST API med CORS-stöd
- **Firebase Admin SDK**: Autentisering, Firestore och Storage
- **Google Cloud AI**: Sentimentanalys och NLP
- **OpenAI API**: Avancerad AI-konversation (valfritt)
- **JWT**: Token-baserad autentisering

### Frontend (React/TypeScript)
- **React 18**: Moderna komponenter med hooks
- **TypeScript**: Typsäker utveckling
- **Vite**: Snabb bygg- och utvecklingsmiljö
- **Axios**: HTTP-klient för API-anrop
- **React Router**: Klient-sida routing
- **Firebase Client SDK**: Frontend-autentisering

### Databas & Lagring
- **Firestore**: NoSQL-databas för användardata
- **Firebase Storage**: Filuppladdning för ljudinspelningar
- **Firebase Auth**: Användarhantering

För fullständig lista av beroenden, se `requirements.txt` och `frontend/package.json`.

## 🚀 Installation & Konfiguration

### Förutsättningar
- **Python 3.8+** med pip
- **Node.js 16+** och npm
- **Firebase-projekt** med Firestore och Authentication aktiverat
- **Google Cloud Service Account** (för AI-funktioner)

### Steg-för-steg Installation

1. **Klona projektet:**
    ```bash
    git clone https://github.com/omar1u7777/Lugn-Trygg.git
    cd Lugn-Trygg
    ```

2. **Konfigurera Firebase:**
    - Skapa ett nytt Firebase-projekt på [Firebase Console](https://console.firebase.google.com)
    - Aktivera Authentication (Email/Password och Google provider)
    - Aktivera Firestore Database
    - Aktivera Storage
    - Ladda ner service account-nyckeln och döp om till `serviceAccountKey.json`

3. **Backend-konfiguration:**
    ```bash
    # Installera Python-beroenden
    pip install -r requirements.txt

    # Kopiera och konfigurera miljövariabler
    cp Backend/.env.example Backend/.env
    # Redigera Backend/.env med dina Firebase-inställningar
    ```

4. **Frontend-konfiguration:**
    ```bash
    cd frontend

    # Installera Node.js-beroenden
    npm install

    # Kopiera och konfigurera miljövariabler
    cp .env.example .env
    # Redigera .env med dina Firebase-inställningar
    ```

5. **Starta applikationen:**

    **Terminal 1 - Backend:**
    ```bash
    cd Backend
    python main.py
    ```
    Backend startar på `http://localhost:5001`

    **Terminal 2 - Frontend:**
    ```bash
    cd frontend
    npm run dev
    ```
    Frontend startar på `http://localhost:3000`

### 🔧 Miljövariabler

#### Backend (.env)
```env
# Flask
FLASK_DEBUG=True
PORT=5001

# Firebase
FIREBASE_CREDENTIALS=serviceAccountKey.json
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key

# JWT
JWT_SECRET_KEY=your-jwt-secret
JWT_REFRESH_SECRET_KEY=your-refresh-secret

# OpenAI (valfritt för avancerad AI)
OPENAI_API_KEY=your-openai-key

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

#### Frontend (.env)
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

## 📈 Projektstatus & Sprintöversikt

### ✅ **Sprint 1: Användarhantering & Autentisering (Klar)**
- Firebase-autentisering med e-post/lösenord och Google-inloggning
- JWT-token baserad säker API-kommunikation
- Säker användarregistrering med validering

### ✅ **Sprint 2: Humörloggning & AI-analys (Klar)**
- Röstbaserad humörloggning med sentimentanalys
- Realtids humörspårning och lagring i Firestore
- AI-driven mönsteranalys och trendidentifiering
- Veckovis rapporter med personliga insikter

### ✅ **Sprint 3: AI Chatbot & Krisstöd (Klar)**
- Terapeutisk AI-konversation med krisdetektion
- Automatisk känsloregistering och coping-strategier
- Säker krisintervention med professionella rekommendationer
- Konversationshistorik och sammanhangsbevarande dialog

### ✅ **Sprint 4: Minneshantering & Välbefinnande (Klar)**
- Röstinspelning och lagring av personliga minnen
- Avslappningsljud och meditationsverktyg
- Minnesbank för positiva upplevelser
- Omfattande välmående-dashboard

### 🚀 **Sprint 5: Avancerade Funktioner (Pågående)**
- OpenAI-integration för förbättrad AI-konversation
- Röstanalys för emotionell tillståndsbedömning
- Prediktiv analys av humörmönster
- Mobiloptimering och PWA-funktionalitet

## 🧪 Testning & Utveckling

### Testanvändare
Applikationen innehåller förkonfigurerade testanvändare för utveckling:
- **Erik Eriksson** (`erik.eriksson@test.se`) - Testdata för mönsteranalys
- **Anna Andersson** (`anna.andersson@test.se`) - Förbättrande humörmönster
- **Maria Pettersson** (`maria.pettersson@test.se`) - Variabla humörmönster

### Köra Tester
```bash
# Backend-tester
cd Backend
python -m pytest tests/

# Frontend-tester
cd frontend
npm run test

# Integrationstestning
cd Backend
python populate_test_data.py  # Lägger till testdata
```

## 📚 API-dokumentation

### Viktiga Endpoints
- `POST /api/auth/login` - Användarinloggning
- `POST /api/mood/log` - Logga humör
- `POST /api/chatbot/chat` - AI-konversation
- `POST /api/chatbot/analyze-patterns` - Mönsteranalys
- `GET /api/mood/weekly-analysis` - Veckovis rapport

Fullständig API-dokumentation finns i `Backend/docs/`.

## 🤝 Bidrag & Utveckling

### Bidragsriktlinjer
1. **Förka branch för nya funktioner:**
    ```bash
    git checkout -b feature/din-funktion
    ```
2. **Följ kodstandarder:**
    ```bash
    # Backend: Black för formattering
    # Frontend: ESLint och Prettier
    cd frontend && npm run lint
    ```
3. **Skriv tester för nya funktioner**
4. **Skapa Pull Request med detaljerad beskrivning**

### Utvecklingsmiljö
```bash
# Klona och setup
git clone https://github.com/omar1u7777/Lugn-Trygg.git
cd Lugn-Trygg

# Backend development
cd Backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python main.py

# Frontend development (nytt terminalfönster)
cd frontend
npm install
npm run dev
```

## 📞 Support & Kontakt

- **Projektägare**: Omar Alhaek
- **E-post**: [omaralhaek97@gmail.com](mailto:omaralhaek97@gmail.com)
- **GitHub**: [https://github.com/omar1u7777/Lugn-Trygg](https://github.com/omar1u7777/Lugn-Trygg)

## 📄 Licens & Användning

Detta projekt är utvecklat som en del av ett utbildningsprojekt för att demonstrera moderna webbutvecklings-tekniker och AI-integrering i mentalvårdsapplikationer.

### Viktig Information
- **Ej medicinsk rådgivning**: Denna applikation är ett verktyg för välbefinnande och ersätter inte professionell vård
- **Datasekretess**: All användardata krypteras och lagras säkert i Firebase
- **AI-genererat innehåll**: AI-rekommendationer är hjälpmedel, inte medicinska råd

---

🧘 **Lugn & Trygg** - För ett bättre mående genom teknik och empati.

