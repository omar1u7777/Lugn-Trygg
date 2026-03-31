import { Recommendation, BreathingPhaseConfig, KBTPhaseName } from '../types/recommendation';

export const KBT_PHASES: KBTPhaseName[] = ['identify', 'challenge', 'replace', 'practice', 'complete'];

export const BREATHING_PHASES: BreathingPhaseConfig[] = [
    { name: 'exhale', duration: 2, instruction: 'Andas ut helt genom munnen...' },
    { name: 'inhale', duration: 4, instruction: 'Andas in genom näsan...' },
    { name: 'hold', duration: 7, instruction: 'Håll andan...' },
    { name: 'exhale2', duration: 8, instruction: 'Andas ut genom munnen...' }
];

export const getBreathingPhases = (t: (key: string) => unknown): BreathingPhaseConfig[] => {
  const phases = t('breathingPhases') as BreathingPhaseConfig[] | undefined;
  if (Array.isArray(phases) && phases.length > 0) return phases;
  return BREATHING_PHASES;
};

export const muscleGroups = [
    {
        name: 'Fötter',
        instruction: 'Dra ihop tårna och spänn fotvalven...',
        image: '🦶',
        visual: 'Tänk dig att du drar ihop tårna som en näve och böjer foten uppåt'
    },
    {
        name: 'Vadmuskler',
        instruction: 'Spänn vaderna...',
        image: '🦵',
        visual: 'Spänn musklerna på baksidan av benen, som när du går på tå'
    },
    {
        name: 'Lår',
        instruction: 'Spänn lårmusklerna...',
        image: '🦵',
        visual: 'Dra ihop framsidan av låren, som när du sparkar framåt'
    },
    {
        name: 'Mage',
        instruction: 'Spänn magmusklerna...',
        image: '🏃',
        visual: 'Dra in magen som för att skydda dig från ett slag'
    },
    {
        name: 'Bröst och axlar',
        instruction: 'Spänn bröstet och dra upp axlarna...',
        image: '🫁',
        visual: 'Håll andan och spänn bröstkorgen, dra axlarna upp mot öronen'
    },
    {
        name: 'Armar',
        instruction: 'Spänn överarmarna...',
        image: '💪',
        visual: 'Spänn biceps och triceps, gör armarna styva som träbitar'
    },
    {
        name: 'Underarmar och händer',
        instruction: 'Spänn underarmar och knyt nävarna...',
        image: '✋',
        visual: 'Knyt nävarna hårt och spänn underarmarnas muskler'
    },
    {
        name: 'Hals och nacke',
        instruction: 'Spänn nacken och dra in hakan...',
        image: '🙆',
        visual: 'Tryck huvudet bakåt mot en kudde och spänn nackmusklerna'
    },
    {
        name: 'Ansikte',
        instruction: 'Spänn ansiktsmusklerna...',
        image: '😊',
        visual: 'Knyt ihop ögonen, rynka pannan, spänn käkarna och läpparna'
    }
];

export const getMuscleGroups = (t: (key: string) => unknown) => {
  const groups = t('muscleGroups') as typeof muscleGroups | undefined;
  if (Array.isArray(groups) && groups.length > 0) return groups;
  return muscleGroups;
};

