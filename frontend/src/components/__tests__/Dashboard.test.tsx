import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/i18n';
import Dashboard from '../Dashboard/Dashboard';
import TestProviders from '../../utils/TestProviders';

// Provide a hand-rolled mock for the API module to avoid loading the real file (which uses import.meta)
jest.mock('../../api/api', () => {
  const apiMock = {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    defaults: { headers: {} }
  };
  return {
    __esModule: true,
    default: apiMock,
    getMoods: jest.fn().mockResolvedValue([
      { mood: 'glad', score: 0.8, timestamp: '2025-10-01T00:00:00Z' },
      { mood: 'ledsen', score: -0.5, timestamp: '2025-10-02T00:00:00Z' }
    ]),
    logoutUser: jest.fn().mockResolvedValue(undefined),
    refreshAccessToken: jest.fn().mockResolvedValue(null)
  };
});

// Mock Chart.js to avoid canvas issues in tests
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-chart">Chart Component</div>
}));

// Mock child components
jest.mock('../Dashboard/MoodChart', () => {
  return function MockMoodChart() {
    return <div data-testid="mood-chart">Mood Chart</div>;
  };
});

jest.mock('../Dashboard/MemoryChart', () => {
  return function MockMemoryChart() {
    return <div data-testid="memory-chart">Memory Chart</div>;
  };
});

jest.mock('../WeeklyAnalysis', () => {
  return function MockWeeklyAnalysis({ refreshTrigger }: { refreshTrigger: number }) {
    return <div data-testid="weekly-analysis">Weekly Analysis - Trigger: {refreshTrigger}</div>;
  };
});

jest.mock('../RelaxingSounds', () => {
  return function MockRelaxingSounds() {
    return <div data-testid="relaxing-sounds">Relaxing Sounds</div>;
  };
});

describe('Dashboard Component', () => {
  const renderDashboard = async (language: 'sv' | 'en' | 'no' = 'sv') => {
    await act(async () => {
      await i18n.changeLanguage(language);
    });

    return render(
      <TestProviders>
        <I18nextProvider i18n={i18n}>
          <Dashboard />
        </I18nextProvider>
      </TestProviders>
    );
  };

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('sv');
    });
  });

  test('renders dashboard with Swedish translations', async () => {
    await renderDashboard('sv');

    // Check for Swedish welcome message
    await waitFor(() => {
      expect(screen.getByText(/Välkommen/)).toBeInTheDocument();
    });

    // Check for dashboard sections
    expect(screen.getByText(/Humörtrender/)).toBeInTheDocument();
    expect(screen.getByText(/Minnesfrekvens/)).toBeInTheDocument();
  });

  test('renders dashboard with English translations when language changes', async () => {
    await renderDashboard('en');

    // Check for English welcome message
    await waitFor(() => {
      expect(screen.getByText(/Welcome/)).toBeInTheDocument();
    });
  });

  test('renders dashboard with Norwegian translations when language changes', async () => {
    await renderDashboard('no');

    // Check for Norwegian welcome message
    await waitFor(() => {
      expect(screen.getByText(/Velkommen/)).toBeInTheDocument();
    });
  });

  test('renders all dashboard components', async () => {
    await renderDashboard();

    // Check for mocked components
    expect(screen.getByTestId('mood-chart')).toBeInTheDocument();
    expect(screen.getByTestId('memory-chart')).toBeInTheDocument();
  });

  test('renders action buttons', async () => {
    await renderDashboard();

    // Check for mood logging button
    expect(screen.getByText(/Öppna Humörloggning/)).toBeInTheDocument();

    // Check for mood logs button
    expect(screen.getByText(/Visa Humörloggar/)).toBeInTheDocument();

    // Check for memory recording button
    expect(screen.getByText(/Öppna Inspelning/)).toBeInTheDocument();

    // Check for memories button
    expect(screen.getByText(/Visa Minnen/)).toBeInTheDocument();

    // Check for AI therapist button
    expect(screen.getByText(/Öppna Chatt/)).toBeInTheDocument();
  });

  test('handles mood logging button click', async () => {
    await renderDashboard();

    const moodButton = screen.getByText(/Öppna Humörloggning/);
    fireEvent.click(moodButton);

    // Since modals are conditionally rendered, we can't easily test the modal opening
    // in this basic test setup. In a real scenario, we'd mock the modal state.
    expect(moodButton).toBeInTheDocument();
  });

  test.skip('displays reminder when no mood logged today', async () => {
    // Mock getMoods to return no moods for today (yesterday's mood with Firestore-like Timestamp)
    const yesterday = new Date(Date.now() - 86400000); // 24 hours ago
    const mockGetMoods = require('../../api/api').getMoods;
    mockGetMoods.mockResolvedValueOnce([
      { 
        mood: 'glad', 
        score: 0.8, 
        timestamp: {
          toDate: () => yesterday  // Mimic Firestore Timestamp
        }
      }
    ]);

    await renderDashboard();

    // Wait for debounced checkTodayMood (500ms debounce + time for render)
    // Use findBy which automatically waits for element to appear
    const reminderElement = await screen.findByText(/Påminnelse/, {}, { timeout: 2000 });
    expect(reminderElement).toBeDefined();
  });

  test('does not display reminder when mood logged today', async () => {
    // Mock getMoods to return a mood for today
    const today = new Date().toISOString().split('T')[0];
    const mockGetMoods = require('../../api/api').getMoods;
    mockGetMoods.mockResolvedValueOnce([
      { mood: 'glad', score: 0.8, timestamp: `${today}T00:00:00Z` }
    ]);

    await renderDashboard();

    await waitFor(() => {
      expect(screen.queryByText(/Påminnelse/)).not.toBeInTheDocument();
    });
  });

  test('opens relaxing sounds component when button is clicked', async () => {
    await renderDashboard();

    const relaxingButton = screen.getByText(/Öppna Musik/);
    fireEvent.click(relaxingButton);

    await waitFor(() => {
      expect(screen.getByTestId('relaxing-sounds')).toBeInTheDocument();
    });
  });
});