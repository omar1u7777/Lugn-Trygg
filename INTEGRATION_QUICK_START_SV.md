# 🔗 Integration Page - Snabbguide för Google Health

## 📋 Innehållsförteckning
1. [Vad är Integration Page?](#vad-är-integration-page)
2. [Förutsättningar](#förutsättningar)
3. [Steg-för-steg Guide](#steg-för-steg-guide)
4. [Felsökning](#felsökning)
5. [Säkerhet](#säkerhet)

---

## Vad är Integration Page?

Integration Page är den plats där du kan **ansluta din riktiga hälsoutrustning och appar** för att få personaliserad hälsodata i Lugn & Trygg.

**Stödda plattformar:**
- 🏃 **Google Fit** - aktivitet, hjärtfrekvens, sömn
- 💪 **Fitbit** - wearables från Fitbit
- 📱 **Samsung Health** - Galaxy Watch, Galaxy Buds
- ⚖️ **Withings** - smarta vågar och armbandsklockor

---

## Förutsättningar

### För dig som användare
- ✅ Lugn & Trygg-konto
- ✅ Google/Fitbit/Samsung-konto
- ✅ Hälsodata sparad i din tjänst
- ✅ Internetanslutning

### För utvecklare/administratörer
- ✅ Backend körande (`http://localhost:5001`)
- ✅ Frontend körande (`http://localhost:3000`)
- ✅ Firebase konfigurerat
- ✅ Google Cloud-projekt skapat
- ✅ OAuth-kredentialer inställda i `.env`

---

## Steg-för-steg Guide

### 1️⃣ Gå till Integration Page

```
http://localhost:3000/integrations
```

Du ser denna skärm:
```
🔗 Health Integrations (OAuth)
Connect your health devices and apps to sync real data automatically

[Google Fit]  [Fitbit]  [Samsung]  [Withings]
```

---

### 2️⃣ Ansluta Google Fit (Exempel)

#### A. Klicka "🔗 Connect" på Google Fit-kortet

```
Du bör se:
- Ett fönster öppnas
- Google-inloggning
- Behörighetsbegäran
```

**Behörigheter som begärs:**
- ✓ Aktivitetsdata (steg, träning)
- ✓ Hjärtfrekvensdata
- ✓ Sömndata
- ✓ Kroppsmätvärden (vikt, längd)

#### B. Godkänn behörigheterna

```
Google frågar: "Vill du tillåta Lugn & Trygg att:"
- Läsa dina aktivitetsdata
- Läsa din hjärtfrekvensdata
- Läsa din sömndata

Klicka: [Godkänn]
```

#### C. Verifiering

```
Du omdirigeras tillbaka till appen.
Skärmen uppdateras automatiskt.

Google Fit-kortet visar nu:
✓ Connected
🔄 Sync Now
🔌 Disconnect
```

---

### 3️⃣ Synka dina data

#### Första synkningen

```
Klicka: [🔄 Sync Now]

Du ser:
- Laddningsindikator
- "⏳ Syncing..."

Efter ~3 sekunder:
✅ "Successfully synced data from google_fit!"

Visa data:
- Heart Rate: 72 bpm
- Steps: 8,534
- Sleep: 7.5 hours
- Calories: 2,145
```

#### Återkommande synkningar

```
✅ Automatisk synkning: Var 24:e timme
🔄 Manuell synkning: Klicka "Sync Now" när som helst
```

---

### 4️⃣ Visa din hälsodata

Din hälsodata visas på flera ställen:

#### Dashboard
```
🏠 Dashboard
├─ Daglig aktivitet
├─ Hjärtfrekvens
├─ Sömnkvalitet
└─ Trend-analys
```

#### Hälsoinsikter
```
📊 Insights
├─ Aktivitetstrend
├─ Sömnanalys
├─ Hjärthälsa
└─ Personliga rekommendationer
```

---

### 5️⃣ Koppla från (Om du vill)

```
Google Fit-kortet visar:
[🔌 Disconnect]

Klicka för att:
1. Återkalla åtkomsten
2. Ta bort tokens från Lugn & Trygg
3. Stoppa automatisk synkning

Status: Går tillbaka till "🔗 Connect"
```

---

## Felsökning

### Problem: "OAuth not configured"
```
❌ Felmeddelande: 
"OAuth not configured for google_fit"

✅ Lösning:
1. Kontrollera Backend/.env
2. Verifiera GOOGLE_FIT_CLIENT_ID och CLIENT_SECRET
3. Starta Backend om
```

### Problem: "Authorization denied"
```
❌ Du gjorde ett misstag under OAuth-flödet

✅ Lösning:
1. Klicka [🔗 Connect] igen
2. Se till att du godkänner alla behörigheter
3. Försök igen
```

### Problem: "Failed to sync data"
```
❌ Synkingen av data misslyckades

Möjliga orsaker:
1. Tokens löpta ut - lösning: Koppla från och anslut igen
2. Google Fit API nere - lösning: Försök senare
3. Ingen data tillgänglig - lösning: Aktivera din Google Fit

✅ Lösning:
1. Klicka [🔌 Disconnect]
2. Vänta 5 sekunder
3. Klicka [🔗 Connect] igen
```

### Problem: Ingen data visas
```
❌ Efter synkning visar det ingen data

Möjliga orsaker:
1. Google Fit har ingen data än - lösning: Aktivera din telefon
2. Behörigheter inte godkända - lösning: Anslut igen
3. Data är för gammal - lösning: Gör ny aktivitet

✅ Lösning:
1. Gå till Google Fit-appen på din telefon
2. Aktivera placeringen och aktivitetsspårning
3. Gör lite aktivitet (gå 10 minuter)
4. Vänta 5 minuter
5. Klicka "Sync Now" igen
```

---

## Säkerhet

### 🔐 Hur skyddas dina data?

**Tokens**
```
Din åtkomsttoken lagras:
✓ Krypterad i Firestore
✓ Aldrig i loggfiler
✓ Aldrig skickad till tredje part
```

**OAuth 2.0 säkerhet**
```
✓ CSRF-skydd med state-parameter
✓ Säker kanal (HTTPS)
✓ Möjlighet att återkalla åtkomst när som helst
```

**Behörigheter**
```
✓ Du godkänner endast det som behövs
✓ Du kan ändra behörigheter i Google-inställningar
✓ Du kan återkalla åtkomst när som helst
```

### 🛡️ Vad kan du göra?

**Maximera din säkerhet:**
```
1. Använd starkt lösenord för ditt Google-konto
2. Aktivera tvåfaktorsautentisering
3. Granska regelbundet dina anslutna appar
4. Koppla från om du inte använder appen längre
```

**Se dina anslutna appar i Google:**
```
https://myaccount.google.com/permissions
```

---

## Tips & Tricks

### 💡 Få mest ut av Integration Page

**Bästa praxis:**
```
1. Synka data varje dag för mest exakt data
2. Aktivera både Google Fit OCH Fitbit för mer data
3. Använd hälsoinsikterna för att förbättra din hälsa
4. Dela data med din terapeut/läkare vid behov
```

**Automatisk synkning:**
```
✓ Aktiverad per standard
✓ Körs var 24:e timme
✓ Du behöver inte göra något
✓ Kan stängas av om du vill
```

---

## Kontakt & Support

### Har du problem?

```
📧 support@lugntrygq.se
🐛 Bug report: https://github.com/...
💬 Chat support: I appen under Hjälp
```

### Användbara resurser

```
📚 Google Fit hjälp: https://support.google.com/fit
📚 Fitbit hjälp: https://help.fitbit.com/
📚 Samsung Health: https://support.samsung.com/
```

---

## FAQ

**F: Är mina data säkra?**  
S: Ja! Dina data är krypterad och lagras enligt GDPR.

**F: Kan jag ta bort mina data?**  
S: Ja, du kan ta bort allt genom att koppla från.

**F: Vad kostar det?**  
S: Gratis för alla prenumeranter på Lugn & Trygg.

**F: Kan jag ansluta flera enheter?**  
S: Ja, du kan ansluta Google Fit + Fitbit + Samsung samtidigt.

**F: Hur ofta uppdateras data?**  
S: Var 24:e timme automatiskt, eller manuellt när du klickar "Sync Now".

**F: Vad om jag glömmer mina behörigheter?**  
S: Du kan alltid gå till Google-inställningar och se vad du godkänt.

---

**Senast uppdaterad:** 2025-10-20  
**Version:** 1.0  
**Status:** ✅ Produktionsklar
