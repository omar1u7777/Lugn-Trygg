import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserProgress } from '../useUserProgress';

const USER_ID = 'user-1';
const KEY = `user_progress_${USER_ID}`;

describe('useUserProgress', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('counts completed exercises and persists them', () => {
    const { result } = renderHook(() => useUserProgress({ userId: USER_ID }));

    act(() => result.current.updateProgress('exercise'));
    act(() => result.current.updateProgress('meditation', 10));

    expect(result.current.userProgress.exercisesCompleted).toBe(1);
    expect(result.current.userProgress.meditationMinutes).toBe(10);
    expect(JSON.parse(localStorage.getItem(KEY) as string).exercisesCompleted).toBe(1);
  });

  it('restores what was stored for this user', () => {
    localStorage.setItem(KEY, JSON.stringify({
      exercisesCompleted: 4, meditationMinutes: 20, articlesRead: 2, weeklyGoalProgress: 57,
    }));

    const { result } = renderHook(() => useUserProgress({ userId: USER_ID }));

    expect(result.current.userProgress.exercisesCompleted).toBe(4);
    expect(result.current.userProgress.meditationMinutes).toBe(20);
  });

  describe('corrupted storage', () => {
    // A stored value that parses but has the wrong shape used to be trusted,
    // and the first increment on a missing counter produced NaN — which then
    // rendered as "NaN övningar" permanently, since NaN + 1 is still NaN.
    it.each([
      ['a bare string', JSON.stringify('nope')],
      ['null', JSON.stringify(null)],
      ['an object with no counters', JSON.stringify({ somethingElse: 1 })],
      ['counters of the wrong type', JSON.stringify({ exercisesCompleted: 'many' })],
      ['a negative counter', JSON.stringify({ exercisesCompleted: -5 })],
      ['unparseable text', 'not json at all'],
    ])('recovers from %s without producing NaN', (_label, stored) => {
      localStorage.setItem(KEY, stored);

      const { result } = renderHook(() => useUserProgress({ userId: USER_ID }));
      act(() => result.current.updateProgress('exercise'));

      const progress = result.current.userProgress;
      for (const value of Object.values(progress)) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(progress.exercisesCompleted).toBe(1);
    });
  });

  it('does not crash when storage rejects the write', () => {
    // Safari private mode and a full quota both throw here. This runs inside a
    // setState updater, so an unhandled throw took the page down at the moment
    // the user finished an exercise.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const { result } = renderHook(() => useUserProgress({ userId: USER_ID }));

    expect(() => act(() => result.current.updateProgress('exercise'))).not.toThrow();
    // The count still updates in memory for this session.
    expect(result.current.userProgress.exercisesCompleted).toBe(1);
  });

  it('does not crash when storage rejects the read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    expect(() => renderHook(() => useUserProgress({ userId: USER_ID }))).not.toThrow();
  });

  it('keeps progress separate per user', () => {
    const first = renderHook(() => useUserProgress({ userId: 'user-a' }));
    act(() => first.result.current.updateProgress('exercise'));

    const second = renderHook(() => useUserProgress({ userId: 'user-b' }));
    expect(second.result.current.userProgress.exercisesCompleted).toBe(0);
  });

  it('does not write anything when there is no user', () => {
    const { result } = renderHook(() => useUserProgress({ userId: undefined }));
    act(() => result.current.updateProgress('exercise'));

    expect(localStorage.length).toBe(0);
  });
});
