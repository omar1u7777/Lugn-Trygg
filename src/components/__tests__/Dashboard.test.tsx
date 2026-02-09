import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TestProviders from '../../utils/TestProviders';

// ---- Hoisted mocks (safe to reference inside vi.mock factories) ----
const { mockNavigate, mockUseDashboardData, mockUseSubscription, mockAnalytics } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseDashboardData: vi.fn(),
  mockUseSubscription: vi.fn(),
  mockAnalytics: { page: vi.fn(), track: vi.fn() },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../hooks/useDashboardData', () => ({
  useDashboardData: (...args: unknown[]) => mockUseDashboardData(...args),
  clearDashboardCache: vi.fn(),
}));

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => mockUseSubscription(),
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../services/analytics', () => ({
  analytics: mockAnalytics,
}));

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    screenReaderActive: false,
    highContrast: false,
    reducedMotion: false,
    focusVisible: true,
    colorScheme: 'light',
    fontSize: 'medium',
    keyboardNavigation: true,
    announceToScreenReader: vi.fn(),
    setFocus: vi.fn(),
    trapFocus: vi.fn(() => vi.fn()),
    skipToContent: vi.fn(),
    updateLiveRegion: vi.fn(),
    handleKeyboardNavigation: vi.fn(),
    getAriaLabel: vi.fn((c: string) => c),
  }),
}));

// Mock heavy child components to keep tests focused on the Dashboard shell
vi.mock('../MoodLogger', () => ({ default: () => React.createElement('div', { 'data-testid': 'mock-mood-logger' }, 'MoodLogger') }));
vi.mock('../MoodList', () => ({ default: (props: any) => React.createElement('div', { 'data-testid': 'mock-mood-list' }, React.createElement('button', { onClick: props.onClose }, 'close')) }));
vi.mock('../WorldClassAIChat', () => ({ default: (props: any) => React.createElement('div', { 'data-testid': 'mock-ai-chat' }, React.createElement('button', { onClick: props.onClose }, 'close')) }));
vi.mock('../WorldClassGamification', () => ({ default: () => React.createElement('div', { 'data-testid': 'mock-gamification' }, 'Gamification') }));
vi.mock('../Wellness/WellnessGoalsOnboarding', () => ({ default: () => React.createElement('div', { 'data-testid': 'mock-wellness-onboarding' }, 'Wellness Onboarding') }));
vi.mock('../PremiumGate', () => ({ PremiumGate: () => React.createElement('div', { 'data-testid': 'mock-premium-gate' }, 'Premium Gate') }));
vi.mock('../UsageLimitBanner', () => ({ UsageLimitBanner: () => React.createElement('div', { 'data-testid': 'mock-usage-banner' }, 'Usage Banner') }));
vi.mock('../Recommendations', () => ({ default: () => React.createElement('div', { 'data-testid': 'mock-recommendations' }, 'Recommendations') }));
vi.mock('../WorldClassAnalytics', () => ({ default: () => React.createElement('div', { 'data-testid': 'mock-analytics' }, 'Analytics') }));

// The actual component under test
import WorldClassDashboard from '../WorldClassDashboard';

// ---- Helpers ----
const defaultStats = {
  totalMoods: 10,
  totalChats: 5,
  averageMood: 7.2,
  streakDays: 3,
  weeklyGoal: 7,
  weeklyProgress: 4,
  wellnessGoals: ['Hantera stress'],
  recentActivity: [
    { id: 'a1', type: 'mood' as const, timestamp: new Date(), description: 'Loggade humör: Glad' },
  ],
};

function setupMocks(overrides: {
  stats?: Partial<typeof defaultStats>;
  loading?: boolean;
  error?: Error | null;
  isPremium?: boolean;
} = {}) {
  const { stats, loading = false, error = null, isPremium = false } = overrides;

  mockUseDashboardData.mockReturnValue({
    stats: { ...defaultStats, ...stats },
    loading,
    error,
    refresh: vi.fn(),
  });

  mockUseSubscription.mockReturnValue({
    isPremium,
    plan: isPremium ? 'premium' : 'free',
    getRemainingMoodLogs: () => (isPremium ? 999 : 3),
    getRemainingMessages: () => (isPremium ? 999 : 5),
    hasFeature: () => isPremium,
    checkAccess: vi.fn(),
    canAccessFeature: () => isPremium,
    incrementUsage: vi.fn(),
  });
}

function renderDashboard(userId = 'test-user') {
  return render(
    <TestProviders>
      <WorldClassDashboard userId={userId} />
    </TestProviders>
  );
}

