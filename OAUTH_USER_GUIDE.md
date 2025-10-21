# OAuth Health Integration - User Guide

**Language:** Swedish & English  
**Last Updated:** 2024  
**Version:** 2.0 (with real OAuth)

---

## 🇸🇪 Swedish Version

### Integrera din hälsodata - Så här gör du

#### ✨ Vad är nytt?
Vi har fixat integrationssidan så att den nu kopplar till **RIKTIGA** Google Health, Fitbit, Samsung Health och Withings-konton via säker OAuth. Inte simulerad data längre!

#### 🚀 Steg-för-steg guide

**Steg 1: Öppna Integrationssidan**
- Logga in på Lugn & Trygg
- Gå till **Inställningar → Integrationer**
- Du ser listor med olika hälsoappar

**Steg 2: Anslut en hälsoapp (exempel: Google Fit)**
- Klicka på "Anslut" knappen bredvid Google Fit
- Du skickas till **Googles inloggningssida** (RIKTIGT inloggning, inte formulär)
- Logga in med ditt Google-konto

**Steg 3: Ge tillåtelse**
- Google frågar om du tillåter Lugn & Trygg att läsa:
  - 🏃 Träningsaktiviteter
  - ❤️ Hjärtfrekvens
  - 😴 Sömndata
  - ⚖️ Kroppsvikt
- Klicka "Tillåt" för att ge tillåtelse

**Steg 4: Bekräftelse**
- Du skickas tillbaka till integrationssidan
- Du ser nu "✅ Ansluten till Google Fit"
- Dina OAuth-tokens sparas säkert i vår databas

**Steg 5: Synkronisera hälsodata**
- Klicka på "Synkronisera" knappen
- Lugn & Trygg hämtar din senaste hälsodata
- Du ser nu:
  - 🏃 Steg från din aktivitetstracker
  - ❤️ Hjärtfrekvens från din smartklocka
  - 😴 Sömndata från din enhet
  - 🔥 Brända kalorier

#### ✅ Så vet du att det fungerar
- Du ser **olika siffror varje dag** (inte samma 8500 steg varje gång)
- Värdena matchar det du ser i din hälsoapp
- Du kan klicka "Synkronisera" flera gånger och få ny data

#### ⚙️ Vilka appar kan jag ansluta?
- ✅ Google Fit
- ✅ Fitbit
- ✅ Samsung Health
- ✅ Withings
- Fler kommer snart

#### 🔒 Är detta säkert?
**Ja, helt säkert!**
- Vi använder OAuth 2.0 (samma teknologi som Google, Facebook m.m. använder)
- Vi får ALDRIG ditt lösenord
- Du kan när som helst återkalla tillgången i Google/Fitbit-inställningar
- Dina tokens krypteras i vår databas
- Vi läser ENDAST den data du tillåter oss

#### ❌ Vad gör jag om något inte fungerar?

**"Jag ser fortfarande fake data"**
- Uppdatera sidan: `Ctrl+Shift+R` (eller `Cmd+Shift+R` på Mac)
- Rensa cookies: `Ctrl+Shift+Delete`
- Logga ut och logga in igen

**"OAuth-popup visas inte"**
- Kontrollera att popup-blockerare är inaktiv
- Försök i en annan webbläsare
- Kontakta support@lungtrygg.se

**"Jag kan inte ge tillåtelse"**
- Säkerställ att du är inloggad i Google
- Kontrollera internet-anslutningen
- Försök senare om Google-servrarna är långsamma

#### 🔐 Hur tar jag bort en koppling?
1. Gå till Integrationssidan
2. Klicka "Koppla bort" knappen
3. Väl gjort! Tokens raderas från vår databas
4. Tillgången återkallas även i Google/Fitbit

#### 📊 Hur ofta uppdateras min hälsodata?
- **Manuell:** Klicka "Synkronisera" när som helst
- **Automatisk:** Vi kan ställa in automatisk synkning (säg till!)
- **Real-tid:** Google/Fitbit uppdaterar sin API ungefär en gång per timme

#### 💡 Tips
- Synkronisera efter träning för att få senaste värden
- Om något ser konstigt ut, synkronisera igen
- Granska dina OAuth-kopplingar i Google-inställningar (`myaccount.google.com`)

---

## 🇬🇧 English Version

### Integrate Your Health Data - Quick Guide

#### ✨ What's New?
We fixed the integration page to connect to **REAL** Google Health, Fitbit, Samsung Health, and Withings accounts via secure OAuth. No more simulated data!

