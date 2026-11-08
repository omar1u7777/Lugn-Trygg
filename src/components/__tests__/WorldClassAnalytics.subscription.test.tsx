/**
 * The free-tier history banner is for the free plan only.
 *
 * It checked for premium, so a trial, whose history is unlimited (-1 days),
 * got a lock and "Gratis: Endast senaste -1 dagars historik".
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import i18n from '../../i18n';

const { useSubscriptionMock } = vi.hoisted(() => ({ useSubscriptionMock: vi.fn() }));

vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: useSubscriptionMock }));
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: { user_id: 'u1' } }) }));
vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({ announceToScreenReader: vi.fn() }),
}));
vi.mock('../../services/analytics', () => ({ analytics: { page: vi.fn(), track: vi.fn() } }));
vi.mock('../../api/api', () => ({
  getAllMoods: vi.fn().mockResolvedValue([]),
  getWeeklyAnalysis: vi.fn().mockResolvedValue({}),
}));

import WorldClassAnalytics from '../WorldClassAnalytics';

type Tier = 'free' | 'trial' | 'premium';

const renderAnalytics = (tier: Tier) => {
  useSubscriptionMock.mockReturnValue({
    plan: { tier, limits: { historyDays: tier === 'free' ? 7 : -1 } },
    isPremium: tier === 'premium',
    isTrial: tier === 'trial',
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <WorldClassAnalytics onClose={vi.fn()} />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

const banner = () => screen.queryByText(/Gratis: Endast senaste/);

describe('WorldClassAnalytics free-tier banner', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  it.each<Tier>(['trial', 'premium'])('is not shown on %s', async (tier) => {
    renderAnalytics(tier);

    await waitFor(() => expect(screen.getByText(/Fullständig Ärlighet/)).toBeInTheDocument());
    expect(banner()).toBeNull();
    expect(document.body.textContent).not.toContain('-1 dagar');
  });

  it('is shown on the free plan with its limit', async () => {
    renderAnalytics('free');

    await waitFor(() => expect(banner()).not.toBeNull());
    expect(banner()?.textContent).toContain('7 dagars');
  });
});
