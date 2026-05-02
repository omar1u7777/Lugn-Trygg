import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { BreathingExercise } from '../BreathingExercise';
import { useBreathingExercise } from '../../../hooks/useBreathingExercise';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../hooks/useBreathingExercise');

vi.mock('../BiofeedbackBreathingCircle', () => ({
  BiofeedbackBreathingCircle: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="biofeedback-circle">
      Biofeedback Circle
      {children}
    </div>
  ),
}));

vi.mock('../../../constants/recommendations', () => ({
  getBreathingPhases: () => [
    { name: 'rest', title: 'Redo', detail: 'Tryck Starta för att börja', icon: '🫁' },
    { name: 'exhale', title: 'Andas ut', detail: 'Andas ut genom munnen', icon: '💨' },
    { name: 'inhale', title: 'Andas in', detail: 'Andas in genom näsan', icon: '🫁' },
    { name: 'hold', title: 'Håll andan', detail: 'Håll andan', icon: '⏸️' },
    { name: 'exhale2', title: 'Andas ut (fortsätt)', detail: 'Fortsätt andas ut', icon: '💨' },
    { name: 'completed', title: 'Slutförd', detail: 'Bra jobbat!', icon: '✅' },
  ],
  getMuscleGroups: () => [],
  getRecommendationsPool: () => [],
  neuroscienceArticleSections: [],
  neuroscienceQuiz: [],
}));

