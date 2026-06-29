import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TestProviders from '../../utils/TestProviders';
import { ClinicalAssessment } from '../ClinicalAssessment';
import * as clinicalApi from '../../api/clinical';
import type { PHQ9Result, GAD7Result, AssessmentHistoryEntry, ComprehensiveRiskResult } from '../../api/clinical';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderComponent() {
  return render(
    <TestProviders>
      <ClinicalAssessment />
    </TestProviders>,
  );
}

function makePHQ9Result(overrides: Partial<PHQ9Result> = {}): PHQ9Result {
  return {
    total_score: 7,
    severity: 'mild',
    risk_level: 'mild',
    suicidal_ideation: false,
    self_harm_score: 0,
    item_scores: { little_interest: 1, feeling_down: 1, sleep_problems: 0, feeling_tired: 1, appetite: 0, feeling_bad: 1, concentration: 1, moving_slowly: 1, self_harm: 1 },
    interpretation: 'Lindrig depression',
    recommendations: ['Fortsätt monitorera'],
    follow_up_timeframe: '1_month',
    ...overrides,
  };
}

function makeGAD7Result(overrides: Partial<GAD7Result> = {}): GAD7Result {
  return {
    total_score: 5,
    severity: 'mild',
    risk_level: 'mild',
    item_scores: { feeling_nervous: 1, cant_control_worry: 1, worrying_too_much: 0, trouble_relaxing: 1, restless: 0, easily_annoyed: 1, afraid: 1 },
    interpretation: 'Lindrig ångest',
    recommendations: ['Prova andningsövningar'],
    follow_up_timeframe: '1_month',
    ...overrides,
  };
}

