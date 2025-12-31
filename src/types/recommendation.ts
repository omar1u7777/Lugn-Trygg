export type RecommendationType = 'exercise' | 'article' | 'meditation' | 'challenge' | 'insight';

export interface Recommendation {
    id: string;
    type: RecommendationType;
    title: string;
    description: string;
    content: string;
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    duration?: number; // in minutes
    rating?: number;
    completed?: boolean;
    saved?: boolean;
    image?: string;
    category: string;
}

export interface RecommendationsProps {
    userId?: string;
    wellnessGoals?: string[];
    compact?: boolean;
}

export type BreathingPhaseName = 'exhale' | 'inhale' | 'hold' | 'exhale2';

export interface BreathingPhaseConfig {
    name: BreathingPhaseName;
    duration: number;
    instruction: string;
}

export type KBTPhaseName = 'identify' | 'challenge' | 'replace' | 'practice' | 'complete';
