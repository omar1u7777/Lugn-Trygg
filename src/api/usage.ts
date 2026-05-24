import api from './client';

export interface UsageStatus {
  mood_logs: number;
  chat_messages: number;
  limits: {
    mood_logs_per_day: number;
    chat_messages_per_day: number;
  };
  date: string;
  subscription_tier: string;
}

export interface IncrementResponse {
  success: boolean;
  mood_logs?: number;
  chat_messages?: number;
  limit?: number;
}

const USAGE_BASE = '/api/v1/usage';

/**
 * Get current usage status from backend
 */
export const getUsageStatus = async (): Promise<UsageStatus> => {
  const response = await api.get(`${USAGE_BASE}/status`);
  return response.data.data;
};

/**
 * Increment mood log count
 */
export const incrementMoodLog = async (): Promise<IncrementResponse> => {
  const response = await api.post(`${USAGE_BASE}/increment/mood`);
  return response.data.data;
};

/**
 * Increment chat message count
 */
export const incrementChatMessage = async (): Promise<IncrementResponse> => {
  const response = await api.post(`${USAGE_BASE}/increment/chat`);
  return response.data.data;
};
