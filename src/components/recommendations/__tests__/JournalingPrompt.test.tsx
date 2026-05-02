import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { JournalingPrompt } from '../JournalingPrompt';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../hooks/useJournaling', () => ({
  useJournaling: () => ({
    content: '',
    setContent: vi.fn(),
    mood: undefined,
    setMood: vi.fn(),
    tags: [],
    setTags: vi.fn(),
    entries: [],
    isSaving: false,
    isLoading: false,
    saveEntry: vi.fn(),
    loadHistory: vi.fn(),
  }),
}));

describe('JournalingPrompt', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the journaling prompt component', () => {
    render(<JournalingPrompt onClose={mockOnClose} />);

    expect(screen.getByText(/📝 Journaling för Mental Klarhet/i)).toBeInTheDocument();
  });

  it('should render journal input textarea', () => {
    render(<JournalingPrompt onClose={mockOnClose} />);

    const textarea = screen.getByPlaceholderText(/Skriv fritt om vad som händer/i);
    expect(textarea).toBeInTheDocument();
  });

  it('should render mood selection buttons', () => {
    render(<JournalingPrompt onClose={mockOnClose} />);

    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(i.toString())).toBeInTheDocument();
    }
  });

  it('should render default tags', () => {
    render(<JournalingPrompt onClose={mockOnClose} />);

    expect(screen.getByText('stress')).toBeInTheDocument();
    expect(screen.getByText('ångest')).toBeInTheDocument();
    expect(screen.getByText('glädje')).toBeInTheDocument();
    expect(screen.getByText('oro')).toBeInTheDocument();
    expect(screen.getByText('tacksamhet')).toBeInTheDocument();
    expect(screen.getByText('reflektion')).toBeInTheDocument();
    expect(screen.getByText('mål')).toBeInTheDocument();
    expect(screen.getByText('relationer')).toBeInTheDocument();
  });

  it('should display character count', () => {
    render(<JournalingPrompt onClose={mockOnClose} />);

    expect(screen.getByText(/0 tecken/i)).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(<JournalingPrompt onClose={mockOnClose} />);

    const closeButton = screen.getByText('Stäng');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should toggle journal history', () => {
    render(<JournalingPrompt onClose={mockOnClose} />);

    const toggleButton = screen.getByText(/Visa tidigare anteckningar/i);
    fireEvent.click(toggleButton);

    expect(screen.getByText(/Dölj tidigare anteckningar/i)).toBeInTheDocument();
  });

  it('should render save button', () => {
    render(<JournalingPrompt onClose={mockOnClose} />);

    expect(screen.getByText(/📝 Spara Journalanteckning/i)).toBeInTheDocument();
  });
});
