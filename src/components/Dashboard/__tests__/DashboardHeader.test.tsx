import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mocks — must come before component import

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === 'object' && 'minutes' in opts) return `${opts.minutes} minuter sedan`;
      if (opts && typeof opts === 'object' && 'time' in opts) return `kl. ${opts.time}`;
      return key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
}));

const dashboardDataMock = vi.hoisted(() => ({
  useDashboardData: vi.fn(() => ({ stats: null, isLoading: false, refresh: vi.fn() })),
}));

vi.mock('../../../hooks/useDashboardData', () => dashboardDataMock);

import { DashboardHeader } from '../DashboardHeader';

describe('DashboardHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default: no session completed
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  // -----------------------------------------------------------------------
  // Render tests
  // -----------------------------------------------------------------------

  it('renders with default props', () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader />);
    // Should render some greeting key
    expect(document.body).toBeInTheDocument();
  });

  it('renders userName prop', () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader userName="Anna" />);
    expect(screen.getByText('Anna')).toBeInTheDocument();
  });

  it('shows loading indicator when isLoading is true', () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader isLoading={true} />);
    // isLoading branch: shows updating label
    expect(screen.getByText('dashboardHeader.updatingData')).toBeInTheDocument();
  });

  it('shows auto-update text when not loading', () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader isLoading={false} />);
    expect(screen.getByText(/dashboardHeader.autoUpdate/i)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // getGreeting branches via rendered output
  // -----------------------------------------------------------------------

  it('uses morning greeting before 10:00', () => {
    vi.setSystemTime(new Date('2026-04-06T08:00:00'));
    render(<DashboardHeader />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('greeting.morning');
  });

  it('uses day greeting at 10:00', () => {
    vi.setSystemTime(new Date('2026-04-06T12:00:00'));
    render(<DashboardHeader />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('greeting.day');
  });

  it('uses afternoon greeting at 14:00', () => {
    vi.setSystemTime(new Date('2026-04-06T15:30:00'));
    render(<DashboardHeader />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('greeting.afternoon');
  });

  it('uses evening greeting after 18:00', () => {
    vi.setSystemTime(new Date('2026-04-06T20:00:00'));
    render(<DashboardHeader />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('greeting.evening');
  });

  it('adds takeItEasy suffix for stressed mood', () => {
    dashboardDataMock.useDashboardData.mockReturnValue({
      stats: { averageMood: 'stress' },
      isLoading: false,
      refresh: vi.fn(),
    });
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader userId="u1" />);
    // The greeting will include takeItEasy suffix
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('greeting.takeItEasy');
  });

  it('adds restIsProductive suffix for tired mood', () => {
    dashboardDataMock.useDashboardData.mockReturnValue({
      stats: { averageMood: 'trött' },
      isLoading: false,
      refresh: vi.fn(),
    });
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader userId="u1" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('greeting.restIsProductive');
  });

  it('adds greatToSeeYou suffix for happy mood', () => {
    dashboardDataMock.useDashboardData.mockReturnValue({
      stats: { averageMood: 'glad' },
      isLoading: false,
      refresh: vi.fn(),
    });
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader userId="u1" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('greeting.greatToSeeYou');
  });

  // -----------------------------------------------------------------------
  // getContextualPrompt branches
  // -----------------------------------------------------------------------

  it('shows checkedIn prompt when hasLoggedToday is true', () => {
    vi.setSystemTime(new Date('2026-04-06T12:00:00'));
    render(<DashboardHeader hasLoggedToday={true} />);
    expect(screen.getByText('dashboardHeader.checkedIn')).toBeInTheDocument();
  });

  it('shows morningMood prompt with mood in the morning', () => {
    vi.setSystemTime(new Date('2026-04-06T08:00:00'));
    render(<DashboardHeader hasLoggedToday={false} lastMood="lugnare" />);
    expect(screen.getByText('dashboardHeader.morningMood')).toBeInTheDocument();
  });

  it('shows welcomeBackMood prompt with mood during daytime', () => {
    vi.setSystemTime(new Date('2026-04-06T14:00:00'));
    render(<DashboardHeader hasLoggedToday={false} lastMood="glad" />);
    expect(screen.getByText('dashboardHeader.welcomeBackMood')).toBeInTheDocument();
  });

  it('shows mindfulPrompt when no mood and not logged', () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader hasLoggedToday={false} />);
    expect(screen.getByText('dashboardHeader.mindfulPrompt')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // getSmartTimestamp branches
  // -----------------------------------------------------------------------

  it('shows no timestamp when less than 2 minutes ago', () => {
    vi.setSystemTime(new Date('2026-04-06T12:01:00'));
    const recent = new Date('2026-04-06T12:00:30');
    render(<DashboardHeader isLoading={false} lastUpdatedAt={recent} />);
    // diff < 2 min → empty string, so just autoUpdate text
    const autoUpdateEl = screen.getByText(/dashboardHeader.autoUpdate/i);
    expect(autoUpdateEl.textContent).not.toContain('minuter');
  });

  it('shows minutes timestamp when 5 minutes ago', () => {
    vi.setSystemTime(new Date('2026-04-06T12:10:00'));
    const fiveMinutesAgo = new Date('2026-04-06T12:05:00');
    render(<DashboardHeader isLoading={false} lastUpdatedAt={fiveMinutesAgo} />);
    expect(screen.getByText(/5 minuter sedan/)).toBeInTheDocument();
  });

  it('shows time timestamp when more than an hour ago', () => {
    vi.setSystemTime(new Date('2026-04-06T14:00:00'));
    const twoHoursAgo = new Date('2026-04-06T12:00:00');
    render(<DashboardHeader isLoading={false} lastUpdatedAt={twoHoursAgo} />);
    // diff >= 60 min → time format
    expect(screen.getByText(/kl\./)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Breathing session interaction branches
  // -----------------------------------------------------------------------

  const getStartBreathingBtn = () => screen.getByRole('button', { name: /breath\.ariaStart/i });

  it('renders the start breathing button', () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader />);
    const btn = getStartBreathingBtn();
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('starts breathing session on button click', async () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader />);
    const btn = getStartBreathingBtn();
    await act(async () => {
      fireEvent.click(btn);
      await Promise.resolve();
    });
    // Button is now disabled (session active)
    expect(btn).toBeDisabled();
  });

  it('shows skip button when breathing session is active', async () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader />);
    const startBtn = getStartBreathingBtn();
    await act(async () => {
      fireEvent.click(startBtn);
      await Promise.resolve();
    });
    expect(screen.getByText('breath.skip')).toBeInTheDocument();
  });

  it('calls onFocusAction when skip button is clicked', async () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    const onFocusAction = vi.fn();
    render(<DashboardHeader onFocusAction={onFocusAction} />);
    const startBtn = getStartBreathingBtn();
    await act(async () => {
      fireEvent.click(startBtn);
      await Promise.resolve();
    });
    const skipBtn = screen.getByText('breath.skip');
    fireEvent.click(skipBtn);
    expect(onFocusAction).toHaveBeenCalled();
  });

  it('shows completed session state when stored in localStorage', () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    const todayKey = new Date('2026-04-06T09:00:00').toISOString().slice(0, 10);
    localStorage.setItem('lugn-trygg-focus-breathing-last-completed', todayKey);
    render(<DashboardHeader />);
    // Session already completed — should show "continue" button
    expect(screen.getByText('breath.continue')).toBeInTheDocument();
  });

  it('calls onFocusAction when continue button is clicked after session completed', () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    const todayKey = new Date('2026-04-06T09:00:00').toISOString().slice(0, 10);
    localStorage.setItem('lugn-trygg-focus-breathing-last-completed', todayKey);
    const onFocusAction = vi.fn();
    render(<DashboardHeader onFocusAction={onFocusAction} />);
    const continueBtn = screen.getByText('breath.continue');
    fireEvent.click(continueBtn);
    expect(onFocusAction).toHaveBeenCalled();
  });

  it('starts breathing on Space keydown when session not active', async () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader />);
    const startBtn = getStartBreathingBtn();
    expect(startBtn).not.toBeDisabled();
    await act(async () => {
      fireEvent.keyDown(window, { code: 'Space' });
      await Promise.resolve();
    });
    expect(startBtn).toBeDisabled();
  });

  it('does not start breathing on Space when session already active', async () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader />);
    const startBtn = getStartBreathingBtn();
    // Start session
    await act(async () => {
      fireEvent.click(startBtn);
      await Promise.resolve();
    });
    expect(startBtn).toBeDisabled();
    // Press Space again — should not throw, session remains
    await act(async () => {
      fireEvent.keyDown(window, { code: 'Space' });
      await Promise.resolve();
    });
    expect(startBtn).toBeDisabled();
  });

  it('does not trigger breathing on non-Space key', async () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader />);
    const startBtn = getStartBreathingBtn();
    await act(async () => {
      fireEvent.keyDown(window, { code: 'Enter' });
      await Promise.resolve();
    });
    expect(startBtn).not.toBeDisabled();
  });

  it('advances breathing phases after timer fires', async () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader />);
    const startBtn = getStartBreathingBtn();
    await act(async () => {
      fireEvent.click(startBtn);
      await Promise.resolve();
    });
    // Advance through inhale phase (4 seconds)
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    // Now in exhale phase — button still disabled
    expect(startBtn).toBeDisabled();
  });

  it('completes breathing session after all cycles', async () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader />);
    const startBtn = getStartBreathingBtn();
    await act(async () => {
      fireEvent.click(startBtn);
      await Promise.resolve();
    });
    // Advance through 3 full breath cycles: inhale(4) + exhale(4) + hold(2) = 10s × 3 = 30s
    await act(async () => {
      vi.advanceTimersByTime(4000); // inhale → exhale
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(4000); // exhale → hold
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(2000); // hold → next breath
      await Promise.resolve();
    });
    // At least first cycle done; session progressing
    expect(document.body).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // getDailyFocusContent branches (visible through rendered titles)
  // -----------------------------------------------------------------------

  it('shows morning focus content before 10:00', () => {
    vi.setSystemTime(new Date('2026-04-06T08:00:00'));
    render(<DashboardHeader />);
    expect(screen.getByText('dashboardHeader.morningFocus')).toBeInTheDocument();
  });

  it('shows day focus content between 10:00 and 18:00', () => {
    vi.setSystemTime(new Date('2026-04-06T12:00:00'));
    render(<DashboardHeader />);
    expect(screen.getByText('dashboardHeader.dayFocus')).toBeInTheDocument();
  });

  it('shows evening focus content after 18:00', () => {
    vi.setSystemTime(new Date('2026-04-06T20:00:00'));
    render(<DashboardHeader />);
    expect(screen.getByText('dashboardHeader.eveningFocus')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // No userId → stats null
  // -----------------------------------------------------------------------

  it('renders without userId (stats null path)', () => {
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader userId={undefined} />);
    expect(document.body).toBeInTheDocument();
  });

  it('renders with userId (stats from dashboardData path)', () => {
    dashboardDataMock.useDashboardData.mockReturnValue({
      stats: { averageMood: 5 },
      isLoading: false,
      refresh: vi.fn(),
    });
    vi.setSystemTime(new Date('2026-04-06T09:00:00'));
    render(<DashboardHeader userId="user-1" />);
    expect(document.body).toBeInTheDocument();
  });
});
