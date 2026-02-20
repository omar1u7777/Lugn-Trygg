import { renderHook, act } from '@testing-library/react';

// Mock muscleGroups constant so we control the list length
vi.mock('../../constants/recommendations', () => ({
  muscleGroups: [
    { name: 'Händer', svName: 'Hands', instruction: 'Knyt handen' },
    { name: 'Axlar', svName: 'Shoulders', instruction: 'Lyft axlarna' },
  ],
}));

import { usePMR } from '../usePMR';

describe('usePMR', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const defaults = {
    difficulty: 'beginner' as const,
    customTiming: { tense: 5, relax: 10 },
  };

  it('initialises in prepare phase, inactive', () => {
    const { result } = renderHook(() => usePMR(defaults));

    expect(result.current.isActive).toBe(false);
    expect(result.current.phase).toBe('prepare');
    expect(result.current.currentMuscleGroupIndex).toBe(0);
  });

  it('start sets isActive and begins with prepare → tense', () => {
    const { result } = renderHook(() => usePMR(defaults));

    act(() => result.current.start());
    expect(result.current.isActive).toBe(true);

    // After 5s prepare phase, should transition to tense
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.phase).toBe('tense');
  });

  it('cycles through tense → relax for beginner timing', () => {
    const { result } = renderHook(() => usePMR(defaults));

    act(() => result.current.start());
    // 5s prepare
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.phase).toBe('tense');

    // 5s tense (beginner)
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.phase).toBe('relax');
  });

  it('stop resets state', () => {
    const { result } = renderHook(() => usePMR(defaults));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.stop());

    expect(result.current.isActive).toBe(false);
    expect(result.current.phase).toBe('prepare');
    expect(result.current.currentMuscleGroupIndex).toBe(0);
  });

  it('calls onComplete after all muscle groups', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      usePMR({ ...defaults, onComplete })
    );

    act(() => result.current.start());
    // prepare(5s) + tense(5s) + relax(10s) × 2 groups = 5+15+15 = 35s
    act(() => vi.advanceTimersByTime(35_000));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('exposes muscleGroups for convenience', () => {
    const { result } = renderHook(() => usePMR(defaults));
    expect(result.current.muscleGroups).toHaveLength(2);
  });
});
