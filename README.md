# Lugn & Trygg App

Lugn & Trygg är en röststyrd applikation för att logga humör, Kolla sparade humör, spela in och spela upp minnen samt spela avslappningsljud.

## Funktioner

- 📋 Humörloggning via röst
- 🎧 Inspelning och uppspelning av minnen
- 🎧 Lugnande ljud 

## Teknologier och Beroenden

- **Firebase Admin SDK**: För autentisering, Firestore och Storage.
- **Pyttsx3**: För text-till-tal-konvertering.
- **SpeechRecognition**: För taligenkänning.
- **Whisper**: OpenAI\:s system för automatisk taligenkänning.
- **Flask**: Mikro-webbramverk för API-hantering.
- **React/Electron**: Bygger applikationens UI.
- **Vite**: Snabb utvecklingsmiljö för React/Electron.
- **Firebase Client SDK**: Används i frontend för autentisering och datalagring.

För fullständig lista av beroenden, se `requirements.txt`.

## Installation & Konfiguration

1. **Klona detta repo** och gå in i projektmappen:

   ```bash
   git clone https://github.com/omar1u7777/Lugn-Trygg.git
   cd Lugn-Trygg
   ```

2. **Installera backend-beroenden:**

3. **Starta backend-servern:**

```bash
uvicorn main:app --reload
```

4. **Installera frontend-beroenden:**

```bash
cd frontend
npm install
npm run dev
```

## Testning

```bash
pytest
```

## CI/CD

GitHub Actions workflow `.github/workflows/ci.yml` kör linting och tester vid varje push.

## Licens

MIT

   ```bash
   pip install -r requirements.txt
   ```

3. **Installera frontend-beroenden:**

   ```bash
   cd frontend
   npm install
   ```

4. **Ställ in miljövariabler:**

   - Kopiera filen `.env.example` till `.env` i projektets rotmapp.
   - Fyll i dina egna värden för JWT- och Firebase-konfigurationen i `.env`.
   - Exempel på `.env`:
     ```env
     # JWT-konfiguration
     JWT_SECRET_KEY=din-jwt-hemlighet
     JWT_REFRESH_SECRET_KEY=din-refresh-hemlighet

     # Firebase
     FIREBASE_WEB_API_KEY=din-web-api-nyckel
     FIREBASE_CREDENTIALS=serviceAccountKey.json
     FIREBASE_API_KEY=din-client-api-nyckel
     FIREBASE_PROJECT_ID=din-project-id
     FIREBASE_STORAGE_BUCKET=din-storage-bucket

     # Övrigt
     PORT=5001
     FLASK_DEBUG=False
     ```

5. **Starta backend-servern (kör kommandot från projektets rotmapp):**

   ```bash
   python main.py
   ```

6. **Starta frontend-applikationen:**

   ```bash
   cd frontend
   npm run dev
   ```

## Sprintöversikt enligt JIRA-planen

### 📊 **Sprint 1: Användarhantering & Autentisering (Klar ✅)**

- Implementera inloggnings- och registreringssystem.
- Koppla applikationen till Firebase för autentisering.

### 📊 **Sprint 2: Humörloggning (Klar ✅)**

- Daglig humörloggning via röst.
- Spara humördata i Firestore.
- Lista sparade humör.
-  föreslå lugnande musik

### 📊 **Sprint 3: Inspelning & Uppspelning av Minnen ( klar ✅)**

- Röststyrd inspelning och lagring av minnen.
- Uppspelning av sparade minnen.

### 📊 **Sprint 4: Lugnande Ljud & Slutgiltiga Förbättringar (klart ✅)**

- Implementera avslappningsljud.
- Förbättra gränssnitt och användarupplevelse.

## Bidragsriktlinjer

1. **Skapa en ny branch för din funktionalitet:**
   ```bash
   git checkout -b feature/namn-på-funktion
   ```
2. **Gör dina ändringar och committa dem:**
   ```bash
   git commit -m "Beskrivning av ändring"
   ```
3. **Push din branch till GitHub:**
   ```bash
   git push origin feature/namn-på-funktion
   ```
4. **Skapa en Pull Request (PR) på GitHub.**

## Testinstruktioner

1. **Kör backend-tester:**
   ```bash
   python -m unittest discover tests/
   ```
2. **Kör frontend-tester:**
   ```bash
   cd frontend
   npm run test
   ```
3. **Verifiera funktionalitet för röstigenkänning och Firebase-integrering.**

## Kontakt

För frågor eller support, kontakta **[omaralhaek97@gmail.com](mailto\:omaralhaek97@gmail.com)**.

---

❤️ Projektet är utvecklat för utbildningsändamål och är en del av ett eleverprojekt.

