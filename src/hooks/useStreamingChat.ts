import { useState, useCallback, useRef, useEffect } from 'react';
import { getBackendUrl } from '../config/env';
import { tokenStorage } from '../utils/secureStorage';
import { logger } from '../utils/logger';
import { API_ENDPOINTS } from '../api/constants';

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
  const csrfTokenRef = useRef<string | null>(null);
  // CRITICAL FIX: Use ref to avoid dependency issues with useCallback
  // Initialize with defensive empty object to prevent TDZ errors in production builds
  const optionsRef = useRef<UseStreamingChatOptions>({});
  
  // Sync options to ref using useEffect to avoid breaking hooks rules
  // This ensures the ref is always up-to-date when callbacks execute
  useEffect(() => {
    optionsRef.current = options || {};
  }, [options]);

  const streamMessage = useCallback(async (
    userId: string,
    message: string,
    _conversationHistory: Array<{ role: string; content: string }> = []
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

      // Fetch CSRF token once (cookie + header double-submit pattern in backend)
      if (!csrfTokenRef.current) {
        const csrfResponse = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH.CSRF_TOKEN}`, {
          method: 'GET',
          credentials: 'include',
        });
        if (csrfResponse.ok) {
          const csrfJson = await csrfResponse.json().catch(() => ({}));
          const payload = csrfJson?.data || csrfJson;
          csrfTokenRef.current = payload?.csrfToken || payload?.csrf_token || null;
        }
      }

      const response = await fetch(`${baseUrl}${API_ENDPOINTS.CHATBOT.CHAT_STREAM}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(csrfTokenRef.current ? { 'X-CSRF-Token': csrfTokenRef.current } : {}),
        },
        credentials: 'include',
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
            // Use ref to access latest options without dependency issues
            optionsRef.current.onComplete?.(accumulatedContent, crisisDetected);
            setIsStreaming(false);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const tokenText = parsed.content ?? '';
            if (parsed.crisis) crisisDetected = true;
            // Check for error in stream
            if (parsed.error) {
              logger.warn('Stream error from server:', parsed.error);
            }

            if (tokenText) {
              accumulatedContent += tokenText;
              setCurrentMessage(prev =>
                prev ? { ...prev, content: accumulatedContent } : null
              );
              optionsRef.current.onChunk?.(tokenText);
            }
          } catch {
            logger.warn('Failed to parse SSE chunk:', data);
          }
        }
      }

      // Stream ended without [DONE] - treat as complete
      setCurrentMessage(prev => prev ? { ...prev, isComplete: true } : null);
      optionsRef.current.onComplete?.(accumulatedContent, crisisDetected);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.info('Stream cancelled by user');
        return;
      }
      const error = err instanceof Error ? err : new Error('Streaming failed');
      setError(error);
      optionsRef.current.onError?.(error);
      logger.error('Streaming error:', error);
    } finally {
      setIsStreaming(false);
    }
    // CRITICAL FIX: Empty dependency array - options accessed via ref to prevent recreating callback
  }, []);

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