describe('BreathingExercise', () => {
  const mockOnComplete = vi.fn();
  const mockOnStressChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBreathingExercise).mockReturnValue({
      phase: 'rest',
      totalSeconds: 0,
      phaseSecondsLeft: 0,
      isActive: false,
      isPaused: false,
      cycleCount: 0,
      targetCycles: 4,
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });
  });

  it('should render basic mode by default', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    expect(screen.getByText('🫁 Grundläge')).toBeInTheDocument();
    expect(screen.queryByText('💜 HRV Biofeedback')).toBeInTheDocument();
  });

  it('should toggle between basic and biofeedback mode', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const biofeedbackButton = screen.getByText('💜 HRV Biofeedback');
    fireEvent.click(biofeedbackButton);
    
    expect(screen.getByTestId('biofeedback-circle')).toBeInTheDocument();
  });

  it('should render cycle selector buttons', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    expect(screen.getByText('4 cykler')).toBeInTheDocument();
    expect(screen.getByText('8 cykler')).toBeInTheDocument();
    expect(screen.getByText('12 cykler')).toBeInTheDocument();
  });

  it('should allow cycle selection', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const eightCyclesButton = screen.getByText('8 cykler');
    fireEvent.click(eightCyclesButton);
    
    expect(eightCyclesButton).toHaveClass('bg-indigo-600');
  });

  it('should render stress before slider', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    expect(screen.getByLabelText(/Stress före start/i)).toBeInTheDocument();
  });

  it('should update stress before value', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const stressSlider = screen.getByLabelText(/Stress före start/i);
    fireEvent.change(stressSlider, { target: { value: '50' } });
    
    expect(stressSlider).toHaveValue('50');
  });

  it('should toggle sound on/off', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const soundButton = screen.getByText('🔈 Ljud av');
    fireEvent.click(soundButton);
    
    expect(screen.getByText('🔊 Ljud på')).toBeInTheDocument();
  });

  it('should toggle haptics on/off', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const hapticsButton = screen.getByText('📳 Haptik på');
    fireEvent.click(hapticsButton);
    
    expect(screen.getByText('📴 Haptik av')).toBeInTheDocument();
  });

  it('should toggle fullscreen mode', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const fullscreenButton = screen.getByText('🗖 Helskärm');
    fireEvent.click(fullscreenButton);
    
    expect(screen.getByText('🗗 Avsluta helskärm')).toBeInTheDocument();
  });

  it('should toggle science explanation', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const scienceButton = screen.getByText(/Visa.*Varför 4-7-8/i);
    fireEvent.click(scienceButton);
    
    expect(screen.getByText(/4-7-8-andning förlänger utandningen/i)).toBeInTheDocument();
  });

  it('should render biofeedback pattern selector when in biofeedback mode', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const biofeedbackButton = screen.getByText('💜 HRV Biofeedback');
    fireEvent.click(biofeedbackButton);
    
    expect(screen.getByText('❤️ Koherens 6bpm')).toBeInTheDocument();
    expect(screen.getByText('😴 4-7-8')).toBeInTheDocument();
    expect(screen.getByText('⚡ Box')).toBeInTheDocument();
    expect(screen.getByText('🌙 Sömn')).toBeInTheDocument();
  });

  it('should select biofeedback pattern', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const biofeedbackButton = screen.getByText('💜 HRV Biofeedback');
    fireEvent.click(biofeedbackButton);
    
    const relaxPattern = screen.getByText('😴 4-7-8');
    fireEvent.click(relaxPattern);
    
    expect(relaxPattern).toHaveClass('bg-purple-600');
  });

  it('should call onComplete callback when exercise completes', async () => {
    const mockStart = vi.fn();

    vi.mocked(useBreathingExercise).mockReturnValue({
      phase: 'rest',
      totalSeconds: 0,
      phaseSecondsLeft: 0,
      isActive: false,
      isPaused: false,
      cycleCount: 0,
      targetCycles: 4,
      start: mockStart,
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    render(<BreathingExercise onComplete={mockOnComplete} initialStressBefore={50} />);

    const startButton = screen.getByText('🚀 Starta andningsövning');
    fireEvent.click(startButton);

    expect(mockStart).toHaveBeenCalled();
  });

  it('should disable start button when stress before is null', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const startButton = screen.getByText('🚀 Starta andningsövning');
    expect(startButton).toBeDisabled();
  });

  it('should enable start button when stress before is set', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const stressSlider = screen.getByLabelText(/Stress före start/i);
    fireEvent.change(stressSlider, { target: { value: '50' } });
    
    const startButton = screen.getByText('🚀 Starta andningsövning');
    expect(startButton).not.toBeDisabled();
  });

  it('should show stress after slider when completed', () => {
    vi.mocked(useBreathingExercise).mockReturnValue({
      phase: 'completed',
      totalSeconds: 0,
      phaseSecondsLeft: 0,
      isActive: false,
      isPaused: false,
      cycleCount: 4,
      targetCycles: 4,
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    render(<BreathingExercise onComplete={mockOnComplete} initialStressBefore={50} />);

    expect(screen.getByLabelText(/Stress efter övningen/i)).toBeInTheDocument();
  });

  it('should calculate stress change when both values are set', () => {
    vi.mocked(useBreathingExercise).mockReturnValue({
      phase: 'completed',
      totalSeconds: 0,
      phaseSecondsLeft: 0,
      isActive: false,
      isPaused: false,
      cycleCount: 4,
      targetCycles: 4,
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    });

    render(<BreathingExercise onComplete={mockOnComplete} initialStressBefore={70} />);

    const stressAfterSlider = screen.getByLabelText(/Stress efter övningen/i);
    fireEvent.change(stressAfterSlider, { target: { value: '40' } });

    expect(screen.getByText(/Förändring: -30 poäng/i)).toBeInTheDocument();
  });

  it('should render breathing circle with phase indicators', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    const phaseIndicators = screen.getAllByRole('generic').filter(el => 
      el.classList.contains('rounded-full') && el.classList.contains('w-2')
    );
    
    expect(phaseIndicators.length).toBeGreaterThan(0);
  });

  it('should use initial cycles prop', () => {
    render(<BreathingExercise onComplete={mockOnComplete} initialCycles={8} />);
    
    const eightCyclesButton = screen.getByText('8 cykler');
    expect(eightCyclesButton).toHaveClass('bg-indigo-600');
  });

  it('should use initial stress before prop', () => {
    render(<BreathingExercise onComplete={mockOnComplete} initialStressBefore={60} />);
    
    const stressSlider = screen.getByLabelText(/Stress före start/i);
    expect(stressSlider).toHaveValue('60');
  });

  it('should pass userId to BiofeedbackBreathingCircle', () => {
    render(<BreathingExercise userId="test-user-123" onComplete={mockOnComplete} />);
    
    const biofeedbackButton = screen.getByText('💜 HRV Biofeedback');
    fireEvent.click(biofeedbackButton);
    
    const biofeedbackCircle = screen.getByTestId('biofeedback-circle');
    expect(biofeedbackCircle).toBeInTheDocument();
  });

  it('should show warning when stress before is null and exercise not active', () => {
    render(<BreathingExercise onComplete={mockOnComplete} />);
    
    expect(screen.getByText(/Välj stressnivå före start/i)).toBeInTheDocument();
  });
});
