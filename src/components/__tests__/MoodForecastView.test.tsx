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

const day = (n: number, value: number, flags: string[] = []) => ({
  date: `2026-11-${15 + n}T08:00:00+00:00`,
  predicted_valence: value,
  confidence_interval: { lower: value - 0.2, upper: value + 0.2 },
  uncertainty: 0.1,
  risk_flags: flags,
});

const answer = (modelType: string, forecasts: ReturnType<typeof day>[]) => ({
  data: { success: true, data: { forecasts, model_type: modelType } },
});

describe('MoodForecastView', () => {
  beforeEach(() => {
    get.mockReset();
  });

  // The page said "Baserad på Temporal Attention LSTM" and "AI-prognos" over
  // every forecast. Where the server has no model the forecast is a trend
  // through the person's own scores, and the page has to say that.
  it('says a trend forecast is made from the recent mood logs, not from an AI model', async () => {
    get.mockResolvedValue(answer('score_trend', [day(1, 0.1), day(2, 0.12), day(3, 0.13)]));

    render(<MoodForecastView />);

    expect(await screen.findByText('Bygger på trenden i dina senaste humörloggningar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prognos för ditt humör' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/LSTM|AI-prognos|AI-modell/);
  });

  it('names the model only when the model made the forecast', async () => {
    get.mockResolvedValue(answer('temporal_attention_lstm', [day(1, 0.1), day(2, 0.12)]));

    render(<MoodForecastView />);

    expect(await screen.findByText(/Temporal Attention LSTM/)).toBeInTheDocument();
  });

  it('says a low trend as a low trend, not as a predicted depressive episode', async () => {
    get.mockResolvedValue(answer('score_trend', [
      day(1, -0.7, ['sustained_low_mood']),
      day(2, -0.7, ['sustained_low_mood']),
    ]));

    render(<MoodForecastView />);

    expect(await screen.findByText('Dina senaste loggar pekar mot fortsatt lågt humör')).toBeInTheDocument();
    expect(screen.getByText(/1177/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/depressiv episod/);
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
