import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import CompositeRiskCard from '../CompositeRiskCard';
import type { ComprehensiveRiskResult } from '../../../api/clinical';

const base: ComprehensiveRiskResult = {
  timestamp: '2026-10-04T10:00:00Z',
  composite_risk: 'none',
  risk_factors: [],
  protective_factors: [],
  immediate_concerns: [],
  suggested_interventions: [],
  follow_up_recommended: false,
  follow_up_timeframe: 'routine',
  latest_phq9: null,
  latest_gad7: null,
};

const renderCard = (risk: Partial<ComprehensiveRiskResult>, onRetake = vi.fn()) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <CompositeRiskCard risk={{ ...base, ...risk }} severityColor={() => ''} onRetake={onRetake} />
      </MemoryRouter>
    </I18nextProvider>,
  );

describe('CompositeRiskCard', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  it('gives a crisis result a way to act: 112, 90101 and the crisis page', () => {
    renderCard({
      composite_risk: 'crisis',
      risk_factor_details: [{ code: 'SUICIDAL_IDEATION', params: { q9: 3 } }],
      patient_interventions: ['CONTACT_CRISIS_SUPPORT', 'CREATE_SAFETY_PLAN'],
    });

    const alert = screen.getByRole('alert');
    expect(alert.querySelector('a[href="tel:112"]')).not.toBeNull();
    expect(alert.querySelector('a[href="tel:90101"]')).not.toBeNull();
    expect(alert.querySelector('a[href="/crisis"]')).not.toBeNull();
    expect(screen.getByText(/Tankar på att skada dig själv \(PHQ-9 fråga 9: 3\)/)).toBeInTheDocument();
  });

  it('never shows backend English or clinician orders to the patient', () => {
    const { container } = renderCard({
      composite_risk: 'crisis',
      risk_factors: ['Suicidal ideation: PHQ-9 Q9=3'],
      risk_factor_details: [{ code: 'SUICIDAL_IDEATION', params: { q9: 3 } }],
      suggested_interventions: ['URGENT_REFERRAL_PSYCHIATRY', 'REMOVE_MEANS_SELF_HARM'],
      patient_interventions: ['CONTACT_CRISIS_SUPPORT'],
    });

    expect(container.textContent).not.toMatch(/Suicidal ideation/);
    expect(container.textContent).not.toMatch(/remiss till psykiatrin/i);
    expect(container.textContent).not.toMatch(/Avlägsna medel/);
  });

  it('filters clinician orders out when talking to an older backend', () => {
    const { container } = renderCard({
      composite_risk: 'severe',
      suggested_interventions: ['URGENT_THERAPY_REFERRAL', 'MEDICATION_EVALUATION', 'DAILY_MOOD_TRACKING'],
    });

    expect(container.textContent).toMatch(/Daglig humörloggning/);
    expect(container.textContent).not.toMatch(/Läkemedelsbedömning/);
    expect(container.querySelector('a[href="tel:1177"]')).not.toBeNull();
  });

  it('translates factor severities and pluralises the streak', () => {
    renderCard({
      composite_risk: 'moderate',
      risk_factor_details: [
        { code: 'PHQ9_SCORE', params: { score: 16, severity: 'moderately_severe' } },
        { code: 'NEGATIVE_STREAK', params: { days: 4 } },
      ],
    });

    expect(screen.getByText('PHQ-9: 16 poäng (Medelsvår–svår)')).toBeInTheDocument();
    expect(screen.getByText('4 dagar i rad med lågt humör')).toBeInTheDocument();
  });

  it('offers a new assessment when the latest one is outside the window', () => {
    const onRetake = vi.fn();
    renderCard(
      {
        stale_assessments: [{ type: 'phq9', timestamp: '2026-05-01T10:00:00Z' }],
        assessment_window_days: 30,
      },
      onRetake,
    );

    expect(screen.getByText(/Din senaste PHQ-9 är från .*2026\. Resultat som är äldre än 30 dagar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gör en ny PHQ-9' }));
    expect(onRetake).toHaveBeenCalledWith('phq9');
  });

  it('shows no crisis or care block when there is no risk', () => {
    const { container } = renderCard({ composite_risk: 'none' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });
});
