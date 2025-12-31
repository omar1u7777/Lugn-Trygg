import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

/**
 * Get user's memories
 * @param userId - User ID
 * @returns Promise resolving to memories data
 * @throws Error if memories retrieval fails
 */
export const getMemories = async (userId: string) => {
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
 * Get memory URL
 * @param memoryId - Memory ID
 * @returns Promise resolving to memory URL
 * @throws Error if URL retrieval fails
 */
export const getMemoryUrl = async (memoryId: string) => {
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
 * Create a new memory
 * @param userId - User ID
 * @param memoryData - Memory data
 * @returns Promise resolving to created memory
 * @throws Error if creation fails
 */
export const createMemory = async (userId: string, memoryData: any) => {
  try {
    const response = await api.post(API_ENDPOINTS.MEMORY.LIST_MEMORIES, {
      user_id: userId,
      ...memoryData
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
 * Update a memory
 * @param memoryId - Memory ID
 * @param memoryData - Updated memory data
 * @returns Promise resolving to updated memory
 * @throws Error if update fails
 */
export const updateMemory = async (memoryId: string, memoryData: any) => {
  try {
    const response = await api.put(`${API_ENDPOINTS.MEMORY.LIST_MEMORIES}/${memoryId}`, memoryData);
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
 * @throws Error if deletion fails
 */
export const deleteMemory = async (memoryId: string) => {
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