import { formatPomodoroTime } from '../usePomodoro';

// We test the pure utility directly; the hook uses intervals and refs that
// make full-cycle integration tests fragile under fake timers.  We will
// still cover the hook's public API where practical.

describe('formatPomodoroTime', () => {
  it('formats 0 seconds', () => {
    expect(formatPomodoroTime(0)).toBe('0:00');
  });

  it('formats seconds < 60', () => {
    expect(formatPomodoroTime(9)).toBe('0:09');
    expect(formatPomodoroTime(30)).toBe('0:30');
    expect(formatPomodoroTime(59)).toBe('0:59');
  });

  it('formats full minutes', () => {
    expect(formatPomodoroTime(60)).toBe('1:00');
    expect(formatPomodoroTime(300)).toBe('5:00');
    expect(formatPomodoroTime(1500)).toBe('25:00');
  });

  it('formats minutes + seconds', () => {
    expect(formatPomodoroTime(90)).toBe('1:30');
    expect(formatPomodoroTime(125)).toBe('2:05');
    expect(formatPomodoroTime(1499)).toBe('24:59');
  });

  it('pads single-digit seconds with leading zero', () => {
    expect(formatPomodoroTime(61)).toBe('1:01');
    expect(formatPomodoroTime(605)).toBe('10:05');
  });
});

// ─── Hook-level smoke tests ──────────────────────────────

import { renderHook, act } from '@testing-library/react';
import { usePomodoro } from '../usePomodoro';

describe('usePomodoro hook', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const defaults = {
    workTime: 1,       // 1 minute (60 s) for fast tests
    breakTime: 1,      // 1 minute break
    totalSessions: 2,
  };

  it('initial state is idle', () => {
    const { result } = renderHook(() => usePomodoro(defaults));

    expect(result.current.isActive).toBe(false);
    expect(result.current.phase).toBe('work');
    expect(result.current.session).toBe(1);
    expect(result.current.timeLeft).toBe(60);
  });

  it('start activates timer', () => {
    const { result } = renderHook(() => usePomodoro(defaults));

    act(() => result.current.start());
    expect(result.current.isActive).toBe(true);
  });

  it('time decreases each second', () => {
    const { result } = renderHook(() => usePomodoro(defaults));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));

    expect(result.current.timeLeft).toBe(57);
  });

  it('stop resets to initial state', () => {
    const { result } = renderHook(() => usePomodoro(defaults));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(5000));
    act(() => result.current.stop());

    expect(result.current.isActive).toBe(false);
    expect(result.current.phase).toBe('work');
    expect(result.current.session).toBe(1);
    expect(result.current.timeLeft).toBe(60);
  });

  it('transitions from work → break after work time elapses', () => {
    const onSessionComplete = vi.fn();
    const { result } = renderHook(() =>
      usePomodoro({ ...defaults, onSessionComplete })
    );

    act(() => result.current.start());
    // Advance through entire work period (60 s)
    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.phase).toBe('break');
    expect(onSessionComplete).toHaveBeenCalledWith(1, 'work', 1);
  });

  it('calls onComplete after all sessions', () => {
    const onComplete = vi.fn();
    const onSessionComplete = vi.fn();
    const { result } = renderHook(() =>
      usePomodoro({
        workTime: 1,
        breakTime: 1,
        totalSessions: 1,
        onComplete,
        onSessionComplete,
      })
    );

    act(() => result.current.start());
    // Advance through the single work session (60 s)
    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.phase).toBe('completed');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onTick every second', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      usePomodoro({ ...defaults, onTick })
    );

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));

    expect(onTick).toHaveBeenCalledTimes(3);
  });
});
