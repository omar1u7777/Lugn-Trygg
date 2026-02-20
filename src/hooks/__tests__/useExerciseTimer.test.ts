import { renderHook, act } from '@testing-library/react';
import { useExerciseTimer } from '../useExerciseTimer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useExerciseTimer', () => {
  it('initialises with given seconds', () => {
    const { result } = renderHook(() => useExerciseTimer(60));
    expect(result.current.time).toBe(60);
    expect(result.current.isActive).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });

  it('default initialSeconds is 0', () => {
    const { result } = renderHook(() => useExerciseTimer());
    expect(result.current.time).toBe(0);
  });

  it('counts down when started', () => {
    const { result } = renderHook(() => useExerciseTimer(5));

    act(() => result.current.start());
    expect(result.current.isActive).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.time).toBe(4);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.time).toBe(2);
  });

  it('counts up when countdown = false', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useExerciseTimer(0, { countdown: false, onTick })
    );

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));

    expect(result.current.time).toBe(3);
    expect(onTick).toHaveBeenCalledWith(1);
    expect(onTick).toHaveBeenCalledWith(2);
    expect(onTick).toHaveBeenCalledWith(3);
  });

  it('calls onComplete when countdown reaches 0', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useExerciseTimer(2, { onComplete })
    );

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.time).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it('pause and resume work', () => {
    const { result } = renderHook(() => useExerciseTimer(10));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.time).toBe(8);

    act(() => result.current.pause());
    expect(result.current.isPaused).toBe(true);

    // Time should not change while paused
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.time).toBe(8);

    act(() => result.current.resume());
    expect(result.current.isPaused).toBe(false);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.time).toBe(7);
  });

  it('stop resets isActive and isPaused', () => {
    const { result } = renderHook(() => useExerciseTimer(10));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.stop());

    expect(result.current.isActive).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });

  it('reset restores initial time', () => {
    const { result } = renderHook(() => useExerciseTimer(30));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(5000));
    act(() => result.current.reset());

    expect(result.current.time).toBe(30);
    expect(result.current.isActive).toBe(false);
  });

  it('reset with newSeconds overrides initial', () => {
    const { result } = renderHook(() => useExerciseTimer(30));

    act(() => result.current.reset(120));
    expect(result.current.time).toBe(120);
  });

  it('setTime allows manual time override', () => {
    const { result } = renderHook(() => useExerciseTimer(10));

    act(() => result.current.setTime(99));
    expect(result.current.time).toBe(99);
  });
});
