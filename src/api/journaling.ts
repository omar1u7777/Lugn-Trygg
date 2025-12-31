import { api } from "./client";
import { API_ENDPOINTS } from "./constants";

/**
 * Save a journal entry
 * @param userId - User ID
 * @param content - Journal entry content
 * @param mood - Optional mood score (1-10)
 * @param tags - Optional tags array
 * @returns Promise resolving to journal entry data
 * @throws Error if journal entry save fails
 */
export const saveJournalEntry = async (userId: string, content: string, mood?: number, tags?: string[]) => {
  console.log('📝 API - saveJournalEntry called', { userId, contentLength: content.length, mood, tags });
  try {
    const response = await api.post(`${API_ENDPOINTS.USERS.JOURNAL}/${userId}/journal`, {
      content,
      mood,
      tags
    });
    console.log('✅ Journal entry saved successfully');
    // Handle APIResponse wrapper: { success: true, data: {...}, message: "..." }
    return response.data?.data || response.data;
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Save journal entry error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to save journal entry");
  }
};

/**
 * Get journal entries for a user
 * @param userId - User ID
 * @param limit - Maximum number of entries to retrieve (default: 50)
 * @returns Promise resolving to journal entries array
 * @throws Error if journal entries retrieval fails
 */
export const getJournalEntries = async (userId: string, limit: number = 50) => {
  console.log('📝 API - getJournalEntries called', { userId, limit });
  try {
    const response = await api.get(`${API_ENDPOINTS.USERS.JOURNAL}/${userId}/journal?limit=${limit}`);
    // Handle APIResponse wrapper: { success: true, data: { entries: [...] }, message: "..." }
    const responseData = response.data?.data || response.data;
    console.log('✅ Journal entries retrieved:', responseData.entries?.length || 0);
    return responseData.entries || [];
  } catch (error: unknown) {
    const apiError = error as any;
    console.error("❌ Get journal entries error:", apiError);
    throw new Error((apiError.response?.data as any)?.error || "Failed to get journal entries");
  }
};