import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: { user_id: 'u1', email: 'a@b.se' } }) }));
vi.mock('../../api/api', () => ({
  getMoods: vi.fn().mockResolvedValue([]),
  getUserRewards: vi.fn().mockResolvedValue(null),
  getRewardCatalog: vi.fn().mockResolvedValue([]),
  claimReward: vi.fn(),
  checkAchievements: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../api/journaling', () => ({ getJournalEntries: vi.fn().mockResolvedValue([]) }));
vi.mock('../../api/social', () => ({ getReferralStats: vi.fn().mockResolvedValue({ successfulReferrals: 0 }) }));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('../BadgeDisplay', () => ({ default: () => <div>badge-list</div> }));
const gamification = vi.fn();
vi.mock('../WorldClassGamification', () => ({
  default: (props: Record<string, unknown>) => {
    gamification(props);
    return <div>level-and-xp</div>;
  },
}));

import RewardsHub from '../RewardsHub';

describe('RewardsHub tabs (UI audit Dup-8)', () => {
  it('has one tab per thing, none repeating another', async () => {
    render(<RewardsHub />);
    const tabs = await screen.findAllByRole('tab');
    // Named by aria-label: the visible text is hidden on phones.
    const labels = tabs.map((tab) => tab.getAttribute('aria-label'));

    expect(labels).toEqual(['Mina märken', 'Belöningskatalog', 'Nivå & XP']);
    // It had a "Dagliga utmaningar" tab rendering the same component as
    // "Prestationer", and the component has no daily challenges.
    expect(labels).not.toContain('Dagliga utmaningar');
  });

  it('shows level and XP without a second, differently counted achievement list', async () => {
    render(<RewardsHub />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Nivå & XP' }));

    await waitFor(() => expect(screen.getByText('level-and-xp')).toBeInTheDocument());
    expect(gamification).toHaveBeenCalledWith(expect.objectContaining({ showAchievements: false }));
  });
});
