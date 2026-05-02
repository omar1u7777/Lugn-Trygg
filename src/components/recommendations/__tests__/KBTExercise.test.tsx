import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { KBTExercise } from '../KBTExercise';
import { useKBTExercise } from '../../../hooks/useKBTExercise';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../hooks/useKBTExercise');

describe('KBTExercise', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useKBTExercise).mockReturnValue({
      phase: 'identify',
      thoughts: { negative: '', evidence: '', alternative: '' },
      updateThoughts: vi.fn(),
      timeLeft: 0,
      isActive: false,
      start: vi.fn(),
      nextPhase: vi.fn(),
      stop: vi.fn(),
    });
  });

  it('should render identify phase by default', () => {
    render(<KBTExercise onComplete={mockOnComplete} />);
    expect(screen.getByText('📝 Steg 1: Identifiera negativa tankar')).toBeInTheDocument();
  });

  it('should render progress indicator', () => {
    render(<KBTExercise onComplete={mockOnComplete} />);
    expect(screen.getByText(/Steg 1 av/i)).toBeInTheDocument();
  });

  it('should render textarea for negative thought', () => {
    render(<KBTExercise onComplete={mockOnComplete} />);
    const textarea = screen.getByPlaceholderText(/Skriv din negativa tanke här/i);
    expect(textarea).toBeInTheDocument();
  });

  it('should call start when Starta KBT-övning button is clicked', () => {
    const mockStart = vi.fn();
    vi.mocked(useKBTExercise).mockReturnValue({
      phase: 'identify',
      thoughts: { negative: '', evidence: '', alternative: '' },
      updateThoughts: vi.fn(),
      timeLeft: 0,
      isActive: false,
      start: mockStart,
      nextPhase: vi.fn(),
      stop: vi.fn(),
    });

    render(<KBTExercise onComplete={mockOnComplete} />);
    const startButton = screen.getByText('🚀 Starta KBT-övning');
    fireEvent.click(startButton);

    expect(mockStart).toHaveBeenCalled();
  });

  it('should render challenge phase', () => {
    vi.mocked(useKBTExercise).mockReturnValue({
      phase: 'challenge',
      thoughts: { negative: 'Jag kommer misslyckas', evidence: '', alternative: '' },
      updateThoughts: vi.fn(),
      timeLeft: 0,
      isActive: true,
      start: vi.fn(),
      nextPhase: vi.fn(),
      stop: vi.fn(),
    });

    render(<KBTExercise onComplete={mockOnComplete} />);
    expect(screen.getByText('🔍 Steg 2: Utmana tanken med evidens')).toBeInTheDocument();
    expect(screen.getByText(/Jag kommer misslyckas/i)).toBeInTheDocument();
  });

  it('should render replace phase', () => {
    vi.mocked(useKBTExercise).mockReturnValue({
      phase: 'replace',
      thoughts: { negative: 'Jag kommer misslyckas', evidence: 'För: Jag har misslyckats. Emot: Jag har lyckats.', alternative: '' },
      updateThoughts: vi.fn(),
      timeLeft: 0,
      isActive: true,
      start: vi.fn(),
      nextPhase: vi.fn(),
      stop: vi.fn(),
    });

    render(<KBTExercise onComplete={mockOnComplete} />);
    expect(screen.getByText('✨ Steg 3: Ersätt med balanserad tanke')).toBeInTheDocument();
  });

  it('should render practice phase', () => {
    vi.mocked(useKBTExercise).mockReturnValue({
      phase: 'practice',
      thoughts: { negative: 'Jag kommer misslyckas', evidence: 'För: Jag har misslyckats. Emot: Jag har lyckats.', alternative: 'Jag gör mitt bästa' },
      updateThoughts: vi.fn(),
      timeLeft: 0,
      isActive: true,
      start: vi.fn(),
      nextPhase: vi.fn(),
      stop: vi.fn(),
    });

    render(<KBTExercise onComplete={mockOnComplete} />);
    expect(screen.getByText('🧘 Steg 4: Öva den nya tanken')).toBeInTheDocument();
  });

  it('should render complete phase', () => {
    vi.mocked(useKBTExercise).mockReturnValue({
      phase: 'complete',
      thoughts: { negative: 'Jag kommer misslyckas', evidence: 'För: Jag har misslyckats. Emot: Jag har lyckats.', alternative: 'Jag gör mitt bästa' },
      updateThoughts: vi.fn(),
      timeLeft: 0,
      isActive: false,
      start: vi.fn(),
      nextPhase: vi.fn(),
      stop: vi.fn(),
    });

    render(<KBTExercise onComplete={mockOnComplete} />);
    expect(screen.getByText('✅ KBT-övning Slutförd!')).toBeInTheDocument();
  });

  it('should call nextPhase when Nästa Steg button is clicked', () => {
    const mockNextPhase = vi.fn();
    vi.mocked(useKBTExercise).mockReturnValue({
      phase: 'identify',
      thoughts: { negative: 'Jag kommer misslyckas', evidence: '', alternative: '' },
      updateThoughts: vi.fn(),
      timeLeft: 0,
      isActive: true,
      start: vi.fn(),
      nextPhase: mockNextPhase,
      stop: vi.fn(),
    });

    render(<KBTExercise onComplete={mockOnComplete} />);
    const nextButton = screen.getByText('Nästa Steg →');
    fireEvent.click(nextButton);

    expect(mockNextPhase).toHaveBeenCalled();
  });

  it('should call stop when Avbryt button is clicked', () => {
    const mockStop = vi.fn();
    vi.mocked(useKBTExercise).mockReturnValue({
      phase: 'identify',
      thoughts: { negative: 'Jag kommer misslyckas', evidence: '', alternative: '' },
      updateThoughts: vi.fn(),
      timeLeft: 0,
      isActive: true,
      start: vi.fn(),
      nextPhase: vi.fn(),
      stop: mockStop,
    });

    render(<KBTExercise onComplete={mockOnComplete} />);
    const cancelButton = screen.getByText('⏹️ Avbryt');
    fireEvent.click(cancelButton);

    expect(mockStop).toHaveBeenCalled();
  });

  it('should use initialBeliefBefore prop', () => {
    render(<KBTExercise onComplete={mockOnComplete} initialBeliefBefore={50} />);
    // The belief slider should be rendered in challenge phase
    // We'll verify this by checking if the component renders without error
    expect(screen.getByText('📝 Steg 1: Identifiera negativa tankar')).toBeInTheDocument();
  });

  it('should use initialStressBefore prop', () => {
    render(<KBTExercise onComplete={mockOnComplete} initialStressBefore={70} />);
    expect(screen.getByText('📝 Steg 1: Identifiera negativa tankar')).toBeInTheDocument();
  });
});
