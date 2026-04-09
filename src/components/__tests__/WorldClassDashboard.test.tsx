import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const navigateMock = vi.fn();
const announceMock = vi.fn();
const refreshMock = vi.fn();
const refreshSubscriptionMock = vi.fn();
const getSubscriptionStatusMock = vi.fn();

const locationState = {
  pathname: '/dashboard',
  search: '',
};

const dashboardDataState = {
  stats: {
    totalMoods: 8,
    totalChats: 3,
    averageMood: 6,
    streakDays: 4,
    weeklyGoal: 5,
    weeklyProgress: 2,
    wellnessGoals: [] as string[],
    recentActivity: [] as Array<{ id: string; type: string; timestamp: string; description: string }>,
  },
  loading: false,
  error: null as Error | null,
  refresh: refreshMock,
};

const subscriptionState = {
  hasFeature: vi.fn((feature: string) => feature !== 'premium' && feature !== 'unlimited_usage'),
  plan: { name: 'free', limits: { moodLogsPerDay: 3, chatMessagesPerDay: 10 } },
  refreshSubscription: refreshSubscriptionMock,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => locationState,
    useNavigate: () => navigateMock,
  };
});

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, vars?: Record<string, unknown>) => {
        if (key === 'dashboard.goalSteps') {
          return {
            default: ['Ta ett litet steg'],
            fallback: 'Fortsatt fokus',
            BetterSleep: ['Lagg dig 10 min tidigare'],
          };
        }
        if (vars && typeof vars === 'object') {
          return `${key}:${Object.keys(vars).join(',')}`;
        }
        return key;
      },
    }),
  };
});

vi.mock('../Dashboard/DashboardHeader', () => ({
  DashboardHeader: ({ userName }: { userName: string }) => <div data-testid="dashboard-header">{userName}</div>,
}));

vi.mock('../Dashboard/DashboardStats', () => ({
  DashboardStats: ({ isLoading }: { isLoading: boolean }) => <div data-testid="dashboard-stats">{String(isLoading)}</div>,
}));

vi.mock('../Dashboard/DashboardActivity', () => ({
  DashboardActivity: () => <div data-testid="dashboard-activity">activity</div>,
}));

vi.mock('../Dashboard/DashboardQuickActions', () => ({
  DashboardQuickActions: ({ onActionClick }: { onActionClick: (actionId: string) => void }) => (
    <div>
      <button onClick={() => onActionClick('mood')}>qa-mood</button>
      <button onClick={() => onActionClick('chat')}>qa-chat</button>
      <button onClick={() => onActionClick('meditation')}>qa-meditation</button>
      <button onClick={() => onActionClick('journal')}>qa-journal</button>
      <button onClick={() => onActionClick('sounds')}>qa-sounds</button>
      <button onClick={() => onActionClick('social')}>qa-social</button>
      <button onClick={() => onActionClick('recommendations')}>qa-recommendations</button>
      <button onClick={() => onActionClick('analytics')}>qa-analytics</button>
      <button onClick={() => onActionClick('gamification')}>qa-gamification</button>
    </div>
  ),
}));

vi.mock('../SuperMoodLogger', () => ({
  SuperMoodLogger: () => <div data-testid="super-mood-logger">super-mood</div>,
}));

vi.mock('../MoodLogger', () => ({
  default: ({ onMoodLogged }: { onMoodLogged: () => void }) => (
    <button onClick={onMoodLogged}>log-mood</button>
  ),
}));

vi.mock('../MoodList', () => ({
  default: () => <div data-testid="mood-list">mood-list</div>,
}));

vi.mock('../WorldClassAIChat', () => ({
  default: () => <div data-testid="ai-chat">ai-chat</div>,
}));

vi.mock('../WorldClassGamification', () => ({
  default: () => <div data-testid="gamification">gamification</div>,
}));

vi.mock('../Wellness/WellnessGoalsOnboarding', () => ({
  default: ({ onComplete, onSkip }: { onComplete: (goals: string[]) => void; onSkip: () => void }) => (
    <div>
      <button onClick={() => onComplete(['BetterSleep'])}>complete-goals</button>
      <button onClick={onSkip}>skip-goals</button>
    </div>
  ),
}));

vi.mock('../PremiumGate', () => ({
  PremiumGate: ({ feature }: { feature: string }) => <div data-testid="premium-gate">{feature}</div>,
}));

vi.mock('../UsageLimitBanner', () => ({
  UsageLimitBanner: () => <div data-testid="usage-banner">usage</div>,
}));

vi.mock('../ui/tailwind', () => ({
  Snackbar: ({ open, message }: { open: boolean; message: string }) =>
    open ? <div data-testid="snackbar">{message}</div> : null,
}));

vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({ announceToScreenReader: announceMock }),
}));

vi.mock('../../hooks/useDashboardData', () => ({
  useDashboardData: () => dashboardDataState,
}));

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => subscriptionState,
}));

vi.mock('../../api/subscription', () => ({
  getSubscriptionStatus: (...args: unknown[]) => getSubscriptionStatusMock(...args),
}));

vi.mock('../../services/analytics', () => ({
  analytics: {
    page: vi.fn(),
    track: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { user_id: 'u1', email: 'test@example.com' } }),
}));

import WorldClassDashboard from '../WorldClassDashboard';

