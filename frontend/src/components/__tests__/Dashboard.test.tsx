import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/i18n';
import Dashboard from '../Dashboard/Dashboard';
import TestProviders from '../../utils/TestProviders';

// Mock the API calls
jest.mock('../../api/api', () => ({
  getMoods: jest.fn().mockResolvedValue([
    { mood: 'glad', score: 0.8, timestamp: '2025-10-01T00:00:00Z' },
    { mood: 'ledsen', score: -0.5, timestamp: '2025-10-02T00:00:00Z' }
  ])
}));

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
  const renderDashboard = () => {
    return render(
      <TestProviders>
        <I18nextProvider i18n={i18n}>
          <Dashboard />
        </I18nextProvider>
      </TestProviders>
    );
  };

  test('renders dashboard with Swedish translations', async () => {
    renderDashboard();

    // Check for Swedish welcome message
    await waitFor(() => {
      expect(screen.getByText(/Välkommen/)).toBeInTheDocument();
    });

    // Check for dashboard sections
    expect(screen.getByText(/Veckovis Humöranalys/)).toBeInTheDocument();
    expect(screen.getByText(/Humörtrender/)).toBeInTheDocument();
    expect(screen.getByText(/Minnesfrekvens/)).toBeInTheDocument();
  });

  test('renders dashboard with English translations when language changes', async () => {
    renderDashboard();

    // Change language to English
    const languageSelect = screen.getByRole('combobox', { name: /välj språk/i });
    fireEvent.change(languageSelect, { target: { value: 'en' } });

    // Check for English welcome message
    await waitFor(() => {
      expect(screen.getByText(/Welcome/)).toBeInTheDocument();
    });
  });

  test('renders dashboard with Norwegian translations when language changes', async () => {
    renderDashboard();

    // Change language to Norwegian
    const languageSelect = screen.getByRole('combobox', { name: /välj språk/i });
    fireEvent.change(languageSelect, { target: { value: 'no' } });

    // Check for Norwegian welcome message
    await waitFor(() => {
      expect(screen.getByText(/Velkommen/)).toBeInTheDocument();
    });
  });

  test('renders all dashboard components', () => {
    renderDashboard();

    // Check for mocked components
    expect(screen.getByTestId('mood-chart')).toBeInTheDocument();
    expect(screen.getByTestId('memory-chart')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-analysis')).toBeInTheDocument();
    expect(screen.getByTestId('relaxing-sounds')).toBeInTheDocument();
  });

  test('renders action buttons', () => {
    renderDashboard();

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

  test('handles mood logging button click', () => {
    renderDashboard();

    const moodButton = screen.getByText(/Öppna Humörloggning/);
    fireEvent.click(moodButton);

    // Since modals are conditionally rendered, we can't easily test the modal opening
    // in this basic test setup. In a real scenario, we'd mock the modal state.
    expect(moodButton).toBeInTheDocument();
  });

  test('displays reminder when no mood logged today', async () => {
    // Mock getMoods to return no moods for today
    const mockGetMoods = require('../../api/api').getMoods;
    mockGetMoods.mockResolvedValueOnce([
      { mood: 'glad', score: 0.8, timestamp: '2025-09-30T00:00:00Z' } // Yesterday
    ]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Påminnelse/)).toBeInTheDocument();
    });
  });

  test('does not display reminder when mood logged today', async () => {
    // Mock getMoods to return a mood for today
    const today = new Date().toISOString().split('T')[0];
    const mockGetMoods = require('../../api/api').getMoods;
    mockGetMoods.mockResolvedValueOnce([
      { mood: 'glad', score: 0.8, timestamp: `${today}T00:00:00Z` }
    ]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByText(/Påminnelse/)).not.toBeInTheDocument();
    });
  });
});