import { describe, it, expect, vi } from 'vitest';
import {
  WELLNESS_GOAL_OPTIONS,
  WELLNESS_GOAL_VALUES,
  WELLNESS_GOAL_BY_ID,
  MAX_WELLNESS_GOALS,
  getWellnessGoalIcon,
  getWellnessGoalLabel,
  getWellnessGoalDescription,
} from '../wellnessGoals';

describe('wellnessGoals constants', () => {
  it('WELLNESS_GOAL_OPTIONS is a non-empty array', () => {
    expect(Array.isArray(WELLNESS_GOAL_OPTIONS)).toBe(true);
    expect(WELLNESS_GOAL_OPTIONS.length).toBeGreaterThan(0);
  });

  it('each goal has id, label, icon, description', () => {
    for (const goal of WELLNESS_GOAL_OPTIONS) {
      expect(typeof goal.id).toBe('string');
      expect(typeof goal.label).toBe('string');
      expect(typeof goal.icon).toBe('string');
      expect(typeof goal.description).toBe('string');
    }
  });

  it('WELLNESS_GOAL_VALUES matches option ids', () => {
    expect(WELLNESS_GOAL_VALUES).toEqual(WELLNESS_GOAL_OPTIONS.map((g) => g.id));
  });

  it('WELLNESS_GOAL_BY_ID maps each id to its goal', () => {
    for (const goal of WELLNESS_GOAL_OPTIONS) {
      expect(WELLNESS_GOAL_BY_ID[goal.id]).toEqual(goal);
    }
  });

  it('MAX_WELLNESS_GOALS is a positive integer', () => {
    expect(Number.isInteger(MAX_WELLNESS_GOALS)).toBe(true);
    expect(MAX_WELLNESS_GOALS).toBeGreaterThan(0);
  });
});

describe('getWellnessGoalIcon', () => {
  it('returns icon for known goal', () => {
    const firstGoal = WELLNESS_GOAL_OPTIONS[0];
    expect(getWellnessGoalIcon(firstGoal.id)).toBe(firstGoal.icon);
  });

  it('returns ✨ fallback for unknown goal id', () => {
    expect(getWellnessGoalIcon('nonexistent-goal-xyz')).toBe('✨');
  });

  it('returns icon for every goal in options', () => {
    for (const goal of WELLNESS_GOAL_OPTIONS) {
      expect(getWellnessGoalIcon(goal.id)).toBe(goal.icon);
    }
  });
});

describe('getWellnessGoalLabel', () => {
  it('returns translated label when t returns a real translation', () => {
    const goalId = WELLNESS_GOAL_OPTIONS[0].id;
    const t = vi.fn().mockReturnValue('Translated label');
    expect(getWellnessGoalLabel(goalId, t)).toBe('Translated label');
  });

  it('falls back to goal label when t returns the key (no translation)', () => {
    const goal = WELLNESS_GOAL_OPTIONS[0];
    // t() returns the key itself = no translation found
    const t = (key: string) => key;
    expect(getWellnessGoalLabel(goal.id, t)).toBe(goal.label);
  });

  it('falls back to goalId when goal not found and t returns key', () => {
    const t = (key: string) => key;
    expect(getWellnessGoalLabel('unknown-id', t)).toBe('unknown-id');
  });

  it('uses translated value when translation is available', () => {
    const goal = WELLNESS_GOAL_OPTIONS[0];
    const t = (_key: string) => 'Min etikett';
    expect(getWellnessGoalLabel(goal.id, t)).toBe('Min etikett');
  });
});

describe('getWellnessGoalDescription', () => {
  it('returns translated description when t returns a real translation', () => {
    const goalId = WELLNESS_GOAL_OPTIONS[0].id;
    const t = vi.fn().mockReturnValue('Translated description');
    expect(getWellnessGoalDescription(goalId, t)).toBe('Translated description');
  });

  it('falls back to goal description when t returns the key', () => {
    const goal = WELLNESS_GOAL_OPTIONS[0];
    const t = (key: string) => key;
    expect(getWellnessGoalDescription(goal.id, t)).toBe(goal.description);
  });

  it('returns empty string when goal not found and t returns key', () => {
    const t = (key: string) => key;
    expect(getWellnessGoalDescription('unknown-id', t)).toBe('');
  });

  it('uses translated description when available', () => {
    const goal = WELLNESS_GOAL_OPTIONS[0];
    const t = (_key: string) => 'Min beskrivning';
    expect(getWellnessGoalDescription(goal.id, t)).toBe('Min beskrivning');
  });
});
