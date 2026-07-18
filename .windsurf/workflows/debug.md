---
description: Senior fullstack debugging of a specific system component
---

Debugga **$ARGUMENTS** som en senior fullstack-utvecklare.

## Steeg

1. **Läs all relevant kod** för $ARGUMENTS (frontend + backend + tester). Använd code_search, grep_search och read_file för att hitta och läsa alla berörda filer.

2. **Hitta root cause** — inte symptoms. Spåra felet baklänges från symptomet till källan. Om det är cross-stack (frontend↔backend), följ hela flödet: API call → route → middleware → service → database → response → frontend handler.

3. **Visa exakt vilka rader** som är problemet med `fil:rad`-referenser. Förklara kort varför det är fel.

4. **Fixa minimalt** — föredra 1-radskorrigeringar över omskrivningar. Gör ändringen med edit/multi_edit.

5. **Kör relevanta tester** för att verifiera fixen. Om tester inte finns, lägg till ett riktat regressionstest.

6. **Sammanfatta** vad som var fel, vad som ändrades, och varför det löser problemet.

## Regler

- Gissa inte utan att läsa koden först
- Skapa inte nya filer om inte absolut nödvändigt
- Ändra inget utanför $ARGUMENTS
- Radera eller försvaga aldrig existerande tester
- Föredra minimala upstream-fixar över downstream-workarounds
