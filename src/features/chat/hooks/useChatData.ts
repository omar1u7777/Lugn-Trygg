/**
 * useChatData Hook
 * 
 * Custom hook for managing AI chat state and operations.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { chat as apiChat } from '../../../api/api';
import useAuth from '../../../hooks/useAuth';
import { ChatMessage, ChatSession, AIResponse } from '../types';

interface UseChatDataOptions {
  maxMessages?: number;
  sessionId?: string;
}

interface UseChatDataReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  sessionId: string | null;
  sendMessage: (content: string) => Promise<AIResponse | null>;
  clearChat: () => void;
  getHistory: () => ChatMessage[];
}

export function useChatData(options: UseChatDataOptions = {}): UseChatDataReturn {
  const { maxMessages = 100 } = options;
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(options.sessionId || null);
  
  const messageIdRef = useRef(0);

  const generateMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return `msg_${Date.now()}_${messageIdRef.current}`;
  }, []);

  const sendMessage = useCallback(async (content: string): Promise<AIResponse | null> => {
    if (!user?.user_id || !content.trim()) return null;

    // Create user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev.slice(-(maxMessages - 2)), userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Initialize session if needed
      if (!sessionId) {
        setSessionId(`session_${Date.now()}`);
      }

      // Send to API
      const response = await apiChat({
        message: content,
        history: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      // Parse response
      const aiResponse: AIResponse = {
        message: typeof response === 'string' ? response : response.message || response.response,
        emotion: response.emotion,
        suggestions: response.suggestions,
        followUp: response.follow_up,
      };

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: aiResponse.message,
        timestamp: new Date(),
        metadata: {
          emotion: aiResponse.emotion,
          suggestions: aiResponse.suggestions,
        },
      };

      setMessages(prev => [...prev.slice(-(maxMessages - 1)), assistantMessage]);

      return aiResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to send message');
      setError(errorMessage);
      
      // Add error message to chat
      const errorChatMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: 'Tyvärr kunde jag inte svara just nu. Försök igen om en stund.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorChatMessage]);
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, messages, sessionId, maxMessages, generateMessageId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  const getHistory = useCallback(() => {
    return [...messages];
  }, [messages]);

  return useMemo(() => ({
    messages,
    isLoading,
    error,
    sessionId,
    sendMessage,
    clearChat,
    getHistory,
  }), [messages, isLoading, error, sessionId, sendMessage, clearChat, getHistory]);
}

export default useChatData;
