import { api } from "./client";
import { API_ENDPOINTS } from "./constants";

// ============================================================================
// Types
// ============================================================================

/**
 * Journal entry interface (camelCase primary, snake_case for backwards compatibility)
 */
export interface JournalEntry {
  id: string;
  content: string;
  mood?: number;
  tags?: string[];
  // Primary camelCase format (from APIResponse)
  createdAt?: string;
  updatedAt?: string;
  // Legacy snake_case format (backwards compatibility)
  created_at?: string;
  updated_at?: string;
}

/**
 * Create journal entry request
 */
export interface CreateJournalEntryRequest {
  content: string;
  mood?: number;
  tags?: string[];
}

/**
 * Update journal entry request
 */
export interface UpdateJournalEntryRequest {
  content?: string;
  mood?: number;
  tags?: string[];
}

/**
 * Journal API response wrapper
 */
export interface JournalApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Save a journal entry
 * @param content - Journal entry content
 * @param mood - Optional mood score (1-10)
 * @param tags - Optional tags array
 * @returns Promise resolving to journal entry data
 * @throws Error if journal entry save fails
 */
export const saveJournalEntry = async (
  content: string,
  mood?: number,
  tags?: string[]
): Promise<JournalEntry> => {
  console.log('📝 API - saveJournalEntry called', { contentLength: content.length, mood, tags });
  try {
    const response = await api.post<JournalApiResponse<JournalEntry>>(
      `${API_ENDPOINTS.JOURNAL.ENTRIES}/journal`,
      { content, mood, tags }
    );
    console.log('✅ Journal entry saved successfully');
    return response.data?.data || response.data as unknown as JournalEntry;
  } catch (error: unknown) {
    const apiError = error as { response?: { data?: { error?: string } } };
    console.error("❌ Save journal entry error:", apiError);
    throw new Error(apiError.response?.data?.error || "Failed to save journal entry");
  }
};

/**
 * Get journal entries for a user
 * @param limit - Maximum number of entries to retrieve (default: 50, max: 100)
 * @returns Promise resolving to journal entries array
 * @throws Error if journal entries retrieval fails
 */
export const getJournalEntries = async (
  limit: number = 50
): Promise<JournalEntry[]> => {
  console.log('📝 API - getJournalEntries called', { limit });
  try {
    const response = await api.get<JournalApiResponse<{ entries: JournalEntry[] }>>(
      `${API_ENDPOINTS.JOURNAL.ENTRIES}/journal?limit=${Math.min(limit, 100)}`
    );
    const responseData = response.data?.data || response.data;
    const entries = (responseData as { entries?: JournalEntry[] }).entries || [];
    console.log('✅ Journal entries retrieved:', entries.length);
    return entries;
  } catch (error: unknown) {
    const apiError = error as { response?: { data?: { error?: string } } };
    console.error("❌ Get journal entries error:", apiError);
    throw new Error(apiError.response?.data?.error || "Failed to get journal entries");
  }
};

/**
 * Update a journal entry
 * @param userId - User ID
 * @param entryId - Journal entry ID
 * @param data - Fields to update
 * @returns Promise resolving to updated entry data
 * @throws Error if update fails
 */
export const updateJournalEntry = async (
  userId: string,
  entryId: string,
  data: UpdateJournalEntryRequest
): Promise<JournalEntry> => {
  console.log('📝 API - updateJournalEntry called', { userId, entryId, data });
  try {
    const response = await api.put<JournalApiResponse<JournalEntry>>(
      `${API_ENDPOINTS.JOURNAL.ENTRY}/${userId}/journal/${entryId}`,
      data
    );
    console.log('✅ Journal entry updated successfully');
    return response.data?.data || response.data as unknown as JournalEntry;
  } catch (error: unknown) {
    const apiError = error as { response?: { data?: { error?: string } } };
    console.error("❌ Update journal entry error:", apiError);
    throw new Error(apiError.response?.data?.error || "Failed to update journal entry");
  }
};

/**
 * Delete a journal entry
 * @param userId - User ID
 * @param entryId - Journal entry ID
 * @returns Promise resolving when deletion is complete
 * @throws Error if deletion fails
 */
export const deleteJournalEntry = async (
  userId: string,
  entryId: string
): Promise<void> => {
  console.log('📝 API - deleteJournalEntry called', { userId, entryId });
  try {
    await api.delete(`${API_ENDPOINTS.JOURNAL.ENTRY}/${userId}/journal/${entryId}`);
    console.log('✅ Journal entry deleted successfully');
  } catch (error: unknown) {
    const apiError = error as { response?: { data?: { error?: string } } };
    console.error("❌ Delete journal entry error:", apiError);
    throw new Error(apiError.response?.data?.error || "Failed to delete journal entry");
  }
};

/**
 * Get a single journal entry by ID
 * @param userId - User ID
 * @param entryId - Journal entry ID
 * @returns Promise resolving to journal entry or null if not found
 * @throws Error if retrieval fails
 */
export const getJournalEntryById = async (
  userId: string,
  entryId: string
): Promise<JournalEntry | null> => {
  console.log('📝 API - getJournalEntryById called', { userId, entryId });
  try {
    // Get all entries and find the specific one (backend doesn't have single entry endpoint)
    const entries = await getJournalEntries(100);
    const entry = entries.find(e => e.id === entryId);
    console.log('✅ Journal entry lookup:', entry ? 'found' : 'not found');
    return entry || null;
  } catch (error: unknown) {
    const apiError = error as { response?: { data?: { error?: string } } };
    console.error("❌ Get journal entry by ID error:", apiError);
    throw new Error(apiError.response?.data?.error || "Failed to get journal entry");
  }
};

// ============================================================================
// Exported API Object
// ============================================================================

/**
 * Journal API object with all operations
 */
export const journalApi = {
  getEntries: getJournalEntries,
  getEntryById: getJournalEntryById,
  createEntry: saveJournalEntry,
  updateEntry: updateJournalEntry,
  deleteEntry: deleteJournalEntry,
};

export default journalApi;