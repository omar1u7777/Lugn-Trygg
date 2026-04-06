import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ default: apiMock, api: apiMock, apiClient: apiMock }));

import {
  assessCrisisRisk,
  getSafetyPlan,
  updateSafetyPlan,
  getInterventionProtocol,
  getAssessmentHistory,
  getCrisisIndicators,
  checkEscalation,
  formatRiskLevel,
  getRiskLevelColor,
  getRiskLevelIcon,
  needsImmediateAction,
  getIndicatorPriority,
  sortIndicatorsByPriority,
  buildUserContextFromMoods,
} from '../crisis';

describe('crisis API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('async functions', () => {
    it('assessCrisisRisk posts message and returns assessment', async () => {
      const assessment = { risk_level: 'low', risk_score: 2.0, needs_immediate_attention: false };
      apiMock.post.mockResolvedValueOnce({ data: { data: assessment } });
      const result = await assessCrisisRisk({ message: 'I feel fine' });
      expect(apiMock.post).toHaveBeenCalled();
    });

    it('assessCrisisRisk throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(assessCrisisRisk({ message: 'test' })).rejects.toThrow();
    });

    it('getSafetyPlan returns plan', async () => {
      const plan = { contacts: [], copingStrategies: [] };
      apiMock.get.mockResolvedValueOnce({ data: { data: plan } });
      await getSafetyPlan();
      expect(apiMock.get).toHaveBeenCalled();
    });

    it('getSafetyPlan throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getSafetyPlan()).rejects.toThrow();
    });

    it('updateSafetyPlan puts and returns plan', async () => {
      const plan = { contacts: ['112'] };
      apiMock.put.mockResolvedValueOnce({ data: { data: plan } });
      const result = await updateSafetyPlan({ contacts: ['112'] });
      expect(apiMock.put).toHaveBeenCalled();
    });

    it('updateSafetyPlan throws on error', async () => {
      apiMock.put.mockRejectedValueOnce(new Error('fail'));
      await expect(updateSafetyPlan({})).rejects.toThrow();
    });

    it('getInterventionProtocol returns protocol', async () => {
      apiMock.get.mockResolvedValueOnce({ data: { data: { steps: [] } } });
      await getInterventionProtocol('high');
      expect(apiMock.get).toHaveBeenCalled();
    });

    it('getAssessmentHistory returns list', async () => {
      apiMock.get.mockResolvedValueOnce({ data: { data: { assessments: [] } } });
      const result = await getAssessmentHistory('u1', 10);
      expect(result).toBeDefined();
    });

    it('getCrisisIndicators returns indicators', async () => {
      apiMock.get.mockResolvedValueOnce({ data: { data: { indicators: [] } } });
      await getCrisisIndicators();
      expect(apiMock.get).toHaveBeenCalled();
    });

    it('checkEscalation returns escalation data', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { data: { should_escalate: false } } });
      const result = await checkEscalation({ risk_level: 'low', risk_score: 1.0, needs_immediate_attention: false, intervention_recommended: false, recommended_actions: [] });
      expect(result).toBeDefined();
    });
  });

  describe('pure functions', () => {
    it('formatRiskLevel returns Swedish text', () => {
      expect(formatRiskLevel('low')).toBe('Låg risk');
      expect(formatRiskLevel('medium')).toBe('Medelhög risk');
      expect(formatRiskLevel('high')).toBe('Hög risk');
      expect(formatRiskLevel('critical')).toBe('Kritisk risk');
    });

    it('getRiskLevelColor returns Tailwind class string', () => {
      expect(getRiskLevelColor('low')).toContain('success');
      expect(getRiskLevelColor('critical')).toContain('error');
      expect(getRiskLevelColor('medium')).toContain('warning');
    });

    it('getRiskLevelIcon returns icon name', () => {
      expect(getRiskLevelIcon('low')).toBe('CheckCircleIcon');
      expect(getRiskLevelIcon('critical')).toBe('ShieldExclamationIcon');
    });

    it('needsImmediateAction true for critical', () => {
      const assessment = { risk_level: 'critical' as const, risk_score: 9.0, needs_immediate_attention: false, intervention_recommended: true, recommended_actions: [] };
      expect(needsImmediateAction(assessment)).toBe(true);
    });

    it('needsImmediateAction true when needs_immediate_attention', () => {
      const assessment = { risk_level: 'low' as const, risk_score: 1.0, needs_immediate_attention: true, intervention_recommended: false, recommended_actions: [] };
      expect(needsImmediateAction(assessment)).toBe(true);
    });

    it('needsImmediateAction false for low risk', () => {
      const assessment = { risk_level: 'low' as const, risk_score: 1.0, needs_immediate_attention: false, intervention_recommended: false, recommended_actions: [] };
      expect(needsImmediateAction(assessment)).toBe(false);
    });

    it('needsImmediateAction true for high+score > 7.5', () => {
      const assessment = { risk_level: 'high' as const, risk_score: 8.0, needs_immediate_attention: false, intervention_recommended: true, recommended_actions: [] };
      expect(needsImmediateAction(assessment)).toBe(true);
    });

    it('getIndicatorPriority multiplies severity weight by risk_weight', () => {
      const indicator = { id: 'i1', severity: 'severe' as const, risk_weight: 2, category: 'emotional' as const, name: 'depression', description: '' };
      expect(getIndicatorPriority(indicator)).toBe(8); // 4 * 2
    });

    it('sortIndicatorsByPriority sorts highest first', () => {
      const low = { id: 'low', severity: 'low' as const, risk_weight: 1, category: 'emotional' as const, name: 'low', description: '' };
      const high = { id: 'high', severity: 'high' as const, risk_weight: 3, category: 'emotional' as const, name: 'high', description: '' };
      const result = sortIndicatorsByPriority([low, high]);
      expect(result[0].id).toBe('high');
    });

    it('buildUserContextFromMoods returns empty object for empty array', () => {
      expect(buildUserContextFromMoods([])).toEqual({});
    });

    it('buildUserContextFromMoods computes mood drop', () => {
      const moods = [
        { score: 8, timestamp: '2026-04-06' },
        { score: 3, timestamp: '2026-04-05' },
      ];
      const result = buildUserContextFromMoods(moods);
      expect(result.mood_history).toHaveLength(2);
      expect(result.consecutive_low_mood_days).toBe(1);
    });
  });
});
