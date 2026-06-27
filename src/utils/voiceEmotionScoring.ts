/**
 * Convert voice emotion to mood score (1-10) plus circumplex valence/arousal.
 * Shared utility used by SuperMoodLogger and VoicePage.
 */
export interface EmotionMoodMapping {
  score: number;
  valence: number;
  arousal: number;
}

export const voiceEmotionToMoodScore = (
  emotion: string,
  valence?: number,
  arousal?: number
): EmotionMoodMapping => {
  const emotionMap: Record<string, EmotionMoodMapping> = {
    happy: { score: 9, valence: 0.8, arousal: 0.6 },
    sad: { score: 3, valence: -0.7, arousal: -0.3 },
    anxious: { score: 4, valence: -0.5, arousal: 0.7 },
    angry: { score: 2, valence: -0.6, arousal: 0.8 },
    calm: { score: 7, valence: 0.5, arousal: -0.4 },
    neutral: { score: 5, valence: 0, arousal: 0 },
    tired: { score: 3, valence: -0.3, arousal: -0.6 },
  };

  const mapped = emotionMap[emotion] || emotionMap.neutral;

  if (!mapped) {
    return { score: 5, valence: 0, arousal: 0 };
  }

  return {
    score: mapped.score,
    valence: valence !== undefined ? valence : mapped.valence,
    arousal: arousal !== undefined ? arousal : mapped.arousal,
  };
};
