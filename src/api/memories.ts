import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

// ============================================================================
// Types (camelCase primary, snake_case for backwards compatibility)
// ============================================================================

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
 * Upload memory response
 */
export interface UploadMemoryResponse {
  success: boolean;
  data: {
    // Primary camelCase
    fileUrl?: string;
    memoryId?: string;
    // Legacy snake_case
    file_url?: string;
    memory_id?: string;
  };
  message: string;
}

/**
 * Memory URL response
 */
export interface MemoryUrlResponse {
  success: boolean;
  data: {
    url: string;
    // Primary camelCase
    memoryId?: string;
    filePath?: string;
    // Legacy snake_case
    memory_id?: string;
    file_path?: string;
  };
  message: string;
}

// ============================================================================
// API Functions
// ============================================================================

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

/**
 * Get memory URL by memory ID
 * @param memoryId - Memory ID
 * @returns Promise resolving to signed URL
 * @throws ApiError if URL retrieval fails
 */
export const getMemoryUrl = async (memoryId: string): Promise<string> => {
  try {
    const response = await api.get(`${API_ENDPOINTS.MEMORY.GET_MEMORY_URL}/${memoryId}`);
    return response.data.url;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Upload audio memory
 * @param audioFile - Audio file (mp3, wav, m4a)
 * @param userId - Optional user ID (defaults to authenticated user)
 * @returns Promise resolving to upload response
 * @throws ApiError if upload fails
 */
export const uploadMemory = async (
  audioFile: File,
  userId?: string
): Promise<UploadMemoryResponse> => {
  try {
    const formData = new FormData();
    formData.append('audio', audioFile);
    if (userId) {
      formData.append('user_id', userId);
    }
    
    const response = await api.post(API_ENDPOINTS.MEMORY.UPLOAD_MEMORY, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Delete a memory
 * @param memoryId - Memory ID
 * @returns Promise resolving to deletion response
 * @throws ApiError if deletion fails
 */
export const deleteMemory = async (memoryId: string): Promise<{ deleted: string }> => {
  try {
    const response = await api.delete(`${API_ENDPOINTS.MEMORY.LIST_MEMORIES}/${memoryId}`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

// ============================================================================
// API Object Export (alternative import style)
// ============================================================================

export const memoriesApi = {
  getMemories,
  getMemoryUrl,
  uploadMemory,
  deleteMemory,
};