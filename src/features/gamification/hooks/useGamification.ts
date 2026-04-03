/**
 * useGamification Hook
 * 
 * Custom hook for managing gamification state and operations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMoods, getWeeklyAnalysis, getUserRewards } from '../../../api/api';
import useAuth from '../../../hooks/useAuth';
import { 
  Achievement, 
  Badge, 
  Challenge, 
  GamificationStats,
  LEVEL_TITLES,
} from '../types';
import { logger } from '../../../utils/logger';


interface UseGamificationOptions {
  autoFetch?: boolean;
}

interface UseGamificationReturn {
  stats: GamificationStats;
  achievements: Achievement[];
  badges: Badge[];
  challenges: Challenge[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  claimReward: (rewardId: string) => Promise<boolean>;
  getLevelTitle: () => string;
  getProgressToNextLevel: () => number;
}

export function useGamification(options: UseGamificationOptions = {}): UseGamificationReturn {
  const { autoFetch = true } = options;
  const { user } = useAuth();
  
  const [stats, setStats] = useState<GamificationStats>({
    level: 1,
    xp: 0,
    xpToNext: 100,
    streakDays: 0,
    achievementsUnlocked: 0,
    totalAchievements: 20,
    badgesEarned: 0,
    challengesCompleted: 0,
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const userId = user?.user_id;

  const fetchGamificationData = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch backend rewards (authoritative XP/level) and mood/weekly data in parallel
      const [moodsData, weeklyData, userRewardsData] = await Promise.all([
        getMoods(userId).catch(() => []),
        getWeeklyAnalysis(userId).catch(() => ({})),
        getUserRewards().catch(() => null),
      ]);

      // Calculate streak
      const moodCount = Array.isArray(moodsData) ? moodsData.length : 0;
      const streakDays = (weeklyData as any).streak || calculateStreakFromMoods(moodsData);

      // Use backend XP/level as authoritative source.
      // Fall back to estimated local XP only when API unavailable.
      let level: number;
      let xpInLevel: number;
      let xpForNextLevel: number;

      if (userRewardsData && userRewardsData.xp !== undefined) {
        level = userRewardsData.level ?? 1;
        xpInLevel = userRewardsData.progressXp ?? 0;
        xpForNextLevel = userRewardsData.neededXp ?? 100;
      } else {
        // Offline fallback with correct sqrt formula
        const totalXP = moodCount * 10;
        level = Math.floor(Math.sqrt(Math.max(0, totalXP) / 100)) + 1;
        const xpForCurrentLevel = ((level - 1) ** 2) * 100;
        xpForNextLevel = (level ** 2) * 100;
        xpInLevel = totalXP - xpForCurrentLevel;
      }

      // Generate achievements based on actual activity data
      const generatedAchievements = generateAchievements(moodCount, streakDays);
      const unlockedCount = generatedAchievements.filter(a => a.unlocked).length;

      setStats({
        level,
        xp: xpInLevel,
        xpToNext: xpForNextLevel,
        streakDays,
        achievementsUnlocked: unlockedCount,
        totalAchievements: generatedAchievements.length,
        badgesEarned: Math.floor(unlockedCount / 2),
        challengesCompleted: Math.floor(moodCount / 7),
      });

      setAchievements(generatedAchievements);
      setBadges(generateBadges(unlockedCount));
      setChallenges(generateChallenges(moodCount, streakDays));

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load gamification data'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const claimReward = useCallback(async (rewardId: string): Promise<boolean> => {
    // In a real app, this would call an API
    logger.debug('Claiming reward:', rewardId);
    return true;
  }, []);

  const getLevelTitle = useCallback((): string => {
    const titles = Object.entries(LEVEL_TITLES)
      .sort(([a], [b]) => Number(b) - Number(a));
    
    for (const [minLevel, title] of titles) {
      if (stats.level >= Number(minLevel)) {
        return title;
      }
    }
    return 'Nybörjare';
  }, [stats.level]);

  const getProgressToNextLevel = useCallback((): number => {
    if (stats.xpToNext === 0) return 100;
    return Math.round((stats.xp / stats.xpToNext) * 100);
  }, [stats.xp, stats.xpToNext]);

  useEffect(() => {
    if (autoFetch && userId) {
      fetchGamificationData();
    }
  }, [autoFetch, userId, fetchGamificationData]);

  return useMemo(() => ({
    stats,
    achievements,
    badges,
    challenges,
    isLoading,
    error,
    refetch: fetchGamificationData,
    claimReward,
    getLevelTitle,
    getProgressToNextLevel,
  }), [stats, achievements, badges, challenges, isLoading, error, fetchGamificationData, claimReward, getLevelTitle, getProgressToNextLevel]);
}

// Helper functions
function calculateStreakFromMoods(moods: any[]): number {
  if (!Array.isArray(moods) || moods.length === 0) return 0;
  
  const sorted = [...moods].sort((a, b) => 
    new Date(b.timestamp || b.created_at).getTime() - new Date(a.timestamp || a.created_at).getTime()
  );
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  for (const mood of sorted) {
    const moodDate = new Date(mood.timestamp || mood.created_at);
    moodDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((currentDate.getTime() - moodDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) {
      streak++;
      currentDate = new Date(moodDate);
    } else {
      break;
    }
  }
  
  return streak;
}

function generateAchievements(moodCount: number, streakDays: number): Achievement[] {
  return [
    {
      id: 'first_mood',
      title: 'Första steget',
      description: 'Logga ditt första humör',
      icon: '🌱',
      unlocked: moodCount >= 1,
      progress: Math.min(moodCount, 1),
      maxProgress: 1,
      rarity: 'common',
      category: 'mood',
      xpReward: 25,
    },
    {
      id: 'mood_week',
      title: 'Veckorutinen',
      description: 'Logga humör 7 dagar i rad',
      icon: '📅',
      unlocked: streakDays >= 7,
      progress: Math.min(streakDays, 7),
      maxProgress: 7,
      rarity: 'rare',
      category: 'streak',
      xpReward: 100,
    },
    {
      id: 'mood_month',
      title: 'Månadsexperten',
      description: 'Logga humör 30 dagar i rad',
      icon: '🏆',
      unlocked: streakDays >= 30,
      progress: Math.min(streakDays, 30),
      maxProgress: 30,
      rarity: 'epic',
      category: 'streak',
      xpReward: 500,
    },
    {
      id: 'mood_100',
      title: 'Centurion',
      description: 'Logga 100 humör',
      icon: '💯',
      unlocked: moodCount >= 100,
      progress: Math.min(moodCount, 100),
      maxProgress: 100,
      rarity: 'legendary',
      category: 'milestone',
      xpReward: 1000,
    },
    {
      id: 'mood_explorer',
      title: 'Humörutforskare',
      description: 'Logga 10 olika humör',
      icon: '🔍',
      unlocked: moodCount >= 10,
      progress: Math.min(moodCount, 10),
      maxProgress: 10,
      rarity: 'common',
      category: 'mood',
      xpReward: 50,
    },
  ];
}

function generateBadges(unlockedAchievements: number): Badge[] {
  return [
    {
      id: 'early_bird',
      name: 'Morgonpigg',
      description: 'Logga humör innan kl 8',
      icon: '🌅',
      earned: unlockedAchievements >= 1,
      category: 'mood',
      rarity: 'common',
    },
    {
      id: 'streak_master',
      name: 'Streak-mästare',
      description: 'Uppnå 7 dagars streak',
      icon: '🔥',
      earned: unlockedAchievements >= 2,
      category: 'streak',
      rarity: 'rare',
    },
  ];
}

function generateChallenges(moodCount: number, streakDays: number): Challenge[] {
  return [
    {
      id: 'daily_mood',
      title: 'Daglig check-in',
      description: 'Logga ditt humör idag',
      progress: moodCount > 0 ? 1 : 0,
      goal: 1,
      reward: '+10 XP',
      xpReward: 10,
      type: 'daily',
      completed: moodCount > 0,
    },
    {
      id: 'weekly_streak',
      title: 'Veckans streak',
      description: 'Logga humör 7 dagar i rad',
      progress: Math.min(streakDays, 7),
      goal: 7,
      reward: '+100 XP',
      xpReward: 100,
      type: 'weekly',
      completed: streakDays >= 7,
    },
  ];
}

export default useGamification;
