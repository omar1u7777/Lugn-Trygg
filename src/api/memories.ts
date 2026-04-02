import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

/**
 * Memory metadata from backend
 */
export interface Memory {
  id: string;
  // Primary camelCase format (from APIResponse)
  filePath?: string | null;
  createdAt?: string;
  // Legacy snake_case format (backwards compatibility)
  file_path?: string | null;
  created_at?: string;
  timestamp: string | null;
}

/**
 * Get user's memories
 * @param userId - User ID
 * @returns Promise resolving to memories array
 * @throws ApiError if memories retrieval fails
 */
export const getMemories = async (userId: string): Promise<Memory[]> => {
  try {
    const response = await api.get(`${API_ENDPOINTS.MEMORY.LIST_MEMORIES}/${userId}`);
    return response.data.memories || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};