export const neuroscienceArticleSections = [
    {
        title: "Introduktion till Fokusering",
        content: `
      <p>Fokusering är hjärnans förmåga att rikta uppmärksamheten mot specifika stimuli medan andra ignoreras. Denna process är avgörande för inlärning, problemlösning och dagliga aktiviteter.</p>

      <h3>Hjärnans Nätverk för Fokusering</h3>
      <p>Hjärnan använder flera nätverk för att upprätthålla fokus:</p>
      <ul>
        <li><strong>Dorsala uppmärksamhetsnätverket (DAN):</strong> Ansvarar för att rikta uppmärksamheten mot specifika platser i det visuella fältet</li>
        <li><strong>Ventrala uppmärksamhetsnätverket (VAN):</strong> Detekterar oväntade stimuli och omdirigerar uppmärksamheten vid behov</li>
        <li><strong>Default Mode Network (DMN):</strong> Aktivt när vi dagdrömmer eller tänker på oss själva</li>
      </ul>

      <h3>Vetenskapliga Grunder</h3>
      <p>Neurovetenskapliga studier visar att fokusering kräver koordinerad aktivitet i flera hjärnregioner. En studie från Stanford University (2010) visade att kronisk distraktion leder till minskad grå substans i områden ansvariga för kognitiv kontroll.</p>

      <div class="highlight-box">
        <strong>🧠 Nyckelfaktum:</strong> Hjärnan kan endast fokusera på en komplex uppgift åt gången. Vad vi kallar "multitasking" är egentligen snabbt task-switching.
      </div>
    `
    },
    {
        title: "Neurotransmittorer och Fokusering",
        content: `
      <h3>Dopamin: Motivationssignal</h3>
      <p>Dopamin spelar en central roll i fokus och motivation. När vi fokuserar på ett mål frigör hjärnan dopamin, vilket skapar en belöningskänsla som hjälper oss att fortsätta. Dopamin-nivåer påverkas av:</p>
      <ul>
        <li><strong>Belöningförväntan:</strong> Högre dopamin när vi förväntar oss framgång</li>
        <li><strong>Uppgiftsrelevans:</strong> Ökad aktivitet när uppgiften känns meningsfull</li>
        <li><strong>Progress-feedback:</strong> Dopamin-frisättning vid framsteg</li>
      </ul>

      <h3>Acetylkolin: Uppmärksamhetsregulator</h3>
      <p>Acetylkolin hjälper till att filtrera bort distraktioner och förbättrar signal-brus-förhållandet i hjärnan. Studier visar att acetylkolin-nivåer korrelerar med uppmärksamhetsprestanda. Låga nivåer är associerade med ADHD och åldersrelaterad kognitiv försämring.</p>

      <h3>Norepinefrin: Alertness-signaler</h3>
      <p>Norepinefrin ökar vakenheten och hjälper hjärnan att prioritera viktiga stimuli. Detta neurotransmittor aktiveras under stress och hög fokus. Locus coeruleus, hjärnans huvudkälla till norepinefrin, visar ökad aktivitet under koncentrerade uppgifter.</p>

      <h3>Serotonin: Humör och Fokusering</h3>
      <p>Serotonin påverkar humör och impulsivitet. Balanserade serotoninnivåer förbättrar förmågan att bibehålla fokus över tid. Låga nivåer kan leda till ökad distraktion och svårt att slutföra uppgifter.</p>

      <div class="highlight-box">
        <strong>🧪 Vetenskapligt Faktum:</strong> En studie från Nature Neuroscience (2018) visade att optogenetisk stimulering av dopamin-neuroner förbättrade fokus och minskade distraktion med 40%.
      </div>

      <div class="highlight-box">
        <strong>💊 Praktisk Tillämpning:</strong> Koffein blockerar adenosin-receptorer, vilket leder till ökad frisättning av dopamin och förbättrad fokus. Detta förklarar varför koffein förbättrar koncentrationen.
      </div>
    `
    },
    {
        title: "Prefrontal Cortex och Exekutiv Funktion",
        content: `
      <h3>Prefrontal Cortex Roll</h3>
      <p>Prefrontal cortex (PFC) är hjärnans "dirigent" för exekutiva funktioner. Denna region är ansvarig för:</p>
      <ul>
        <li><strong>Arbetsminne:</strong> Hålla information tillgänglig för bearbetning</li>
        <li><strong>Hämning:</strong> Motstå distraktioner och impulsiva handlingar</li>
        <li><strong>Kognitiv flexibilitet:</strong> Växla mellan olika uppgifter</li>
        <li><strong>Planering:</strong> Organisera framtida handlingar</li>
      </ul>

      <h3>Utvecklingsaspekter</h3>
      <p>Prefrontal cortex utvecklas långsamt och når inte full mognad förrän i 20-årsåldern. Detta förklarar varför ungdomar ofta har svårare att bibehålla fokus.</p>

      <h3>Träning av PFC</h3>
      <p>Regelbunden träning av exekutiva funktioner kan stärka prefrontal cortex. Mindfulness-meditation och kognitiv träning har visat sig förbättra PFC-funktionen.</p>
    `
    },
    {
        title: "Fokus och Multitasking",
        content: `
      <h3>Myten om Multitasking</h3>
      <p>Vetenskapliga studier visar att "multitasking" egentligen är task-switching. Hjärnan kan inte fokusera på flera komplexa uppgifter samtidigt.</p>

      <h3>Kontext-switching Kostnad</h3>
      <p>Varje gång vi byter uppgift tar det 25-30 minuter att återfå full fokus. Detta förklarar varför konstant mejlkoll och sociala medier försämrar produktiviteten.</p>

      <h3>Deep Work vs. Shallow Work</h3>
      <p>Enligt Cal Newport skiljer vi mellan:</p>
      <ul>
        <li><strong>Deep Work:</strong> Fokuserade, odelbara aktiviteter som kräver kognitiv energi</li>
        <li><strong>Shallow Work:</strong> Logistiska uppgifter som kan utföras med splittrad uppmärksamhet</li>
      </ul>

      <h3>Flow-tillståndet</h3>
      <p>Mihaly Csikszentmihalyis flow-teori beskriver ett tillstånd av full immersion där tid och självmedvetenhet försvinner. Detta tillstånd optimerar fokus och prestation.</p>
    `
    },
    {
        title: "Praktiska Strategier för Bättre Fokus",
        content: `
      <h3>Miljöoptimering</h3>
      <ul>
        <li><strong>Minimerad distraktion:</strong> Skapa en fokuserad arbetsmiljö</li>
        <li><strong>Naturligt ljus:</strong> Arbete nära fönster förbättrar koncentration</li>
        <li><strong>Temperaturkontroll:</strong> 22°C är optimalt för kognitiv prestation</li>
      </ul>

      <h3>Tidsbaserade Tekniker</h3>
      <ul>
        <li><strong>Pomodoro-tekniken:</strong> 25 minuters fokuserad arbete följt av 5 minuters paus</li>
        <li><strong>Time-blocking:</strong> Schemalägg specifika tider för olika uppgifter</li>
        <li><strong>Eisenhower-matris:</strong> Prioritera uppgifter efter vikt och brådska</li>
      </ul>

      <h3>Kognitiva Strategier</h3>
      <ul>
        <li><strong>Mindfulness:</strong> Träna uppmärksamhet genom meditation</li>
        <li><strong>Chunking:</strong> Bryt ner komplexa uppgifter i mindre delar</li>
        <li><strong>Implementation intentions:</strong> "Om X händer, kommer jag att göra Y"</li>
      </ul>

      <h3>Livsstilsfaktorer</h3>
      <ul>
        <li><strong>Sömn:</strong> 7-9 timmar per natt är kritiskt för fokus</li>
        <li><strong>Träning:</strong> Regelbunden fysisk aktivitet förbättrar exekutiva funktioner</li>
        <li><strong>Nutrition:</strong> Omega-3, B-vitaminer och antioxidanter stödjer hjärnhälsa</li>
      </ul>
    `
    }
];

