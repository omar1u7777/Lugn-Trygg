import type { Recommendation } from '../types/recommendation';
import { logger } from './logger';

/**
 * Rule-based recommendation personalization.
 * Scores recommendations based on:
 * 1. Mood trend (declining → stress/anxiety boost, improving → focus/growth boost)
 * 2. Time of day (morning → focus, afternoon → stress, evening → sleep)
 * 3. Exercise history (uncompleted → boost, completed → demote)
 * 4. User streak (long streak → harder exercises, new user → beginner)
 */

export interface MoodTrendData {
  averageScore: number;
  trend: 'declining' | 'stable' | 'improving';
  recentScores: number[];
}

export interface PersonalizationContext {
  moodTrend?: MoodTrendData | null;
  completedRecIds: string[];
  exercisesCompleted: number;
  dayStreak: number;
  hour: number;
}

export interface ScoredRecommendation extends Recommendation {
  personalizationScore: number;
  personalizationReasons: string[];
}

/**
 * Analyze mood data to determine trend.
 * Compares average of last 3 entries vs average of previous 4-7 entries.
 */
export const analyzeMoodTrend = (moodScores: number[]): MoodTrendData | null => {
  if (!moodScores || moodScores.length < 3) return null;

  const sorted = [...moodScores].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, s) => sum + s, 0) / sorted.length;

  if (moodScores.length < 7) {
    return {
      averageScore: Math.round(avg * 10) / 10,
      trend: 'stable',
      recentScores: sorted,
    };
  }

  const recent = moodScores.slice(-3);
  const older = moodScores.slice(-7, -3);

  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;

  const diff = recentAvg - olderAvg;

  let trend: MoodTrendData['trend'] = 'stable';
  if (diff <= -1.5) trend = 'declining';
  else if (diff >= 1.5) trend = 'improving';

  return {
    averageScore: Math.round(avg * 10) / 10,
    trend,
    recentScores: sorted,
  };
};

/**
 * Get time-of-day context.
 * Morning: 5-11, Afternoon: 12-17, Evening: 18-23, Night: 0-4
 */
const getTimeOfDay = (hour: number): 'morning' | 'afternoon' | 'evening' | 'night' => {
  if (hour >= 5 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'afternoon';
  if (hour >= 18 && hour <= 23) return 'evening';
  return 'night';
};

/**
 * Score a single recommendation based on personalization context.
 * Base score is the recommendation's rating (1-5). Adjustments are additive.
 */
const scoreRecommendation = (
  rec: Recommendation,
  ctx: PersonalizationContext
): { score: number; reasons: string[] } => {
  let score = rec.rating || 3;
  const reasons: string[] = [];

  const tags = rec.tags.map((t) => t.toLowerCase());
  const recId = rec.id;

  // --- Factor 1: Mood trend ---
  if (ctx.moodTrend) {
    const { trend, averageScore } = ctx.moodTrend;

    if (trend === 'declining') {
      // User is feeling worse → boost stress/anxiety/sleep exercises
      if (tags.some((t) => ['stress', 'ångest', 'anxiety', 'andning', 'avslappning'].includes(t))) {
        score += 2;
        reasons.push('mood_declining');
      }
      // Demote focus/productivity exercises
      if (tags.some((t) => ['fokus', 'produktivitet', 'koncentration'].includes(t))) {
        score -= 1;
      }
    } else if (trend === 'improving') {
      // User is feeling better → boost focus/growth/self-esteem
      if (tags.some((t) => ['fokus', 'produktivitet', 'självkänsla', 'kreativt'].includes(t))) {
        score += 1.5;
        reasons.push('mood_improving');
      }
    }

    // Low average mood → boost beginner-friendly exercises
    if (averageScore <= 4) {
      if (rec.difficulty === 'beginner') {
        score += 0.5;
        reasons.push('low_mood_beginner');
      }
      if (rec.difficulty === 'advanced') {
        score -= 1;
      }
    }
  }

  // --- Factor 2: Time of day ---
  const timeOfDay = getTimeOfDay(ctx.hour);
  if (timeOfDay === 'morning') {
    if (tags.some((t) => ['fokus', 'energi', 'produktivitet', 'mindfulness'].includes(t))) {
      score += 1;
      reasons.push('morning_focus');
    }
  } else if (timeOfDay === 'afternoon') {
    if (tags.some((t) => ['stress', 'avslappning', 'andning'].includes(t))) {
      score += 0.5;
      reasons.push('afternoon_stress');
    }
  } else if (timeOfDay === 'evening') {
    if (tags.some((t) => ['sömn', 'sleep', 'avslappning', 'meditation'].includes(t))) {
      score += 1.5;
      reasons.push('evening_sleep');
    }
    // Demote high-energy exercises in the evening
    if (tags.some((t) => ['energi', 'fokus', 'produktivitet'].includes(t))) {
      score -= 0.5;
    }
  } else if (timeOfDay === 'night') {
    // Late night → strongly boost sleep/relaxation
    if (tags.some((t) => ['sömn', 'sleep', 'avslappning', 'andning'].includes(t))) {
      score += 2;
      reasons.push('night_sleep');
    }
    if (rec.duration && rec.duration > 10) {
      score -= 0.5;
    }
  }

  // --- Factor 3: Exercise history ---
  if (ctx.completedRecIds.includes(recId)) {
    // Already completed → demote but don't remove
    score -= 1.5;
    reasons.push('already_completed');
  } else {
    // Not yet completed → slight boost
    score += 0.3;
  }

  // --- Factor 4: User streak / experience ---
  if (ctx.dayStreak >= 7) {
    // Experienced user → boost intermediate/advanced
    if (rec.difficulty === 'intermediate' || rec.difficulty === 'advanced') {
      score += 0.5;
      reasons.push('streak_advanced');
    }
    // Demote beginner if they have a long streak
    if (rec.difficulty === 'beginner' && ctx.exercisesCompleted > 10) {
      score -= 0.3;
    }
  } else if (ctx.dayStreak <= 1 && ctx.exercisesCompleted <= 2) {
    // New user → boost beginner exercises
    if (rec.difficulty === 'beginner') {
      score += 1;
      reasons.push('new_user_beginner');
    }
    if (rec.difficulty === 'advanced') {
      score -= 1;
    }
  }

  return { score: Math.round(score * 10) / 10, reasons };
};

/**
 * Personalize and sort recommendations based on user context.
 * Returns a new array sorted by personalization score (descending).
 */
export const personalizeRecommendations = (
  recommendations: Recommendation[],
  ctx: PersonalizationContext
): ScoredRecommendation[] => {
  if (!recommendations || recommendations.length === 0) {
    return [];
  }

  const scored = recommendations.map((rec) => {
    const { score, reasons } = scoreRecommendation(rec, ctx);
    return { ...rec, personalizationScore: score, personalizationReasons: reasons };
  });

  // Sort by score descending, keep stable for equal scores (use id as tiebreaker)
  scored.sort((a, b) => {
    if (b.personalizationScore !== a.personalizationScore) {
      return b.personalizationScore - a.personalizationScore;
    }
    return a.id.localeCompare(b.id);
  });

  logger.debug('Personalized recommendations:', {
    top: scored.slice(0, 3).map((r) => ({ id: r.id, score: r.personalizationScore, reasons: r.personalizationReasons })),
    context: {
      moodTrend: ctx.moodTrend?.trend ?? 'none',
      timeOfDay: getTimeOfDay(ctx.hour),
      completed: ctx.completedRecIds.length,
      streak: ctx.dayStreak,
    },
  });

  return scored;
};