// ---- Tests ----
describe('WorldClassDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  test('renders without crashing', () => {
    const { container } = renderDashboard();
    expect(container.querySelector('.world-class-dashboard')).toBeInTheDocument();
  });

  test('renders the DashboardHeader with a greeting', () => {
    renderDashboard();
    // DashboardHeader renders a time-based Swedish greeting (God morgon/dag/eftermiddag/kväll)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  test('renders "Hur mår du idag?" mood check section', () => {
    renderDashboard();
    expect(screen.getByText('Hur mår du idag?')).toBeInTheDocument();
  });

  test('renders the embedded MoodLogger component', () => {
    renderDashboard();
    expect(screen.getByTestId('mock-mood-logger')).toBeInTheDocument();
  });

  test('renders DashboardStats section', () => {
    renderDashboard();
    // Stats section renders values from the stats object
    expect(screen.getByText(/Ditt Mående/)).toBeInTheDocument();
    expect(screen.getByText(/Nuvarande Streak/)).toBeInTheDocument();
  });

  test('renders DashboardQuickActions section', () => {
    renderDashboard();
    expect(screen.getByText('Hur vill du ta hand om dig?')).toBeInTheDocument();
    // The quick actions render "Känn efter" and "Få stöd" buttons
    expect(screen.getByText('Känn efter')).toBeInTheDocument();
    expect(screen.getByText('Få stöd')).toBeInTheDocument();
  });

  test('renders weekly progress card', () => {
    renderDashboard();
    expect(screen.getByText('Veckoprogress')).toBeInTheDocument();
    // Shows progress text
    expect(screen.getByText(/4 av 7 humör-inlägg denna vecka/)).toBeInTheDocument();
  });

  test('renders usage limit banner for free users', () => {
    setupMocks({ isPremium: false });
    renderDashboard();
    expect(screen.getByTestId('mock-usage-banner')).toBeInTheDocument();
  });

  test('does not render usage limit banner for premium users', () => {
    setupMocks({ isPremium: true });
    renderDashboard();
    expect(screen.queryByTestId('mock-usage-banner')).not.toBeInTheDocument();
  });

  test('shows error state when data fetch fails', () => {
    setupMocks({ error: new Error('Network error') });
    renderDashboard();
    expect(screen.getByText(/Kunde inte ladda dashboard/)).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Försök igen')).toBeInTheDocument();
  });

  test('shows loading skeleton for stats when loading', () => {
    setupMocks({ loading: true });
    const { container } = renderDashboard();
    // Stats and quick actions show pulse skeletons during loading
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  test('clicking "Känn efter" quick action switches to mood view', async () => {
    renderDashboard();
    fireEvent.click(screen.getByText('Känn efter'));
    // After clicking, the view switches to mood-basic which shows back button + MoodLogger
    await waitFor(() => {
      expect(screen.getByText('Tillbaka till Dashboard')).toBeInTheDocument();
    });
  });

  test('clicking "Få stöd" quick action switches to chat view', async () => {
    renderDashboard();
    fireEvent.click(screen.getByText('Få stöd'));
    await waitFor(() => {
      expect(screen.getByTestId('mock-ai-chat')).toBeInTheDocument();
      expect(screen.getByText('Tillbaka till Dashboard')).toBeInTheDocument();
    });
  });

  test('clicking back button returns to overview', async () => {
    renderDashboard();
    // Switch to mood view first
    fireEvent.click(screen.getByText('Känn efter'));
    await waitFor(() => {
      expect(screen.getByText('Tillbaka till Dashboard')).toBeInTheDocument();
    });
    // Click back
    fireEvent.click(screen.getByText('Tillbaka till Dashboard'));
    await waitFor(() => {
      expect(screen.getByText('Hur mår du idag?')).toBeInTheDocument();
    });
  });

  test('shows wellness goals when available', () => {
    setupMocks({ stats: { wellnessGoals: ['Hantera stress', 'Bättre sömn'] } });
    renderDashboard();
    expect(screen.getByText('Dina Wellness-Mål')).toBeInTheDocument();
    expect(screen.getByText('Hantera stress')).toBeInTheDocument();
    expect(screen.getByText('Bättre sömn')).toBeInTheDocument();
  });

  test('shows congratulations when weekly goal is met', () => {
    setupMocks({ stats: { weeklyProgress: 7, weeklyGoal: 7 } });
    renderDashboard();
    expect(screen.getByText(/Grattis! Du har nått ditt veckomål!/)).toBeInTheDocument();
  });

  test('tracks page view on mount', () => {
    renderDashboard();
    expect(mockAnalytics.page).toHaveBeenCalledWith('World Class Dashboard', expect.any(Object));
  });

  test('renders recent activity section', () => {
    renderDashboard();
    expect(screen.getByText('Loggade humör: Glad')).toBeInTheDocument();
  });

  test('renders empty activity message when no activities', () => {
    setupMocks({ stats: { recentActivity: [] } });
    renderDashboard();
    expect(screen.getByText(/Ingen aktivitet än/)).toBeInTheDocument();
  });
});
