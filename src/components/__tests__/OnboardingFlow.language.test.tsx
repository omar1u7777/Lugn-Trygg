/**
 * /onboarding speaks Swedish, also where it is only heard or shown on failure.
 *
 * Screen readers announced "Welcome Step", "Goal Selection Step", "Onboarding
 * steps" and "Step 1: …", and a failed save showed the raw error, e.g.
 * "Network Error", or "Failed to save goals", among Swedish text.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import i18n from '../../i18n';

const { saveOnboardingGoals } = vi.hoisted(() => ({ saveOnboardingGoals: vi.fn() }));

vi.mock('../../api/onboarding', () => ({ saveOnboardingGoals, skipOnboarding: vi.fn() }));
vi.mock('../../services/analytics', () => ({ trackEvent: vi.fn() }));

class StubIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.IntersectionObserver = StubIntersectionObserver as unknown as typeof IntersectionObserver;

import { OnboardingFlow } from '../OnboardingFlow';

const renderOnboarding = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <OnboardingFlow userId="u1" onComplete={vi.fn()} />
    </I18nextProvider>,
  );

const ENGLISH_LABEL = /\b(step|steps|welcome|goal selection|onboarding)\b/i;

describe('OnboardingFlow language', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  it('names its regions and steps in Swedish for screen readers', () => {
    const { container } = renderOnboarding();

    const labels = [...container.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label') ?? '');
    expect(labels.filter((label) => ENGLISH_LABEL.test(label))).toEqual([]);
    expect(screen.getByRole('region', { name: 'Välkommen' })).toBeInTheDocument();
  });

  it('says in Swedish that the goals could not be saved', async () => {
    saveOnboardingGoals.mockRejectedValue(new Error('Network Error'));
    renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: /Nästa/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Hantera stress/ }));
    fireEvent.click(screen.getByRole('button', { name: /Nästa/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Starta/ }));

    await waitFor(() => expect(saveOnboardingGoals).toHaveBeenCalled());
    expect(await screen.findByText(/Kunde inte spara dina mål/)).toBeInTheDocument();
    expect(screen.queryByText(/Network Error|Failed to save goals/)).toBeNull();
  });
});
