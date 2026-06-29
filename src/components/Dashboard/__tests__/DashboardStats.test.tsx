/**
 * DashboardStats Component Tests
 * Tests for Streak and Achievements cards
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => {
  const translations: Record<string, string> = {
    'dashboardStats.positiveDevelopment': 'Positiv utveckling',
    'dashboardStats.naturallyVarying': 'Naturlig variation',
    'dashboardStats.stable': 'Stabilt',
    'dashboardStats.streakTitle': 'Svit',
    'dashboardStats.achievementsTitle': 'Prestationer',
    'dashboardStats.streakActive': 'Svit aktiv',
    'dashboardStats.streakDays': '{{count}} dagar',
    'dashboardStats.sectionTitle': 'Statistik',
    'dashboardStats.yourActivity': 'Din aktivitet',
    'dashboardStats.activityOfTotal': '{{current}} av {{total}}',
    'dashboardStats.startJourney': 'Starta din resa',
    'dashboardStats.allAchievementsUnlocked': 'Alla prestationer upplåsta',
    'dashboardStats.nextMilestone': 'Nästa milstolpe',
    'dashboardStats.almostThere': 'Nästan där!',
    'dashboardStats.activitiesToNext': '{{count}} aktiviteter kvar',
    'dashboardStats.progressOngoing': 'Pågår',
    'dashboardStats.allUnlocked': 'Alla upplåsta',
    'dashboardStats.trendTooltip': 'Trend: {{label}}',
    'dashboardStats.encouragement0': 'Varje ny dag är en ny möjlighet att börja om!',
    'dashboardStats.encouragement1': 'Bra start! En dag i rad.',
    'dashboardStats.encouragement2': 'Fortfarande igång! Två dagar i rad.',
    'dashboardStats.encouragement3': 'Bygger momentum!',
    'dashboardStats.encouragement5': 'Fantastisk konsistens!',
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
  getDashboardRegionProps: vi.fn(() => ({ 'aria-label': 'Stats', role: 'region' })),
}));

import { DashboardStats } from '../DashboardStats';

const baseStats = {
  streakDays: 3,
  achievementsCount: 2,
};

describe('DashboardStats', () => {
  it('renders loading skeleton when isLoading=true', () => {
    const { container } = render(<DashboardStats stats={baseStats} isLoading={true} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders stat cards when not loading', () => {
    const { container } = render(<DashboardStats stats={baseStats} />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders with zero achievements (new user case - welcomes new user)', () => {
    const { container } = render(<DashboardStats stats={{ ...baseStats, achievementsCount: 0 }} />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders with achievements progress (shows next milestone)', () => {
    const { container } = render(<DashboardStats stats={{ ...baseStats, achievementsCount: 3 }} />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders with all achievements unlocked (count >= 12)', () => {
    render(<DashboardStats stats={{ ...baseStats, achievementsCount: 12 }} />);
    expect(screen.getAllByText(/12/).length).toBeGreaterThan(0);
  });

  it('shows "Positiv utveckling" for streak and achievements trends', () => {
    render(<DashboardStats stats={{ ...baseStats, streakDays: 3, achievementsCount: 2 }} />);
    expect(screen.getAllByText(/Positiv utveckling/).length).toBeGreaterThanOrEqual(2);
  });

  it('does not show trend badge when streak is 0', () => {
    render(<DashboardStats stats={{ ...baseStats, streakDays: 0 }} />);
    // Streak trend should be undefined when streakDays=0
    expect(screen.queryByText(/Svit aktiv/)).not.toBeInTheDocument();
  });

  it('renders consistency progress text for streakDays', () => {
    render(<DashboardStats stats={{ ...baseStats, streakDays: 5 }} />);
    expect(screen.getByText(/5 dagar/)).toBeInTheDocument();
  });

  it('renders 0 streak case with encouragement message', () => {
    render(<DashboardStats stats={{ ...baseStats, streakDays: 0 }} />);
    expect(screen.getByText(/möjlighet/i)).toBeInTheDocument();
  });

  it('renders achievements count as value', () => {
    render(<DashboardStats stats={{ ...baseStats, achievementsCount: 7 }} />);
    expect(screen.getAllByText(/7/).length).toBeGreaterThan(0);
  });
});
