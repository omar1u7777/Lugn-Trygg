const fs = require('fs');

const data = {
  sv: {
    pmr: {
      prepare: 'Förberedelse',
      tense: 'Spänn',
      relax: 'Slappna av',
      completed: 'Övning slutförd!',
      muscles: 'musklerna',
      prepareDesc: 'Sitt eller ligg bekvämt. Andas lugnt.',
      relaxDesc: 'Släpp spänningen långsamt och känn avslappningen...',
      completedDesc: 'Bra jobbat! Du har genomfört progressiv muskelavslappning.',
      guideDesc: 'Följ guiden genom olika muskelgrupper för djup avslappning',
    },
    kbt: {
      distortions: {
        catastrophizing: { label: 'Katastroftankande', hint: 'Tanken förutsäger värsta möjliga utfall utan mellanlägesscenarion.', reframeQuestion: 'Vad är det mest sannolika utfallet, inte det värsta?' },
        black_white: { label: 'Svart-vitt tänkande', hint: 'Tanken använder ytterligheter som "alltid", "aldrig" eller "helt".', reframeQuestion: 'Vilket mer nyanserat mellanläge skulle kunna vara sant?' },
        mind_reading: { label: 'Tankeläsning', hint: 'Tanken antar vad andra tycker utan tydliga bevis.', reframeQuestion: 'Vilka faktiska bevis har du för vad andra tänker?' },
        self_labeling: { label: 'Global självetikett', hint: 'Ett misstag göras om till en generell etikett om dig som person.', reframeQuestion: 'Hur skulle du beskriva situationen utan att etikettera dig själv?' },
      },
      quality: {
        stable: 'Stabil grund',
        veryStrong: 'Mycket stark genomförning',
        good: 'Bra genomförning',
      },
      adaptive: {
        noData: { title: 'Fortsatt reflektion', message: 'Du har gjort ett viktigt arbete. Fortsatt repetition av den balanserade tanken kan göra den mer tillgänglig i vardagen.' },
        clearRestructuring: { title: 'Tydlig omstrukturering', message: 'Din nya tanke känns betydligt mer trovärdig nu. Det tyder på att du har brutit ett automatiskt stresstolkningsmönster.' },
        goodProgress: { title: 'Bra framsteg', message: 'Du rör dig i rätt riktning. Fortsätt öva på den nya tanken i liknande situationer för att befästa effekten.' },
        stabilization: { title: 'Stabilisering behövs', message: 'Förändring tar tid. Testa att konkretisera evidensen ytterligare och prova samma övning igen i en lugn stund.' },
      },
      stress: {
        noData: { title: 'Stressmätning saknas', message: 'Lägg till stressnivå före och efter nästa gång för att tydligare se effekten av övningen.' },
        clearReduction: { title: 'Tydlig stressminskning', message: 'Din stressnivå gick ner markant. Fortsätt med samma strategi i liknande situationer.' },
        goodRegulation: { title: 'Bra stressreglering', message: 'Stressnivån minskade. Repetera övriga handlingssteg för att befästa effekten.' },
        remaining: { title: 'Stressen kvarstår delvis', message: 'Om stressen fortfarande är hög, kombinera tanken med en kort andningspaus innan nästa steg.' },
      },
    },
  },
  en: {
    pmr: {
      prepare: 'Preparation',
      tense: 'Tense',
      relax: 'Relax',
      completed: 'Exercise complete!',
      muscles: 'muscles',
      prepareDesc: 'Sit or lie comfortably. Breathe calmly.',
      relaxDesc: 'Release the tension slowly and feel the relaxation...',
      completedDesc: 'Well done! You have completed progressive muscle relaxation.',
      guideDesc: 'Follow the guide through different muscle groups for deep relaxation',
    },
    kbt: {
      distortions: {
        catastrophizing: { label: 'Catastrophizing', hint: 'The thought predicts the worst possible outcome without middle-ground scenarios.', reframeQuestion: 'What is the most likely outcome, not the worst?' },
        black_white: { label: 'Black-and-white thinking', hint: 'The thought uses extremes like "always", "never" or "completely".', reframeQuestion: 'What more nuanced middle ground could be true?' },
        mind_reading: { label: 'Mind reading', hint: 'The thought assumes what others think without clear evidence.', reframeQuestion: 'What actual evidence do you have for what others are thinking?' },
        self_labeling: { label: 'Global self-labeling', hint: 'A mistake is turned into a general label about you as a person.', reframeQuestion: 'How would you describe the situation without labeling yourself?' },
      },
      quality: {
        stable: 'Stable foundation',
        veryStrong: 'Very strong completion',
        good: 'Good completion',
      },
      adaptive: {
        noData: { title: 'Continued reflection', message: 'You have done important work. Continued repetition of the balanced thought can make it more accessible in everyday life.' },
        clearRestructuring: { title: 'Clear restructuring', message: 'Your new thought feels considerably more credible now. This indicates you have broken an automatic stress interpretation pattern.' },
        goodProgress: { title: 'Good progress', message: 'You are moving in the right direction. Keep practicing the new thought in similar situations to consolidate the effect.' },
        stabilization: { title: 'Stabilization needed', message: 'Change takes time. Try to concretize the evidence further and try the same exercise again in a calm moment.' },
      },
      stress: {
        noData: { title: 'Stress measurement missing', message: 'Add stress level before and after next time to more clearly see the effect of the exercise.' },
        clearReduction: { title: 'Clear stress reduction', message: 'Your stress level dropped significantly. Continue with the same strategy in similar situations.' },
        goodRegulation: { title: 'Good stress regulation', message: 'Stress level decreased. Repeat the remaining action steps to consolidate the effect.' },
        remaining: { title: 'Stress partially remains', message: 'If stress is still high, combine the thought with a short breathing pause before the next step.' },
      },
    },
  },
  no: {
    pmr: {
      prepare: 'Forberedelse',
      tense: 'Spenn',
      relax: 'Slapp av',
      completed: 'Øvelse fullført!',
      muscles: 'musklene',
      prepareDesc: 'Sitt eller ligg komfortabelt. Pust rolig.',
      relaxDesc: 'Slipp spenningen sakte og kjenn avslapningen...',
      completedDesc: 'Bra jobbet! Du har gjennomført progressiv muskelavslapning.',
      guideDesc: 'Følg guiden gjennom ulike muskelgrupper for dyp avslapning',
    },
    kbt: {
      distortions: {
        catastrophizing: { label: 'Katastroftenkning', hint: 'Tanken forutsier verste mulige utfall uten mellomscenarier.', reframeQuestion: 'Hva er det mest sannsynlige utfallet, ikke det verste?' },
        black_white: { label: 'Svart-hvitt tenkning', hint: 'Tanken bruker ytterligheter som "alltid", "aldri" eller "helt".', reframeQuestion: 'Hvilket mer nyansert mellomrom kunne være sant?' },
        mind_reading: { label: 'Tankelesning', hint: 'Tanken antar hva andre tenker uten tydelige bevis.', reframeQuestion: 'Hvilke faktiske bevis har du for hva andre tenker?' },
        self_labeling: { label: 'Global selvmerking', hint: 'En feil gjøres om til en generell merkelapp om deg som person.', reframeQuestion: 'Hvordan ville du beskrive situasjonen uten å merke deg selv?' },
      },
      quality: {
        stable: 'Stabil grunn',
        veryStrong: 'Meget sterk gjennomføring',
        good: 'God gjennomføring',
      },
      adaptive: {
        noData: { title: 'Fortsatt refleksjon', message: 'Du har gjort et viktig arbeid. Fortsatt repetisjon av den balanserte tanken kan gjøre den mer tilgjengelig i hverdagen.' },
        clearRestructuring: { title: 'Tydelig omstrukturering', message: 'Din nye tanke føles betydelig mer troverdig nå. Det tyder på at du har brutt et automatisk stressfortolkningsmønster.' },
        goodProgress: { title: 'God fremgang', message: 'Du beveger deg i riktig retning. Fortsett å øve på den nye tanken i lignende situasjoner for å befeste effekten.' },
        stabilization: { title: 'Stabilisering trengs', message: 'Forandring tar tid. Prøv å konkretisere bevisene ytterligere og prøv den samme øvelsen igjen i et rolig øyeblikk.' },
      },
      stress: {
        noData: { title: 'Stressmåling mangler', message: 'Legg til stressnivå før og etter neste gang for å tydeligere se effekten av øvelsen.' },
        clearReduction: { title: 'Tydelig stressreduksjon', message: 'Stressnivået ditt gikk markant ned. Fortsett med den samme strategien i lignende situasjoner.' },
        goodRegulation: { title: 'God stressregulering', message: 'Stressnivået ble redusert. Gjenta de øvrige handlingstrinnene for å befeste effekten.' },
        remaining: { title: 'Stressen gjenstår delvis', message: 'Hvis stresset fortsatt er høyt, kombiner tanken med en kort pustepause før neste steg.' },
      },
    },
  },
};

['sv', 'en', 'no'].forEach(l => {
  const p = 'src/i18n/locales/' + l + '.json';
  const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  obj.pmr = data[l].pmr;
  obj.kbt = data[l].kbt;
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  console.log(l + ': pmr + kbt added');
});

['sv', 'en', 'no'].forEach(l => {
  try { JSON.parse(fs.readFileSync('src/i18n/locales/' + l + '.json', 'utf8')); console.log(l + ': VALID'); }
  catch(e) { console.log(l + ': INVALID ' + e.message); }
});
