/**
 * "Dagar aktiv" shows days with a mood entry, not account age.
 *
 * Both "Medlem i X dagar" and the "Dagar aktiv" tile read accountAge, so they
 * always showed the same number (399 for the tester).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import i18n from '../../i18n';

const { getUserStats } = vi.hoisted(() => ({ getUserStats: vi.fn() }));

vi.mock('../../api/users', () => ({
  getUserProfile: vi.fn().mockResolvedValue({}),
  getUserStats,
  updateUserPreferences: vi.fn(),
}));
vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    plan: { tier: 'premium', limits: { moodLogsPerDay: -1, chatMessagesPerDay: -1, historyDays: -1 } },
    isPremium: true,
    isTrial: false,
    usage: { moodLogs: 0, chatMessages: 0, lastResetDate: '2026-11-08' },
    getRemainingMoodLogs: () => -1,
    getRemainingMessages: () => -1,
  }),
}));
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { user_id: 'u1', email: 'test@example.se' }, setUser: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false, toggleTheme: vi.fn() }),
}));

import ProfileHub from '../ProfileHub';

const renderProfile = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/profile']}>
        <ProfileHub />
      </MemoryRouter>
    </I18nextProvider>,
  );

const activeDaysTile = () => screen.getByText('Dagar aktiv').parentElement?.textContent ?? '';

describe('ProfileHub stats', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  it('shows days with a mood entry under "Dagar aktiv"', async () => {
    getUserStats.mockResolvedValue({ totalMoods: 128, totalConversations: 4, totalMemories: 0, accountAge: 399, activeDays: 57 });

    renderProfile();

    await waitFor(() => expect(screen.getByText(/Medlem i 399 dagar/)).toBeInTheDocument());
    expect(activeDaysTile()).toContain('57');
    expect(activeDaysTile()).not.toContain('399');
  });

  it('shows "–" rather than account age when the count is missing', async () => {
    getUserStats.mockResolvedValue({ totalMoods: 128, totalConversations: 4, totalMemories: 0, accountAge: 399, activeDays: null });

    renderProfile();

    await waitFor(() => expect(screen.getByText(/Medlem i 399 dagar/)).toBeInTheDocument());
    expect(activeDaysTile()).toContain('–');
    expect(activeDaysTile()).not.toContain('399');
  });
});
