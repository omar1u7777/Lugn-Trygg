import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import InsightsHub from '../InsightsHub';

vi.mock('../../api/mood', () => ({
  getAllMoods: vi.fn(),
  getWeeklyAnalysis: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { user_id: 'test-user' } }),
}));
vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../DailyInsights', () => ({
  default: () => <div data-testid="daily-insights-mock" />,
}));
vi.mock('../WeeklyAnalysis', () => ({ default: () => <div /> }));
vi.mock('../AI/PredictiveAnalytics', () => ({ default: () => <div /> }));

import { getAllMoods, getWeeklyAnalysis } from '../../api/mood';

const renderP = (c: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}>{c}</I18nextProvider>);

describe('InsightsHub trend fix (#9)', () => {
  beforeEach(() => { vi.clearAllMocks(); i18n.changeLanguage('sv'); });

  it('handles prevWeekAvg=0 without showing 0% stable', async () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);

    vi.mocked(getAllMoods).mockResolvedValue([
      { score: 0, timestamp: tenDaysAgo.toISOString() },
      { score: 0, timestamp: new Date(tenDaysAgo.getTime() + 86400000).toISOString() },
      { score: 5, timestamp: threeDaysAgo.toISOString() },
      { score: 5, timestamp: new Date(threeDaysAgo.getTime() + 86400000).toISOString() },
    ]);
    vi.mocked(getWeeklyAnalysis).mockResolvedValue({ trend: 'up' });

    renderP(<InsightsHub />);

    // Should show an upward trend, not "0% stabilt"
    await waitFor(() => {
      const trendEl = screen.getByText(/↗|↘|→/);
      expect(trendEl).toBeInTheDocument();
      // Should NOT show "0%" with stable arrow when there's clear improvement
      expect(trendEl.textContent).not.toContain('→ 0%');
    });
  });

  it('caps trend percentage at reasonable value', async () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);

    // prev=1, last=10 → raw 900% which is unreasonable
    vi.mocked(getAllMoods).mockResolvedValue([
      { score: 1, timestamp: tenDaysAgo.toISOString() },
      { score: 1, timestamp: new Date(tenDaysAgo.getTime() + 86400000).toISOString() },
      { score: 10, timestamp: threeDaysAgo.toISOString() },
      { score: 10, timestamp: new Date(threeDaysAgo.getTime() + 86400000).toISOString() },
    ]);
    vi.mocked(getWeeklyAnalysis).mockResolvedValue({ trend: 'up' });

    renderP(<InsightsHub />);

    await waitFor(() => {
      const trendEl = screen.getByText(/↗|↘|→/);
      expect(trendEl).toBeInTheDocument();
      // Should not show 900%
      expect(trendEl.textContent).not.toContain('900%');
    });
  });
});
