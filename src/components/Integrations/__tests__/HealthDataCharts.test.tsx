/**
 * The sync charts say in Swedish that statistics could not be fetched.
 *
 * A failed request showed the error's own message, which for an API error is
 * the server's English sentence.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { getSyncStats } = vi.hoisted(() => ({ getSyncStats: vi.fn() }));

vi.mock('../../../api/sync', () => ({ getSyncStats }));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import HealthDataCharts from '../HealthDataCharts';

describe('HealthDataCharts', () => {
  beforeEach(() => {
    getSyncStats.mockReset();
  });

  it('says in its own words that the statistics could not be fetched', async () => {
    getSyncStats.mockRejectedValue(new Error('Internal server error'));

    render(<HealthDataCharts userId="u1" />);

    expect(await screen.findByText('Kunde inte hämta synkstatistik.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Internal server error');
  });

  it('says so when nothing has been synced yet', async () => {
    getSyncStats.mockResolvedValue({
      totalSyncs: 0, successCount: 0, failedCount: 0, partialCount: 0, successRate: 0, lastSync: null, byProvider: {},
    });

    render(<HealthDataCharts userId="u1" />);

    expect(await screen.findByText(/Ingen synkstatistik tillgänglig ännu/)).toBeInTheDocument();
  });
});
