import sharedWellnessGoals from '../../shared/wellness_goals.json';

export interface WellnessGoalOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface SharedWellnessGoalsConfig {
  maxGoals?: number;
  goals?: WellnessGoalOption[];
}

const FALLBACK_GOALS: WellnessGoalOption[] = [
  {
    id: 'Hantera stress',
    label: 'Hantera stress',
    icon: '🍃',
    description: 'Tekniker för lugn och balans'
  },
  {
    id: 'Bättre sömn',
    label: 'Bättre sömn',
    icon: '😴',
    description: 'Sov djupare och vakna utvilad'
  },
  {
    id: 'Ökad fokusering',
    label: 'Ökad fokusering',
    icon: '🎯',
    description: 'Skärp din koncentration'
  },
  {
    id: 'Mental klarhet',
    label: 'Mental klarhet',
    icon: '✨',
    description: 'Rensa tankarna och prioritera'
  },
  {
    id: 'Ångesthantering',
    label: 'Ångesthantering',
    icon: '🛡️',
    description: 'Bygg trygghet vid oro och ångest'
  },
  {
    id: 'Självkänsla',
    label: 'Självkänsla',
    icon: '🌱',
    description: 'Stärk självkänsla och självmedkänsla'
  },
  {
    id: 'Relationsstöd',
    label: 'Relationsstöd',
    icon: '🤝',
    description: 'Förbättra relationer och kommunikation'
  },
  {
    id: 'Arbetsbalans',
    label: 'Arbetsbalans',
    icon: '💼',
    description: 'Skapa hållbar balans mellan jobb och liv'
  },
  {
    id: 'Mindfulness',
    label: 'Mindfulness',
    icon: '🧘',
    description: 'Bli mer närvarande i stunden'
  },
  {
    id: 'Emotionell balans',
    label: 'Emotionell balans',
    icon: '⚖️',
    description: 'Förstå och reglera dina känslor'
  },
  {
    id: 'Energi',
    label: 'Energi',
    icon: '⚡',
    description: 'Hitta stabil energi i vardagen'
  }
];

const sharedConfig = sharedWellnessGoals as SharedWellnessGoalsConfig;

const parsedGoals = Array.isArray(sharedConfig.goals) ? sharedConfig.goals : [];

export const MAX_WELLNESS_GOALS =
  typeof sharedConfig.maxGoals === 'number' && Number.isInteger(sharedConfig.maxGoals) && sharedConfig.maxGoals > 0
    ? sharedConfig.maxGoals
    : 3;

export const WELLNESS_GOAL_OPTIONS: WellnessGoalOption[] = parsedGoals.length > 0 ? parsedGoals : FALLBACK_GOALS;

export const WELLNESS_GOAL_VALUES = WELLNESS_GOAL_OPTIONS.map((goal) => goal.id);

export const WELLNESS_GOAL_BY_ID = WELLNESS_GOAL_OPTIONS.reduce<Record<string, WellnessGoalOption>>((goalMap, goalOption) => {
  goalMap[goalOption.id] = goalOption;
  return goalMap;
}, {});

export const getWellnessGoalIcon = (goalId: string): string => WELLNESS_GOAL_BY_ID[goalId]?.icon || '✨';
