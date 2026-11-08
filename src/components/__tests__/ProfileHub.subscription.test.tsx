/**
 * A trial has every premium feature, so /profile offers it no upgrade.
 *
 * The plan card said "Provperiod — Obegränsad tillgång till alla funktioner"
 * while the header, which only checked for premium, offered "Uppgradera nu".
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import i18n from '../../i18n';

const { useSubscriptionMock } = vi.hoisted(() => ({ useSubscriptionMock: vi.fn() }));

vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: useSubscriptionMock }));
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { user_id: 'u1', email: 'test@example.se' }, setUser: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false, toggleTheme: vi.fn() }),
}));
vi.mock('../../api/users', () => ({
  getUserProfile: vi.fn().mockResolvedValue({}),
  getUserStats: vi.fn().mockResolvedValue({}),
  updateUserPreferences: vi.fn(),
}));

import ProfileHub from '../ProfileHub';

type Tier = 'free' | 'trial' | 'premium';

const subscription = (tier: Tier) => {
  const unlimited = tier !== 'free';
  return {
    plan: {
      tier,
      limits: {
        moodLogsPerDay: unlimited ? -1 : 5,
        chatMessagesPerDay: unlimited ? -1 : 10,
        historyDays: unlimited ? -1 : 7,
      },
    },
    isPremium: tier === 'premium',
    isTrial: tier === 'trial',
    usage: { moodLogs: 0, chatMessages: 0, lastResetDate: '2026-11-08' },
    getRemainingMoodLogs: () => (unlimited ? -1 : 5),
    getRemainingMessages: () => (unlimited ? -1 : 10),
  };
};

const renderProfile = (tier: Tier) => {
  useSubscriptionMock.mockReturnValue(subscription(tier));
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/profile']}>
        <ProfileHub />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

describe('ProfileHub upgrade prompts', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  it('offers a trial no upgrade', async () => {
    renderProfile('trial');

    await waitFor(() => expect(screen.getByText(/Provperiod/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Uppgradera nu' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Uppgradera till Premium' })).toBeNull();
  });

  it('offers premium no upgrade', async () => {
    renderProfile('premium');

    await waitFor(() => expect(screen.getByText(/Premium-medlem/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Uppgradera nu' })).toBeNull();
  });

  it('still offers the free plan an upgrade', async () => {
    renderProfile('free');

    await waitFor(() => expect(screen.getByText(/Gratis-plan/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Uppgradera nu' })).toBeInTheDocument();
  });
});
