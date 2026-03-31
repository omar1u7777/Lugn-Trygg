const fs = require('fs');

// ─────────────────────────────────────────────
// BREATHING PHASES
// ─────────────────────────────────────────────
const breathingPhases = {
  sv: [
    { name: 'exhale',  duration: 2, instruction: 'Andas ut helt genom munnen...' },
    { name: 'inhale',  duration: 4, instruction: 'Andas in genom näsan...' },
    { name: 'hold',    duration: 7, instruction: 'Håll andan...' },
    { name: 'exhale2', duration: 8, instruction: 'Andas ut genom munnen...' }
  ],
  en: [
    { name: 'exhale',  duration: 2, instruction: 'Breathe out completely through your mouth...' },
    { name: 'inhale',  duration: 4, instruction: 'Breathe in through your nose...' },
    { name: 'hold',    duration: 7, instruction: 'Hold your breath...' },
    { name: 'exhale2', duration: 8, instruction: 'Breathe out through your mouth...' }
  ],
  no: [
    { name: 'exhale',  duration: 2, instruction: 'Pust helt ut gjennom munnen...' },
    { name: 'inhale',  duration: 4, instruction: 'Pust inn gjennom nesen...' },
    { name: 'hold',    duration: 7, instruction: 'Hold pusten...' },
    { name: 'exhale2', duration: 8, instruction: 'Pust ut gjennom munnen...' }
  ]
};

// ─────────────────────────────────────────────
// MUSCLE GROUPS
// ─────────────────────────────────────────────
const muscleGroups = {
  sv: [
    { name: 'Fötter',               instruction: 'Dra ihop tårna och spänn fotvalven...', image: '🦶', visual: 'Tänk dig att du drar ihop tårna som en näve och böjer foten uppåt' },
    { name: 'Vadmuskler',           instruction: 'Spänn vaderna...', image: '🦵', visual: 'Spänn musklerna på baksidan av benen, som när du går på tå' },
    { name: 'Lår',                  instruction: 'Spänn lårmusklerna...', image: '🦵', visual: 'Dra ihop framsidan av låren, som när du sparkar framåt' },
    { name: 'Mage',                 instruction: 'Spänn magmusklerna...', image: '🏃', visual: 'Dra in magen som för att skydda dig från ett slag' },
    { name: 'Bröst och axlar',      instruction: 'Spänn bröstet och dra upp axlarna...', image: '🫁', visual: 'Håll andan och spänn bröstkorgen, dra axlarna upp mot öronen' },
    { name: 'Armar',                instruction: 'Spänn överarmarna...', image: '💪', visual: 'Spänn biceps och triceps, gör armarna styva som träbitar' },
    { name: 'Underarmar och händer', instruction: 'Spänn underarmar och knyt nävarna...', image: '✋', visual: 'Knyt nävarna hårt och spänn underarmarnas muskler' },
    { name: 'Hals och nacke',       instruction: 'Spänn nacken och dra in hakan...', image: '🙆', visual: 'Tryck huvudet bakåt mot en kudde och spänn nackmusklerna' },
    { name: 'Ansikte',              instruction: 'Spänn ansiktsmusklerna...', image: '😊', visual: 'Knyt ihop ögonen, rynka pannan, spänn käkarna och läpparna' }
  ],
  en: [
    { name: 'Feet',                 instruction: 'Curl your toes and tense your arches...', image: '🦶', visual: 'Imagine curling your toes like a fist and bending your foot upward' },
    { name: 'Calves',               instruction: 'Tense your calves...', image: '🦵', visual: 'Tense the muscles at the back of your legs, like when you stand on your toes' },
    { name: 'Thighs',               instruction: 'Tense your thigh muscles...', image: '🦵', visual: 'Squeeze the front of your thighs, like when you kick forward' },
    { name: 'Abdomen',              instruction: 'Tense your abdominal muscles...', image: '🏃', visual: 'Pull your stomach in as if protecting yourself from a blow' },
    { name: 'Chest and shoulders',  instruction: 'Tense your chest and raise your shoulders...', image: '🫁', visual: 'Hold your breath and tense your chest, raise shoulders toward your ears' },
    { name: 'Arms',                 instruction: 'Tense your upper arms...', image: '💪', visual: 'Tense your biceps and triceps, make your arms stiff like wooden planks' },
    { name: 'Forearms and hands',   instruction: 'Tense your forearms and clench your fists...', image: '✋', visual: 'Clench your fists tightly and tense the muscles in your forearms' },
    { name: 'Neck and throat',      instruction: 'Tense your neck and pull in your chin...', image: '🙆', visual: 'Press your head back against a pillow and tense your neck muscles' },
    { name: 'Face',                 instruction: 'Tense your facial muscles...', image: '😊', visual: 'Squeeze your eyes shut, wrinkle your forehead, clench your jaw and lips' }
  ],
  no: [
    { name: 'Føtter',               instruction: 'Krøll tærne og spenn fotbuen...', image: '🦶', visual: 'Tenk deg at du krøller tærne som en neve og bøyer foten oppover' },
    { name: 'Legger',               instruction: 'Spenn leggmusklene...', image: '🦵', visual: 'Spenn musklene på baksiden av beina, som når du går på tå' },
    { name: 'Lår',                  instruction: 'Spenn lårets muskler...', image: '🦵', visual: 'Klem forsiden av lårene, som når du sparker fremover' },
    { name: 'Mage',                 instruction: 'Spenn magemusklene...', image: '🏃', visual: 'Trekk inn magen som for å beskytte deg mot et slag' },
    { name: 'Bryst og skuldre',     instruction: 'Spenn brystet og trekk opp skuldrene...', image: '🫁', visual: 'Hold pusten og spenn brystkassen, trekk skuldrene opp mot ørene' },
    { name: 'Armer',                instruction: 'Spenn overarmene...', image: '💪', visual: 'Spenn biceps og triceps, gjør armene stive som trebiter' },
    { name: 'Underarmer og hender', instruction: 'Spenn underarmene og knytt nevene...', image: '✋', visual: 'Knyt nevene hardt og spenn musklene i underarmene' },
    { name: 'Hals og nakke',        instruction: 'Spenn nakken og trekk inn haken...', image: '🙆', visual: 'Trykk hodet bakover mot en pute og spenn nakkemusklene' },
    { name: 'Ansikt',               instruction: 'Spenn ansiktsmusklene...', image: '😊', visual: 'Klem øynene igjen, rynk pannen, stram kjevene og leppene' }
  ]
};

