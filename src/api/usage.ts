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

/**
 * Get current usage status from backend
 */
export const getUsageStatus = async (): Promise<UsageStatus> => {
  const response = await api.get('/usage/status');
  return response.data.data;
};

/**
 * Increment mood log count
 */
export const incrementMoodLog = async (): Promise<IncrementResponse> => {
  const response = await api.post('/usage/increment/mood');
  return response.data.data;
};

/**
 * Increment chat message count
 */
export const incrementChatMessage = async (): Promise<IncrementResponse> => {
  const response = await api.post('/usage/increment/chat');
  return response.data.data;
};
