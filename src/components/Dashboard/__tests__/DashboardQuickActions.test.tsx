import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardQuickActions } from '../DashboardQuickActions';

const mockUseSubscription = vi.fn();

vi.mock('react-i18next', () => {
  const translations: Record<string, string> = {
    'dashboardQuickActions.title': 'Hur vill du ta hand om dig?',
    'dashboardQuickActions.remainingToday': '{{count}} kvar idag',
    'dashboardQuickActions.remainingMessages': '{{count}} meddelanden',
    'dashboardQuickActions.unlimitedToday': 'Obegränsat idag',
    'dashboardQuickActions.alwaysReady': 'Alltid redo',
    'dashboardQuickActions.quotaReached': 'Kvot nådd idag',
    'quickAction.mood.title': 'Känn efter',
    'quickAction.chat.title': 'Få stöd',
    'quickAction.sounds.title': 'Ljud',
    'quickAction.journal.title': 'Journal',
    'quickAction.recommendations.title': 'Rekommendationer',
    'quickAction.social.title': 'Socialt',
    'quickAction.mood.ariaLabel': 'Checka in med ditt mående',
    'quickAction.chat.ariaLabel': 'Starta samtal med AI-stöd',
    'quickAction.mood.description': 'Logga hur du mår',
    'quickAction.chat.description': 'Prata med AI',
  };
  return {
    useTranslation: () => ({
      t: (key: string, fallbackOrOpts?: string | object) => {
        if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
        let result = translations[key] || key;
        if (typeof fallbackOrOpts === 'object' && fallbackOrOpts !== null) {
          for (const [k, v] of Object.entries(fallbackOrOpts)) {
            result = result.replace(`{{${k}}}`, String(v));
          }
        }
        return result;
      },
      i18n: { changeLanguage: vi.fn() },
    }),
  };
});

vi.mock('../../../constants/accessibility', () => ({
  getDashboardRegionProps: vi.fn(() => ({ 'aria-label': 'Quick Actions', role: 'region' })),
}));

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => mockUseSubscription(),
}));

describe('DashboardQuickActions', () => {
  const mockOnActionClick = vi.fn();

  beforeEach(() => {
    mockUseSubscription.mockReset();
    mockOnActionClick.mockReset();
  });

  describe('free plan', () => {
    beforeEach(() => {
      mockUseSubscription.mockReturnValue({
        isPremium: false,
        getRemainingMoodLogs: () => 3,
        getRemainingMessages: () => 5,
        hasFeature: () => false,
      });
    });

    it('renders the heading', () => {
      render(<DashboardQuickActions onActionClick={mockOnActionClick} />);
      expect(screen.getByText('Hur vill du ta hand om dig?')).toBeInTheDocument();
    });

    it('renders action buttons with correct titles', () => {
      render(<DashboardQuickActions onActionClick={mockOnActionClick} />);
      expect(screen.getByText('Känn efter')).toBeInTheDocument();
      expect(screen.getByText('Få stöd')).toBeInTheDocument();
    });

    it('shows remaining counts for free users', () => {
      render(<DashboardQuickActions onActionClick={mockOnActionClick} />);
      expect(screen.getByText('3 kvar idag')).toBeInTheDocument();
      expect(screen.getByText('5 meddelanden')).toBeInTheDocument();
    });

    it('calls onActionClick with the correct action id when clicked', () => {
      render(<DashboardQuickActions onActionClick={mockOnActionClick} />);
      fireEvent.click(screen.getByText('Känn efter'));
      expect(mockOnActionClick).toHaveBeenCalledWith('mood');

      fireEvent.click(screen.getByText('Få stöd'));
      expect(mockOnActionClick).toHaveBeenCalledWith('chat');
    });

    it('disables mood and chat actions when quota is exhausted', () => {
      mockUseSubscription.mockReturnValue({
        isPremium: false,
        getRemainingMoodLogs: () => 0,
        getRemainingMessages: () => -2,
        hasFeature: () => false,
      });

      render(<DashboardQuickActions onActionClick={mockOnActionClick} />);

      const moodButton = screen.getByRole('button', { name: /Checka in med ditt mående/i });
      const chatButton = screen.getByRole('button', { name: /Starta samtal med AI-stöd/i });

      expect(screen.getAllByText('Kvot nådd idag').length).toBeGreaterThanOrEqual(2);
      expect(moodButton).toBeDisabled();
      expect(chatButton).toBeDisabled();

      fireEvent.click(moodButton);
      fireEvent.click(chatButton);
      expect(mockOnActionClick).not.toHaveBeenCalled();
    });

    it('shows unlimited labels instead of negative values when backend returns -1', () => {
      mockUseSubscription.mockReturnValue({
        isPremium: false,
        getRemainingMoodLogs: () => -1,
        getRemainingMessages: () => -1,
        hasFeature: () => false,
      });

      render(<DashboardQuickActions onActionClick={mockOnActionClick} />);

      expect(screen.getByText('Obegränsat idag')).toBeInTheDocument();
      expect(screen.getByText('Alltid redo')).toBeInTheDocument();
      expect(screen.queryByText('-1 kvar idag')).not.toBeInTheDocument();
      expect(screen.queryByText('-1 meddelanden')).not.toBeInTheDocument();
    });
  });

  describe('premium plan', () => {
    beforeEach(() => {
      mockUseSubscription.mockReturnValue({
        isPremium: true,
        getRemainingMoodLogs: () => 999,
        getRemainingMessages: () => 999,
        hasFeature: () => true,
      });
    });

    it('shows unlimited descriptions for premium users', () => {
      render(<DashboardQuickActions onActionClick={mockOnActionClick} />);
      expect(screen.getByText('Obegränsat idag')).toBeInTheDocument();
      expect(screen.getByText('Alltid redo')).toBeInTheDocument();
    });

    it('does not show PRO badges when all features are unlocked', () => {
      render(<DashboardQuickActions onActionClick={mockOnActionClick} />);
      expect(screen.queryByText('PRO')).toBeNull();
    });
  });

  describe('loading state', () => {
    it('renders skeleton placeholders when loading', () => {
      mockUseSubscription.mockReturnValue({
        isPremium: false,
        getRemainingMoodLogs: () => 0,
        getRemainingMessages: () => 0,
        hasFeature: () => false,
      });

      const { container } = render(
        <DashboardQuickActions onActionClick={mockOnActionClick} isLoading />
      );
      expect(screen.queryByText('Hur vill du ta hand om dig?')).toBeNull();
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });
});