function makeHistoryEntry(overrides: Partial<AssessmentHistoryEntry> = {}): AssessmentHistoryEntry {
  return {
    id: 'test-id',
    type: 'phq9',
    total_score: 10,
    severity: 'moderate',
    risk_level: 'moderate',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeComprehensiveRisk(overrides: Partial<ComprehensiveRiskResult> = {}): ComprehensiveRiskResult {
  return {
    timestamp: new Date().toISOString(),
    composite_risk: 'moderate',
    risk_factors: ['PHQ-9 score: 10 (moderate)'],
    protective_factors: ['Low GAD-7: 4'],
    immediate_concerns: [],
    suggested_interventions: ['CBT_THERAPY_REFERRAL', 'DAILY_MOOD_TRACKING'],
    follow_up_recommended: true,
    follow_up_timeframe: '2_weeks',
    latest_phq9: null,
    latest_gad7: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClinicalAssessment', () => {
  let submitPHQ9Spy: ReturnType<typeof vi.spyOn>;
  let submitGAD7Spy: ReturnType<typeof vi.spyOn>;
  let getHistorySpy: ReturnType<typeof vi.spyOn>;
  let getComprehensiveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    submitPHQ9Spy = vi.spyOn(clinicalApi, 'submitPHQ9').mockResolvedValue(makePHQ9Result());
    submitGAD7Spy = vi.spyOn(clinicalApi, 'submitGAD7').mockResolvedValue(makeGAD7Result());
    getHistorySpy = vi.spyOn(clinicalApi, 'getAssessmentHistory').mockResolvedValue({ history: [], total: 0 });
    getComprehensiveSpy = vi.spyOn(clinicalApi, 'getComprehensiveRisk').mockResolvedValue(makeComprehensiveRisk());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- #2: Q9 differentiation ---

  describe('Q9 self-harm differentiation', () => {
    it('shows high-risk warning when Q9 score >= 2', async () => {
      const result = makePHQ9Result({
        suicidal_ideation: true,
        self_harm_score: 2,
        total_score: 15,
        severity: 'moderately_severe',
        risk_level: 'severe',
        follow_up_timeframe: '24_hours',
      });
      submitPHQ9Spy.mockResolvedValue(result);

      renderComponent();

      // Answer all PHQ-9 questions with score 2 for self_harm
      const buttons = screen.getAllByRole('button');
      // Click response buttons for each question (0 = "Inte alls" for all except self_harm)
      // We need to answer all 9 questions
      const questionButtons = buttons.filter(b => b.textContent?.match(/Inte alls|Flera dagar|Mer än hälften|Nästan varje/));

      // Answer each question — click "Flera dagar" (index 1) for first 8, "Mer än hälften" (index 2) for self_harm
      for (let i = 0; i < 9; i++) {
        const baseIdx = i * 4;
        const answerIdx = i === 8 ? 2 : 1; // self_harm gets score 2
        fireEvent.click(questionButtons[baseIdx + answerIdx]);
      }

      // Click calculate
      const calcButton = screen.getByText('Beräkna resultat');
      fireEvent.click(calcButton);

      await waitFor(() => {
        expect(screen.getByText('⚠️ Akut självskaderisk')).toBeInTheDocument();
      });
    });

    it('shows moderate-risk warning when Q9 score = 1', async () => {
      const result = makePHQ9Result({
        suicidal_ideation: true,
        self_harm_score: 1,
        total_score: 7,
        severity: 'mild',
        risk_level: 'mild',
        follow_up_timeframe: '1_month',
      });
      submitPHQ9Spy.mockResolvedValue(result);

      renderComponent();

      const buttons = screen.getAllByRole('button');
      const questionButtons = buttons.filter(b => b.textContent?.match(/Inte alls|Flera dagar|Mer än hälften|Nästan varje/));

      for (let i = 0; i < 9; i++) {
        const baseIdx = i * 4;
        const answerIdx = i === 8 ? 1 : 0; // self_harm gets score 1, rest 0
        fireEvent.click(questionButtons[baseIdx + answerIdx]);
      }

      fireEvent.click(screen.getByText('Beräkna resultat'));

      await waitFor(() => {
        expect(screen.getByText('⚠️ Självskadetankar upptäckta')).toBeInTheDocument();
      });
    });
  });

  // --- #3: Safety plan ---

  describe('Safety plan', () => {
    it('shows safety plan when suicidal_ideation is true', async () => {
      const result = makePHQ9Result({
        suicidal_ideation: true,
        self_harm_score: 1,
        follow_up_timeframe: '1_month',
      });
      submitPHQ9Spy.mockResolvedValue(result);

      renderComponent();

      const buttons = screen.getAllByRole('button');
      const questionButtons = buttons.filter(b => b.textContent?.match(/Inte alls|Flera dagar|Mer än hälften|Nästan varje/));

      for (let i = 0; i < 9; i++) {
        fireEvent.click(questionButtons[i * 4 + (i === 8 ? 1 : 0)]);
      }

      fireEvent.click(screen.getByText('Beräkna resultat'));

      await waitFor(() => {
        expect(screen.getByText('Säkerhetsplan')).toBeInTheDocument();
      });
    });

    it('shows safety plan when severity is moderate or higher (without suicidal ideation)', async () => {
      const result = makePHQ9Result({
        total_score: 12,
        severity: 'moderate',
        risk_level: 'moderate',
        suicidal_ideation: false,
        self_harm_score: 0,
        follow_up_timeframe: '2_weeks',
      });
      submitPHQ9Spy.mockResolvedValue(result);

      renderComponent();

      const buttons = screen.getAllByRole('button');
      const questionButtons = buttons.filter(b => b.textContent?.match(/Inte alls|Flera dagar|Mer än hälften|Nästan varje/));

      // Answer all with score 1 (total = 9, not moderate) — need score 12
      // 4 questions with 2, 5 with 1 = 8+5 = 13... let's do 3 with 2, 6 with 1 = 12
      for (let i = 0; i < 9; i++) {
        fireEvent.click(questionButtons[i * 4 + (i < 3 ? 2 : 1)]);
      }

      fireEvent.click(screen.getByText('Beräkna resultat'));

      await waitFor(() => {
        expect(screen.getByText('Säkerhetsplan')).toBeInTheDocument();
      });
    });

    it('does not show safety plan for mild severity without suicidal ideation', async () => {
      const result = makePHQ9Result({
        total_score: 5,
        severity: 'mild',
        risk_level: 'mild',
        suicidal_ideation: false,
        self_harm_score: 0,
        follow_up_timeframe: '1_month',
      });
      submitPHQ9Spy.mockResolvedValue(result);

      renderComponent();

      const buttons = screen.getAllByRole('button');
      const questionButtons = buttons.filter(b => b.textContent?.match(/Inte alls|Flera dagar|Mer än hälften|Nästan varje/));

      for (let i = 0; i < 9; i++) {
        fireEvent.click(questionButtons[i * 4 + (i < 5 ? 1 : 0)]);
      }

      fireEvent.click(screen.getByText('Beräkna resultat'));

      await waitFor(() => {
        expect(screen.queryByText('Säkerhetsplan')).not.toBeInTheDocument();
      });
    });
  });

  // --- #8: Localized crisis numbers ---

  describe('Localized crisis contacts', () => {
    it('shows Swedish crisis numbers by default', async () => {
      const result = makePHQ9Result({
        suicidal_ideation: true,
        self_harm_score: 1,
      });
      submitPHQ9Spy.mockResolvedValue(result);

      renderComponent();

      const buttons = screen.getAllByRole('button');
      const questionButtons = buttons.filter(b => b.textContent?.match(/Inte alls|Flera dagar|Mer än hälften|Nästan varje/));

      for (let i = 0; i < 9; i++) {
        fireEvent.click(questionButtons[i * 4 + (i === 8 ? 1 : 0)]);
      }

      fireEvent.click(screen.getByText('Beräkna resultat'));

      await waitFor(() => {
        const crisisElements = screen.getAllByText(/90101/);
        expect(crisisElements.length).toBeGreaterThanOrEqual(1);
        const emergencyElements = screen.getAllByText(/112/);
        expect(emergencyElements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // --- #4: Follow-up reminder ---

  describe('Follow-up reminder', () => {
    it('shows follow-up timeframe in result', async () => {
      const result = makePHQ9Result({
        follow_up_timeframe: '2_weeks',
      });
      submitPHQ9Spy.mockResolvedValue(result);

      renderComponent();

      const buttons = screen.getAllByRole('button');
      const questionButtons = buttons.filter(b => b.textContent?.match(/Inte alls|Flera dagar|Mer än hälften|Nästan varje/));

      for (let i = 0; i < 9; i++) {
        fireEvent.click(questionButtons[i * 4 + 1]);
      }

      fireEvent.click(screen.getByText('Beräkna resultat'));

      await waitFor(() => {
        expect(screen.getByText(/Nästa bedömning/)).toBeInTheDocument();
        expect(screen.getByText(/inom 2 veckor/)).toBeInTheDocument();
      });
    });

    it('shows routine follow-up for minimal scores', async () => {
      const result = makePHQ9Result({
        total_score: 2,
        severity: 'minimal',
        risk_level: 'none',
        follow_up_timeframe: 'routine',
      });
      submitPHQ9Spy.mockResolvedValue(result);

      renderComponent();

      const buttons = screen.getAllByRole('button');
      const questionButtons = buttons.filter(b => b.textContent?.match(/Inte alls|Flera dagar|Mer än hälften|Nästan varje/));

      for (let i = 0; i < 9; i++) {
        fireEvent.click(questionButtons[i * 4 + 0]);
      }
      // Click two as "Flera dagar" to get score 2
      fireEvent.click(questionButtons[0 * 4 + 1]);
      fireEvent.click(questionButtons[1 * 4 + 1]);

      fireEvent.click(screen.getByText('Beräkna resultat'));

      await waitFor(() => {
        expect(screen.getByText(/vid behov/)).toBeInTheDocument();
      });
    });
  });

  // --- #7: Score swing warning ---

  describe('Score swing warning in history', () => {
    it('shows warning when >10 point change between consecutive PHQ-9 entries', async () => {
      const history: AssessmentHistoryEntry[] = [
        makeHistoryEntry({ id: '1', type: 'phq9', total_score: 19, severity: 'moderately_severe', timestamp: '2026-06-28T02:18:00Z' }),
        makeHistoryEntry({ id: '2', type: 'phq9', total_score: 7, severity: 'mild', timestamp: '2026-06-29T17:40:00Z' }),
      ];
      getHistorySpy.mockResolvedValue({ history, total: 2 });

      renderComponent();

      // Go to history tab
      fireEvent.click(screen.getByText('Historik'));

      await waitFor(() => {
        expect(screen.getByText(/Stor förändring/)).toBeInTheDocument();
      });
    });

    it('does not show warning for small changes', async () => {
      const history: AssessmentHistoryEntry[] = [
        makeHistoryEntry({ id: '1', type: 'phq9', total_score: 10, timestamp: '2026-06-28T02:18:00Z' }),
        makeHistoryEntry({ id: '2', type: 'phq9', total_score: 8, timestamp: '2026-06-29T17:40:00Z' }),
      ];
      getHistorySpy.mockResolvedValue({ history, total: 2 });

      renderComponent();

      fireEvent.click(screen.getByText('Historik'));

      await waitFor(() => {
        expect(screen.queryByText(/Stor förändring/)).not.toBeInTheDocument();
      });
    });
  });

  // --- #5: Composite risk ---

  describe('Composite risk assessment', () => {
    it('shows composite risk section when both PHQ-9 and GAD-7 history exist', async () => {
      const history: AssessmentHistoryEntry[] = [
        makeHistoryEntry({ id: '1', type: 'phq9', total_score: 10, severity: 'moderate' }),
        makeHistoryEntry({ id: '2', type: 'gad7', total_score: 8, severity: 'mild' }),
      ];
      getHistorySpy.mockResolvedValue({ history, total: 2 });
      getComprehensiveSpy.mockResolvedValue(makeComprehensiveRisk({
        composite_risk: 'moderate',
        risk_factors: ['PHQ-9 score: 10 (moderate)'],
        protective_factors: ['Low GAD-7: 4'],
      }));

      renderComponent();

      // Go to history tab
      fireEvent.click(screen.getByText('Historik'));

      await waitFor(() => {
        expect(screen.getByText('Kombinerad riskbedömning')).toBeInTheDocument();
        expect(screen.getByText('Medelhög risk')).toBeInTheDocument();
      });
    });

    it('does not show composite risk when only one type exists', async () => {
      const history: AssessmentHistoryEntry[] = [
        makeHistoryEntry({ id: '1', type: 'phq9', total_score: 10 }),
      ];
      getHistorySpy.mockResolvedValue({ history, total: 1 });

      renderComponent();

      fireEvent.click(screen.getByText('Historik'));

      await waitFor(() => {
        expect(screen.queryByText('Kombinerad riskbedömning')).not.toBeInTheDocument();
      });
    });
  });
});
