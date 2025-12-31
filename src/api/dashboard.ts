import { api } from "./client";
import { API_ENDPOINTS } from "./constants";

/**
 * Gets complete dashboard summary in one API call
 * Replaces multiple getMoods, getWeeklyAnalysis, getChatHistory calls
 * Backend caches for 5 minutes for optimal performance
 * @param userId - User ID
 * @param forceRefresh - Whether to force refresh cached data
 * @returns Promise resolving to dashboard summary data
 * @throws Error if dashboard summary retrieval fails
 */
export const getDashboardSummary = async (userId: string, forceRefresh = false) => {
  const startTime = performance.now();
  try {
    const url = `${API_ENDPOINTS.DASHBOARD.DASHBOARD_SUMMARY}/${userId}/summary`;

    const response = await api.get(url, {
      params: forceRefresh ? { forceRefresh: 'true' } : {}
    });
    const duration = performance.now() - startTime;

    // Log performance metrics
    console.log(`✅ Dashboard summary fetched in ${duration.toFixed(2)}ms`, {
      cached: response.data.cached || false,
      responseTime: response.data.responseTime,
      totalMoods: response.data.totalMoods,
      totalChats: response.data.totalChats,
      forceRefresh
    });

    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    throw new Error((apiError.response?.data as any)?.error || "Failed to load dashboard summary");
  }
};

/**
 * Gets quick stats for real-time updates (1 minute cache)
 * Ultra-fast endpoint for dashboard refresh
 * @param userId - User ID
 * @returns Promise resolving to quick stats or fallback data
 */
export const getDashboardQuickStats = async (userId: string) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.DASHBOARD.DASHBOARD_QUICK_STATS}/${userId}/quick-stats`);
    return response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Quick stats error:", apiError);
    return { totalMoods: 0, totalChats: 0, cached: false };
  }
};

/**
 * Get user's wellness goals
 * @param userId - User ID
 * @returns Promise resolving to wellness goals array
 * @throws Error if wellness goals retrieval fails
 */
export const getWellnessGoals = async (userId: string) => {
  console.log('🎯 API - getWellnessGoals called', { userId });
  try {
    const response = await api.get(`${API_ENDPOINTS.USERS.WELLNESS_GOALS}/${userId}/wellness-goals`);
    // Handle APIResponse wrapper: { success: true, data: { wellnessGoals: [...] }, message: "..." }
    const responseData = response.data?.data || response.data;
    console.log('✅ API - Wellness goals retrieved:', responseData.wellnessGoals);
    return responseData.wellnessGoals;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Get wellness goals error:", apiError);
    return [];
  }
};

/**
 * Set user's wellness goals
 * @param userId - User ID
 * @param goals - Array of wellness goal strings
 * @returns Promise resolving to wellness goals array
 * @throws Error if wellness goals save fails
 */
export const setWellnessGoals = async (userId: string, goals: string[]) => {
  console.log('🎯 API - setWellnessGoals called', { userId, goals });
  try {
    const response = await api.post(`${API_ENDPOINTS.USERS.WELLNESS_GOALS}/${userId}/wellness-goals`, {
      wellnessGoals: goals
    });
    // Handle APIResponse wrapper: { success: true, data: { wellnessGoals: [...] }, message: "..." }
    const responseData = response.data?.data || response.data;
    console.log('✅ API - Wellness goals saved:', responseData.wellnessGoals);
    return responseData.wellnessGoals;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Set wellness goals error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to save wellness goals");
  }
};