/**
 * Dashboard Data Hook - Centralized Backend Integration
 * Handles caching, error handling, and data fetching for Dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { getDashboardSummary } from '../api/api';
import { analytics } from '../services/analytics';

interface DashboardStats {
  totalMoods: number;
  totalChats: number;
  averageMood: number;
  streakDays: number;
  weeklyGoal: number;
  weeklyProgress: number;
  recentActivity: Array<{
    id: string;
    type: 'mood' | 'chat' | 'meditation';
    timestamp: Date;
    description: string;
  }>;
}

interface UseDashboardDataReturn {
  stats: DashboardStats;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// In-memory cache with TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedData: { stats: DashboardStats; timestamp: number } | null = null;

export const useDashboardData = (userId?: string): UseDashboardDataReturn => {
  const [stats, setStats] = useState<DashboardStats>({
    totalMoods: 0,
    totalChats: 0,
    averageMood: 0,
    streakDays: 0,
    weeklyGoal: 7,
    weeklyProgress: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Check cache first (client-side caching)
    if (!forceRefresh && cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      setStats(cachedData.stats);
      setLoading(false);
      analytics.track('Dashboard Cache Hit', { userId });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const startTime = performance.now();

      // Single API call - backend handles batching and caching
      const data = await getDashboardSummary(userId);

      // Map backend response to frontend stats format
      const newStats: DashboardStats = {
        totalMoods: data.totalMoods || 0,
        totalChats: data.totalChats || 0,
        averageMood: data.averageMood || 0,
        streakDays: data.streakDays || 0,
        weeklyGoal: data.weeklyGoal || 7,
        weeklyProgress: data.weeklyProgress || 0,
        recentActivity: (data.recentActivity || []).map((activity: any) => ({
          ...activity,
          timestamp: new Date(activity.timestamp),
        })),
      };

      // Update cache
      cachedData = {
        stats: newStats,
        timestamp: Date.now(),
      };

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
      if (!stats.totalMoods && !stats.totalChats) {
        // Only reset if no data exists
        setStats({
          totalMoods: 0,
          totalChats: 0,
          averageMood: 0,
          streakDays: 0,
          weeklyGoal: 7,
          weeklyProgress: 0,
          recentActivity: [],
        });
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    analytics.track('Dashboard Refreshed', { userId });
    await loadDashboardData(true); // Force refresh
  }, [loadDashboardData, userId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return { stats, loading, error, refresh };
};

// Clear cache utility (call on logout)
export const clearDashboardCache = () => {
  cachedData = null;
};
