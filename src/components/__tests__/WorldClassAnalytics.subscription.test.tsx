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
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import i18n from '../../i18n';

const { useSubscriptionMock } = vi.hoisted(() => ({ useSubscriptionMock: vi.fn() }));

vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: useSubscriptionMock }));
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: { user_id: 'u1' } }) }));
vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({ announceToScreenReader: vi.fn() }),
}));
vi.mock('../../services/analytics', () => ({ analytics: { page: vi.fn(), track: vi.fn() } }));
const { getAllMoods } = vi.hoisted(() => ({ getAllMoods: vi.fn() }));

vi.mock('../../api/api', () => ({
  getAllMoods,
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

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const totalLogs = () =>
  screen.getByText('Totala loggningar').previousElementSibling?.textContent;

describe('WorldClassAnalytics free-tier banner', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  beforeEach(() => {
    getAllMoods.mockResolvedValue([]);
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

describe('WorldClassAnalytics history window', () => {
  const moods = [
    { id: 'today', score: 8, timestamp: daysAgo(0) },
    { id: 'yesterday', score: 3, timestamp: daysAgo(1) },
    { id: 'last-month', score: 5, timestamp: daysAgo(30) },
  ];

  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  beforeEach(() => {
    getAllMoods.mockResolvedValue(moods);
  });

  it('counts only the last 7 days on the free plan', async () => {
    renderAnalytics('free');

    await waitFor(() => expect(totalLogs()).toBe('2'));
  });

  it.each<Tier>(['trial', 'premium'])('counts the whole history on %s', async (tier) => {
    renderAnalytics(tier);

    await waitFor(() => expect(totalLogs()).toBe('3'));
  });
});
