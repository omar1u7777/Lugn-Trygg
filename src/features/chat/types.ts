/**
 * Chat Feature Types
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    emotion?: string;
    sentiment?: number;
    suggestions?: string[];
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  title?: string;
  summary?: string;
}

export interface AIResponse {
  message: string;
  emotion?: string;
  suggestions?: string[];
  followUp?: string[];
  resources?: {
    title: string;
    url: string;
    type: 'article' | 'exercise' | 'video';
  }[];
}

export interface ChatStats {
  totalSessions: number;
  totalMessages: number;
  averageSessionLength: number;
  mostUsedTopics: string[];
}

// Predefined responses for common scenarios
export const QUICK_RESPONSES = [
  { id: 'anxiety', label: 'Jag känner mig orolig', emoji: '😰' },
  { id: 'sad', label: 'Jag är ledsen', emoji: '😢' },
  { id: 'stressed', label: 'Jag är stressad', emoji: '😫' },
  { id: 'happy', label: 'Jag mår bra idag', emoji: '😊' },
  { id: 'talk', label: 'Jag vill bara prata', emoji: '💬' },
] as const;

// Chat tone options
export const CHAT_TONES = {
  supportive: 'Stödjande och varm',
  professional: 'Professionell och saklig',
  friendly: 'Vänlig och avslappnad',
  motivating: 'Motiverande och upplyftande',
} as const;
