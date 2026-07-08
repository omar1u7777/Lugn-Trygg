import { describe, test, expect } from 'vitest';
import { BREATHING_PHASES, BOX_BREATHING_PHASES, BREATHING_TECHNIQUES, getBreathingPhases } from '../../constants/recommendations';

describe('BUG 2: Box breathing uses correct 4-4-4-4 phases', () => {
  test('BREATHING_TECHNIQUES has 4-7-8 and box entries', () => {
    expect(BREATHING_TECHNIQUES['4-7-8']).toBeDefined();
    expect(BREATHING_TECHNIQUES['box']).toBeDefined();
  });

  test('4-7-8 phases are exhale=2, inhale=4, hold=7, exhale2=8', () => {
    expect(BREATHING_PHASES).toHaveLength(4);
    expect(BREATHING_PHASES[0]).toMatchObject({ name: 'exhale', duration: 2 });
    expect(BREATHING_PHASES[1]).toMatchObject({ name: 'inhale', duration: 4 });
    expect(BREATHING_PHASES[2]).toMatchObject({ name: 'hold', duration: 7 });
    expect(BREATHING_PHASES[3]).toMatchObject({ name: 'exhale2', duration: 8 });
  });

  test('Box phases are inhale=4, hold=4, exhale=4, exhale2=4', () => {
    expect(BOX_BREATHING_PHASES).toHaveLength(4);
    expect(BOX_BREATHING_PHASES[0]).toMatchObject({ name: 'inhale', duration: 4 });
    expect(BOX_BREATHING_PHASES[1]).toMatchObject({ name: 'hold', duration: 4 });
    expect(BOX_BREATHING_PHASES[2]).toMatchObject({ name: 'exhale', duration: 4 });
    expect(BOX_BREATHING_PHASES[3]).toMatchObject({ name: 'exhale2', duration: 4 });
  });

  test('Box breathing total cycle = 16 seconds (4+4+4+4)', () => {
    const total = BOX_BREATHING_PHASES.reduce((sum, p) => sum + p.duration, 0);
    expect(total).toBe(16);
  });

  test('4-7-8 breathing total cycle = 21 seconds (2+4+7+8)', () => {
    const total = BREATHING_PHASES.reduce((sum, p) => sum + p.duration, 0);
    expect(total).toBe(21);
  });

  test('getBreathingPhases returns box phases when technique=box', () => {
    const phases = getBreathingPhases(() => undefined, 'box');
    expect(phases).toBe(BOX_BREATHING_PHASES);
  });

  test('getBreathingPhases returns 4-7-8 phases when technique=4-7-8', () => {
    const phases = getBreathingPhases(() => undefined, '4-7-8');
    expect(phases).toBe(BREATHING_PHASES);
  });

  test('getBreathingPhases falls back to 4-7-8 without technique', () => {
    const phases = getBreathingPhases(() => undefined);
    expect(phases).toBe(BREATHING_PHASES);
  });
});
