import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, f?: unknown) => (typeof f === 'string' ? f : k) }),
}));

vi.mock('../../api/security', () => ({
  getKeyRotationStatus: vi.fn(),
  getTamperEvents: vi.fn(),
  getSecurityMetrics: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import SecurityMonitor from '../Admin/SecurityMonitor';
import { getKeyRotationStatus, getTamperEvents, getSecurityMetrics } from '../../api/security';

const keyStatus = { service: 'openai', status: 'ok', keysActive: 2 };
const tamperData = {
  events: [],
  summary: { totalEvents: 0, activeAlerts: 0, resolvedEvents: 0, criticalEvents: 0 },
  activeAlerts: [],
};
const metrics = {
  authFailures: 0,
  suspiciousActivity: 0,
  blockedRequests: 0,
  activeThreats: 0,
  lastUpdated: new Date().toISOString(),
};

describe('SecurityMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getKeyRotationStatus).mockResolvedValue(keyStatus);
    vi.mocked(getTamperEvents).mockResolvedValue(tamperData);
    vi.mocked(getSecurityMetrics).mockResolvedValue(metrics);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the real panels with no warning when every fetch succeeds', async () => {
    render(<SecurityMonitor />);

    await waitFor(() => {
      expect(screen.getByText('Tamper Detection')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Manipulationsdetekteringen kunde inte hämtas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kunde inte ladda/)).not.toBeInTheDocument();
  });

  it('replaces the tamper panel with an explicit "unknown" notice when its fetch fails', async () => {
    // The panel is rendered only when tamperSummary exists, so a failed fetch
    // used to simply remove it — an admin sees no alerts panel and reads that
    // as "no tamper events" rather than "detection is unreachable".
    vi.mocked(getTamperEvents).mockRejectedValue(new Error('security backend down'));

    render(<SecurityMonitor />);

    expect(
      await screen.findByText(/Manipulationsdetekteringen kunde inte hämtas/)
    ).toBeInTheDocument();
    expect(screen.getByText(/det betyder inte att inga larm finns/i)).toBeInTheDocument();
  });

  it('names the section that failed instead of only counting failures', async () => {
    vi.mocked(getSecurityMetrics).mockRejectedValue(new Error('metrics down'));

    render(<SecurityMonitor />);

    expect(await screen.findByText(/Kunde inte ladda: säkerhetsmätvärden/)).toBeInTheDocument();
    expect(screen.getByText(/Mätvärdena kunde inte hämtas/)).toBeInTheDocument();
  });

  it('falls back to the total-failure message when nothing loads', async () => {
    vi.mocked(getKeyRotationStatus).mockRejectedValue(new Error('down'));
    vi.mocked(getTamperEvents).mockRejectedValue(new Error('down'));
    vi.mocked(getSecurityMetrics).mockRejectedValue(new Error('down'));

    render(<SecurityMonitor />);

    expect(await screen.findByText(/Kunde inte ladda säkerhetsdata just nu/)).toBeInTheDocument();
  });
});