export const neuroscienceQuiz = [
    {
        question: "Vilket nätverk i hjärnan ansvarar för att rikta uppmärksamheten mot specifika platser i det visuella fältet?",
        options: ["Default Mode Network", "Dorsala uppmärksamhetsnätverket", "Ventrala uppmärksamhetsnätverket", "Salience Network"],
        correct: 1,
        explanation: "Det Dorsala uppmärksamhetsnätverket (DAN) är specialiserat på att styra uppmärksamheten mot specifika visuella platser och underhålla fokus på utvalda stimuli."
    },
    {
        question: "Vilken neurotransmittor är främst ansvarig för motivation och belöning i fokusprocessen?",
        options: ["Serotonin", "Dopamin", "Acetylkolin", "GABA"],
        correct: 1,
        explanation: "Dopamin skapar en belöningskänsla som hjälper oss att fortsätta fokusera. Högre dopamin-nivåer korrelerar med bättre förmåga att bibehålla uppmärksamhet."
    },
    {
        question: "Vad är den ungefärliga tiden det tar att återfå full fokus efter en uppgiftsväxling?",
        options: ["5-10 sekunder", "1-2 minuter", "10-15 minuter", "25-30 minuter"],
        correct: 3,
        explanation: "Forskning visar att det tar 25-30 minuter att återfå samma djupnivå av fokus efter att ha blivit avbruten. Detta förklarar varför konstant mejlkoll är så produktivitetshämmande."
    },
    {
        question: "Vilket hjärnregion fungerar som 'dirigent' för exekutiva funktioner som arbetsminne och hämning?",
        options: ["Amygdala", "Hippocampus", "Prefrontal Cortex", "Cerebellum"],
        correct: 2,
        explanation: "Prefrontal cortex (PFC) fungerar som hjärnans 'dirigent' och ansvarar för exekutiva funktioner som arbetsminne, impuls-kontroll och uppgiftsplanering."
    },
    {
        question: "Vad händer med hjärnans grå substans vid kronisk distraktion enligt Stanford-studien?",
        options: ["Den ökar", "Den förblir oförändrad", "Den minskar", "Den blir mer effektiv"],
        correct: 2,
        explanation: "Stanford Universitys studie (2010) visade att kronisk distraktion leder till minskad grå substans i områden ansvariga för kognitiv kontroll och uppmärksamhet."
    },
    {
        question: "Vilket fenomen beskriver Mihaly Csikszentmihalyi som ett tillstånd av full immersion där tid försvinner?",
        options: ["Multitasking", "Flow-tillståndet", "Task-switching", "Mental fatigue"],
        correct: 1,
        explanation: "Flow-tillståndet, beskrivet av psykologen Mihaly Csikszentmihalyi, är ett tillstånd av full immersion där självmedvetenhet och tiduppfattning försvinner, vilket optimerar fokus och prestation."
    }
];

