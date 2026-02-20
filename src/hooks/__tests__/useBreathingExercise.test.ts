import { renderHook, act } from '@testing-library/react';

// Mock the dependency – useExerciseTimer
vi.mock('../useExerciseTimer', () => {
  // Simulate timer by capturing onTick and letting tests drive it
  let _onTick: ((s: number) => void) | undefined;
  let _isActive = false;

  return {
    useExerciseTimer: (_init: number, opts: any) => {
      _onTick = opts?.onTick;
      return {
        get isActive() { return _isActive; },
        start: () => { _isActive = true; },
        stop: () => { _isActive = false; },
        // expose helper so tests can drive ticks
        __tick: (s: number) => { _onTick?.(s); },
        __setActive: (v: boolean) => { _isActive = v; },
      };
    },
  };
});

// Mock the constants
vi.mock('../../constants/recommendations', () => ({
  BREATHING_PHASES: [
    { name: 'exhale', duration: 2, instruction: 'Andas ut...' },
    { name: 'inhale', duration: 4, instruction: 'Andas in...' },
    { name: 'hold', duration: 7, instruction: 'Håll andan...' },
    { name: 'exhale2', duration: 8, instruction: 'Andas ut genom munnen...' },
  ],
}));

import { useBreathingExercise } from '../useBreathingExercise';

describe('useBreathingExercise', () => {
  it('starts in rest phase', () => {
    const { result } = renderHook(() => useBreathingExercise());
    expect(result.current.phase).toBe('rest');
    expect(result.current.isActive).toBe(false);
    expect(result.current.cycleCount).toBe(0);
  });

  it('start sets phase to exhale and activates', () => {
    const onPhaseChange = vi.fn();
    const { result } = renderHook(() =>
      useBreathingExercise({ onPhaseChange })
    );

    act(() => result.current.start());
    expect(result.current.phase).toBe('exhale');
    expect(onPhaseChange).toHaveBeenCalledWith('exhale', 'Andas ut...');
  });

  it('stop resets everything to rest', () => {
    const { result } = renderHook(() => useBreathingExercise());

    act(() => result.current.start());
    act(() => result.current.stop());

    expect(result.current.phase).toBe('rest');
    expect(result.current.cycleCount).toBe(0);
    expect(result.current.totalSeconds).toBe(0);
  });

  it('returns expected shape', () => {
    const { result } = renderHook(() => useBreathingExercise());

    expect(result.current).toHaveProperty('isActive');
    expect(result.current).toHaveProperty('phase');
    expect(result.current).toHaveProperty('cycleCount');
    expect(result.current).toHaveProperty('totalSeconds');
    expect(result.current).toHaveProperty('start');
    expect(result.current).toHaveProperty('stop');
  });
});
