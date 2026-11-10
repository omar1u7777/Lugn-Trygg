/**
 * A mood that cannot be logged says why, on screen and in Swedish.
 *
 * Logging the same mood twice within five minutes did nothing visible: the
 * client's own check told only screen readers and returned. When the server
 * refused instead (409 for a duplicate, 429 for the daily limit) the red box
 * showed the server's English text, "Duplicate mood within 5 minutes. Please
 * wait before logging the same mood again.", in a Swedish app.
 *
 * Real translations here, not a mocked t(): the bug was which text was chosen.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import i18n from '../../i18n';
import sv from '../../i18n/locales/sv.json';
import { ApiError } from '../../api/errors';

const { logMoodMock } = vi.hoisted(() => ({ logMoodMock: vi.fn() }));

vi.mock('../../api/api', () => ({
  logMood: logMoodMock,
  getMoods: vi.fn().mockResolvedValue([]),
  deleteMood: vi.fn(),
}));
vi.mock('../../api/client', () => ({ api: { post: vi.fn().mockResolvedValue({ data: {} }) } }));
vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../../services/analytics', () => ({ analytics: { track: vi.fn(), page: vi.fn(), identify: vi.fn() } }));
vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({ announceToScreenReader: vi.fn() }),
}));
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { user_id: 'user-1', email: 'test@example.com' } }),
}));
vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({ canLogMood: () => true, incrementMoodLog: vi.fn(), plan: { tier: 'free', limits: {} } }),
}));

import { SuperMoodLogger } from '../SuperMoodLogger';

const DUPLICATE = sv.moodLogger.duplicateWarning;
const DAILY_LIMIT = sv.moodLogger.dailyLimitReachedMessage;

const refusal = (status: number, error: string, message: string) =>
  new ApiError(message, { status, data: { success: false, error, message } });

const renderLogger = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <SuperMoodLogger showRecentMoods={false} />
    </I18nextProvider>,
  );

const logGlad = async () => {
  fireEvent.click(screen.getByText('Glad'));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Logga/ }));
  });
};

describe('SuperMoodLogger when a mood cannot be logged', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  beforeEach(() => {
    logMoodMock.mockReset();
    logMoodMock.mockResolvedValue({ id: 'mood-1', score: 8 });
  });

  it('says on screen that the same mood was just logged', async () => {
    renderLogger();
    await logGlad();
    await waitFor(() => expect(logMoodMock).toHaveBeenCalledTimes(1));

    await logGlad();

    expect(logMoodMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(DUPLICATE)).toBeInTheDocument();
  });

  it('tells the person what to do about it', () => {
    expect(DUPLICATE).toMatch(/vänta/i);
  });

  it('shows the Swedish text when the server refuses a duplicate', async () => {
    logMoodMock.mockRejectedValueOnce(refusal(
      409, 'DUPLICATE_MOOD', 'Duplicate mood within 5 minutes. Please wait before logging the same mood again.',
    ));
    renderLogger();

    await logGlad();

    expect(await screen.findByText(DUPLICATE)).toBeInTheDocument();
    expect(screen.queryByText(/Duplicate mood/)).toBeNull();
  });

  it('shows the Swedish text when the server says the daily limit is reached', async () => {
    logMoodMock.mockRejectedValueOnce(refusal(429, 'QUOTA_EXCEEDED', 'Daily mood log limit reached'));
    renderLogger();

    await logGlad();

    expect(await screen.findByText(DAILY_LIMIT)).toBeInTheDocument();
    expect(screen.queryByText(/Daily mood log limit/)).toBeNull();
  });
});
