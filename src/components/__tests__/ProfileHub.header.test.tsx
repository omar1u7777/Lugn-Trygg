/**
 * The /profile heading is the person's name, with the e-mail address below it.
 *
 * The heading was the e-mail address at text-5xl, broken across lines at any
 * character, so it read as cut off; the stored name was not shown anywhere.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import i18n from '../../i18n';

let currentUser: Record<string, unknown> = {};

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: currentUser, setUser: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../api/users', () => ({
  getUserProfile: vi.fn().mockResolvedValue({}),
  getUserStats: vi.fn().mockResolvedValue({ accountAge: 399, activeDays: 43 }),
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
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false, toggleTheme: vi.fn() }),
}));

import ProfileHub from '../ProfileHub';

const renderProfile = async (user: Record<string, unknown>) => {
  currentUser = user;
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/profile']}>
        <ProfileHub />
      </MemoryRouter>
    </I18nextProvider>,
  );
  await waitFor(() => expect(screen.getByText(/Medlem i 399 dagar/)).toBeInTheDocument());
  return screen.getByRole('heading', { level: 1 });
};

describe('ProfileHub heading', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  it('is the stored name, with the e-mail address shown apart', async () => {
    const heading = await renderProfile({ user_id: 'u1', email: 'omaralhaek97@gmail.com', name: 'Omar Alhaek' });

    expect(heading.textContent).toBe('Omar Alhaek');
    expect(screen.getAllByText('omaralhaek97@gmail.com').length).toBeGreaterThan(0);
  });

  it('is "Din profil" when no name is stored, not the e-mail address', async () => {
    const heading = await renderProfile({ user_id: 'u1', email: 'omaralhaek97@gmail.com', name: 'Okänd' });

    expect(heading.textContent).toBe('Din profil');
    expect(heading.textContent).not.toContain('@');
    expect(screen.getAllByText('omaralhaek97@gmail.com').length).toBeGreaterThan(0);
  });
});