// ─────────────────────────────────────────────
// RECOMMENDATIONS POOL – titles, descriptions, categories
// ─────────────────────────────────────────────
const recPool = {
  sv: {
    'stress-1': { title: '4-7-8 Andningsövning', description: 'Dr. Andrew Weils vetenskapligt beprövade metod för ångest och sömn', category: 'Stresshantering', content: 'Tekniken aktiverar det parasympatiska nervsystemet och sänker kortisolnivåer med upp till 30%.' },
    'stress-2': { title: 'KBT-övning: Hantera Stressiga Tankar', description: 'Identifiera och utmana stresstankemönster', category: 'KBT', content: 'Lär dig att känna igen stress-triggers och hur du kan hantera dem bättre.' },
    'stress-3': { title: 'Progressiv Muskelavslappning', description: 'Minska fysisk spänning från stress', category: 'Avslappning', content: '15 minuters guidad övning för att släppa spänningar i kroppen.' },
    'sleep-1': { title: 'Vetenskapen Bakom Bättre Sömn', description: 'Förstå hur du förbättrar din sömnkvalitet', category: 'Utbildning', content: 'Lär dig vetenskapligt beprövade metoder för bättre sömn.' },
    'sleep-2': { title: 'Sömnmeditation: Body Scan', description: '20 minuters guidad meditation för djupare sömn', category: 'Sömn', content: 'En body scan-meditation speciellt designad för sömnproblem.' },
    'sleep-3': { title: '7-Dagars Sömnrutin', description: 'Bygg en konsekvent sömnrutin', category: 'Utmaningar', content: 'Etablera hälsosamma sömnvanor över en vecka.' },
    'focus-1': { title: 'Pomodoro-teknik för Bättre Fokus', description: 'Vetenskapligt beprövad tidsstyrningsteknik för optimal produktivitet', category: 'Produktivitet', content: 'Pomodoro-tekniken utnyttjar naturliga 90-120 minuters cykler av hög och låg prestationsförmåga.' },
    'focus-2': { title: 'Mindfulness för Fokus', description: 'Vetenskapligt beprövad MBSR-meditation för förbättrad koncentration', category: 'Fokus', content: 'Denna guidade mindfulness-meditation bygger på MBSR-programmet av Dr. Jon Kabat-Zinn.' },
    'focus-3': { title: 'Neurovetenskap: Så Fungerar Fokus', description: 'Djupgående förståelse av hjärnans uppmärksamhetssystem', category: 'Utbildning', content: 'Artikel om neurovetenskapliga mekanismer bakom uppmärksamhet och koncentration.' },
    'clarity-1': { title: 'Clarity Meditation', description: 'Rensa tankarna och öka mental klarhet', category: 'Meditation', content: '15 minuters meditation för mental klarhet.' },
    'clarity-2': { title: 'Journaling för Mental Klarhet', description: 'Skriv dig till klarare tankar', category: 'Journaling', content: 'Strukturerad journaling-metod för att organisera tankar.' },
    'clarity-3': { title: 'Digital Detox för Mental Klarhet', description: '3-dagars utmaning för klarare sinne', category: 'Utmaningar', content: 'Minska skärmtid för ökad mental klarhet.' },
    'mindfulness-1': { title: 'Mindfulness för Nybörjare', description: 'Lär dig grunderna i mindfulness på 10 minuter', category: 'Meditation', content: 'En guidad introduktion till mindfulness-meditation.' },
    'mindfulness-2': { title: 'Body Scan Meditation', description: 'Skanna igenom kroppen för djup avslappning', category: 'Meditation', content: 'En 20-minuters body scan för att släppa spänningar och stress.' },
    'mindfulness-3': { title: '5-4-3-2-1 Sinnesövning', description: 'Grounding-teknik för ångest och stress', category: 'Ångesthantering', content: 'Använd dina sinnen för att återvända till nuet.' },
    'sleep-4': { title: 'Sömnberedelse Ritual', description: 'Förbered dig för djup sömn med guidad avslappning', category: 'Sömn', content: 'En 15-minuters ritual som hjälper dig varva ner och förbereda för sömn.' },
    'sleep-5': { title: 'Skärmtid och Sömn', description: 'Hur blått ljus påverkar din sömnkvalitet', category: 'Utbildning', content: 'Vetenskaplig översikt över hur skärmtid påverkar melatoninproduktion.' },
    'social-1': { title: 'Kommunikation i Relationer', description: 'Förbättra dina kommunikationsfärdigheter', category: 'Relationer', content: 'Lär dig aktiv lyssning och assertiv kommunikation.' },
    'social-2': { title: 'Daglig Känsla-delning', description: 'Dela dina känslor med någon du litar på', category: 'Relationer', content: 'Öva på att uttrycka känslor öppet och ärligt varje dag i en vecka.' },
    'work-1': { title: 'Arbetsplats Stresshantering', description: 'Hantera stress på jobbet effektivt', category: 'Arbetsliv', content: 'Strategier för att hantera deadlines, konflikter och arbetsbelastning.' },
    'work-2': { title: 'Fokus Meditation för Arbete', description: 'Öka koncentrationen och produktiviteten', category: 'Arbetsliv', content: 'En meditation designad för att förbättra fokus och arbetsförmåga.' },
    'advanced-1': { title: 'Kognitiv Omstrukturering', description: 'Avancerad KBT-teknik för tankemönster', category: 'Avancerad KBT', content: 'Lär dig identifiera och omstrukturera djupgående negativa tankemönster.' },
    'advanced-2': { title: 'Vipassana Meditation', description: 'Djup mindfulness-praktik för erfarna utövare', category: 'Avancerad Meditation', content: 'Traditionell vipassana-teknik för medvetenhet och insikt.' },
    'generic-1': { title: '7-Dagars Tacksamhetsutmaning', description: 'Utveckla en mer positiv syn genom daglig tacksamhet', category: 'Allmänt', content: 'Skriv ner tre saker du är tacksam för varje dag i en vecka.' },
    'generic-2': { title: 'Mental Hälsa 101', description: 'Grundläggande kunskaper om mental hälsa', category: 'Utbildning', content: 'En översikt över viktiga begrepp inom mental hälsa och välbefinnande.' }
  },
  en: {
    'stress-1': { title: '4-7-8 Breathing Exercise', description: 'Dr. Andrew Weil\'s scientifically proven method for anxiety and sleep', category: 'Stress management', content: 'This technique activates the parasympathetic nervous system and lowers cortisol levels by up to 30%.' },
    'stress-2': { title: 'CBT Exercise: Managing Stressful Thoughts', description: 'Identify and challenge stress thought patterns', category: 'CBT', content: 'Learn to recognize stress triggers and how to manage them better.' },
    'stress-3': { title: 'Progressive Muscle Relaxation', description: 'Reduce physical tension from stress', category: 'Relaxation', content: '15-minute guided exercise to release tension in your body.' },
    'sleep-1': { title: 'The Science Behind Better Sleep', description: 'Understand how to improve your sleep quality', category: 'Education', content: 'Learn scientifically proven methods for better sleep.' },
    'sleep-2': { title: 'Sleep Meditation: Body Scan', description: '20-minute guided meditation for deeper sleep', category: 'Sleep', content: 'A body scan meditation specially designed for sleep problems.' },
    'sleep-3': { title: '7-Day Sleep Routine', description: 'Build a consistent sleep routine', category: 'Challenges', content: 'Establish healthy sleep habits over a week.' },
    'focus-1': { title: 'Pomodoro Technique for Better Focus', description: 'Scientifically proven time management technique for optimal productivity', category: 'Productivity', content: 'The Pomodoro technique leverages natural 90-120 minute cycles of high and low performance.' },
    'focus-2': { title: 'Mindfulness for Focus', description: 'Scientifically proven MBSR meditation for improved concentration', category: 'Focus', content: 'This guided mindfulness meditation is based on the MBSR program by Dr. Jon Kabat-Zinn.' },
    'focus-3': { title: 'Neuroscience: How Focus Works', description: 'In-depth understanding of the brain\'s attention system', category: 'Education', content: 'Article on neuroscientific mechanisms behind attention and concentration.' },
    'clarity-1': { title: 'Clarity Meditation', description: 'Clear your mind and increase mental clarity', category: 'Meditation', content: '15-minute meditation for mental clarity.' },
    'clarity-2': { title: 'Journaling for Mental Clarity', description: 'Write your way to clearer thinking', category: 'Journaling', content: 'Structured journaling method to organize your thoughts.' },
    'clarity-3': { title: 'Digital Detox for Mental Clarity', description: '3-day challenge for a clearer mind', category: 'Challenges', content: 'Reduce screen time for increased mental clarity.' },
    'mindfulness-1': { title: 'Mindfulness for Beginners', description: 'Learn the basics of mindfulness in 10 minutes', category: 'Meditation', content: 'A guided introduction to mindfulness meditation.' },
    'mindfulness-2': { title: 'Body Scan Meditation', description: 'Scan through your body for deep relaxation', category: 'Meditation', content: 'A 20-minute body scan to release tension and stress.' },
    'mindfulness-3': { title: '5-4-3-2-1 Senses Exercise', description: 'Grounding technique for anxiety and stress', category: 'Anxiety management', content: 'Use your senses to return to the present moment.' },
    'sleep-4': { title: 'Sleep Preparation Ritual', description: 'Prepare for deep sleep with guided relaxation', category: 'Sleep', content: 'A 15-minute ritual to help you wind down and prepare for sleep.' },
    'sleep-5': { title: 'Screen Time and Sleep', description: 'How blue light affects your sleep quality', category: 'Education', content: 'Scientific overview of how screen time affects melatonin production.' },
    'social-1': { title: 'Communication in Relationships', description: 'Improve your communication skills', category: 'Relationships', content: 'Learn active listening and assertive communication.' },
    'social-2': { title: 'Daily Feeling Sharing', description: 'Share your feelings with someone you trust', category: 'Relationships', content: 'Practice expressing feelings openly and honestly every day for a week.' },
    'work-1': { title: 'Workplace Stress Management', description: 'Manage stress at work effectively', category: 'Work life', content: 'Strategies for handling deadlines, conflicts and workload.' },
    'work-2': { title: 'Focus Meditation for Work', description: 'Increase concentration and productivity', category: 'Work life', content: 'A meditation designed to improve focus and work performance.' },
    'advanced-1': { title: 'Cognitive Restructuring', description: 'Advanced CBT technique for thought patterns', category: 'Advanced CBT', content: 'Learn to identify and restructure deep negative thought patterns.' },
    'advanced-2': { title: 'Vipassana Meditation', description: 'Deep mindfulness practice for experienced practitioners', category: 'Advanced Meditation', content: 'Traditional vipassana technique for awareness and insight.' },
    'generic-1': { title: '7-Day Gratitude Challenge', description: 'Develop a more positive outlook through daily gratitude', category: 'General', content: 'Write down three things you are grateful for every day for a week.' },
    'generic-2': { title: 'Mental Health 101', description: 'Basic knowledge about mental health', category: 'Education', content: 'An overview of important concepts in mental health and wellbeing.' }
  },
  no: {
    'stress-1': { title: '4-7-8 Pusteøvelse', description: 'Dr. Andrew Weils vitenskapelig beprøvde metode for angst og søvn', category: 'Stressmestring', content: 'Denne teknikken aktiverer det parasympatiske nervesystemet og senker kortisolnivåer med opp til 30%.' },
    'stress-2': { title: 'KAT-øvelse: Håndtere Stressende Tanker', description: 'Identifiser og utfordre stressede tankemønstre', category: 'KAT', content: 'Lær å gjenkjenne stress-triggere og hvordan du kan håndtere dem bedre.' },
    'stress-3': { title: 'Progressiv Muskelavslapning', description: 'Reduser fysisk spenning fra stress', category: 'Avslapning', content: '15 minutters veiledet øvelse for å slippe spenninger i kroppen.' },
    'sleep-1': { title: 'Vitenskapen Bak Bedre Søvn', description: 'Forstå hvordan du forbedrer søvnkvaliteten din', category: 'Utdanning', content: 'Lær vitenskapelig beprøvde metoder for bedre søvn.' },
    'sleep-2': { title: 'Søvnmeditasjon: Body Scan', description: '20 minutters veiledet meditasjon for dypere søvn', category: 'Søvn', content: 'En body scan-meditasjon spesielt designet for søvnproblemer.' },
    'sleep-3': { title: '7-Dagers Søvnrutine', description: 'Bygg en konsekvent søvnrutine', category: 'Utfordringer', content: 'Etabler sunne søvnvaner over en uke.' },
    'focus-1': { title: 'Pomodoro-teknikk for Bedre Fokus', description: 'Vitenskapelig beprøvd tidsstyringsteknikk for optimal produktivitet', category: 'Produktivitet', content: 'Pomodoro-teknikken utnytter naturlige 90-120 minutters sykluser av høy og lav ytelse.' },
    'focus-2': { title: 'Mindfulness for Fokus', description: 'Vitenskapelig beprøvd MBSR-meditasjon for forbedret konsentrasjon', category: 'Fokus', content: 'Denne veiledede mindfulness-meditasjonen er basert på MBSR-programmet av Dr. Jon Kabat-Zinn.' },
    'focus-3': { title: 'Nevrovitenskap: Slik Fungerer Fokus', description: 'Dybdeforståelse av hjernens oppmerksomhetssystem', category: 'Utdanning', content: 'Artikkel om nevrovitenskapelige mekanismer bak oppmerksomhet og konsentrasjon.' },
    'clarity-1': { title: 'Klarhet-Meditasjon', description: 'Rydd tankene og øk mental klarhet', category: 'Meditasjon', content: '15 minutters meditasjon for mental klarhet.' },
    'clarity-2': { title: 'Journaling for Mental Klarhet', description: 'Skriv deg til klarere tanker', category: 'Journaling', content: 'Strukturert journaling-metode for å organisere tanker.' },
    'clarity-3': { title: 'Digital Detox for Mental Klarhet', description: '3-dagers utfordring for et klarere sinn', category: 'Utfordringer', content: 'Reduser skjermtid for økt mental klarhet.' },
    'mindfulness-1': { title: 'Mindfulness for Nybegynnere', description: 'Lær grunnleggende mindfulness på 10 minutter', category: 'Meditasjon', content: 'En veiledet introduksjon til mindfulness-meditasjon.' },
    'mindfulness-2': { title: 'Body Scan Meditasjon', description: 'Skann gjennom kroppen for dyp avslapning', category: 'Meditasjon', content: 'En 20-minutters body scan for å slippe spenninger og stress.' },
    'mindfulness-3': { title: '5-4-3-2-1 Sansøvelse', description: 'Grounding-teknikk for angst og stress', category: 'Angstmestring', content: 'Bruk sansene dine for å returnere til nåtiden.' },
    'sleep-4': { title: 'Søvnforberedelsesritual', description: 'Forbered deg for dyp søvn med veiledet avslapning', category: 'Søvn', content: 'Et 15-minutters ritual som hjelper deg å roe ned og forberede deg for søvn.' },
    'sleep-5': { title: 'Skjermtid og Søvn', description: 'Hvordan blått lys påvirker søvnkvaliteten din', category: 'Utdanning', content: 'Vitenskapelig oversikt over hvordan skjermtid påvirker melatoninproduksjon.' },
    'social-1': { title: 'Kommunikasjon i Relasjoner', description: 'Forbedre kommunikasjonsferdighetene dine', category: 'Relasjoner', content: 'Lær aktiv lytting og assertiv kommunikasjon.' },
    'social-2': { title: 'Daglig Følelsesdeling', description: 'Del følelsene dine med noen du stoler på', category: 'Relasjoner', content: 'Øv på å uttrykke følelser åpent og ærlig hver dag i en uke.' },
    'work-1': { title: 'Arbeidsplass Stressmestring', description: 'Håndter stress på jobben effektivt', category: 'Arbeidsliv', content: 'Strategier for å håndtere frister, konflikter og arbeidsbelastning.' },
    'work-2': { title: 'Fokus Meditasjon for Arbeid', description: 'Øk konsentrasjonen og produktiviteten', category: 'Arbeidsliv', content: 'En meditasjon designet for å forbedre fokus og arbeidsevne.' },
    'advanced-1': { title: 'Kognitiv Omstrukturering', description: 'Avansert KAT-teknikk for tankemønstre', category: 'Avansert KAT', content: 'Lær å identifisere og omstrukturere dype negative tankemønstre.' },
    'advanced-2': { title: 'Vipassana Meditasjon', description: 'Dyp mindfulness-praksis for erfarne utøvere', category: 'Avansert Meditasjon', content: 'Tradisjonell vipassana-teknikk for bevissthet og innsikt.' },
    'generic-1': { title: '7-Dagers Takknemlighetsutfordring', description: 'Utvikle et mer positivt syn gjennom daglig takknemlighet', category: 'Generelt', content: 'Skriv ned tre ting du er takknemlig for hver dag i en uke.' },
    'generic-2': { title: 'Mental Helse 101', description: 'Grunnleggende kunnskap om mental helse', category: 'Utdanning', content: 'En oversikt over viktige begreper innen mental helse og velvære.' }
  }
};

// ─────────────────────────────────────────────
// WRITE TO JSON FILES
// ─────────────────────────────────────────────
['sv', 'en', 'no'].forEach(l => {
  const p = 'src/i18n/locales/' + l + '.json';
  const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  obj.breathingPhases = breathingPhases[l];
  obj.muscleGroups = muscleGroups[l];
  obj.recommendationsPool = recPool[l];
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  console.log(l + ': breathingPhases + muscleGroups + recommendationsPool added');
});

// Validate
['sv', 'en', 'no'].forEach(l => {
  try { JSON.parse(fs.readFileSync('src/i18n/locales/' + l + '.json', 'utf8')); console.log(l + ': VALID'); }
  catch(e) { console.log(l + ': INVALID ' + e.message); }
});
