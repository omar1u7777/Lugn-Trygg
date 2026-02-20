import { renderHook, act } from '@testing-library/react';

// Mock logger to suppress output in tests
vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import { useGratitude } from '../useGratitude';

describe('useGratitude', () => {
  const mockUser = { user_id: 'test-uid-123' };
  const onProgress = vi.fn();
  const announce = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const renderGratitude = (userOverride?: any) =>
    renderHook(() =>
      useGratitude({
        user: userOverride ?? mockUser,
        onProgress,
        announce,
      })
    );

  it('starts inactive with day 1', () => {
    const { result } = renderGratitude();
    expect(result.current.isActive).toBe(false);
    expect(result.current.day).toBe(1);
    expect(result.current.entries).toEqual({});
  });

  it('start activates challenge', () => {
    const { result } = renderGratitude();
    act(() => result.current.start());
    expect(result.current.isActive).toBe(true);
  });

  it('saveEntry persists to localStorage', async () => {
    const { result } = renderGratitude();
    act(() => result.current.start());

    await act(async () => {
      await result.current.saveEntry(1, ['Tack 1', 'Tack 2', 'Tack 3']);
    });

    const stored = localStorage.getItem(`gratitude_challenge_${mockUser.user_id}`);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.entries[1]).toEqual(['Tack 1', 'Tack 2', 'Tack 3']);
    expect(onProgress).toHaveBeenCalledWith('exercise', 5);
    expect(announce).toHaveBeenCalled();
  });

  it('nextDay advances day', () => {
    const { result } = renderGratitude();
    act(() => result.current.start());

    act(() => result.current.nextDay());
    expect(result.current.day).toBe(2);

    act(() => result.current.nextDay());
    expect(result.current.day).toBe(3);
  });

  it('complete clears state and localStorage', () => {
    const { result } = renderGratitude();
    act(() => result.current.start());
    act(() => result.current.complete());

    expect(result.current.isActive).toBe(false);
    expect(result.current.day).toBe(1);
    expect(result.current.entries).toEqual({});
    expect(localStorage.getItem(`gratitude_challenge_${mockUser.user_id}`)).toBeNull();
    expect(onProgress).toHaveBeenCalledWith('exercise', 35);
  });

  it('cancel clears state and localStorage', () => {
    const { result } = renderGratitude();
    act(() => result.current.start());
    act(() => result.current.cancel());

    expect(result.current.isActive).toBe(false);
    expect(localStorage.getItem(`gratitude_challenge_${mockUser.user_id}`)).toBeNull();
    expect(announce).toHaveBeenCalledWith('Tacksamhetsutmaning avbruten', 'polite');
  });

  it('getPrompts returns different prompts per day', () => {
    const { result } = renderGratitude();
    const p1 = result.current.getPrompts(1);
    const p2 = result.current.getPrompts(2);
    expect(p1).not.toBe(p2);
    expect(p1).toContain('tacksam');
  });

  it('loads progress from localStorage on mount', () => {
    const saved = {
      entries: { 1: ['a', 'b', 'c'] },
      currentDay: 3,
      startDate: new Date().toISOString(),
    };
    localStorage.setItem(`gratitude_challenge_${mockUser.user_id}`, JSON.stringify(saved));

    const { result } = renderGratitude();
    expect(result.current.day).toBe(3);
    expect(result.current.entries).toEqual({ 1: ['a', 'b', 'c'] });
  });

  it('works without user', () => {
    const { result } = renderGratitude(null);
    expect(result.current.isActive).toBe(false);
    act(() => result.current.start());
    expect(result.current.isActive).toBe(true);
  });

  it('updateEntries sets entries', () => {
    const { result } = renderGratitude();
    act(() => result.current.updateEntries({ 2: ['x', 'y'] }));
    expect(result.current.entries).toEqual({ 2: ['x', 'y'] });
  });
});
