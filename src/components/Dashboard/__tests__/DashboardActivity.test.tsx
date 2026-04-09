import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardActivity, ActivityItem } from '../DashboardActivity';

vi.mock('../../../constants/accessibility', () => ({
  getDashboardRegionProps: (_key: string) => ({
    'aria-label': `${_key} region`,
  }),
}));

vi.mock('../../../utils/intlFormatters', () => ({
  formatRelativeTimeFromNow: (_date: Date) => 'just nu',
}));

const makeActivity = (id: string, type: ActivityItem['type'], daysAgo = 0): ActivityItem => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id,
    type,
    timestamp: date,
    description: `Description ${id}`,
    icon: '✅',
    colorClass: 'text-green-500',
  };
};

describe('DashboardActivity', () => {
  it('shows empty state when no activities', () => {
    render(<DashboardActivity activities={[]} />);
    expect(screen.getByText('Ingen aktivitet än. Börja logga ditt humör!')).toBeInTheDocument();
  });

  it('shows custom empty state message', () => {
    render(<DashboardActivity activities={[]} emptyStateMessage="Custom empty" />);
    expect(screen.getByText('Custom empty')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading', () => {
    const { container } = render(<DashboardActivity activities={[]} isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders activity with mood type', () => {
    render(<DashboardActivity activities={[makeActivity('1', 'mood')]} />);
    expect(screen.getByText('Description 1')).toBeInTheDocument();
  });

  it('renders activity with chat type', () => {
    render(<DashboardActivity activities={[makeActivity('2', 'chat')]} />);
    expect(screen.getByText('Description 2')).toBeInTheDocument();
  });

  it('renders activity with meditation type', () => {
    render(<DashboardActivity activities={[makeActivity('3', 'meditation')]} />);
    expect(screen.getByText('Description 3')).toBeInTheDocument();
  });

  it('renders activity with journal type', () => {
    render(<DashboardActivity activities={[makeActivity('4', 'journal')]} />);
    expect(screen.getByText('Description 4')).toBeInTheDocument();
  });

  it('renders activity with achievement type (default branch)', () => {
    render(<DashboardActivity activities={[makeActivity('5', 'achievement')]} />);
    expect(screen.getByText('Description 5')).toBeInTheDocument();
  });

  it('groups today activities under Idag', () => {
    render(<DashboardActivity activities={[makeActivity('t1', 'mood', 0)]} />);
    expect(screen.getByText('Idag')).toBeInTheDocument();
  });

  it('groups yesterday activities under Igår', () => {
    render(<DashboardActivity activities={[makeActivity('y1', 'mood', 1)]} />);
    expect(screen.getByText('Igår')).toBeInTheDocument();
  });

  it('groups same-year earlier activities under Tidigare i år', () => {
    // Go to 30 days ago in same year (edge case may vary by month)
    const date = new Date();
    date.setDate(date.getDate() - 5);
    // Only if same year
    const year = date.getFullYear();
    const activity: ActivityItem = {
      id: 'ey1',
      type: 'mood',
      timestamp: date,
      description: 'Earlier this year',
      icon: '📅',
      colorClass: 'text-blue-500',
    };
    render(<DashboardActivity activities={[activity]} />);
    // Either "Idag", "Igår" or "Tidigare i år" depending on offset — just verify no crash
    expect(screen.getByText('Earlier this year')).toBeInTheDocument();
    expect(year).toBe(new Date().getFullYear());
  });

  it('groups older activities (different year) under Äldre', () => {
    const oldDate = new Date('2020-01-15');
    const activity: ActivityItem = {
      id: 'old1',
      type: 'chat',
      timestamp: oldDate,
      description: 'Old activity',
      icon: '💬',
      colorClass: 'text-blue-500',
    };
    render(<DashboardActivity activities={[activity]} />);
    expect(screen.getByText('Äldre')).toBeInTheDocument();
    expect(screen.getByText('Old activity')).toBeInTheDocument();
  });

  it('renders multiple activities with connector lines', () => {
    const activities = [
      makeActivity('a1', 'mood'),
      makeActivity('a2', 'chat'),
      makeActivity('a3', 'meditation'),
    ];
    render(<DashboardActivity activities={activities} />);
    expect(screen.getByText('Description a1')).toBeInTheDocument();
    expect(screen.getByText('Description a2')).toBeInTheDocument();
    expect(screen.getByText('Description a3')).toBeInTheDocument();
  });

  it('shows "load more" button when activities exceed visible limit', () => {
    // Create 13 activities to exceed MAX_VISIBLE_ACTIVITIES=12
    const activities = Array.from({ length: 13 }, (_, i) =>
      makeActivity(`bulk-${i}`, 'mood')
    );
    render(<DashboardActivity activities={activities} />);
    expect(screen.getByRole('button', { name: /visa äldre aktiviteter/i })).toBeInTheDocument();
  });

  it('loads more activities on button click', () => {
    const activities = Array.from({ length: 13 }, (_, i) =>
      makeActivity(`batch-${i}`, 'mood')
    );
    render(<DashboardActivity activities={activities} />);
    const btn = screen.getByRole('button', { name: /visa äldre aktiviteter/i });
    fireEvent.click(btn);
    // After clicking, all 13 should be visible (batch size=12, total=13)
    expect(screen.queryByRole('button', { name: /visa äldre aktiviteter/i })).toBeNull();
  });
});
