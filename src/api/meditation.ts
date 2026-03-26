import { api } from "./client";
import { API_ENDPOINTS } from "./constants";
import { logger } from "../utils/logger";
import { getApiErrorMessage } from "./errorUtils";

/**
 * Save a meditation session
 * @param sessionData - Meditation session data
 * @returns Promise resolving to meditation session data
 * @throws Error if meditation session save fails
 */
export const saveMeditationSession = async (sessionData: {
  type: string;
  duration: number;
  technique?: string;
  completedCycles?: number;
  moodBefore?: number;
  moodAfter?: number;
  notes?: string;
}) => {
  logger.debug('saveMeditationSession called', { sessionData });
  try {
    const response = await api.post(`${API_ENDPOINTS.USERS.MEDITATION_SESSIONS}/meditation-sessions`, sessionData);
    logger.debug('Meditation session saved successfully');
    // Handle APIResponse wrapper: { success: true, data: {...}, message: "..." }
    return response.data?.data || response.data;
  } catch (error: unknown) {
    logger.error("Save meditation session error:", error);
    throw new Error(getApiErrorMessage(error, "Failed to save meditation session"));
  }
};

/**
 * Get meditation sessions for a user
 * @param limit - Maximum number of sessions to retrieve (default: 50)
 * @returns Promise resolving to meditation sessions data
 * @throws Error if meditation sessions retrieval fails
 */
export const getMeditationSessions = async (limit: number = 50) => {
  logger.debug('getMeditationSessions called', { limit });
  try {
    const response = await api.get(`${API_ENDPOINTS.USERS.MEDITATION_SESSIONS}/meditation-sessions?limit=${limit}`);
    // Handle APIResponse wrapper: { success: true, data: { sessions: [...], stats: {...} }, message: "..." }
    const responseData = response.data?.data || response.data;
    logger.debug('Meditation sessions retrieved:', responseData.sessions?.length || 0);
    return responseData;
  } catch (error: unknown) {
    logger.error("Get meditation sessions error:", error);
    throw new Error(getApiErrorMessage(error, "Failed to get meditation sessions"));
  }
};