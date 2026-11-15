/**
 * /mood/forecast words its own messages, in Swedish.
 *
 * With fewer than 14 mood entries the page showed the server's sentence as it
 * came: "Need at least 14 mood entries for LSTM forecast, got 4". Any other
 * failure showed whatever `message` the server sent as well.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../api/api', () => ({ default: { get } }));
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: { user_id: 'u1' } }) }));
vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { MoodForecastView } from '../MoodForecastView';

describe('MoodForecastView', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('says how many mood logs the forecast needs and how many there are', async () => {
    get.mockResolvedValue({
      data: {
        success: true,
        data: { forecasts: [], insufficient_data: true, entries_required: 14, entries_logged: 4 },
      },
    });

    render(<MoodForecastView />);

    expect(await screen.findByText('Prognosen behöver minst 14 humörloggningar. Du har loggat 4 hittills.'))
      .toBeInTheDocument();
    expect(screen.getByText(/Fortsätt logga ditt humör/)).toBeInTheDocument();
  });

  it('does not show the server\'s own text when the forecast fails', async () => {
    get.mockRejectedValue({
      response: { status: 500, data: { success: false, error: 'FORECAST_ERROR', message: 'Forecast generation failed' } },
    });

    render(<MoodForecastView />);

    expect(await screen.findByText('Prognosen är inte tillgänglig just nu. Försök igen senare.')).toBeInTheDocument();
    expect(screen.queryByText(/Forecast generation failed/)).toBeNull();
    // More logging does not fix a failure, so the page must not suggest it.
    expect(screen.queryByText(/Fortsätt logga ditt humör/)).toBeNull();
  });

  it('treats an answer without any forecast as unavailable, not as a chart of nothing', async () => {
    get.mockResolvedValue({ data: { success: true, data: { forecasts: [] } } });

    render(<MoodForecastView />);

    expect(await screen.findByText('Prognosen är inte tillgänglig just nu. Försök igen senare.')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
