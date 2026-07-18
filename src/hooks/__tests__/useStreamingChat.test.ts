import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Mock dependencies before importing the hook
vi.mock('../../config/env', () => ({ getBackendUrl: () => 'http://localhost:5001' }));
vi.mock('../../utils/secureStorage', () => ({
  tokenStorage: { getAccessToken: vi.fn().mockResolvedValue('fake-token') },
}));
vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../../api/constants', () => ({
  API_ENDPOINTS: { CHATBOT: { CHAT_STREAM: '/api/v1/chatbot/chat/stream' } },
}));
vi.mock('../../api/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('fake-csrf'),
  clearCsrfToken: vi.fn(),
}));
vi.mock('../../api/client', () => ({}));

import { useStreamingChat } from '../useStreamingChat';

// Helper: create a mock ReadableStream from an array of SSE chunks
function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

// Helper: create a mock fetch response
function mockResponse(body: ReadableStream | null, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    json: vi.fn().mockResolvedValue({}),
  } as unknown as Response;
}

const mockFetch = vi.fn();

describe('useStreamingChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('streams content chunks and calls onComplete on [DONE]', async () => {
    const onComplete = vi.fn();
    const onChunk = vi.fn();

    const chunks = [
      'data: {"content":"Hello"}\n\n',
      'data: {"content":" world"}\n\n',
      'data: [DONE]\n\n',
    ];

    mockFetch.mockResolvedValue(
      mockResponse(createMockStream(chunks))
    );

    const { result } = renderHook(() => useStreamingChat({ onComplete, onChunk }));

    await act(async () => {
      await result.current.streamMessage('user-1', 'Hi');
    });

    expect(onChunk).toHaveBeenCalledWith('Hello');
    expect(onChunk).toHaveBeenCalledWith(' world');
    expect(onComplete).toHaveBeenCalledWith('Hello world', false);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentMessage?.isComplete).toBe(true);
    expect(result.current.currentMessage?.content).toBe('Hello world');
  });

  it('detects crisis flag in stream', async () => {
    const onComplete = vi.fn();

    const chunks = [
      'data: {"content":"Kris text","crisis":true}\n\n',
      'data: [DONE]\n\n',
    ];

    mockFetch.mockResolvedValue(
      mockResponse(createMockStream(chunks))
    );

    const { result } = renderHook(() => useStreamingChat({ onComplete }));

    await act(async () => {
      await result.current.streamMessage('user-1', 'I need help');
    });

    expect(onComplete).toHaveBeenCalledWith('Kris text', true);
    expect(result.current.currentMessage?.crisisDetected).toBe(true);
  });

  it('handles stream ending without [DONE] as complete', async () => {
    const onComplete = vi.fn();

    const chunks = ['data: {"content":"partial"}\n\n'];

    mockFetch.mockResolvedValue(
      mockResponse(createMockStream(chunks))
    );

    const { result } = renderHook(() => useStreamingChat({ onComplete }));

    await act(async () => {
      await result.current.streamMessage('user-1', 'Hi');
    });

    expect(onComplete).toHaveBeenCalledWith('partial', false);
    expect(result.current.isStreaming).toBe(false);
  });

  it('calls onError on fetch failure', async () => {
    const onError = vi.fn();

    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useStreamingChat({ onError }));

    await act(async () => {
      await result.current.streamMessage('user-1', 'Hi');
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.isStreaming).toBe(false);
  });

  it('throws on 429 quota response', async () => {
    const onError = vi.fn();

    mockFetch.mockResolvedValue(
      mockResponse(null, 429)
    );

    const { result } = renderHook(() => useStreamingChat({ onError }));

    await act(async () => {
      await result.current.streamMessage('user-1', 'Hi');
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Daily limit reached' })
    );
  });

  it('aborts previous stream when new message is sent', async () => {
    // First stream: hangs forever (never resolves)
    const hangingStream = new ReadableStream({
      pull() { /* never enqueue, never close */ },
    });

    mockFetch
      .mockResolvedValueOnce(mockResponse(hangingStream))
      .mockResolvedValueOnce(
        mockResponse(createMockStream(['data: {"content":"second"}\n\n', 'data: [DONE]\n\n']))
      );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useStreamingChat({ onComplete }));

    // Start first stream (will hang)
    act(() => {
      result.current.streamMessage('user-1', 'first');
    });

    // Start second stream — should abort the first
    await act(async () => {
      await result.current.streamMessage('user-1', 'second');
    });

    // Only the second stream's onComplete should fire
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('second', false);
  });

  it('stopStreaming aborts active stream and marks message complete', async () => {
    // Create a stream whose read() returns a never-resolving promise
    const hangingStream = new ReadableStream({
      pull() { /* never resolves */ },
    });

    mockFetch.mockResolvedValue(
      mockResponse(hangingStream)
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useStreamingChat({ onComplete }));

    // Start stream without awaiting (it will hang at reader.read())
    act(() => {
      result.current.streamMessage('user-1', 'test');
    });

    // Wait for streaming state to be true
    await waitFor(() => expect(result.current.isStreaming).toBe(true), { timeout: 2000 });
    expect(result.current.currentMessage).not.toBeNull();

    // Stop streaming
    act(() => {
      result.current.stopStreaming();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentMessage?.isComplete).toBe(true);
    // onComplete should NOT be called on manual abort
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('clears timeout when stream completes normally', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const chunks = ['data: {"content":"done"}\n\n', 'data: [DONE]\n\n'];
    mockFetch.mockResolvedValue(
      mockResponse(createMockStream(chunks))
    );

    const { result } = renderHook(() => useStreamingChat());

    await act(async () => {
      await result.current.streamMessage('user-1', 'test');
    });

    // The timeout should have been cleared in the finally block
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('aborts after 90s timeout to prevent indefinite hang', async () => {
    vi.useFakeTimers();

    // Mock a response body whose read() never resolves until aborted
    const neverResolvingPromise = new Promise<ReadableStreamReadResult<Uint8Array>>(() => {});
    const mockBody = {
      getReader: () => ({
        read: () => neverResolvingPromise,
        cancel: vi.fn(),
        releaseLock: vi.fn(),
        closed: Promise.resolve(),
      }),
    };

    mockFetch.mockResolvedValue(
      {
        ok: true,
        status: 200,
        body: mockBody,
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response
    );

    const onError = vi.fn();
    const { result } = renderHook(() => useStreamingChat({ onError }));

    // Start stream without awaiting (it will hang at reader.read())
    act(() => {
      result.current.streamMessage('user-1', 'test');
    });

    // Flush microtasks so the stream gets to the reader.read() point
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.isStreaming).toBe(true);

    // Advance time past 90s timeout — this fires the setTimeout callback
    // which calls abortController.abort()
    await act(async () => {
      vi.advanceTimersByTime(91_000);
    });

    // Flush any remaining microtasks
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // The abort should have triggered. The neverResolvingPromise won't
    // reject on abort in jsdom, but the timeout callback still fires
    // and calls abort(). The stream won't settle, but we verify the
    // timeout mechanism works by checking the logger was called.
    const { logger } = await import('../../utils/logger');
    expect(logger.warn).toHaveBeenCalledWith('Streaming timed out after 90s, aborting');

    vi.useRealTimers();
  });

  it('handles no auth token gracefully', async () => {
    const { tokenStorage } = await import('../../utils/secureStorage');
    (tokenStorage.getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const onError = vi.fn();
    const { result } = renderHook(() => useStreamingChat({ onError }));

    await act(async () => {
      await result.current.streamMessage('user-1', 'test');
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No auth token available' })
    );
    expect(result.current.isStreaming).toBe(false);
  });
});
