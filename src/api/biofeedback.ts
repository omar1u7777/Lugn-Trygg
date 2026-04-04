/**
 * Biofeedback API - HRV analysis and guided breathing exercises
 * Real-time WebSocket communication for breathing guidance
 */

import { api } from './client';
import { unwrapApiResponse } from './client';
import { ApiError } from './errors';
import { API_ENDPOINTS } from './constants';

// Types
export interface BreathingPattern {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  inhale_seconds: number;
  hold_seconds: number;
  exhale_seconds: number;
  hold_after_exhale_seconds: number;
  benefits: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface BreathingSession {
  session_id: string;
  pattern: BreathingPattern;
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
  cycles_completed: number;
  hrv_data?: HRVData;
  coherence_score?: number;
}

export interface HRVData {
  rmssd: number;
  sdnn: number;
  pnn50: number;
  coherence: number;
  resonance_frequency: number;
}

export interface SessionHistory {
  sessions: BreathingSession[];
  total_sessions: number;
  total_minutes: number;
  average_coherence: number;
}

/**
 * Get available breathing patterns
 */
export const getBreathingPatterns = async (): Promise<BreathingPattern[]> => {
  try {
    const response = await api.get(API_ENDPOINTS.BIOFEEDBACK.PATTERNS);
    const payload = unwrapApiResponse<{ patterns?: BreathingPattern[] } | BreathingPattern[]>(response.data);
    if (Array.isArray(payload)) {
      return payload;
    }
    return payload?.patterns || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Start a breathing session
 * @param patternId - ID of the breathing pattern (e.g. 'coherence', 'relax')
 * @param durationMinutes - Target session duration in minutes (default 5)
 */
export const startBreathingSession = async (
  patternId: string,
  durationMinutes: number = 5
): Promise<{ session_id: string; pattern: string; ws_namespace: string | null }> => {
  try {
    // Backend expects { pattern, duration } where duration is in minutes
    const response = await api.post(API_ENDPOINTS.BIOFEEDBACK.START, {
      pattern: patternId,
      duration: durationMinutes
    });
    const payload = unwrapApiResponse<{
      session_id: string;
      pattern: string;
      ws_namespace: string | null;
    }>(response.data);
    return payload;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * End a breathing session
 * @param sessionId - ID of the session to end
 */
export const endBreathingSession = async (
  sessionId: string
): Promise<{ success: boolean; summary: Record<string, unknown> }> => {
  try {
    // Backend route: POST /api/v1/biofeedback/end/<session_id>
    const response = await api.post(`${API_ENDPOINTS.BIOFEEDBACK.END}/${sessionId}`, {});
    const payload = unwrapApiResponse<{ success?: boolean; summary?: Record<string, unknown> }>(response.data);
    return {
      success: (payload as { success?: boolean }).success ?? true,
      summary: (payload as { summary?: Record<string, unknown> }).summary || {}
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get breathing session history
 * @param limit - Number of sessions to retrieve
 */
export const getSessionHistory = async (limit: number = 10): Promise<{ sessions: SessionHistory['sessions']; total: number }> => {
  try {
    const response = await api.get(API_ENDPOINTS.BIOFEEDBACK.HISTORY, {
      params: { limit }
    });
    const payload = unwrapApiResponse<{ sessions?: SessionHistory['sessions']; total?: number }>(response.data);
    return {
      sessions: payload?.sessions || [],
      total: payload?.total || 0
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};
