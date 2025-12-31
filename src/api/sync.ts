import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

export interface SyncHistoryEntry {
  id: string;
  timestamp: Date;
  operation: string;
  status: 'success' | 'failed' | 'pending';
  details?: string;
}

/**
 * Get sync history for user
 * @param userId - User ID
 * @returns Promise resolving to sync history
 * @throws Error if retrieval fails
 */
export const getSyncHistory = async (userId: string): Promise<SyncHistoryEntry[]> => {
  try {
    const response = await api.get(`${API_ENDPOINTS.SYNC_HISTORY.SYNC_HISTORY_LIST}/${userId}`);
    return response.data.history || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Retry a sync operation
 * @param operationId - Operation ID to retry
 * @returns Promise resolving to retry result
 * @throws Error if retry fails
 */
export const retrySyncOperation = async (operationId: string) => {
  try {
    const response = await api.post(`${API_ENDPOINTS.SYNC_HISTORY.SYNC_HISTORY_RETRY}/${operationId}`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};