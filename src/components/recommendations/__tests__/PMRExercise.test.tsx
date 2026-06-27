import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { PMRExercise } from '../PMRExercise';
import { usePMR } from '../../../hooks/usePMR';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../hooks/usePMR');

describe('PMRExercise', () => {
  const mockOnComplete = vi.fn();
  const mockOnSaveSession = vi.fn();
  const mockOnUpdateProgress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePMR).mockReturnValue({
      isActive: false,
      phase: 'relax',
      currentMuscleGroupIndex: 0,
      timeLeft: 10,
      start: vi.fn(),
      stop: vi.fn(),
    });
  });

  it('should render the PMR exercise component', () => {
    render(
      <PMRExercise
        onComplete={mockOnComplete}
        onSaveSession={mockOnSaveSession}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    expect(screen.getByText(/Progressiv Muskelavslappning/i)).toBeInTheDocument();
  });

  it('should call start when start button is clicked', () => {
    const mockStart = vi.fn();
    vi.mocked(usePMR).mockReturnValue({
      isActive: false,
      phase: 'relax',
      currentMuscleGroupIndex: 0,
      timeLeft: 10,
      start: mockStart,
      stop: vi.fn(),
    });

    render(
      <PMRExercise
        onComplete={mockOnComplete}
        onSaveSession={mockOnSaveSession}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    const startButton = screen.getByText(/Starta/i);
    fireEvent.click(startButton);

    expect(mockStart).toHaveBeenCalled();
  });

  it('should call stop when stop button is clicked', () => {
    const mockStop = vi.fn();
    vi.mocked(usePMR).mockReturnValue({
      isActive: true,
      phase: 'tense',
      currentMuscleGroupIndex: 2,
      timeLeft: 5,
      start: vi.fn(),
      stop: mockStop,
    });

    render(
      <PMRExercise
        onComplete={mockOnComplete}
        onSaveSession={mockOnSaveSession}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    const stopButton = screen.getByText(/Stoppa/i);
    fireEvent.click(stopButton);

    expect(mockStop).toHaveBeenCalled();
  });

  it('should display current muscle group when active', () => {
    vi.mocked(usePMR).mockReturnValue({
      isActive: true,
      phase: 'tense',
      currentMuscleGroupIndex: 1,
      timeLeft: 5,
      start: vi.fn(),
      stop: vi.fn(),
    });

    render(
      <PMRExercise
        onComplete={mockOnComplete}
        onSaveSession={mockOnSaveSession}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    expect(screen.getByText(/pmr.tense:/i)).toBeInTheDocument();
  });

  it('should display timer countdown', () => {
    vi.mocked(usePMR).mockReturnValue({
      isActive: true,
      phase: 'tense',
      currentMuscleGroupIndex: 0,
      timeLeft: 10,
      start: vi.fn(),
      stop: vi.fn(),
    });

    render(
      <PMRExercise
        onComplete={mockOnComplete}
        onSaveSession={mockOnSaveSession}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    expect(screen.getByText(/10/i)).toBeInTheDocument();
  });
});
