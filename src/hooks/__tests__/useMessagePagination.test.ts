import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useMessagePagination } from '../useMessagePagination';

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// jsdom doesn't implement IntersectionObserver; the hook only uses it to
// trigger loadMore() on scroll, which these tests call directly instead.
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

const msg = (id: string) => ({
  id,
  role: 'user' as const,
  content: id,
  timestamp: new Date(),
});

describe('useMessagePagination', () => {
  it('shows only the latest initialLoadCount messages on first load', () => {
    const all = Array.from({ length: 10 }, (_, i) => msg(`m${i}`));
    const { result } = renderHook(() =>
      useMessagePagination(all, { initialLoadCount: 4, pageSize: 2 })
    );
    expect(result.current.displayedMessages.map(m => m.id)).toEqual(['m6', 'm7', 'm8', 'm9']);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends a new message without resetting to the initial window', () => {
    const all = Array.from({ length: 10 }, (_, i) => msg(`m${i}`));
    const { result, rerender } = renderHook(
      ({ messages }) => useMessagePagination(messages, { initialLoadCount: 4, pageSize: 2 }),
      { initialProps: { messages: all } }
    );
    expect(result.current.displayedMessages).toHaveLength(4);

    const withNewMessage = [...all, msg('m10')];
    rerender({ messages: withNewMessage });

    // The new message is appended, not just the latest 4 of the new array.
    expect(result.current.displayedMessages.map(m => m.id)).toEqual(['m6', 'm7', 'm8', 'm9', 'm10']);
  });

  it('preserves load-more progress when a new message arrives afterward', async () => {
    const all = Array.from({ length: 10 }, (_, i) => msg(`m${i}`));
    const { result, rerender } = renderHook(
      ({ messages }) => useMessagePagination(messages, { initialLoadCount: 4, pageSize: 2 }),
      { initialProps: { messages: all } }
    );
    expect(result.current.displayedMessages.map(m => m.id)).toEqual(['m6', 'm7', 'm8', 'm9']);

    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() =>
      expect(result.current.displayedMessages.map(m => m.id)).toEqual(['m4', 'm5', 'm6', 'm7', 'm8', 'm9'])
    );

    const withNewMessage = [...all, msg('m10')];
    rerender({ messages: withNewMessage });

    // The older messages loaded via "load more" are still there, plus the new one appended.
    expect(result.current.displayedMessages.map(m => m.id)).toEqual([
      'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10',
    ]);
  });

  it('resets the window when messages are replaced (not a plain append)', () => {
    const all = Array.from({ length: 10 }, (_, i) => msg(`m${i}`));
    const { result, rerender } = renderHook(
      ({ messages }) => useMessagePagination(messages, { initialLoadCount: 4, pageSize: 2 }),
      { initialProps: { messages: all } }
    );
    expect(result.current.displayedMessages).toHaveLength(4);

    const replaced = Array.from({ length: 6 }, (_, i) => msg(`r${i}`));
    rerender({ messages: replaced });

    expect(result.current.displayedMessages.map(m => m.id)).toEqual(['r2', 'r3', 'r4', 'r5']);
  });
});
