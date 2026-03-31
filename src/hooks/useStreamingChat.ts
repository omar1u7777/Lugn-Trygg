import { useState, useCallback, useRef } from 'react';
import { getBackendUrl } from '../config/env';
import { tokenStorage } from '../utils/secureStorage';
import { logger } from '../utils/logger';

export interface StreamingMessage {
  id: string;
  content: string;
  isComplete: boolean;
  timestamp: Date;
  crisisDetected?: boolean;
}

interface UseStreamingChatOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullMessage: string, crisisDetected: boolean) => void;
  onError?: (error: Error) => void;
}

export const useStreamingChat = (options: UseStreamingChatOptions = {}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<StreamingMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamMessage = useCallback(async (
    userId: string,
    message: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ) => {
    // Cancel any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsStreaming(true);
    setError(null);

    const messageId = `stream-${Date.now()}`;
    setCurrentMessage({
      id: messageId,
      content: '',
      isComplete: false,
      timestamp: new Date(),
      crisisDetected: false
    });

    let accumulatedContent = '';
    let crisisDetected = false;

    try {
      // Get real auth token from tokenStorage (same as axios client)
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      const baseUrl = getBackendUrl();
      const response = await fetch(`${baseUrl}/chatbot/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          user_id: userId,
        }),
        signal: abortControllerRef.current.signal,
      });

      // Handle non-streaming error responses (e.g. 429 quota)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw Object.assign(new Error('Daily limit reached'), { response: { status: 429 } });
        }
        throw new Error(errorData?.message || `Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream from server');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on double newlines (SSE event boundary)
        const events = buffer.split('\n\n');
        // Keep the last (potentially incomplete) event in buffer
        buffer = events.pop() ?? '';

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            setCurrentMessage(prev =>
              prev ? { ...prev, isComplete: true, crisisDetected } : null
            );
            options.onComplete?.(accumulatedContent, crisisDetected);
            setIsStreaming(false);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const token = parsed.content ?? '';
            if (parsed.crisis) crisisDetected = true;

            if (token) {
              accumulatedContent += token;
              setCurrentMessage(prev =>
                prev ? { ...prev, content: accumulatedContent } : null
              );
              options.onChunk?.(token);
            }
          } catch {
            logger.warn('Failed to parse SSE chunk:', data);
          }
        }
      }

      // Stream ended without [DONE] - treat as complete
      setCurrentMessage(prev => prev ? { ...prev, isComplete: true } : null);
      options.onComplete?.(accumulatedContent, crisisDetected);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.info('Stream cancelled by user');
        return;
      }
      const error = err instanceof Error ? err : new Error('Streaming failed');
      setError(error);
      options.onError?.(error);
      logger.error('Streaming error:', error);
    } finally {
      setIsStreaming(false);
    }
  }, [options]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
    // Mark current message as complete so it stays visible
    setCurrentMessage(prev => prev ? { ...prev, isComplete: true } : null);
  }, []);

  const clearStreamingMessage = useCallback(() => {
    setCurrentMessage(null);
  }, []);

  return {
    isStreaming,
    currentMessage,
    error,
    streamMessage,
    stopStreaming,
    clearStreamingMessage,
  };
};

export default useStreamingChat;