#### 🚀 Step-by-Step Guide

**Step 1: Open Integration Page**
- Log in to Lugn & Trygg
- Go to **Settings → Integrations**
- You see lists with different health apps

**Step 2: Connect a Health App (Example: Google Fit)**
- Click the "Connect" button next to Google Fit
- You're redirected to **Google's login page** (REAL login, not a form)
- Log in with your Google account

**Step 3: Grant Permission**
- Google asks if you allow Lugn & Trygg to read:
  - 🏃 Training activities
  - ❤️ Heart rate
  - 😴 Sleep data
  - ⚖️ Body weight
- Click "Allow" to grant permission

**Step 4: Confirmation**
- You're redirected back to the integration page
- You see now "✅ Connected to Google Fit"
- Your OAuth tokens are stored securely in our database

**Step 5: Sync Health Data**
- Click the "Sync Data" button
- Lugn & Trygg fetches your latest health data
- You now see:
  - 🏃 Steps from your activity tracker
  - ❤️ Heart rate from your smartwatch
  - 😴 Sleep data from your device
  - 🔥 Calories burned

#### ✅ How to Know It's Working
- You see **different numbers every day** (not the same 8500 steps each time)
- Values match what you see in your health app
- You can click "Sync" multiple times and get new data

#### ⚙️ Which Apps Can I Connect?
- ✅ Google Fit
- ✅ Fitbit
- ✅ Samsung Health
- ✅ Withings
- More coming soon

#### 🔒 Is This Secure?
**Yes, completely safe!**
- We use OAuth 2.0 (the same technology Google, Facebook, etc. use)
- We NEVER get your password
- You can revoke access anytime in Google/Fitbit settings
- Your tokens are encrypted in our database
- We ONLY read data you allow us to

#### ❌ What If Something Doesn't Work?

**"I still see fake data"**
- Refresh page: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- Clear cookies: `Ctrl+Shift+Delete`
- Log out and log in again

**"OAuth popup doesn't appear"**
- Check if popup blocker is disabled
- Try in a different browser
- Contact support@lungtrygg.se

**"I can't grant permission"**
- Make sure you're logged in to Google
- Check your internet connection
- Try later if Google servers are slow

#### 🔐 How Do I Remove a Connection?
1. Go to Integration page
2. Click "Disconnect" button
3. Done! Tokens are deleted from our database
4. Access is also revoked in Google/Fitbit

#### 📊 How Often Is My Health Data Updated?
- **Manual:** Click "Sync" anytime
- **Automatic:** We can set up automatic syncing (let us know!)
- **Real-time:** Google/Fitbit updates their API about once per hour

#### 💡 Tips
- Sync after exercise to get latest values
- If something looks odd, sync again
- Review your OAuth connections in Google Settings (`myaccount.google.com`)

---

## 🆘 Troubleshooting

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| See fake data (8500 steps) | Old cache | Ctrl+Shift+R to hard refresh |
| OAuth popup blocked | Popup blocker enabled | Disable popup blocker |
| "Not connected" error | Token expired | Reconnect again |
| Data hasn't changed | Sync not run | Click Sync button manually |
| Can't see permissions screen | Logged out of Google | Log in to Google first |

### Contact Support
- Email: support@lungtrygg.se
- In-app chat: Available 9-17 CET
- FAQ: https://lungtrygg.se/help/integrations

---

## 📚 More Information

### How OAuth Works
1. You click "Connect"
2. You log in and grant permission to Google
3. Google gives us a secure token (NOT your password!)
4. We use this token to fetch your health data
5. You can revoke access anytime

### Data Storage
- Your health data is stored in our encrypted database
- Only you can see your data
- We use industry-standard security (AES-256 encryption)
- Your data is automatically deleted after 1 year (you can request sooner)

### Privacy
- We do NOT sell your data
- We do NOT share your data with third parties
- We use your data ONLY to show you your health insights
- You control what data we access (via OAuth scopes)

---

## 📱 Mobile App

The mobile app (iOS/Android) uses the same OAuth flow:
- Tap "Integrations" in settings
- Tap "Connect" for your health app
- Use your phone's browser for authentication
- Automatically synced on app launch

---

## 🎉 Enjoy Your Real Health Data!

You now have secure, real-time access to your actual health data. Combine it with Lugn & Trygg's mood tracking and AI analysis for complete wellness insights.

**Happy tracking!** 🚀

---

**Questions?** We're here to help!
- support@lungtrygg.se
- 📱 In-app chat
- 💬 Discord community: discord.gg/lungtrygg

