import { useState, useCallback, useRef, useEffect } from 'react';
import { getBackendUrl } from '../config/env';
import { tokenStorage } from '../utils/secureStorage';
import { logger } from '../utils/logger';
import { API_ENDPOINTS } from '../api/constants';
import { getCsrfToken, clearCsrfToken } from '../api/csrf';
// Importing the api client ensures the CSRF fetcher is registered before we
// call getCsrfToken() — without this side-effect import the shared module
// would return null on first invocation in this hook.
import '../api/client';

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
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  // CRITICAL FIX: Use ref to avoid dependency issues with useCallback
  // Initialize with defensive empty object to prevent TDZ errors in production builds
  const optionsRef = useRef<UseStreamingChatOptions>({});
  
  // Sync options to ref using useEffect to avoid breaking hooks rules
  // This ensures the ref is always up-to-date when callbacks execute
  useEffect(() => {
    optionsRef.current = options || {};
  }, [options]);

  // BUG 4 FIX: Abort any in-flight stream when the component unmounts.
  // Without this, closing the chat mid-stream leaves the fetch and the
  // backend OpenAI call running — a resource leak at 10k-user scale.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      readerRef.current?.cancel()?.catch(() => {});
    };
  }, []);

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

    // CRITICAL FIX: 90s timeout prevents indefinite hang when backend is slow
    // to send the first byte (Firestore query, OpenAI API, network issues).
    const streamTimeoutId = setTimeout(() => {
      logger.warn('Streaming timed out after 90s, aborting');
      abortControllerRef.current?.abort();
    }, 90_000);

    try {
      // Get real auth token from tokenStorage (same as axios client)
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      const baseUrl = getBackendUrl();

      // Always pull through the centralized CSRF manager — it owns the 30-min
      // TTL and re-fetches a fresh token if the cached one is expired. Sharing
      // state with the axios interceptor avoids cookie/header divergence.
      const buildRequest = async () => {
        const csrfToken = await getCsrfToken();
        return fetch(`${baseUrl}${API_ENDPOINTS.CHATBOT.CHAT_STREAM}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            message,
            user_id: userId,
            conversation_history: _conversationHistory,
          }),
          signal: abortControllerRef.current?.signal,
        });
      };

      let response = await buildRequest();

      // 403 typically means the cached CSRF token expired (backend TTL: 2h).
      // Clear and retry once with a freshly-issued token.
      if (response.status === 403) {
        clearCsrfToken();
        logger.warn('Chat stream got 403, retrying once with fresh CSRF token');
        response = await buildRequest();
      }

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
      readerRef.current = reader;

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
        // BUG 6 FIX: Explicitly cancel the reader to free the underlying
        // TCP connection immediately, rather than waiting for GC.
        Promise.resolve(readerRef.current?.cancel()).catch(() => {});
        return;
      }
      const error = err instanceof Error ? err : new Error('Streaming failed');
      setError(error);
      optionsRef.current.onError?.(error);
      logger.error('Streaming error:', error);
    } finally {
      clearTimeout(streamTimeoutId);
      setIsStreaming(false);
      readerRef.current = null;
    }
    // CRITICAL FIX: Empty dependency array - options accessed via ref to prevent recreating callback
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // BUG 6 FIX: Cancel the reader to release the underlying connection
    Promise.resolve(readerRef.current?.cancel()).catch(() => {});
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
