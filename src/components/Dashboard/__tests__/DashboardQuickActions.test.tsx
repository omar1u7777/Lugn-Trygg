import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardQuickActions } from '../DashboardQuickActions';

const mockUseSubscription = vi.fn();

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => mockUseSubscription(),
}));

describe('DashboardQuickActions', () => {
  beforeEach(() => {
    mockUseSubscription.mockReset();
  });

  it('shows premium badges for locked actions on free plan', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      getRemainingMoodLogs: () => 1,
      getRemainingMessages: () => 2,
      hasFeature: () => false,
    });

    render(<DashboardQuickActions onActionClick={() => undefined} />);

    const badges = screen.getAllByText('⭐ Premium');
    expect(badges).toHaveLength(2);
  });

  it('unlocks premium actions when feature available', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      getRemainingMoodLogs: () => 10,
      getRemainingMessages: () => 10,
      hasFeature: () => true,
    });

    render(<DashboardQuickActions onActionClick={() => undefined} />);

    expect(screen.queryByText('⭐ Premium')).toBeNull();
    expect(screen.getByText('Visa alla dina sparade humör-inlägg')).toBeInTheDocument();
  });
});
