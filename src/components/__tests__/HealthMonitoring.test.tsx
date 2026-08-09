import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/admin', () => ({
  getAdminStats: vi.fn(),
  getSystemHealth: vi.fn(),
}));

vi.mock('../../services/analytics', () => ({
  analytics: {
    page: vi.fn(),
    track: vi.fn(),
    health: { crisisDetected: vi.fn() },
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import HealthMonitoring from '../HealthMonitoring';
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

describe('HealthMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminStats).mockResolvedValue(healthyStats);
    vi.mocked(getSystemHealth).mockResolvedValue(healthyHealth);
  });

  it('shows a LOW risk level when the health check actually ran and came back clean', async () => {
    render(<HealthMonitoring />);

    await waitFor(() => {
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });
    expect(screen.queryByText('Monitoring data unavailable')).not.toBeInTheDocument();
  });

  it('shows UNKNOWN rather than LOW when the health check could not run', async () => {
    // Promise.allSettled never rejects, so a failed health call fell through
    // as errorRate 0 / status 'unknown' and scored as 'low' — a monitoring
    // outage was painted green, exactly the reading an admin must not get.
    vi.mocked(getSystemHealth).mockRejectedValue(new Error('backend unreachable'));

    render(<HealthMonitoring />);

    await waitFor(() => {
      expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
    });
    expect(screen.queryByText('LOW')).not.toBeInTheDocument();
    expect(screen.getByText(/risk level below is unknown, not low/)).toBeInTheDocument();
  });

  it('says an empty indicator list is unknown, not empty, when health is unavailable', async () => {
    vi.mocked(getSystemHealth).mockRejectedValue(new Error('backend unreachable'));

    render(<HealthMonitoring />);

    await waitFor(() => {
      expect(screen.getByText(/An empty list here does not mean there are none/)).toBeInTheDocument();
    });
    expect(screen.queryByText('No active crisis indicators.')).not.toBeInTheDocument();
  });

  it('dashes out stats-derived counts instead of showing them as zero', async () => {
    vi.mocked(getAdminStats).mockRejectedValue(new Error('stats down'));

    render(<HealthMonitoring />);

    await waitFor(() => {
      expect(screen.getByText(/counts below are unknown, not zero/)).toBeInTheDocument();
    });
    // Active monitoring / safety checks / average mood all come from stats.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});
