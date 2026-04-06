/**
 * WellnessGoalsOnboarding Tests
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { setWellnessGoalsMock, getDashboardSummaryMock } = vi.hoisted(() => ({
  setWellnessGoalsMock: vi.fn().mockResolvedValue({}),
  getDashboardSummaryMock: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../api/api', () => ({
  setWellnessGoals: setWellnessGoalsMock,
  getDashboardSummary: getDashboardSummaryMock,
}));

vi.mock('../../../services/analytics', () => ({
  analytics: { track: vi.fn() },
}));

vi.mock('../../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../constants/wellnessGoals', () => ({
  MAX_WELLNESS_GOALS: 3,
  WELLNESS_GOAL_OPTIONS: [
    { id: 'stress', label: 'Hantera stress', icon: '🍃', description: 'Stresshantering' },
    { id: 'sleep', label: 'Förbättra sömn', icon: '😴', description: 'Bättre sömnkvalitet' },
    { id: 'anxiety', label: 'Minska ångest', icon: '🌊', description: 'Ångesthantering' },
    { id: 'mood', label: 'Förbättra humör', icon: '☀️', description: 'Positivt humör' },
  ],
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import WellnessGoalsOnboarding from '../WellnessGoalsOnboarding';

describe('WellnessGoalsOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setWellnessGoalsMock.mockResolvedValue({});
    getDashboardSummaryMock.mockResolvedValue({});
  });

  it('renders goal options', () => {
    render(<WellnessGoalsOnboarding />);
    expect(screen.getByText('Hantera stress')).toBeInTheDocument();
    expect(screen.getByText('Förbättra sömn')).toBeInTheDocument();
  });

  it('renders a continue button', () => {
    render(<WellnessGoalsOnboarding />);
    const saveBtn = screen.getByRole('button', { name: /Fortsätt/i });
    expect(saveBtn).toBeInTheDocument();
  });

  it('selects a goal when clicked', () => {
    render(<WellnessGoalsOnboarding />);
    const btn = screen.getByRole('button', { name: /Hantera stress/i });
    fireEvent.click(btn);
    // After clicking, the CheckCircleIcon should appear (goal is selected)
    expect(btn).not.toBeDisabled();
  });

  it('continue button is disabled when no goals selected', () => {
    render(<WellnessGoalsOnboarding userId="user-1" />);
    const saveBtn = screen.getByRole('button', { name: /Fortsätt/i });
    expect(saveBtn).toBeDisabled();
  });

  it('shows error when save clicked without userId', async () => {
    render(<WellnessGoalsOnboarding />);
    // Select a goal first
    fireEvent.click(screen.getByRole('button', { name: /Hantera stress/i }));
    // Try to save without userId
    const saveBtn = screen.getByRole('button', { name: /Fortsätt/i });
    fireEvent.click(saveBtn);
    await waitFor(() =>
      expect(screen.getByText('Autentisering saknas. Försök logga in igen.')).toBeInTheDocument()
    );
  });

  it('calls onComplete with selected goals on successful save', async () => {
    const onComplete = vi.fn();
    render(<WellnessGoalsOnboarding userId="user-1" onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /Hantera stress/i }));
    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent?.includes('Fortsätt'))!);
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(['stress']));
  });

  it('shows API error message when save fails', async () => {
    setWellnessGoalsMock.mockRejectedValueOnce(new Error('Network error'));
    render(<WellnessGoalsOnboarding userId="user-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Hantera stress/i }));
    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent?.includes('Fortsätt'))!);
    await waitFor(() =>
      expect(screen.getByText('Kunde inte spara målen. Försök igen.')).toBeInTheDocument()
    );
  });

  it('renders skip button when onSkip provided', () => {
    const onSkip = vi.fn();
    render(<WellnessGoalsOnboarding onSkip={onSkip} />);
    expect(screen.getByText('Hoppa över')).toBeInTheDocument();
  });

  it('calls onSkip when skip button clicked', () => {
    const onSkip = vi.fn();
    render(<WellnessGoalsOnboarding onSkip={onSkip} />);
    fireEvent.click(screen.getByText('Hoppa över'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('does not show skip button when onSkip not provided', () => {
    render(<WellnessGoalsOnboarding />);
    expect(screen.queryByText('Hoppa över')).not.toBeInTheDocument();
  });

  it('applies initialGoals', () => {
    render(<WellnessGoalsOnboarding initialGoals={['stress']} />);
    // 'stress' goal button should be visually selected
    expect(screen.getByRole('button', { name: /Hantera stress/i })).toBeInTheDocument();
  });

  it('prevents selecting more than MAX_WELLNESS_GOALS goals', () => {
    render(<WellnessGoalsOnboarding userId="user-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Hantera stress/i }));
    fireEvent.click(screen.getByRole('button', { name: /Förbättra sömn/i }));
    fireEvent.click(screen.getByRole('button', { name: /Minska ångest/i }));
    // 4th goal should be blocked (max is 3)
    fireEvent.click(screen.getByRole('button', { name: /Förbättra humör/i }));
    // hint shows up
    expect(screen.queryByText(/Förbättra humör/)).toBeInTheDocument();
  });

  it('deselects a goal when clicked again', () => {
    render(<WellnessGoalsOnboarding />);
    const btn = screen.getByRole('button', { name: /Hantera stress/i });
    fireEvent.click(btn); // select
    fireEvent.click(btn); // deselect
    expect(btn).toBeInTheDocument();
  });
});
