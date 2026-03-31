/**
 * Unified Memory API - Multimedia memories (text, image, audio, video)
 */

import { api, ApiError } from './client';
import { API_ENDPOINTS } from './constants';

export interface MultimediaMemory {
  id: string;
  user_id: string;
  type: 'text' | 'image' | 'audio' | 'video';
  title: string;
  content?: string;
  media_url?: string;
  thumbnail_url?: string;
  tags: string[];
  emotion?: string;
  sentiment_score?: number;
  created_at: string;
  updated_at?: string;
}

export interface UploadMemoryResponse {
  memory: MultimediaMemory;
  upload_url?: string;
}

/**
 * Get all multimedia memories
 * @param type - Filter by memory type
 * @param limit - Number of memories to retrieve
 */
export const getMemories = async (
  type?: 'text' | 'image' | 'audio' | 'video',
  limit: number = 50
): Promise<MultimediaMemory[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.MEMORY_UNIFIED.MEMORIES, {
      params: { type, limit }
    });
    return response.data.data?.memories || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get a single memory by ID
 * @param memoryId - Memory ID
 */
export const getMemory = async (memoryId: string): Promise<MultimediaMemory> => {
  try {
    const response = await api.get(`${API_ENDPOINTS.MEMORY_UNIFIED.MEMORY}/${memoryId}`);
    return response.data.data?.memory;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Upload a multimedia memory
 * @param file - File to upload (for image/audio/video)
 * @param metadata - Memory metadata
 */
export const uploadMemory = async (
  file?: File,
  metadata: Partial<MultimediaMemory> = {}
): Promise<UploadMemoryResponse> => {
  try {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    const response = await api.post(API_ENDPOINTS.MEMORY_UNIFIED.UPLOAD, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Delete a memory
 * @param memoryId - Memory ID to delete
 */
export const deleteMemory = async (memoryId: string): Promise<void> => {
  try {
    await api.delete(`${API_ENDPOINTS.MEMORY_UNIFIED.DELETE}/${memoryId}`);
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};
