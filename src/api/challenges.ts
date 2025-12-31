import { api } from "./client";
import { ApiError } from "./errors";
import { API_ENDPOINTS } from "./constants";

/**
 * Get available challenges
 * @returns Promise resolving to challenges data
 * @throws Error if challenges retrieval fails
 */
export const getChallenges = async () => {
  try {
    const response = await api.get(API_ENDPOINTS.CHALLENGES.CHALLENGES);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Join a challenge
 * @param challengeId - Challenge ID to join
 * @returns Promise resolving to join response
 * @throws Error if join fails
 */
export const joinChallenge = async (challengeId: string) => {
  try {
    const response = await api.post(`${API_ENDPOINTS.CHALLENGES.CHALLENGE_JOIN}/${challengeId}/join`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Leave a challenge
 * @param challengeId - Challenge ID to leave
 * @returns Promise resolving to leave response
 * @throws Error if leave fails
 */
export const leaveChallenge = async (challengeId: string) => {
  try {
    const response = await api.post(`${API_ENDPOINTS.CHALLENGES.CHALLENGE_LEAVE}/${challengeId}/leave`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get challenge progress
 * @param challengeId - Challenge ID
 * @returns Promise resolving to progress data
 * @throws Error if progress retrieval fails
 */
export const getChallengeProgress = async (challengeId: string) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.CHALLENGES.CHALLENGE_PROGRESS}/${challengeId}`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get user's challenges
 * @param userId - User ID
 * @returns Promise resolving to user challenges data
 * @throws Error if retrieval fails
 */
export const getUserChallenges = async (userId: string) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.CHALLENGES.USER_CHALLENGES}/${userId}`);
    return response.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};