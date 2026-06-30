import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api client
vi.mock('../client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import api from '../client';
import {
  submitPHQ9,
  submitGAD7,
  getAssessmentHistory,
  getComprehensiveRisk,
} from '../clinical';

// PHQ-9 valid keys matching backend
const PHQ9_KEYS = [
  'little_interest', 'feeling_down', 'sleep_problems', 'feeling_tired',
  'appetite', 'feeling_bad', 'concentration', 'moving_slowly', 'self_harm',
] as const;

const GAD7_KEYS = [
  'feeling_nervous', 'cant_control_worry', 'worrying_too_much',
  'trouble_relaxing', 'restless', 'easily_annoyed', 'afraid',
] as const;

function makePHQ9Responses(answers: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0]): Record<string, number> {
  return Object.fromEntries(PHQ9_KEYS.map((k, i) => [k, answers[i] ?? 0]));
}

function makeGAD7Responses(answers: number[] = [0, 0, 0, 0, 0, 0, 0]): Record<string, number> {
  return Object.fromEntries(GAD7_KEYS.map((k, i) => [k, answers[i] ?? 0]));
}

// ---------------------------------------------------------------------------
// submitPHQ9
// ---------------------------------------------------------------------------
describe('submitPHQ9', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends responses to /api/v1/advanced-mood/assess/phq9', async () => {
    const responses = makePHQ9Responses([1, 1, 1, 1, 1, 1, 1, 1, 0]);
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { total_score: 8, severity: 'mild', risk_level: 'low', suicidal_ideation: false, self_harm_score: 0, item_scores: responses, interpretation: 'Mild depression', recommendations: [], follow_up_timeframe: 'routine' } },
    });
    const result = await submitPHQ9(responses);
    expect(api.post).toHaveBeenCalledWith('/api/v1/advanced-mood/assess/phq9', { responses }, undefined);
    expect(result.total_score).toBe(8);
    expect(result.severity).toBe('mild');
    expect(result.suicidal_ideation).toBe(false);
  });

  it('flags suicidal ideation when self_harm > 0', async () => {
    const responses = makePHQ9Responses([0, 0, 0, 0, 0, 0, 0, 0, 3]);
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { total_score: 3, severity: 'minimal', risk_level: 'crisis', suicidal_ideation: true, self_harm_score: 3, item_scores: responses, interpretation: 'Crisis', recommendations: ['Seek help'], follow_up_timeframe: '24_hours' } },
    });
    const result = await submitPHQ9(responses);
    expect(result.suicidal_ideation).toBe(true);
    expect(result.self_harm_score).toBe(3);
    expect(result.follow_up_timeframe).toBe('24_hours');
  });

  it('throws when success is false', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: false },
    });
    await expect(submitPHQ9(makePHQ9Responses())).rejects.toThrow('PHQ-9 calculation failed');
  });

  it('passes abort signal', async () => {
    const controller = new AbortController();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { total_score: 0, severity: 'minimal', risk_level: 'none', suicidal_ideation: false, self_harm_score: 0, item_scores: {}, interpretation: '', recommendations: [], follow_up_timeframe: 'routine' } },
    });
    await submitPHQ9(makePHQ9Responses(), controller.signal);
    expect(api.post).toHaveBeenCalledWith(expect.any(String), expect.any(Object), { signal: controller.signal });
  });
});

// ---------------------------------------------------------------------------
// submitGAD7
// ---------------------------------------------------------------------------
describe('submitGAD7', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends responses to /api/v1/advanced-mood/assess/gad7', async () => {
    const responses = makeGAD7Responses([2, 2, 2, 2, 2, 2, 2]);
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { total_score: 14, severity: 'moderate', risk_level: 'moderate', item_scores: responses, interpretation: 'Moderate anxiety', recommendations: ['therapy'], follow_up_timeframe: '1_week' } },
    });
    const result = await submitGAD7(responses);
    expect(api.post).toHaveBeenCalledWith('/api/v1/advanced-mood/assess/gad7', { responses }, undefined);
    expect(result.total_score).toBe(14);
    expect(result.severity).toBe('moderate');
  });

  it('throws when success is false', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: false } });
    await expect(submitGAD7(makeGAD7Responses())).rejects.toThrow('GAD-7 calculation failed');
  });
});

// ---------------------------------------------------------------------------
// getAssessmentHistory
// ---------------------------------------------------------------------------
describe('getAssessmentHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches history with type and limit params', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { history: [{ id: '1', type: 'phq9', total_score: 5, severity: 'mild', risk_level: 'low', timestamp: '2024-01-01' }], total: 1 } },
    });
    const result = await getAssessmentHistory({ type: 'phq9', limit: 10 });
    expect(api.get).toHaveBeenCalledWith('/api/v1/advanced-mood/assess/history', expect.objectContaining({ params: { type: 'phq9', limit: 10 } }));
    expect(result.history).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('works without optional params', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { history: [], total: 0 } },
    });
    const result = await getAssessmentHistory();
    expect(result.history).toEqual([]);
  });

  it('throws when success is false', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: false } });
    await expect(getAssessmentHistory()).rejects.toThrow('Could not retrieve assessment history');
  });
});

// ---------------------------------------------------------------------------
// getComprehensiveRisk
// ---------------------------------------------------------------------------
describe('getComprehensiveRisk', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches comprehensive risk assessment', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { timestamp: '2024-01-01', composite_risk: 'low', risk_factors: [], protective_factors: ['good sleep'], immediate_concerns: [], suggested_interventions: [], follow_up_recommended: false, follow_up_timeframe: 'routine', latest_phq9: null, latest_gad7: null } },
    });
    const result = await getComprehensiveRisk();
    expect(api.get).toHaveBeenCalledWith('/api/v1/advanced-mood/assess/comprehensive');
    expect(result.composite_risk).toBe('low');
    expect(result.follow_up_recommended).toBe(false);
  });

  it('throws when success is false', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: false } });
    await expect(getComprehensiveRisk()).rejects.toThrow('Comprehensive assessment failed');
  });
});
