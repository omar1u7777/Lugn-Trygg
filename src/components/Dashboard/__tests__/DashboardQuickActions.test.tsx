import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardQuickActions } from '../DashboardQuickActions';

const mockUseSubscription = vi.fn();

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
