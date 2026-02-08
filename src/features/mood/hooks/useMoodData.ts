/**
 * useMoodData Hook
 * 
 * Custom hook for managing mood data fetching, caching, and state.
 * Provides a clean interface for mood-related operations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMoods, logMood as apiLogMood, getWeeklyAnalysis } from '../../../api/api';
import useAuth from '../../../hooks/useAuth';
import { MoodEntry, MoodStats, MoodTrend, MOOD_COLORS } from '../types';

interface UseMoodDataOptions {
  autoFetch?: boolean;
  limit?: number;
  cacheTime?: number;
}

interface UseMoodDataReturn {
  moods: MoodEntry[];
  stats: MoodStats | null;
  trends: MoodTrend[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  logMood: (mood: Omit<MoodEntry, 'id' | 'userId' | 'timestamp'>) => Promise<boolean>;
  getMoodColor: (score: number) => string;
  getAverageScore: () => number;
}

// Cache for mood data
const moodCache = new Map<string, { data: MoodEntry[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useMoodData(options: UseMoodDataOptions = {}): UseMoodDataReturn {
  const { autoFetch = true, limit = 50, cacheTime = CACHE_DURATION } = options;
  const { user } = useAuth();
  
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [stats, setStats] = useState<MoodStats | null>(null);
  const [trends, setTrends] = useState<MoodTrend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const userId = user?.user_id;

  const fetchMoods = useCallback(async () => {
    if (!userId) return;

    // Check cache
    const cached = moodCache.get(userId);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      setMoods(cached.data);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [moodsData, weeklyData] = await Promise.all([
        getMoods(userId).catch(() => []),
        getWeeklyAnalysis(userId).catch(() => ({})),
      ]);

      // Transform and limit data
      const transformedMoods = (moodsData || [])
        .slice(0, limit)
        .map((m: any) => ({
          id: m.id || m.mood_id,
          userId: m.user_id,
          score: m.mood_score || m.score,
          mood: m.mood || getMoodLabel(m.mood_score || m.score),
          text: m.text || m.description,
          timestamp: new Date(m.timestamp || m.created_at),
          tags: m.tags || [],
        }));

      // Update cache
      moodCache.set(userId, { data: transformedMoods, timestamp: Date.now() });
      setMoods(transformedMoods);

      // Calculate stats
      if (transformedMoods.length > 0) {
        const avgScore = transformedMoods.reduce((sum: number, m: MoodEntry) => sum + m.score, 0) / transformedMoods.length;
        const moodCounts = transformedMoods.reduce((acc: Record<string, number>, m: MoodEntry) => {
          acc[m.mood] = (acc[m.mood] || 0) + 1;
          return acc;
        }, {});
        const mostCommon = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

        setStats({
          averageScore: Math.round(avgScore * 10) / 10,
          totalEntries: transformedMoods.length,
          streak: weeklyData.streak || 0,
          trend: calculateTrend(transformedMoods),
          mostCommonMood: mostCommon,
        });
      }

      // Calculate trends (last 7 days)
      const last7Days = transformedMoods
        .filter((m: MoodEntry) => {
          const daysDiff = (Date.now() - m.timestamp.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        })
        .map((m: MoodEntry) => ({
          date: m.timestamp.toISOString().split('T')[0],
          score: m.score,
          mood: m.mood,
        }));
      setTrends(last7Days);

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch moods'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, limit, cacheTime]);

  const logMood = useCallback(async (moodData: Omit<MoodEntry, 'id' | 'userId' | 'timestamp'>): Promise<boolean> => {
    if (!userId) return false;

    try {
      await apiLogMood({
        user_id: userId,
        mood_score: moodData.score,
        mood: moodData.mood,
        text: moodData.text,
      });

      // Invalidate cache
      moodCache.delete(userId);
      
      // Refetch to get updated data
      await fetchMoods();
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to log mood'));
      return false;
    }
  }, [userId, fetchMoods]);

  const getMoodColor = useCallback((score: number): string => {
    if (score >= 9) return MOOD_COLORS.ecstatic;
    if (score >= 7) return MOOD_COLORS.happy;
    if (score >= 5) return MOOD_COLORS.content;
    if (score >= 3) return MOOD_COLORS.sad;
    return MOOD_COLORS.stressed;
  }, []);

  const getAverageScore = useCallback((): number => {
    if (moods.length === 0) return 0;
    return moods.reduce((sum, m) => sum + m.score, 0) / moods.length;
  }, [moods]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && userId) {
      fetchMoods();
    }
  }, [autoFetch, userId, fetchMoods]);

  return useMemo(() => ({
    moods,
    stats,
    trends,
    isLoading,
    error,
    refetch: fetchMoods,
    logMood,
    getMoodColor,
    getAverageScore,
  }), [moods, stats, trends, isLoading, error, fetchMoods, logMood, getMoodColor, getAverageScore]);
}

// Helper functions
function getMoodLabel(score: number): string {
  if (score >= 9) return 'ecstatic';
  if (score >= 7) return 'happy';
  if (score >= 5) return 'content';
  if (score >= 3) return 'sad';
  return 'stressed';
}

function calculateTrend(moods: MoodEntry[]): 'up' | 'down' | 'stable' {
  if (moods.length < 3) return 'stable';
  
  const recent = moods.slice(0, 3);
  const older = moods.slice(3, 6);
  
  if (older.length === 0) return 'stable';
  
  const recentAvg = recent.reduce((sum, m) => sum + m.score, 0) / recent.length;
  const olderAvg = older.reduce((sum, m) => sum + m.score, 0) / older.length;
  
  const diff = recentAvg - olderAvg;
  
  if (diff > 0.5) return 'up';
  if (diff < -0.5) return 'down';
  return 'stable';
}

export default useMoodData;
