import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MoodList from '../MoodList';

// ── Mocks ──

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
  analytics: {
    track: () => {},
    identify: () => {},
    page: () => {},
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
  },
}));

vi.mock('../../api/api', () => ({
  getMoods: vi.fn().mockResolvedValue([
    {
      id: '1',
      mood_text: 'Glad',
      timestamp: new Date().toISOString(),
      sentiment: 'POSITIVE',
      score: 8,
      emotions_detected: ['glädje', 'energi'],
    },
    {
      id: '2',
      mood_text: 'Orolig',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      sentiment: 'NEGATIVE',
      score: 3,
      emotions_detected: ['oro'],
    },
  ]),
}));

describe('MoodList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders loading state initially', () => {
    render(
      <BrowserRouter>
        <MoodList inline />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Laddar humörloggar/i)).toBeInTheDocument();
  });

  test('displays mood entries after loading', async () => {
    render(
      <BrowserRouter>
        <MoodList inline />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Glad')).toBeInTheDocument();
      expect(screen.getByText('Orolig')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('filters moods by sentiment', async () => {
    render(
      <BrowserRouter>
        <MoodList inline />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Glad')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Click on positive filter button (use role to distinguish from stats label)
    const positiveButton = screen.getByRole('button', { name: /Positiva/i });
    fireEvent.click(positiveButton);
    
    // Should only show positive mood
    expect(screen.getByText('Glad')).toBeInTheDocument();
    expect(screen.queryByText('Orolig')).not.toBeInTheDocument();
  });

  test('displays correct score format', async () => {
    render(
      <BrowserRouter>
        <MoodList inline />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('8/10')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('handles delete confirmation', async () => {
    render(
      <BrowserRouter>
        <MoodList inline />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Glad')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Click delete button (🗑️ emoji)
    const deleteButton = screen.getAllByLabelText(/Radera detta humör/i)[0];
    fireEvent.click(deleteButton);
    
    // Should show confirmation modal
    expect(screen.getByText(/Radera humör/i)).toBeInTheDocument();
    expect(screen.getByText(/Är du säker/i)).toBeInTheDocument();
  });

  test('displays statistics correctly', async () => {
    render(
      <BrowserRouter>
        <MoodList inline />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Statistik/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Should show stats
    expect(screen.getByText('Totalt')).toBeInTheDocument();
    expect(screen.getByText('Positiva')).toBeInTheDocument();
    expect(screen.getByText('Negativa')).toBeInTheDocument();
  });
});
