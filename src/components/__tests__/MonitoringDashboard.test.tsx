import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, f?: unknown) => (typeof f === 'string' ? f : k) }),
}));

vi.mock('../../api/admin', () => ({
  getAdminStats: vi.fn(),
  getSystemHealth: vi.fn(),
}));

vi.mock('../../services/analytics', () => ({
  analytics: { page: vi.fn(), track: vi.fn() },
}));

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import MonitoringDashboard from '../MonitoringDashboard';
import { getAdminStats, getSystemHealth } from '../../api/admin';

const healthyStats = {
  users: { total: 10, active7d: 4, new30d: 2, premium: 1 },
  moods: { total: 20, today: 3, averageScore: 7 },
  content: { memories: 1, journals: 2, chatSessions: 3 },
  engagement: { activeRate: 0.4, premiumRate: 0.1 },
  generatedAt: new Date().toISOString(),
};

const healthyHealth = {
  status: 'healthy' as const,
  firebase: 'connected' as const,
  timestamp: new Date().toISOString(),
  uptimeRequests: 120,
  errorRate: 0.2,
};

describe('MonitoringDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminStats).mockResolvedValue(healthyStats);
    vi.mocked(getSystemHealth).mockResolvedValue(healthyHealth);
  });

  it('reports all systems working when both fetches succeed', async () => {
    render(<MonitoringDashboard />);

    expect(await screen.findByText('Alla system fungerar')).toBeInTheDocument();
    expect(screen.queryByText('Systemhälsan kunde inte hämtas')).not.toBeInTheDocument();
  });

  it('says health is unknown rather than claiming all systems work when the health fetch fails', async () => {
    // Promise.allSettled never rejects, so a failed health call used to fall
    // through as errorRate 0 with no alerts, and the dashboard announced
    // "Alla system fungerar" at the exact moment it could see nothing.
    vi.mocked(getSystemHealth).mockRejectedValue(new Error('backend unreachable'));

    render(<MonitoringDashboard />);

    expect(await screen.findByText('Systemhälsan kunde inte hämtas')).toBeInTheDocument();
    expect(screen.queryByText('Alla system fungerar')).not.toBeInTheDocument();
  });

  it('renders a dash instead of a healthy-looking zero for health-derived metrics', async () => {
    vi.mocked(getSystemHealth).mockRejectedValue(new Error('backend unreachable'));

    render(<MonitoringDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });
    // Uptime/error rate/performance score all come from the failed call.
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
  });

  it('still shows stats-derived metrics when only the health fetch fails', async () => {
    vi.mocked(getSystemHealth).mockRejectedValue(new Error('backend unreachable'));

    render(<MonitoringDashboard />);

    // Active users comes from getAdminStats, which succeeded.
    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });
});
