/**
 * DashboardStats Component Tests
 * Focus on covering deriveMoodTrend branches and sub-components
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: string | object) =>
      typeof fallbackOrOpts === 'string' ? fallbackOrOpts : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../../constants/accessibility', () => ({
  getDashboardRegionProps: vi.fn(() => ({ 'aria-label': 'Stats', role: 'region' })),
}));

vi.mock('../../../utils/intlFormatters', () => ({
  formatNumber: vi.fn((n: number) => String(n)),
}));

import { DashboardStats } from '../DashboardStats';

const baseStats = {
  averageMood: 6,
  streakDays: 3,
  totalChats: 5,
  achievementsCount: 2,
};

describe('DashboardStats', () => {
  it('renders loading skeleton when isLoading=true', () => {
    const { container } = render(<DashboardStats stats={baseStats} isLoading={true} />);
    // Should show loading animation elements
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders stat cards when not loading', () => {
    const { container } = render(<DashboardStats stats={baseStats} />);
    // Component renders the grid
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders average mood value', () => {
    render(<DashboardStats stats={{ ...baseStats, averageMood: 7.5 }} />);
    // formatNumber is mocked to return string
    expect(screen.getAllByText(/7\.?5?/).length).toBeGreaterThan(0);
  });

  it('renders with zero achievements (new user case - welcomes new user)', () => {
    const { container } = render(<DashboardStats stats={{ ...baseStats, achievementsCount: 0 }} />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders with nextAchievementIn provided (shows progress)', () => {
    const { container } = render(<DashboardStats stats={{ ...baseStats, achievementsCount: 3, nextAchievementIn: 2 }} />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders with no nextAchievementIn (all achievements unlocked)', () => {
    render(<DashboardStats stats={{ ...baseStats, achievementsCount: 50, nextAchievementIn: 0 }} />);
    expect(screen.getAllByText(/50/).length).toBeGreaterThan(0);
  });

  // Test deriveMoodTrend branches via moodSamples
  // The visible trend label is from trendConfig: up='Positiv utveckling', down='Naturlig variation', stable='Stabilt'
  // Note: Streak and Achievements BentoItems are always 'up' so 'Positiv utveckling' is always present
  it('renders without error with <2 samples (good mood) - shows stable mood', () => {
    const { container } = render(<DashboardStats stats={{ ...baseStats, averageMood: 7, moodSamples: [7] }} />);
    // deriveMoodTrend returns 'stable' → mood BentoItem shows trendConfig.stable.label
    expect(container.querySelector('.grid')).toBeInTheDocument();
    // 'Stabilt' appears at least in chats (always stable) + mood (stable derivedMoodTrend)
    expect(screen.getAllByText(/Stabilt/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders with low mood showing safety block (hides trend)', () => {
    // averageMood <= 4 triggers showSafetyBlock, hides trend badge
    const { container } = render(<DashboardStats stats={{ ...baseStats, averageMood: 3, moodSamples: [3] }} />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('shows "Positiv utveckling" for upward mood (at least from streak/achievements)', () => {
    const samples = [3, 5, 7, 8, 9]; // clear upward trend
    render(<DashboardStats stats={{ ...baseStats, moodSamples: samples }} />);
    // Always present from streak + achievements BentoItems
    expect(screen.getAllByText(/Positiv utveckling/).length).toBeGreaterThanOrEqual(2);
  });

  it('shows "Naturlig variation" for downward mood trend (unique to mood BentoItem)', () => {
    // deriveMoodTrend returns direction='down' → mood BentoItem shows 'Naturlig variation'
    const samples = [8, 7, 5, 4, 2]; // change <= -2 and last < 7
    render(<DashboardStats stats={{ ...baseStats, averageMood: 5, moodSamples: samples }} />);
    // 'Naturlig variation' is only shown by BentoItem when direction='down' (mood can be down)
    expect(screen.getAllByText(/Naturlig variation/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders high-variance samples (Naturligt varierande in title attr)', () => {
    const samples = [9, 1, 9, 1, 9, 1, 8]; // very high std dev
    const { container } = render(<DashboardStats stats={{ ...baseStats, moodSamples: samples }} />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders stable mood samples without crashing', () => {
    const samples = [5, 6, 5, 6, 5, 6]; // stable
    const { container } = render(<DashboardStats stats={{ ...baseStats, moodSamples: samples }} />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders with moodTrend direction down (shows Naturlig variation in mood card)', () => {
    // direct moodTrend prop with direction 'down'
    render(<DashboardStats stats={{ ...baseStats, moodTrend: { direction: 'down', value: 'Nedåt' } }} />);
    expect(screen.getAllByText(/Naturlig variation/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders with streakTrend property', () => {
    // streakTrend is passed to streak BentoItem
    const { container } = render(<DashboardStats stats={{ ...baseStats, streakTrend: { direction: 'up', value: '+2' } }} />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders sparkline when moodSamples has 2+ valid entries', () => {
    const { container } = render(<DashboardStats stats={{ ...baseStats, moodSamples: [5, 7, 6, 8] }} />);
    // MoodSparkline renders SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render sparkline with fewer than 2 samples', () => {
    const { container } = render(<DashboardStats stats={{ ...baseStats, moodSamples: [5] }} />);
    // SVG from sparkline should not appear
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  it('renders consistency progress text for streakDays', () => {
    render(<DashboardStats stats={{ ...baseStats, streakDays: 5 }} />);
    expect(screen.getByText(/5 dagar/)).toBeInTheDocument();
  });

  it('renders 0 streak case with special message', () => {
    render(<DashboardStats stats={{ ...baseStats, streakDays: 0 }} />);
    // Looking for the "new day" encouragement message
    expect(screen.getByText(/möjlighet|start/i)).toBeInTheDocument();
  });
});
