/**
 * Biofeedback API - HRV analysis and guided breathing exercises
 * Real-time WebSocket communication for breathing guidance
 */

import { api, ApiError } from './client';
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
    return response.data.data?.patterns || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Start a breathing session
 * @param patternId - ID of the breathing pattern
 * @param durationSeconds - Target session duration
 */
export const startBreathingSession = async (
  patternId: string,
  durationSeconds: number = 300
): Promise<BreathingSession> => {
  try {
    const response = await api.post(API_ENDPOINTS.BIOFEEDBACK.START_SESSION, {
      pattern_id: patternId,
      duration_seconds: durationSeconds
    });
    return response.data.data?.session;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * End a breathing session
 * @param sessionId - ID of the session to end
 * @param hrvData - Optional HRV data from the session
 */
export const endBreathingSession = async (
  sessionId: string,
  hrvData?: Partial<HRVData>
): Promise<BreathingSession> => {
  try {
    const response = await api.post(`${API_ENDPOINTS.BIOFEEDBACK.END_SESSION}/${sessionId}`, {
      hrv_data: hrvData
    });
    return response.data.data?.session;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get breathing session history
 * @param limit - Number of sessions to retrieve
 */
export const getSessionHistory = async (limit: number = 10): Promise<SessionHistory> => {
  try {
    const response = await api.get(API_ENDPOINTS.BIOFEEDBACK.SESSION_HISTORY, {
      params: { limit }
    });
    return response.data.data;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Get HRV analysis
 * @param timeRange - Time range for analysis (e.g., '7d', '30d')
 */
export const getHRVAnalysis = async (timeRange: string = '7d'): Promise<HRVData> => {
  try {
    const response = await api.get(API_ENDPOINTS.BIOFEEDBACK.HRV_ANALYSIS, {
      params: { time_range: timeRange }
    });
    return response.data.data?.analysis;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error);
  }
};

/**
 * Create WebSocket connection for real-time biofeedback
 * @param sessionId - Session ID for the WebSocket connection
 * @param onMessage - Callback for WebSocket messages
 * @param onError - Callback for WebSocket errors
 * @returns WebSocket instance
 */
export const createBiofeedbackWebSocket = (
  sessionId: string,
  onMessage: (data: unknown) => void,
  onError?: (error: Event) => void
): WebSocket => {
  const wsUrl = `${API_ENDPOINTS.BIOFEEDBACK.WS}?session_id=${sessionId}`;
  const ws = new WebSocket(wsUrl);
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch {
      onMessage(event.data);
    }
  };
  
  if (onError) {
    ws.onerror = onError;
  }
  
  return ws;
};
