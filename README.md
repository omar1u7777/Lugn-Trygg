# Lugn & Trygg App

Lugn & Trygg är en röststyrd applikation för att logga humör, spela in och spela upp minnen samt spela avslappningsljud.

## Funktioner
- 📋 Humörloggning via röst
- 🎧 Inspelning och uppspelning av minnen
- 🎧 Lugnande ljud och avslappningsövningar

## Teknologier och Beroenden
- **Firebase Admin SDK**: För autentisering, Firestore och Storage.
- **Pyttsx3**: För text-till-tal-konvertering.
- **SpeechRecognition**: För taligenkänning.
- **Whisper**: OpenAI:s system för automatisk taligenkänning.
- **Flask**: Mikro-webbramverk för API-hantering.
- **React/Electron** – Bygger applikationens UI.
- **Vite** – Snabb utvecklingsmiljö för React/Electron.
- **Firebase Client SDK** – Används i frontend för autentisering och datalagring..
- För fullständig lista, se `requirements.txt`.

## Installation
1. **Klona detta repo:**
   ```bash
   git clone https://github.com/omar1u7777/Lugn-Trygg.git
   cd Lugn-Trygg
   ```

2. **Installera beroenden:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Ställ in miljövariabler:**
   - Skapa en `.env`-fil och inkludera dina Firebase-konfigurationsdetaljer.

4. **Kör applikationen:**
   ```bash
   python App.py
   ```

## Sprintöversikt enligt JIRA-planen

### 📊 **Sprint 1: Användarhantering & Autentisering**
- Implementera inloggnings- och registreringssystem.
- Koppla applikationen till Firebase för autentisering.

### 📊 **Sprint 2: Humörloggning**
- Daglig humörloggning via röst.
- Spara humördata i Firestore.

### 📊 **Sprint 3: Inspelning & Uppspelning av Minnen**
- Röststyrd inspelning och lagring av minnen.
- Uppspelning av sparade minnen.

### 📊 **Sprint 4: Lugnande Ljud & Slutgiltiga Förbättringar**
- Implementera avslappningsljud.
- Förbättra gränssnitt och användarupplevelse.

## Bidragsriktlinjer
1. **Skapa en branch:**
   ```bash
   git checkout -b feature/namn-på-funktion
   ```
2. **Gör ändringar och committa:**
   ```bash
   git commit -m "Beskrivning av ändring"
   ```
3. **Push till din branch:**
   ```bash
   git push origin feature/namn-på-funktion
   ```
4. **Skapa en Pull Request på GitHub.**

## Testinstruktioner
1. **Kör enskilda tester:**
   ```bash
   python -m unittest test.py
   ```
2. **Verifiera funktionalitet för röstigenkänning och Firebase-integrering.**

## Kontakt
För frågor eller support, kontakta **omaralhaek97@gmail.com**.

---
❤️ Projektet är utvecklat för utbildningsändamål och är en del av ett eleverprojekt.