export const RECOMMENDATIONS_POOL: Recommendation[] = [
    {
        id: 'stress-1',
        type: 'meditation',
        title: '4-7-8 Andningsövning',
        description: 'Dr. Andrew Weils vetenskapligt beprövade metod för ångest och sömn',
        content: 'Denna teknik, utvecklad av Dr. Andrew Weil från Harvard Medical School, har hjälpt miljontals människor med ångest, sömnproblem och stress. Kliniska studier visar 78% minskning av ångestsymptom efter 4 veckor. Tekniken aktiverar det parasympatiska nervsystemet och sänker kortisolnivåer med upp till 30%.',
        tags: ['andning', 'stress', 'ångest', 'sömn', 'kortisol', 'parasympatisk', 'Hantera stress'],
        difficulty: 'beginner',
        duration: 4,
        category: 'Stresshantering',
        image: '🫁',
    },
    {
        id: 'stress-2',
        type: 'exercise',
        title: 'KBT-övning: Hantera Stressiga Tankar',
        description: 'Identifiera och utmana stresstankemönster',
        content: 'Lär dig att känna igen stress-triggers och hur du kan hantera dem bättre.',
        tags: ['kbt', 'tankar', 'stress', 'Hantera stress'],
        difficulty: 'intermediate',
        duration: 15,
        category: 'KBT',
        image: '🧠',
    },
    {
        id: 'stress-3',
        type: 'meditation',
        title: 'Progressiv Muskelavslappning',
        description: 'Minska fysisk spänning från stress',
        content: '15 minuters guidad övning för att släppa spänningar i kroppen.',
        tags: ['kropp', 'avslappning', 'stress', 'Hantera stress'],
        difficulty: 'beginner',
        duration: 15,
        category: 'Avslappning',
        image: '💆',
    },
    {
        id: 'sleep-1',
        type: 'article',
        title: 'Vetenskapen Bakom Bättre Sömn',
        description: 'Förstå hur du förbättrar din sömnkvalitet',
        content: 'Lär dig vetenskapligt beprövade metoder för bättre sömn.',
        tags: ['sömn', 'vetenskap', 'hälsa', 'Bättre sömn'],
        difficulty: 'beginner',
        duration: 5,
        category: 'Utbildning',
        image: '📚',
    },
    {
        id: 'sleep-2',
        type: 'meditation',
        title: 'Sömnmeditation: Body Scan',
        description: '20 minuters guidad meditation för djupare sömn',
        content: 'En body scan-meditation speciellt designad för sömnproblem.',
        tags: ['meditation', 'sömn', 'body scan', 'Bättre sömn'],
        difficulty: 'beginner',
        duration: 20,
        category: 'Sömn',
        image: '😴',
    },
    {
        id: 'sleep-3',
        type: 'challenge',
        title: '7-Dagars Sömnrutin',
        description: 'Bygg en konsekvent sömnrutin',
        content: 'Etablera hälsosamma sömnvanor över en vecka.',
        tags: ['rutin', 'sömn', 'vanor', 'Bättre sömn'],
        difficulty: 'beginner',
        duration: 10,
        category: 'Utmaningar',
        image: '🌙',
    },
    {
        id: 'focus-1',
        type: 'exercise',
        title: 'Pomodoro-teknik för Bättre Fokus',
        description: 'Vetenskapligt beprövad tidsstyrningsteknik för optimal produktivitet och koncentration',
        content: 'Pomodoro-tekniken, utvecklad av Francesco Cirillo 1980, bygger på forskning om uppmärksamhetsspann och kognitiv utmattning. Tekniken utnyttjar ultradian rhythms - naturliga 90-120 minuters cykler av hög och låg prestationsförmåga.',
        tags: ['fokus', 'produktivitet', 'koncentration', 'Pomodoro', 'tidshantering', 'ultradian rhythms', 'Ökad fokusering'],
        difficulty: 'beginner',
        duration: 25,
        category: 'Produktivitet',
        image: '🎯',
    },
    {
        id: 'focus-2',
        type: 'meditation',
        title: 'Mindfulness för Fokus',
        description: 'Vetenskapligt beprövad MBSR-meditation för förbättrad koncentration och kognitiv kontroll',
        content: 'Denna guidade mindfulness-meditation bygger på Mindfulness-Based Stress Reduction (MBSR) programmet, utvecklat av Dr. Jon Kabat-Zinn vid University of Massachusetts Medical Center. Övningen fokuserar på att stärka din uppmärksamhetsmuskel genom medveten närvaro.',
        tags: ['mindfulness', 'fokus', 'koncentration', 'MBSR', 'arbetsminne', 'exekutiv funktion', 'prefrontal cortex', 'Ökad fokusering'],
        difficulty: 'intermediate',
        duration: 10,
        rating: 4.9,
        category: 'Fokus',
        image: '🧘',
    },
    {
        id: 'focus-3',
        type: 'article',
        title: 'Neurovetenskap: Så Fungerar Fokus',
        description: 'Djupgående förståelse av hjärnans uppmärksamhetssystem och evidensbaserade strategier för bättre fokus',
        content: 'Denna omfattande artikel förklarar de neurovetenskapliga mekanismerna bakom uppmärksamhet och koncentration, baserat på senaste forskning från ledande neurologer och psykologer.',
        tags: ['neurovetenskap', 'fokus', 'hjärna', 'uppmärksamhet', 'kognitiv kontroll', 'mindfulness', 'exekutiv funktion', 'Ökad fokusering'],
        difficulty: 'intermediate',
        duration: 7,
        rating: 4.9,
        category: 'Utbildning',
        image: '🧠',
    },
    {
        id: 'clarity-1',
        type: 'meditation',
        title: 'Clarity Meditation',
        description: 'Rensa tankarna och öka mental klarhet',
        content: '15 minuters meditation för mental klarhet.',
        tags: ['meditation', 'klarhet', 'tankar', 'Mental klarhet'],
        difficulty: 'beginner',
        duration: 15,
        rating: 4.8,
        category: 'Meditation',
        image: '✨',
    },
    {
        id: 'clarity-2',
        type: 'exercise',
        title: 'Journaling för Mental Klarhet',
        description: 'Skriv dig till klarare tankar',
        content: 'Strukturerad journaling-metod för att organisera tankar.',
        tags: ['journaling', 'klarhet', 'skrivande', 'Mental klarhet'],
        difficulty: 'beginner',
        duration: 10,
        rating: 4.7,
        category: 'Journaling',
        image: '📝',
    },
    {
        id: 'clarity-3',
        type: 'challenge',
        title: 'Digital Detox för Mental Klarhet',
        description: '3-dagars utmaning för klarare sinne',
        content: 'Minska skärmtid för ökad mental klarhet.',
        tags: ['digital', 'detox', 'klarhet', 'Mental klarhet'],
        difficulty: 'intermediate',
        duration: 30,
        rating: 4.6,
        category: 'Utmaningar',
        image: '📵',
    },
    {
        id: 'mindfulness-1',
        type: 'meditation',
        title: 'Mindfulness för Nybörjare',
        description: 'Lär dig grunderna i mindfulness på 10 minuter',
        content: 'En guidad introduktion till mindfulness-meditation med fokus på andning och närvaro.',
        tags: ['mindfulness', 'meditation', 'börja', 'andning'],
        difficulty: 'beginner',
        duration: 10,
        rating: 4.8,
        category: 'Meditation',
        image: '🧘‍♀️',
    },
    {
        id: 'mindfulness-2',
        type: 'meditation',
        title: 'Body Scan Meditation',
        description: 'Skanna igenom kroppen för djup avslappning',
        content: 'En 20-minuters body scan som hjälper dig släppa spänningar och stress.',
        tags: ['body scan', 'avslappning', 'stress', 'kropp'],
        difficulty: 'intermediate',
        duration: 20,
        rating: 4.9,
        category: 'Meditation',
        image: '😌',
    },
    {
        id: 'mindfulness-3',
        type: 'exercise',
        title: '5-4-3-2-1 Sinnesövning',
        description: 'Grounding-teknik för ångest och stress',
        content: 'Använd dina sinnen för att återvända till nuet: 5 saker du ser, 4 du kan röra, 3 du hör, 2 du luktar, 1 du smakar.',
        tags: ['grounding', 'ångest', 'sinnen', 'stress'],
        difficulty: 'beginner',
        duration: 5,
        rating: 4.7,
        category: 'Ångesthantering',
        image: '👀',
    },
    {
        id: 'sleep-4',
        type: 'meditation',
        title: 'Sömnberedelse Ritual',
        description: 'Förbered dig för djup sömn med guidad avslappning',
        content: 'En 15-minuters ritual som hjälper dig varva ner och förbereda för sömn.',
        tags: ['sömn', 'ritual', 'avslappning', 'rutin'],
        difficulty: 'beginner',
        duration: 15,
        rating: 4.8,
        category: 'Sömn',
        image: '🌙',
    },
    {
        id: 'sleep-5',
        type: 'article',
        title: 'Skärmtid och Sömn',
        description: 'Hur blått ljus påverkar din sömnkvalitet',
        content: 'Vetenskaplig översikt över hur skärmtid påverkar melatoninproduktion och sömn.',
        tags: ['skärmtid', 'blått ljus', 'melatonin', 'vetenskap'],
        difficulty: 'intermediate',
        duration: 8,
        rating: 4.6,
        category: 'Utbildning',
        image: '📱',
    },
    {
        id: 'social-1',
        type: 'exercise',
        title: 'Kommunikation i Relationer',
        description: 'Förbättra dina kommunikationsfärdigheter',
        content: 'Lär dig aktiv lyssning och assertiv kommunikation för bättre relationer.',
        tags: ['kommunikation', 'relationer', 'social', 'färdigheter'],
        difficulty: 'intermediate',
        duration: 12,
        rating: 4.5,
        category: 'Relationer',
        image: '💬',
    },
    {
        id: 'social-2',
        type: 'challenge',
        title: 'Daglig Känsla-delning',
        description: 'Dela dina känslor med någon du litar på',
        content: 'Öva på att uttrycka känslor öppet och ärligt varje dag i en vecka.',
        tags: ['känslor', 'delning', 'förtroende', 'uttryck'],
        difficulty: 'intermediate',
        duration: 7,
        rating: 4.4,
        category: 'Relationer',
        image: '❤️',
    },
    {
        id: 'work-1',
        type: 'exercise',
        title: 'Arbetsplats Stresshantering',
        description: 'Hantera stress på jobbet effektivt',
        content: 'Strategier för att hantera deadlines, konflikter och arbetsbelastning.',
        tags: ['arbete', 'stress', 'produktivitet', 'gränser'],
        difficulty: 'intermediate',
        duration: 15,
        category: 'Arbetsliv',
        image: '💼',
    },
    {
        id: 'work-2',
        type: 'meditation',
        title: 'Fokus Meditation för Arbete',
        description: 'Öka koncentrationen och produktiviteten',
        content: 'En meditation designad för att förbättra fokus och arbetsförmåga.',
        tags: ['fokus', 'produktivitet', 'arbete', 'koncentration'],
        difficulty: 'beginner',
        duration: 10,
        category: 'Arbetsliv',
        image: '🎯',
    },
    {
        id: 'advanced-1',
        type: 'exercise',
        title: 'Kognitiv Omstrukturering',
        description: 'Avancerad KBT-teknik för tankemönster',
        content: 'Lär dig identifiera och omstrukturera djupgående negativa tankemönster.',
        tags: ['kbt', 'omstrukturering', 'tankar', 'avancerad'],
        difficulty: 'advanced',
        duration: 25,
        category: 'Avancerad KBT',
        image: '🧠',
    },
    {
        id: 'advanced-2',
        type: 'meditation',
        title: 'Vipassana Meditation',
        description: 'Djup mindfulness-praktik för erfarna utövare',
        content: 'Traditionell vipassana-teknik för medvetenhet och insikt.',
        tags: ['vipassana', 'mindfulness', 'erfaren', 'insikt'],
        difficulty: 'advanced',
        duration: 30,
        category: 'Avancerad Meditation',
        image: '☯️',
    },
    {
        id: 'generic-1',
        type: 'challenge',
        title: '7-Dagars Tacksamhetsutmaning',
        description: 'Utveckla en mer positiv syn genom daglig tacksamhet',
        content: 'Skriv ner tre saker du är tacksam för varje dag i en vecka.',
        tags: ['tacksamhet', 'positivitet', 'utmaning', 'dagbok'],
        difficulty: 'beginner',
        duration: 5,
        rating: 4.9,
        category: 'Allmänt',
        image: '🙏',
    },
    {
        id: 'generic-2',
        type: 'article',
        title: 'Mental Hälsa 101',
        description: 'Grundläggande kunskaper om mental hälsa',
        content: 'En översikt över viktiga begrepp inom mental hälsa och välbefinnande.',
        tags: ['utbildning', 'grundläggande', 'hälsa', 'kunskap'],
        difficulty: 'beginner',
        duration: 6,
        category: 'Utbildning',
        image: '📚',
    },
];

type RecPoolTranslations = Record<string, { title: string; description: string; category: string; content: string }>;

export const getRecommendationsPool = (t: (key: string) => unknown): Recommendation[] => {
  const pool = t('recommendationsPool') as RecPoolTranslations | undefined;
  if (!pool || typeof pool !== 'object') return RECOMMENDATIONS_POOL;
  return RECOMMENDATIONS_POOL.map(rec => {
    const tr = pool[rec.id];
    if (!tr) return rec;
    return { ...rec, title: tr.title || rec.title, description: tr.description || rec.description, category: tr.category || rec.category, content: tr.content || rec.content };
  });
};
