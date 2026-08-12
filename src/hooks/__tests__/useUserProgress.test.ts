import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserProgress } from '../useUserProgress';
import { getActivityProgress, saveActivityProgress } from '../../api/dashboard';

vi.mock('../../api/dashboard', () => ({
  getActivityProgress: vi.fn().mockRejectedValue(new Error('no server in this test')),
  saveActivityProgress: vi.fn().mockResolvedValue({}),
}));

const mockGet = vi.mocked(getActivityProgress);
const mockSave = vi.mocked(saveActivityProgress);

const USER_ID = 'user-1';
const KEY = `user_progress_${USER_ID}`;

describe('useUserProgress', () => {
  beforeEach(() => {
    localStorage.clear();
    // restoreAllMocks puts back the real Storage.prototype methods that the
    // quota tests replace; without it those spies leak into later tests.
    vi.restoreAllMocks();
    mockGet.mockReset();
    mockSave.mockReset();
    mockGet.mockRejectedValue(new Error('no server in this test'));
    mockSave.mockResolvedValue({ exercisesCompleted: 0, meditationMinutes: 0, articlesRead: 0 });
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

  describe('server sync', () => {
    // These counters used to live only in localStorage, so a user who
    // completed 30 exercises saw 0 on their phone and lost everything when
    // they cleared browser data.

    it('takes the higher of local and server for each counter', async () => {
      localStorage.setItem(KEY, JSON.stringify({
        exercisesCompleted: 12, meditationMinutes: 5, articlesRead: 0, weeklyGoalProgress: 0,
      }));
      mockGet.mockResolvedValue({ exercisesCompleted: 3, meditationMinutes: 90, articlesRead: 7 });

      const { result } = renderHook(() => useUserProgress({ userId: USER_ID }));

      await waitFor(() => {
        expect(result.current.userProgress.meditationMinutes).toBe(90);
      });
      // Neither side wins wholesale: this device was ahead on exercises, the
      // server was ahead on minutes and articles.
      expect(result.current.userProgress.exercisesCompleted).toBe(12);
      expect(result.current.userProgress.articlesRead).toBe(7);
    });

    it('pushes up when this device is ahead', async () => {
      localStorage.setItem(KEY, JSON.stringify({
        exercisesCompleted: 20, meditationMinutes: 0, articlesRead: 0, weeklyGoalProgress: 0,
      }));
      mockGet.mockResolvedValue({ exercisesCompleted: 2, meditationMinutes: 0, articlesRead: 0 });

      renderHook(() => useUserProgress({ userId: USER_ID }));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ exercisesCompleted: 20 }));
      });
    });

    it('does not push on a plain load when the server is already current', async () => {
      localStorage.setItem(KEY, JSON.stringify({
        exercisesCompleted: 2, meditationMinutes: 0, articlesRead: 0, weeklyGoalProgress: 0,
      }));
      mockGet.mockResolvedValue({ exercisesCompleted: 5, meditationMinutes: 0, articlesRead: 0 });

      const { result } = renderHook(() => useUserProgress({ userId: USER_ID }));

      await waitFor(() => expect(result.current.userProgress.exercisesCompleted).toBe(5));
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('keeps local progress when the server cannot be reached', async () => {
      localStorage.setItem(KEY, JSON.stringify({
        exercisesCompleted: 8, meditationMinutes: 30, articlesRead: 2, weeklyGoalProgress: 0,
      }));
      mockGet.mockRejectedValue(new Error('offline'));

      const { result } = renderHook(() => useUserProgress({ userId: USER_ID }));

      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      // Progress the user can see beats a blank slate.
      expect(result.current.userProgress.exercisesCompleted).toBe(8);
      expect(result.current.userProgress.meditationMinutes).toBe(30);
    });

    it('still counts the exercise when the push fails', async () => {
      mockGet.mockResolvedValue({ exercisesCompleted: 0, meditationMinutes: 0, articlesRead: 0 });
      mockSave.mockRejectedValue(new Error('offline'));

      const { result } = renderHook(() => useUserProgress({ userId: USER_ID }));
      await waitFor(() => expect(mockGet).toHaveBeenCalled());

      act(() => result.current.updateProgress('exercise'));

      expect(result.current.userProgress.exercisesCompleted).toBe(1);
      expect(JSON.parse(localStorage.getItem(KEY) as string).exercisesCompleted).toBe(1);
    });

    it('does not contact the server without a user', async () => {
      renderHook(() => useUserProgress({ userId: undefined }));
      await new Promise((r) => setTimeout(r, 20));
      expect(mockGet).not.toHaveBeenCalled();
    });
  });
});
