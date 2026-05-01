import { api } from "./client";
import { API_ENDPOINTS } from "./constants";
import { logger } from "../utils/logger";

/**
 * APIResponse wrapper from backend
 */
interface APIResponseWrapper<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * CSRF token response from backend (camelCase)
 */
interface CSRFTokenResponse {
  csrfToken: string;
  // Legacy snake_case alias
  csrf_token?: string;
}

/**
 * Recent activity item from dashboard
 */
export interface RecentActivityItem {
  id: string;
  type: 'mood' | 'chat' | 'exercise';
  timestamp: string;
  description: string;
}

/**
 * Dashboard summary response from backend
 */
export interface DashboardSummary {
  totalMoods: number;
  totalChats: number;
  averageMood: number;
  streakDays: number;
  weeklyGoal: number;
  weeklyProgress: number;
  wellnessGoals: string[];
  recentActivity: RecentActivityItem[];
  cached: boolean;
  responseTime: number;
}

/**
 * Quick stats response from backend
 */
export interface QuickStats {
  totalMoods: number;
  totalChats: number;
  cached: boolean;
  error?: string;
}

/**
 * Get CSRF token for form submissions
 * @returns Promise resolving to CSRF token
 */
export const getCSRFToken = async (): Promise<string> => {
  try {
    const response = await api.get<APIResponseWrapper<CSRFTokenResponse>>(API_ENDPOINTS.DASHBOARD.CSRF_TOKEN);
    // Handle APIResponse wrapper: { success: true, data: { csrfToken: "..." }, message: "..." }
    const responseData = response.data?.data || response.data;
    // Support both camelCase (new) and snake_case (legacy)
    const token = (responseData as CSRFTokenResponse).csrfToken || (responseData as CSRFTokenResponse).csrf_token || '';
    if (!token) {
      logger.warn('CSRF token response missing token field', { responseData });
    }
    return token;
  } catch (error: unknown) {
    const errorObj = error instanceof Error ? error : new Error('Unknown error fetching CSRF token');
    logger.error('CSRF token error:', errorObj);
    return '';
  }
};

/**
 * Gets complete dashboard summary in one API call
 * Replaces multiple getMoods, getWeeklyAnalysis, getChatHistory calls
 * Backend caches for 5 minutes for optimal performance
 * @param userId - User ID
 * @param forceRefresh - Whether to force refresh cached data
 * @returns Promise resolving to dashboard summary data
 * @throws Error if dashboard summary retrieval fails
 */
export const getDashboardSummary = async (userId: string, forceRefresh = false): Promise<DashboardSummary> => {
  if (!userId) {
    throw new Error('User ID is required for dashboard summary');
  }

  const startTime = performance.now();
  try {
    const url = `${API_ENDPOINTS.DASHBOARD.DASHBOARD_SUMMARY}/${userId}/summary`;

    const response = await api.get<APIResponseWrapper<DashboardSummary>>(url, {
      params: forceRefresh ? { forceRefresh: 'true' } : {}
    });
    const duration = performance.now() - startTime;

    // Handle APIResponse wrapper: { success: true, data: {...}, message: "..." }
    const responseData = response.data?.data || response.data;

    // Validate required fields
    if (!responseData || typeof responseData !== 'object') {
      throw new Error('Invalid dashboard summary response: missing data');
    }

    // Log performance metrics
    logger.debug(`Dashboard summary fetched in ${duration.toFixed(2)}ms`, {
      cached: responseData.cached || false,
      responseTime: responseData.responseTime,
      totalMoods: responseData.totalMoods,
      totalChats: responseData.totalChats,
      forceRefresh
    });

    return responseData as DashboardSummary;
  } catch (error: unknown) {
    const apiError = error as Record<string, unknown>;
    const responseData = (apiError.response as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    const errorMessage = (responseData?.error as string) || "Failed to load dashboard summary";
    logger.error('Dashboard summary fetch error:', { error: apiError, responseData });
    throw new Error(errorMessage);
  }
};

/**
 * Gets quick stats for real-time updates (1 minute cache)
 * Ultra-fast endpoint for dashboard refresh
 * @param userId - User ID
 * @returns Promise resolving to quick stats or fallback data
 */
export const getDashboardQuickStats = async (userId: string): Promise<QuickStats> => {
  if (!userId) {
    logger.warn('getDashboardQuickStats called without userId');
    return { totalMoods: 0, totalChats: 0, cached: false };
  }

  try {
    const response = await api.get<APIResponseWrapper<QuickStats>>(`${API_ENDPOINTS.DASHBOARD.DASHBOARD_QUICK_STATS}/${userId}/quick-stats`);
    // Handle APIResponse wrapper: { success: true, data: {...}, message: "..." }
    const responseData = response.data?.data || response.data;
    return responseData as QuickStats;
  } catch (error: unknown) {
    const apiError = error as Record<string, unknown>;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Quick stats error:', apiError);
    return { totalMoods: 0, totalChats: 0, cached: false, error: errorMessage };
  }
};

/**
 * Get user's wellness goals
 * @returns Promise resolving to wellness goals array
 * @throws Error if wellness goals retrieval fails
 */
export const getWellnessGoals = async () => {
  logger.debug('getWellnessGoals called');
  try {
    const response = await api.get(`${API_ENDPOINTS.USERS.WELLNESS_GOALS}/wellness-goals`);
    // Handle APIResponse wrapper: { success: true, data: { wellnessGoals: [...] }, message: "..." }
    const responseData = response.data?.data || response.data;
    const goals = responseData.wellnessGoals ?? [];
    if (!Array.isArray(goals)) {
      logger.warn('Wellness goals response is not an array', { responseData });
      return [];
    }
    logger.debug('Wellness goals retrieved:', goals);
    return goals;
  } catch (error: unknown) {
    const apiError = error as Record<string, unknown>;
    logger.error('Get wellness goals error:', apiError);
    return [];
  }
};

/**
 * Set user's wellness goals
 * @param goals - Array of wellness goal strings
 * @returns Promise resolving to wellness goals array
 * @throws Error if wellness goals save fails
 */
export const setWellnessGoals = async (goals: string[]) => {
  if (!Array.isArray(goals) || goals.length === 0) {
    throw new Error('wellnessGoals must be a non-empty list');
  }

  // Validate all goals are strings
  if (!goals.every(g => typeof g === 'string')) {
    throw new Error('All wellness goals must be strings');
  }

  logger.debug('setWellnessGoals called', { goals });
  try {
    const response = await api.post(`${API_ENDPOINTS.USERS.WELLNESS_GOALS}/wellness-goals`, {
      wellnessGoals: goals
    });
    // Handle APIResponse wrapper: { success: true, data: { wellnessGoals: [...] }, message: "..." }
    const responseData = response.data?.data || response.data;
    const savedGoals = responseData.wellnessGoals;
    if (!Array.isArray(savedGoals)) {
      logger.warn('Set wellness goals response is not an array', { responseData });
      return goals; // Return original goals as fallback
    }
    logger.debug('Wellness goals saved:', savedGoals);
    return savedGoals;
  } catch (error: unknown) {
    const apiError = error as Record<string, unknown>;
    logger.error('Set wellness goals error:', apiError);
    const responseData = (apiError.response as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    throw new Error((responseData?.error as string) || "Failed to save wellness goals");
  }
};