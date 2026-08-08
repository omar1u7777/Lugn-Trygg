import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWellnessTimer } from '../useWellnessTimer';

describe('useWellnessTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down one second per tick', () => {
    const { result } = renderHook(() => useWellnessTimer());
    act(() => result.current.start(3));
    expect(result.current.timeLeft).toBe(3);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.timeLeft).toBe(2);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.timeLeft).toBe(1);
  });

  it('calls onComplete exactly once when the countdown reaches zero, even if ticks keep firing', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useWellnessTimer({ onComplete }));
    act(() => result.current.start(2));

    // Reach zero.
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.timeLeft).toBe(0);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // The bug: the interval never cleared itself at zero, so it kept ticking
    // and re-invoking onComplete every second thereafter. Advancing well
    // past zero must not produce any further calls.
    act(() => vi.advanceTimersByTime(5000));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('stops running (isRunning=false) once it reaches zero, without requiring the consumer to call pause/stop', () => {
    const { result } = renderHook(() => useWellnessTimer());
    act(() => result.current.start(1));
    expect(result.current.isRunning).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isRunning).toBe(false);
  });

  it('pause halts the countdown and resume continues it from where it left off', () => {
    const { result } = renderHook(() => useWellnessTimer());
    act(() => result.current.start(5));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.timeLeft).toBe(3);

    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.timeLeft).toBe(3); // unchanged while paused

    act(() => result.current.resume());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.timeLeft).toBe(2);
  });

  it('stop halts the countdown and resets timeLeft to zero', () => {
    const { result } = renderHook(() => useWellnessTimer());
    act(() => result.current.start(10));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.stop());
    expect(result.current.timeLeft).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });

  it('starting again defensively clears any previous interval instead of running two at once', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useWellnessTimer({ onComplete }));
    act(() => result.current.start(10));
    act(() => vi.advanceTimersByTime(2000));

    // Re-start mid-countdown -- must not leave the old interval ticking
    // alongside the new one (the historical 2x-speed countdown bug).
    act(() => result.current.start(2));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.timeLeft).toBe(1);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.timeLeft).toBe(0);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
