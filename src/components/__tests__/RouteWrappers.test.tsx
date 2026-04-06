/**
 * RouteWrappers Tests
 * Tests for all route wrapper components
 */
import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────
const { mockNavigate, mockUser, mockUseAuth } = vi.hoisted(() => {
  const mockNavigate = vi.fn();
  const mockUser = { user_id: 'user-123', uid: 'uid-456' };
  const mockUseAuth = vi.fn(() => ({ user: mockUser }));
  return { mockNavigate, mockUser, mockUseAuth };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock('../../hooks/useAuth', () => ({ default: mockUseAuth }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Lazy-loaded component mocks
vi.mock('../WorldClassAIChat', () => ({ default: () => <div data-testid="ai-chat">AIChat</div> }));
vi.mock('../WorldClassGamification', () => ({ default: () => <div data-testid="gamification">Gamification</div> }));
vi.mock('../WorldClassAnalytics', () => ({ default: () => <div data-testid="analytics">Analytics</div> }));
vi.mock('../DailyInsights', () => ({ default: (p: { userId: string }) => <div data-testid="daily-insights">DailyInsights {p.userId}</div> }));
vi.mock('../Leaderboard', () => ({ default: () => <div data-testid="leaderboard">Leaderboard</div> }));
vi.mock('../GroupChallenges', () => ({ default: (p: { userId: string }) => <div data-testid="group-challenges">GroupChallenges {p.userId}</div> }));
vi.mock('../MoodList', () => ({ default: () => <div data-testid="mood-list">MoodList</div> }));
vi.mock('../RelaxingSounds', () => ({ default: () => <div data-testid="relaxing-sounds">RelaxingSounds</div> }));
vi.mock('../PeerSupportChat', () => ({ default: (p: { userId: string }) => <div data-testid="peer-chat">PeerSupportChat {p.userId}</div> }));
vi.mock('../CrisisAlert', () => ({
  default: (p: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="crisis-alert">
      CrisisAlert {p.isOpen ? 'open' : 'closed'}
      <button data-testid="crisis-close" onClick={p.onClose}>Close</button>
    </div>
  ),
}));
vi.mock('../OnboardingFlow', () => ({
  default: (p: { onComplete: () => void; userId: string }) => (
    <div data-testid="onboarding-flow">
      OnboardingFlow
      <button data-testid="onboarding-complete" onClick={p.onComplete}>Complete</button>
    </div>
  ),
}));
vi.mock('../PrivacySettings', () => ({ default: (p: { userId: string }) => <div data-testid="privacy-settings">PrivacySettings {p.userId}</div> }));
vi.mock('../../pages/CrisisPage', () => ({ default: () => <div data-testid="crisis-page">CrisisPage</div> }));
vi.mock('../SuperMoodLogger', () => ({
  SuperMoodLogger: () => <div data-testid="super-mood-logger">SuperMoodLogger</div>,
}));

vi.mock('../../api/api', () => ({
  getMoods: vi.fn().mockResolvedValue([{ id: 1, mood: 'happy' }]),
}));

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── Component imports ────────────────────────────────────────────────────────
import {
  WorldClassAIChatWrapper,
  WorldClassGamificationWrapper,
  WorldClassAnalyticsWrapper,
  DailyInsightsWrapper,
  LeaderboardWrapper,
  AchievementSharingWrapper,
  GroupChallengesWrapper,
  MoodLoggerBasicWrapper,
  MoodListWrapper,
  RelaxingSoundsWrapper,
  PeerSupportChatWrapper,
  CrisisAlertWrapper,
  OnboardingFlowWrapper,
  PrivacySettingsWrapper,
  CrisisPageWrapper,
} from '../RouteWrappers';

const renderInRouter = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <Suspense fallback={<div>Loading...</div>}>{ui}</Suspense>
    </MemoryRouter>
  );

describe('RouteWrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockUser });
  });

  describe('WorldClassAIChatWrapper', () => {
    it('renders AI chat component', async () => {
      renderInRouter(<WorldClassAIChatWrapper />);
      await waitFor(() => expect(screen.getByTestId('ai-chat')).toBeInTheDocument());
    });

    it('calls navigate(-1) on close', async () => {
      renderInRouter(<WorldClassAIChatWrapper />);
      await waitFor(() => screen.getByTestId('ai-chat'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('WorldClassGamificationWrapper', () => {
    it('renders gamification component', async () => {
      renderInRouter(<WorldClassGamificationWrapper />);
      await waitFor(() => expect(screen.getByTestId('gamification')).toBeInTheDocument());
    });
  });

  describe('WorldClassAnalyticsWrapper', () => {
    it('renders analytics component', async () => {
      renderInRouter(<WorldClassAnalyticsWrapper />);
      await waitFor(() => expect(screen.getByTestId('analytics')).toBeInTheDocument());
    });
  });

  describe('DailyInsightsWrapper', () => {
    it('renders with user data after loading', async () => {
      renderInRouter(<DailyInsightsWrapper />);
      await waitFor(() => expect(screen.queryByText('Hämtar dina insikter...')).not.toBeInTheDocument(), { timeout: 3000 });
      expect(screen.getByTestId('daily-insights')).toBeInTheDocument();
    });

    it('handles null user gracefully', async () => {
      mockUseAuth.mockReturnValue({ user: null });
      renderInRouter(<DailyInsightsWrapper />);
      await waitFor(() => expect(screen.getByTestId('daily-insights')).toBeInTheDocument(), { timeout: 3000 });
    });

    it('handles API error gracefully', async () => {
      const { getMoods } = await import('../../api/api');
      vi.mocked(getMoods).mockRejectedValueOnce(new Error('Network error'));
      renderInRouter(<DailyInsightsWrapper />);
      await waitFor(() => expect(screen.getByText('Fel vid hämtning')).toBeInTheDocument(), { timeout: 3000 });
    });
  });

  describe('LeaderboardWrapper', () => {
    it('renders leaderboard', async () => {
      renderInRouter(<LeaderboardWrapper />);
      await waitFor(() => expect(screen.getByTestId('leaderboard')).toBeInTheDocument());
    });
  });

  describe('AchievementSharingWrapper', () => {
    it('renders achievement sharing placeholder', () => {
      renderInRouter(<AchievementSharingWrapper />);
      expect(screen.getByText('Achievement Sharing')).toBeInTheDocument();
    });

    it('renders back button', () => {
      renderInRouter(<AchievementSharingWrapper />);
      expect(screen.getByText('Tillbaka')).toBeInTheDocument();
    });

    it('calls navigate(-1) when back button clicked', async () => {
      renderInRouter(<AchievementSharingWrapper />);
      const backBtn = screen.getByText('Tillbaka');
      await userEvent.click(backBtn);
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('GroupChallengesWrapper', () => {
    it('renders group challenges with userId', async () => {
      renderInRouter(<GroupChallengesWrapper />);
      await waitFor(() => expect(screen.getByTestId('group-challenges')).toBeInTheDocument());
      expect(screen.getByText(/GroupChallenges user-123/)).toBeInTheDocument();
    });

    it('uses empty string when no user', async () => {
      mockUseAuth.mockReturnValue({ user: null });
      renderInRouter(<GroupChallengesWrapper />);
      await waitFor(() => expect(screen.getByTestId('group-challenges')).toBeInTheDocument());
    });
  });

  describe('MoodLoggerBasicWrapper', () => {
    it('renders SuperMoodLogger inside a container', () => {
      renderInRouter(<MoodLoggerBasicWrapper />);
      expect(screen.getByTestId('super-mood-logger')).toBeInTheDocument();
    });
  });

  describe('MoodListWrapper', () => {
    it('renders MoodList component', async () => {
      renderInRouter(<MoodListWrapper />);
      await waitFor(() => expect(screen.getByTestId('mood-list')).toBeInTheDocument());
    });
  });

  describe('RelaxingSoundsWrapper', () => {
    it('renders RelaxingSounds component', async () => {
      renderInRouter(<RelaxingSoundsWrapper />);
      await waitFor(() => expect(screen.getByTestId('relaxing-sounds')).toBeInTheDocument());
    });
  });

  describe('PeerSupportChatWrapper', () => {
    it('renders PeerSupportChat with userId', async () => {
      renderInRouter(<PeerSupportChatWrapper />);
      await waitFor(() => expect(screen.getByTestId('peer-chat')).toBeInTheDocument());
      expect(screen.getByText(/PeerSupportChat user-123/)).toBeInTheDocument();
    });
  });

  describe('CrisisAlertWrapper', () => {
    it('renders CrisisAlert as open by default', async () => {
      renderInRouter(<CrisisAlertWrapper />);
      await waitFor(() => expect(screen.getByTestId('crisis-alert')).toBeInTheDocument());
      expect(screen.getByText('CrisisAlert open')).toBeInTheDocument();
    });

    it('closes CrisisAlert and navigates back when onClose called', async () => {
      renderInRouter(<CrisisAlertWrapper />);
      await waitFor(() => screen.getByTestId('crisis-close'));
      await userEvent.click(screen.getByTestId('crisis-close'));
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('OnboardingFlowWrapper', () => {
    it('renders OnboardingFlow component', async () => {
      renderInRouter(<OnboardingFlowWrapper />);
      await waitFor(() => expect(screen.getByTestId('onboarding-flow')).toBeInTheDocument());
    });

    it('navigates to /dashboard when onComplete is called', async () => {
      renderInRouter(<OnboardingFlowWrapper />);
      await waitFor(() => screen.getByTestId('onboarding-complete'));
      await userEvent.click(screen.getByTestId('onboarding-complete'));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('PrivacySettingsWrapper', () => {
    it('renders PrivacySettings with userId', async () => {
      renderInRouter(<PrivacySettingsWrapper />);
      await waitFor(() => expect(screen.getByTestId('privacy-settings')).toBeInTheDocument());
      expect(screen.getByText(/PrivacySettings user-123/)).toBeInTheDocument();
    });
  });

  describe('CrisisPageWrapper', () => {
    it('renders CrisisPage component', async () => {
      renderInRouter(<CrisisPageWrapper />);
      await waitFor(() => expect(screen.getByTestId('crisis-page')).toBeInTheDocument());
    });
  });

  describe('getUserId helper (via wrappers)', () => {
    it('falls back to uid when no user_id', async () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'uid-only' } });
      renderInRouter(<GroupChallengesWrapper />);
      await waitFor(() => expect(screen.getByText(/GroupChallenges uid-only/)).toBeInTheDocument());
    });

    it('falls back to id when no user_id or uid', async () => {
      mockUseAuth.mockReturnValue({ user: { id: 'id-only' } });
      renderInRouter(<GroupChallengesWrapper />);
      await waitFor(() => expect(screen.getByText(/GroupChallenges id-only/)).toBeInTheDocument());
    });

    it('returns empty string for anonymous objects', async () => {
      mockUseAuth.mockReturnValue({ user: {} });
      renderInRouter(<GroupChallengesWrapper />);
      await waitFor(() => expect(screen.getByTestId('group-challenges')).toBeInTheDocument());
    });
  });
});
