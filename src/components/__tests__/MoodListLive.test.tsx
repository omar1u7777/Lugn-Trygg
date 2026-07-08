import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MoodList from '../MoodList';
import { getMoods } from '../../api/api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'sv' },
  }),
}));

vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    announceToScreenReader: () => {},
    isReducedMotion: false,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { user_id: 'test-user-123', email: 'test@example.com' },
    token: 'test-token',
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    isPremium: false,
    plan: { limits: { historyDays: 7 } },
  }),
}));

vi.mock('../../services/analytics', () => ({
  analytics: { track: () => {}, identify: () => {}, page: () => {} },
}));

vi.mock('../../utils/logger', () => ({
  logger: { debug: () => {}, error: () => {}, warn: () => {}, info: () => {} },
}));

vi.mock('../../api/api', () => ({
  getMoods: vi.fn(),
}));

describe('BUG B: Floating point precision in score display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('formats raw float 0.10000000149011612 without precision artifacts', async () => {
    vi.mocked(getMoods).mockResolvedValueOnce([
      {
        id: '1',
        mood_text: 'Precision test',
        timestamp: new Date().toISOString(),
        sentiment: 'NEGATIVE',
        score: 0.10000000149011612,
        emotions_detected: [],
      },
    ]);
    render(
      <BrowserRouter>
        <MoodList inline />
      </BrowserRouter>
    );
    await waitFor(() => screen.getByText('Precision test'), { timeout: 3000 });
    // Should NOT show the raw float
    expect(screen.queryByText(/0\.10000000149011612/)).not.toBeInTheDocument();
  });
});

describe('BUG E: Legacy sentiment_score (-1 to +1) displayed as 1-10', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('legacy score -0.2 is converted to valid 1-10 range', async () => {
    vi.mocked(getMoods).mockResolvedValueOnce([
      {
        id: '1',
        mood_text: 'Legacy mood',
        timestamp: new Date().toISOString(),
        sentiment: 'NEGATIVE',
        score: -0.2,
        emotions_detected: [],
      },
    ]);
    render(
      <BrowserRouter>
        <MoodList inline />
      </BrowserRouter>
    );
    await waitFor(() => screen.getByText('Legacy mood'), { timeout: 3000 });
    // Should NOT show -0.2/10
    expect(screen.queryByText(/-0\.2\/10/)).not.toBeInTheDocument();
  });

  test('legacy score 0.4 is converted to valid 1-10 range', async () => {
    vi.mocked(getMoods).mockResolvedValueOnce([
      {
        id: '1',
        mood_text: 'Legacy positive',
        timestamp: new Date().toISOString(),
        sentiment: 'POSITIVE',
        score: 0.4,
        emotions_detected: [],
      },
    ]);
    render(
      <BrowserRouter>
        <MoodList inline />
      </BrowserRouter>
    );
    await waitFor(() => screen.getByText('Legacy positive'), { timeout: 3000 });
    // Should NOT show 0.4/10
    expect(screen.queryByText(/0\.4\/10/)).not.toBeInTheDocument();
  });
});
