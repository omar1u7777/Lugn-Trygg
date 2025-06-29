# 🌿 Lugn & Trygg

**Lugn & Trygg** är en röststyrd applikation för att logga humör, spara och spela upp minnen samt spela avslappningsljud – utformad för att främja mental hälsa och reflektion i vardagen.

---

## 🚀 Funktioner

- 📋 Logga humör via röst
- 🎙️ Spela in och spela upp personliga minnen
- 🎧 Lyssna på avslappnande ljud
- 🔐 Autentisering med Firebase
- 📊 Swagger-dokumentation för alla API-endpoints

---

## 🧰 Teknologier & Beroenden

- **Backend**: Flask, Firebase Admin SDK, Whisper, Flasgger
- **Frontend**: React/Electron via Vite
- **CI/CD**: GitHub Actions
- **Övrigt**: Pyttsx3, SpeechRecognition, python-dotenv

> 📁 Se `requirements.txt` för komplett backend-beroenden.

---

## 🧪 Installation & Konfiguration

### 1. Klona repo
```bash
git clone https://github.com/omar1u7777/Lugn-Trygg.git
cd Lugn-Trygg
2. Installera backend
bash
Kopiera
Redigera
pip install -r requirements.txt
3. Installera frontend
bash
Kopiera
Redigera
cd frontend
npm install
4. Miljövariabler
Kopiera .env.example till .env och fyll i:

env
Kopiera
Redigera
JWT_SECRET_KEY=din-jwt-hemlighet
JWT_REFRESH_SECRET_KEY=din-refresh-hemlighet
FIREBASE_WEB_API_KEY=din-web-api-nyckel
FIREBASE_CREDENTIALS=serviceAccountKey.json
FIREBASE_API_KEY=din-client-api-nyckel
FIREBASE_PROJECT_ID=din-project-id
FIREBASE_STORAGE_BUCKET=din-storage-bucket
PORT=5001
FLASK_DEBUG=False
5. Starta backend
bash
Kopiera
Redigera
python main.py
6. Starta frontend
bash
Kopiera
Redigera
cd frontend
npm run dev
🔍 API-dokumentation (Swagger UI)
Swagger UI finns tillgänglig när backend körs på:

🌐 http://localhost:5001/apidocs

Här kan du:

Se och testa alla API-endpoints (register, login, mood-loggning, etc)

Skicka testdata och se svar direkt

Inspektera JSON-schema och statuskoder

🧪 Testinstruktioner
1. Kör backend-tester:
bash
Kopiera
Redigera
pytest
# eller
python -m unittest discover tests/
2. Kör frontend-tester:
bash
Kopiera
Redigera
cd frontend
npm run test
3. Verifiera funktionalitet för röstigenkänning och Firebase-integrering:
Starta backend och frontend enligt instruktionerna ovan

Gå till http://localhost:5001/apidocs

Testa att registrera en användare och logga humör med röst

🚦 CI/CD
GitHub Actions (.github/workflows/ci.yml) kör:

✅ Enhetstester

✅ Linting

✅ Automatisk validering vid varje push

📅 Sprintöversikt (enligt JIRA-planen)
Sprint	Funktion	Status
Sprint 1	Inloggning & Registrering	✅ Klar
Sprint 2	Humörloggning via röst	✅ Klar
Sprint 3	Inspelning & uppspelning av minnen	✅ Klar
Sprint 4	Lugnande ljud + UI-förbättringar	✅ Klar

🤝 Bidra
Skapa ny branch:

bash
Kopiera
Redigera
git checkout -b feature/namn-på-funktion
Lägg till ändringar:

bash
Kopiera
Redigera
git commit -m "Beskrivning av ändring"
Skicka till GitHub:

bash
Kopiera
Redigera
git push origin feature/namn-på-funktion
Skapa en Pull Request (PR)

📬 Kontakt
📧 omaralhaek97@gmail.com

❤️ Projektet är utvecklat för utbildningsändamål som en del av ett elevprojekt.