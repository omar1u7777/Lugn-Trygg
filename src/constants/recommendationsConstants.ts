import { KBTPhaseName } from '../types/recommendation';

export const EMPTY_WELLNESS_GOALS: string[] = [];

export const KBT_GUIDED_PHASES: KBTPhaseName[] = ['identify', 'challenge', 'replace', 'practice'];
export const KBT_TOTAL_STEPS = KBT_GUIDED_PHASES.length;
export const KBT_MIN_NEGATIVE_LENGTH = 15;
export const KBT_MIN_EVIDENCE_LENGTH = 30;
export const KBT_MIN_ALTERNATIVE_LENGTH = 15;
export const KBT_MIN_ACTION_PLAN_LENGTH = 10;
export const KBT_MIN_OBSTACLE_PLAN_LENGTH = 12;
export const KBT_MIN_REHEARSAL_CONTEXT_LENGTH = 8;
export const KBT_MIN_EXPERIMENT_HYPOTHESIS_LENGTH = 12;
export const KBT_MIN_EXPERIMENT_MEASURE_LENGTH = 10;
export const KBT_MIN_SOCRATIC_REFLECTION_LENGTH = 18;
export const KBT_MIN_IF_THEN_PLAN_LENGTH = 18;
export const KBT_MIN_COPING_CARD_LENGTH = 12;

export type RecommendationFeedback = 'helpful' | 'not_relevant';

export type KbtDistortionInsight = {
  key: string;
  label: string;
  hint: string;
  reframeQuestion: string;
};

export const KBT_DISTORTION_RULES: Array<KbtDistortionInsight & { pattern: RegExp }> = [
  {
    key: 'catastrophizing',
    label: 'Katastroftankande',
    hint: 'Tanken förutsäger värsta möjliga utfall utan mellanlägesscenarion.',
    reframeQuestion: 'Vad är det mest sannolika utfallet, inte det värsta?',
    pattern: /(katastrof|helt förstört|allt kommer gå fel|det kommer gå åt skogen|det blir en katastrof)/i,
  },
  {
    key: 'black_white',
    label: 'Svart-vitt tänkande',
    hint: 'Tanken använder ytterligheter som "alltid", "aldrig" eller "helt".',
    reframeQuestion: 'Vilket mer nyanserat mellanläge skulle kunna vara sant?',
    pattern: /(alltid|aldrig|helt|totalt|ingen|alla|måste lyckas)/i,
  },
  {
    key: 'mind_reading',
    label: 'Tankeläsning',
    hint: 'Tanken antar vad andra tycker utan tydliga bevis.',
    reframeQuestion: 'Vilka faktiska bevis har du för vad andra tänker?',
    pattern: /(de tycker|alla tycker|ingen gillar mig|de kommer döma mig|de tycker jag är)/i,
  },
  {
    key: 'self_labeling',
    label: 'Global självetikett',
    hint: 'Ett misstag görs om till en generell etikett om dig som person.',
    reframeQuestion: 'Hur skulle du beskriva situationen utan att etikettera dig själv?',
    pattern: /(jag är en|jag är en total|jag är en helt|jag är en sådan|jag är en sådan person)/i,
  },
  {
    key: 'overgeneralization',
    label: 'Övergeneralisering',
    hint: 'En enskild händelse används som bevis för en generell sanning.',
    reframeQuestion: 'Vilka andra exempel motsäger denna generalisering?',
    pattern: /(alltid|aldrig|varje gång|ingen gång|allihop|ingen av dem)/i,
  },
  {
    key: 'should_statements',
    label: 'Bör-tänkande',
    hint: 'Tanken använder "borde" eller "måste" som skapar press.',
    reframeQuestion: 'Vad skulle hända om du släppte kravet på "borde"?',
    pattern: /(borde|måste|skall|behöver|förväntas|skyldig)/i,
  },
];

export const getKbtDistortionInsights = (negativeThought: string, t?: (key: string) => string): KbtDistortionInsight[] => {
  const thought = negativeThought.trim();
  if (!thought) return [];
  
  return KBT_DISTORTION_RULES
    .filter(rule => rule.pattern.test(thought))
    .map(rule => ({
      key: rule.key,
      label: rule.label,
      hint: rule.hint,
      reframeQuestion: rule.reframeQuestion,
    }));
};

export const calculateKbtSessionQuality = (params: {
  beliefBefore: number | null;
  beliefAfter: number | null;
  negativeThoughtLength: number;
  evidenceLength: number;
  alternativeLength: number;
  actionPlanLength: number;
}) => {
  const { beliefBefore, beliefAfter, negativeThoughtLength, evidenceLength, alternativeLength, actionPlanLength } = params;
  
  let qualityScore = 0;
  let maxScore = 100;
  
  // Belief change (40 points max)
  if (typeof beliefBefore === 'number' && typeof beliefAfter === 'number') {
    const beliefChange = Math.abs(beliefBefore - beliefAfter);
    qualityScore += Math.min(40, beliefChange * 4);
  }
  
  // Content quality (60 points max)
  if (negativeThoughtLength >= KBT_MIN_NEGATIVE_LENGTH) qualityScore += 10;
  if (evidenceLength >= KBT_MIN_EVIDENCE_LENGTH) qualityScore += 20;
  if (alternativeLength >= KBT_MIN_ALTERNATIVE_LENGTH) qualityScore += 15;
  if (actionPlanLength >= KBT_MIN_ACTION_PLAN_LENGTH) qualityScore += 15;
  
  return Math.min(maxScore, qualityScore);
};

export const getKbtStepFromPhase = (phase: KBTPhaseName) => {
  const index = KBT_GUIDED_PHASES.indexOf(phase);
  return index >= 0 ? index + 1 : KBT_TOTAL_STEPS;
};

export const getKbtAdaptiveFeedback = (before: number | null, after: number | null, t?: (key: string) => string) => {
  const tr = (key: string, fallback: string) => (t ? (t(key) || fallback) : fallback);
  if (typeof before !== 'number' || typeof after !== 'number') {
    return tr('kbt.feedback.invalid', 'Ange giltiga siffror för din tro på tanken.');
  }
  const change = after - before;
  if (change >= 3) return tr('kbt.feedback.largeDecrease', 'Stor förändring! Din tro har minskat betydligt.');
  if (change >= 1) return tr('kbt.feedback.moderateDecrease', 'Bra! Din tro har minskat något.');
  if (change <= -3) return tr('kbt.feedback.largeIncrease', 'Din tro har ökat. Reflektera över varför.');
  if (change <= -1) return tr('kbt.feedback.moderateIncrease', 'Din tro har ökat något. Är det rimligt?');
  return tr('kbt.feedback.noChange', 'Ingen förändring. Försök hitta ny bevisning.');
};

export const getKbtStressFeedback = (before: number | null, after: number | null, t?: (key: string) => string) => {
  const tr = (key: string, fallback: string) => (t ? (t(key) || fallback) : fallback);
  if (typeof before !== 'number' || typeof after !== 'number') {
    return '';
  }
  if (before >= 7 && after <= 4) {
    return tr('kbt.stress.significantReduction', 'Stressnivån har minskat betydligt. Bra jobbat!');
  }
  if (before >= 7 && after <= 6) {
    return tr('kbt.stress.moderateReduction', 'Stressnivån har minskat något.');
  }
  return '';
};

// Helper function to format seconds into MM:SS
export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatReadingTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

// Helper to format Pomodoro time as MM:SS
export const formatPomodoroTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