describe('WorldClassDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    locationState.pathname = '/dashboard';
    locationState.search = '';

    dashboardDataState.stats = {
      totalMoods: 8,
      totalChats: 3,
      averageMood: 6,
      streakDays: 4,
      weeklyGoal: 5,
      weeklyProgress: 2,
      wellnessGoals: [],
      recentActivity: [],
    };
    dashboardDataState.loading = false;
    dashboardDataState.error = null;

    subscriptionState.hasFeature = vi.fn((feature: string) => feature !== 'premium' && feature !== 'unlimited_usage');
    subscriptionState.plan = { name: 'free', limits: { moodLogsPerDay: 3, chatMessagesPerDay: 10 } };

    getSubscriptionStatusMock.mockResolvedValue({ isPremium: true, isTrial: false, plan: 'premium' });
  });

  it('renders error state and retry action', () => {
    dashboardDataState.error = new Error('boom');
    render(<WorldClassDashboard userId="u1" />);

    expect(screen.getByText('worldDashboard.loadError')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'worldDashboard.tryAgain' }));
    expect(refreshMock).toHaveBeenCalled();
  });

  it('renders usage banner for free users and hides it for premium users', () => {
    const { rerender } = render(<WorldClassDashboard userId="u1" />);
    expect(screen.getByTestId('usage-banner')).toBeTruthy();

    subscriptionState.hasFeature = vi.fn((feature: string) => feature === 'premium' || feature === 'unlimited_usage');
    subscriptionState.plan = { name: 'premium', limits: { moodLogsPerDay: -1, chatMessagesPerDay: -1 } };

    rerender(<WorldClassDashboard userId="u1" />);
    expect(screen.queryByTestId('usage-banner')).toBeNull();
  });

  it('shows onboarding modal when no wellness goals and closes on skip', () => {
    render(<WorldClassDashboard userId="u1" />);

    expect(screen.getByRole('dialog', { name: 'worldDashboard.wellnessGoalsLabel' })).toBeTruthy();
    fireEvent.click(screen.getByText('skip-goals'));
    expect(screen.queryByRole('dialog', { name: 'worldDashboard.wellnessGoalsLabel' })).toBeNull();
  });

  it('renders wellness goals and recommendation CTA when goals exist', async () => {
    dashboardDataState.stats.wellnessGoals = ['BetterSleep'];
    render(<WorldClassDashboard userId="u1" />);

    expect(screen.getByText('worldDashboard.wellnessGoals')).toBeTruthy();
    fireEvent.click(screen.getByText('worldDashboard.seeRecommendations'));
    expect(navigateMock).toHaveBeenCalledWith('/recommendations');

    fireEvent.click(screen.getByRole('button', { name: 'dashboard.updateGoalsAria' }));
    expect(screen.getByRole('dialog', { name: 'worldDashboard.wellnessGoalsLabel' })).toBeTruthy();

    fireEvent.click(screen.getByText('complete-goals'));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('renders weekly goal reached state', () => {
    dashboardDataState.stats.weeklyGoal = 3;
    dashboardDataState.stats.weeklyProgress = 3;

    render(<WorldClassDashboard userId="u1" />);
    expect(screen.getByText('worldDashboard.weeklyGoalReached')).toBeTruthy();
  });

  it('opens feature views from quick actions and supports mood/chat', () => {
    render(<WorldClassDashboard userId="u1" />);

    fireEvent.click(screen.getByText('qa-mood'));
    expect(screen.getByTestId('super-mood-logger')).toBeTruthy();

    render(<WorldClassDashboard userId="u1" />);
    fireEvent.click(screen.getByText('qa-chat'));
    expect(screen.getByTestId('ai-chat')).toBeTruthy();
  });

  it('redirects to upgrade for locked premium quick actions', () => {
    subscriptionState.hasFeature = vi.fn(() => false);
    render(<WorldClassDashboard userId="u1" />);

    fireEvent.click(screen.getByText('qa-meditation'));
    fireEvent.click(screen.getByText('qa-journal'));
    fireEvent.click(screen.getByText('qa-sounds'));
    fireEvent.click(screen.getByText('qa-social'));
    fireEvent.click(screen.getByText('qa-recommendations'));

    expect(navigateMock).toHaveBeenCalledWith('/upgrade');
  });

  it('handles checkout canceled query by showing info snackbar and clearing params', async () => {
    locationState.search = '?canceled=true&session_id=abc';
    render(<WorldClassDashboard userId="u1" />);

    expect(await screen.findByTestId('snackbar')).toBeTruthy();
    expect(screen.getByTestId('snackbar').textContent).toContain('dashboard.purchaseCancelled');
    expect(navigateMock).toHaveBeenCalled();
  });

  it('handles checkout success with missing user as warning', async () => {
    locationState.search = '?success=true&session_id=abc';
    render(<WorldClassDashboard />);

    expect(await screen.findByTestId('snackbar')).toBeTruthy();
    expect(screen.getByTestId('snackbar').textContent).toContain('dashboard.verifyFailed');
  });

  it('handles checkout success and premium sync path', async () => {
    locationState.search = '?success=true&session_id=abc';
    render(<WorldClassDashboard userId="u1" />);

    await waitFor(() => expect(getSubscriptionStatusMock).toHaveBeenCalled());
    await waitFor(() => expect(refreshSubscriptionMock).toHaveBeenCalled());
    expect(screen.getByTestId('snackbar').textContent).toContain('dashboard.premiumActive');
  });

  it('shows error snackbar when sync throws', async () => {
    getSubscriptionStatusMock.mockRejectedValue(new Error('sync fail'));
    refreshSubscriptionMock.mockRejectedValue(new Error('refresh fail'));
    locationState.search = '?success=true&session_id=abc';

    render(<WorldClassDashboard userId="u1" />);
    await waitFor(() => expect(screen.getByTestId('snackbar').textContent).toContain('dashboard.updateFailed'));
  });
});
