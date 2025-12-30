/**
 * Dashboard Data Hook - Centralized Backend Integration
 * Handles caching, error handling, and data fetching for Dashboard
 * Respects subscription limits for free tier users
 */

import { useState, useEffect, useCallback } from 'react';
import { getDashboardSummary } from '../api/dashboard';
import { analytics } from '../services/analytics';

interface RawActivity {
  id: string;
  type: string;
  timestamp: string | Date;
  description: string;
}

interface Activity {
  id: string;
  type: 'mood' | 'chat' | 'meditation' | 'achievement' | 'journal';
  timestamp: Date;
  description: string;
}

interface DashboardStats {
  totalMoods: number;
  totalChats: number;
  averageMood: number;
  streakDays: number;
  weeklyGoal: number;
  weeklyProgress: number;
  wellnessGoals: any[];
  recentActivity: Activity[];
}

interface UseDashboardDataReturn {
  stats: DashboardStats;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// In-memory cache with TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  stats: DashboardStats;
  timestamp: number;
}

const dashboardCache: Record<string, CacheEntry> = {};

const createInitialStats = (): DashboardStats => ({
  totalMoods: 0,
  totalChats: 0,
  averageMood: 0,
  streakDays: 0,
  weeklyGoal: 7,
  weeklyProgress: 0,
  wellnessGoals: [],
  recentActivity: [],
});

const getCachedStatsForUser = (userId: string): DashboardStats | null => {
  const cachedEntry = dashboardCache[userId];
  if (!cachedEntry) {
    return null;
  }

  const isFresh = Date.now() - cachedEntry.timestamp < CACHE_TTL;
  if (!isFresh) {
    delete dashboardCache[userId];
    return null;
  }

  return cachedEntry.stats;
};

const setCachedStatsForUser = (userId: string, stats: DashboardStats) => {
  dashboardCache[userId] = {
    stats,
    timestamp: Date.now(),
  };
};

export const useDashboardData = (userId?: string): UseDashboardDataReturn => {
  const [stats, setStats] = useState<DashboardStats>(() => createInitialStats());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Check cache first (client-side caching) scoped per user
    if (!forceRefresh) {
      const cachedStats = getCachedStatsForUser(userId);
      if (cachedStats) {
        setStats(cachedStats);
        setLoading(false);
        analytics.track('Dashboard Cache Hit', { userId });
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const startTime = performance.now();

      // Single API call - backend handles batching and caching
      const data = await getDashboardSummary(userId, forceRefresh);

      console.log('📊 Dashboard data received:', data);
      console.log('🎯 Wellness goals from backend:', data.wellnessGoals);

      // Map backend response to frontend stats format
      const newStats: DashboardStats = {
        totalMoods: data.totalMoods || 0,
        totalChats: data.totalChats || 0,
        averageMood: data.averageMood || 0,
        streakDays: data.streakDays || 0,
        weeklyGoal: data.weeklyGoal || 7,
        weeklyProgress: data.weeklyProgress || 0,
        wellnessGoals: data.wellnessGoals || [],
        recentActivity: (data.recentActivity || []).map((activity: RawActivity) => ({
          id: activity.id,
          type: activity.type as 'mood' | 'chat' | 'meditation',
          timestamp: new Date(activity.timestamp),
          description: activity.description,
        })),
      };

      // Update cache for this user
      setCachedStatsForUser(userId, newStats);

      setStats(newStats);

      const loadTime = performance.now() - startTime;
      analytics.track('Dashboard Data Loaded', {
        userId,
        loadTime,
        cached: data.cached || false,
        backendResponseTime: data.responseTime,
        totalMoods: newStats.totalMoods,
        totalChats: newStats.totalChats,
      });

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setError(error as Error);

      analytics.track('Dashboard Load Error', {
        userId,
        error: (error as Error).message,
      });

      // Keep previous data if available
      setStats((prev) => {
        if (!prev.totalMoods && !prev.totalChats) {
          return createInitialStats();
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    console.log('🔄 REFRESH FUNCTION CALLED in useDashboardData', { userId });
    analytics.track('Dashboard Refreshed', { userId });
    await loadDashboardData(true); // Force refresh
    console.log('✅ REFRESH COMPLETED');
  }, [loadDashboardData, userId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return { stats, loading, error, refresh };
};

// Clear cache utility (call on logout)
export const clearDashboardCache = (targetUserId?: string) => {
  if (targetUserId) {
    delete dashboardCache[targetUserId];
    return;
  }

  Object.keys(dashboardCache).forEach((key) => delete dashboardCache[key]);
};
