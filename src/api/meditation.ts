import { api } from "./client";
import { API_ENDPOINTS } from "./constants";

/**
 * Save a meditation session
 * @param userId - User ID
 * @param sessionData - Meditation session data
 * @returns Promise resolving to meditation session data
 * @throws Error if meditation session save fails
 */
export const saveMeditationSession = async (userId: string, sessionData: {
  type: string;
  duration: number;
  technique?: string;
  completedCycles?: number;
  moodBefore?: number;
  moodAfter?: number;
  notes?: string;
}) => {
  console.log('🧘 API - saveMeditationSession called', { userId, sessionData });
  try {
    const response = await api.post(`${API_ENDPOINTS.USERS.MEDITATION_SESSIONS}/${userId}/meditation-sessions`, sessionData);
    console.log('✅ Meditation session saved successfully');
    // Handle APIResponse wrapper: { success: true, data: {...}, message: "..." }
    return response.data?.data || response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Save meditation session error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to save meditation session");
  }
};

/**
 * Get meditation sessions for a user
 * @param userId - User ID
 * @param limit - Maximum number of sessions to retrieve (default: 50)
 * @returns Promise resolving to meditation sessions data
 * @throws Error if meditation sessions retrieval fails
 */
export const getMeditationSessions = async (userId: string, limit: number = 50) => {
  console.log('🧘 API - getMeditationSessions called', { userId, limit });
  try {
    const response = await api.get(`${API_ENDPOINTS.USERS.MEDITATION_SESSIONS}/${userId}/meditation-sessions?limit=${limit}`);
    // Handle APIResponse wrapper: { success: true, data: { sessions: [...], stats: {...} }, message: "..." }
    const responseData = response.data?.data || response.data;
    console.log('✅ Meditation sessions retrieved:', responseData.sessions?.length || 0);
    return responseData;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Get meditation sessions error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to get meditation sessions");
  }
};