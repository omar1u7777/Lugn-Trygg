/**
 * Insights API - AI-powered wellness insights and recommendations
 * Connects to the v2 backend insight engine (CBT/ACT/statistical analysis).
 */

import { api } from './client';
import { ApiError } from './errors';
import { API_ENDPOINTS } from './constants';

/**
 * Insight as returned by backend v2 engine.
 * Maps directly to DailyInsightGeneratorV2 TherapeuticInsight fields.
 */
export interface BackendInsight {
  insight_id: string;
  user_id: string;
  insight_type: string;
  domain: string;
  title: string;
  message: string;
  recommendation: string;
  evidence: Record<string, unknown>;
  urgency: 'high' | 'medium' | 'low';
  suggested_action: string;
  related_memories: string[];
  values_alignment: string | null;
  behavioral_target: string | null;
  created_at: string;
  status: 'pending' | 'dismissed' | 'action_taken';
}

/**
 * Trigger insight generation for a user.
 * Backend runs v2 statistical analysis and saves insights to Firestore.
 */
export const generateInsights = async (userId: string): Promise<BackendInsight[]> => {
  try {
    const response = await api.post(`${API_ENDPOINTS.INSIGHTS.GENERATE}/${userId}`);
    return response.data.data?.insights || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get all pending insights for a user (already generated, not yet dismissed).
 */
export const getPendingInsights = async (userId: string): Promise<BackendInsight[]> => {
  try {
    const response = await api.get(`${API_ENDPOINTS.INSIGHTS.PENDING}/${userId}`);
    return response.data.data?.insights || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Dismiss an insight (user chose to ignore it).
 */
export const dismissInsight = async (insightId: string): Promise<void> => {
  try {
    await api.post(`${API_ENDPOINTS.INSIGHTS.DISMISS}/${insightId}`);
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Log that the user took action on an insight.
 */
export const markInsightActionTaken = async (
  insightId: string,
  action: string = 'completed'
): Promise<void> => {
  try {
    await api.post(`${API_ENDPOINTS.INSIGHTS.ACTION}/${insightId}`, { action });
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};
