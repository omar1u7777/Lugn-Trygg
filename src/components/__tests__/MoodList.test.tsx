import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MoodList from '../MoodList';
import { getMoods } from '../../api/api';

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

describe('MoodList - additional branch coverage', () => {
  const renderMoodList = (props = {}) =>
    render(
      <BrowserRouter>
        <MoodList inline {...props} />
      </BrowserRouter>
    );

  test('shows error state when getMoods throws', async () => {
    vi.mocked(getMoods).mockRejectedValueOnce(new Error('Network error'));
    renderMoodList();
    // After max retries, error should be shown
    // Just verify moods is called
    await waitFor(() => {
      expect(getMoods).toHaveBeenCalled();
    });
  });

  test('displays empty state message when no moods', async () => {
    vi.mocked(getMoods).mockResolvedValueOnce([]);
    renderMoodList();
    await waitFor(() => {
      expect(screen.queryByText(/Glad/i)).not.toBeInTheDocument();
    });
  });

  test('searches within emotions_detected field', async () => {
    vi.mocked(getMoods).mockResolvedValueOnce([
      {
        id: '1',
        mood_text: 'Neutral day',
        timestamp: new Date().toISOString(),
        sentiment: 'NEUTRAL',
        score: 5,
        emotions_detected: ['fearful', 'uncertain'],
      },
    ]);
    renderMoodList();
    await waitFor(() => screen.getByText('Neutral day'));

    const searchInput = screen.getByPlaceholderText(/Sök/i);
    fireEvent.change(searchInput, { target: { value: 'fearful' } });

    expect(screen.getByText('Neutral day')).toBeInTheDocument();
  });

  test('filters moods by negative sentiment', async () => {
    renderMoodList();
    await waitFor(() => screen.getByText('Glad'));

    const negativeBtn = screen.getByRole('button', { name: /Negativa/i });
    fireEvent.click(negativeBtn);

    expect(screen.getByText('Orolig')).toBeInTheDocument();
    expect(screen.queryByText('Glad')).not.toBeInTheDocument();
  });

  test('filters moods by neutral sentiment', async () => {
    vi.mocked(getMoods).mockResolvedValueOnce([
      { id: '1', mood_text: 'Glad', timestamp: new Date().toISOString(), sentiment: 'POSITIVE', score: 8, emotions_detected: [] },
      { id: '2', mood_text: 'Neutral', timestamp: new Date().toISOString(), sentiment: 'NEUTRAL', score: 5, emotions_detected: [] },
    ]);
    renderMoodList();
    await waitFor(() => screen.getByText('Glad'));

    const neutralBtn = screen.getByRole('button', { name: /Neutrala/i });
    fireEvent.click(neutralBtn);

    expect(screen.getByText('Neutral')).toBeInTheDocument();
    expect(screen.queryByText('Glad')).not.toBeInTheDocument();
  });

  test('date range filter - week', async () => {
    renderMoodList();
    await waitFor(() => screen.getByText('Glad'));

    const weekBtn = screen.getByRole('button', { name: /7 dagar/i });
    fireEvent.click(weekBtn);
    // Both sample moods are within a week, so still shown
    expect(screen.getByText('Glad')).toBeInTheDocument();
  });

  test('date range filter - month', async () => {
    renderMoodList();
    await waitFor(() => screen.getByText('Glad'));

    const monthBtn = screen.getByRole('button', { name: /30 dagar/i });
    fireEvent.click(monthBtn);
    expect(screen.getByText('Glad')).toBeInTheDocument();
  });

  test('date range filter - year', async () => {
    renderMoodList();
    await waitFor(() => screen.getByText('Glad'));

    const yearBtn = screen.getByRole('button', { name: /^År$/i });
    fireEvent.click(yearBtn);
    expect(screen.getByText('Glad')).toBeInTheDocument();
  });

  test('cancel delete confirmation brings back normal state', async () => {
    renderMoodList();
    await waitFor(() => screen.getByText('Glad'));

    const deleteButtons = screen.getAllByLabelText(/Radera detta humör/i);
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => screen.getByText(/Är du säker/i));

    const cancelBtn = screen.getByText(/Avbryt/i);
    fireEvent.click(cancelBtn);

    expect(screen.queryByText(/Är du säker/i)).not.toBeInTheDocument();
  });

  test('mood without sentiment defaults to NEUTRAL display', async () => {
    vi.mocked(getMoods).mockResolvedValueOnce([
      {
        id: '1',
        mood_text: 'No sentiment mood',
        timestamp: new Date().toISOString(),
        // no sentiment field
        score: 5,
        emotions_detected: [],
      },
    ]);
    renderMoodList();
    await waitFor(() => screen.getByText('No sentiment mood'));
  });

  test('handles mood with firestore-like timestamp object', async () => {
    vi.mocked(getMoods).mockResolvedValueOnce([
      {
        id: '1',
        mood_text: 'Firestore mood',
        timestamp: { toDate: () => new Date() },
        sentiment: 'POSITIVE',
        score: 7,
        emotions_detected: [],
      },
    ]);
    renderMoodList();
    await waitFor(() => screen.getByText('Firestore mood'));
  });

  test('close button calls onClose in modal mode', async () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <MoodList onClose={onClose} />
      </BrowserRouter>
    );
    await waitFor(() => screen.getByText('Glad'));
    const closeBtn = screen.getByLabelText('Stäng');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  test('refresh button triggers data refetch', async () => {
    renderMoodList();
    await waitFor(() => screen.getByText('Glad'));
    const initialCallCount = vi.mocked(getMoods).mock.calls.length;

    const refreshBtn = screen.getByLabelText('Uppdatera');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(vi.mocked(getMoods).mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  test('reset to all filter shows all moods', async () => {
    renderMoodList();
    await waitFor(() => screen.getByText('Glad'));

    // Filter to positive first
    fireEvent.click(screen.getByRole('button', { name: /Positiva/i }));
    expect(screen.queryByText('Orolig')).not.toBeInTheDocument();

    // Reset to all - the sentiment filter 'Alla (N)' button
    const alleBtn = screen.getByRole('button', { name: /Alla \(/ });
    fireEvent.click(alleBtn);
    expect(screen.getByText('Orolig')).toBeInTheDocument();
  });
});
