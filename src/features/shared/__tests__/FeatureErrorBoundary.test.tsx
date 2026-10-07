import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../services/sentryClient', () => ({ captureException: vi.fn() }));
vi.mock('../../../utils/staleBundle', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/staleBundle')>()),
  recoverFromStaleBundle: vi.fn(),
}));

import { FeatureErrorBoundary } from '../FeatureErrorBoundary';
import { captureException } from '../../../services/sentryClient';
import { recoverFromStaleBundle } from '../../../utils/staleBundle';

const Throw = ({ error }: { error: Error }) => {
  throw error;
};

const staleChunk = () =>
  new TypeError('Failed to fetch dynamically imported module: https://x/assets/js/WorldClassAIChat-u5yeJlD1.js');

describe('FeatureErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reloads on a stale chunk instead of offering a retry that cannot work', () => {
    vi.mocked(recoverFromStaleBundle).mockReturnValue(true);

    render(
      <FeatureErrorBoundary featureName="ai-chat">
        <Throw error={staleChunk()} />
      </FeatureErrorBoundary>,
    );

    expect(recoverFromStaleBundle).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/Laddar om/);
    expect(screen.queryByRole('button', { name: /Försök igen/ })).toBeNull();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports a stale chunk once the reload limit is spent', () => {
    vi.mocked(recoverFromStaleBundle).mockReturnValue(false);

    render(
      <FeatureErrorBoundary featureName="ai-chat">
        <Throw error={staleChunk()} />
      </FeatureErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: /Försök igen/ })).toBeInTheDocument();
    expect(captureException).toHaveBeenCalled();
  });

  it('does not reload for an ordinary render error', () => {
    render(
      <FeatureErrorBoundary featureName="journal">
        <Throw error={new Error('boom')} />
      </FeatureErrorBoundary>,
    );

    expect(recoverFromStaleBundle).not.toHaveBeenCalled();
    expect(screen.getByText(/Något gick fel i journal/)).toBeInTheDocument();
    expect(captureException).toHaveBeenCalled();
  });
});
