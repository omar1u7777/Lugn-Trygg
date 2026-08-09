import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/admin', () => ({
  getAdminStats: vi.fn(),
  getPerformanceMetrics: vi.fn(),
  getSystemHealth: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import AnalyticsDashboard from '../AnalyticsDashboard';
import { getAdminStats, getPerformanceMetrics, getSystemHealth } from '../../api/admin';

// recharts' ResponsiveContainer needs one; jsdom has none.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never);

const stats = {
  users: { total: 10, active7d: 4, new30d: 2, premium: 1 },
  moods: { total: 20, today: 3, averageScore: 7 },
  content: { memories: 1, journals: 2, chatSessions: 3 },
  engagement: { activeRate: 0.4, premiumRate: 0.1 },
  generatedAt: new Date().toISOString(),
};

const performance = {
  endpoints: {
    '/api/moods': { count: 12, avgDuration: 40, minDuration: 10, maxDuration: 90, p95Duration: 80 },
  },
  totalRequests: 12,
  errorCounts: {},
  slowRequestsCount: 0,
};

const health = {
  status: 'healthy' as const,
  firebase: 'connected' as const,
  timestamp: new Date().toISOString(),
  uptimeRequests: 120,
  errorRate: 0.2,
};

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <AnalyticsDashboard />
    </MemoryRouter>
  );

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminStats).mockResolvedValue(stats);
    vi.mocked(getPerformanceMetrics).mockResolvedValue(performance);
    vi.mocked(getSystemHealth).mockResolvedValue(health);
  });

  it('shows no error banner when all three fetches succeed', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Användaröversikt')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Kunde inte ladda/)).not.toBeInTheDocument();
  });

  it('names the failed source on a partial failure instead of staying silent', async () => {
    // One success used to be enough to suppress the banner entirely, so a
    // failed stats call rendered as empty charts and "-" cards with nothing
    // saying why — identical to an install with no users at all.
    vi.mocked(getAdminStats).mockRejectedValue(new Error('stats down'));

    renderDashboard();

    expect(
      await screen.findByText(/Kunde inte ladda: användar- och innehållsstatistik/)
    ).toBeInTheDocument();
    expect(screen.getAllByText('Statistiken kunde inte hämtas.').length).toBe(2);
  });

  it('distinguishes unreachable performance data from genuinely no endpoint traffic', async () => {
    vi.mocked(getPerformanceMetrics).mockRejectedValue(new Error('perf down'));

    renderDashboard();

    expect(
      await screen.findByText(/Prestandamätvärdena kunde inte hämtas/)
    ).toBeInTheDocument();
    expect(screen.queryByText('Ingen endpoint-data tillgänglig.')).not.toBeInTheDocument();
  });

  it('still reports a total failure with the original message', async () => {
    vi.mocked(getAdminStats).mockRejectedValue(new Error('down'));
    vi.mocked(getPerformanceMetrics).mockRejectedValue(new Error('down'));
    vi.mocked(getSystemHealth).mockRejectedValue(new Error('down'));

    renderDashboard();

    expect(
      await screen.findByText(/Kunde inte ladda admin analytics-data just nu/)
    ).toBeInTheDocument();
  });
});
