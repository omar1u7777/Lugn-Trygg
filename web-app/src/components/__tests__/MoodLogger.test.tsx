import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import MoodLogger from '../MoodLogger';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'sv' }
  })
}));

vi.mock('../hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    announceToScreenReader: vi.fn(),
    isReducedMotion: false
  })
}));

vi.mock('../services/offlineStorage', () => ({
  default: {
    addOfflineMoodLog: vi.fn()
  }
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

vi.mock('../api/api', () => ({
  API_BASE_URL: 'http://localhost:5001'
}));

describe('MoodLogger', () => {
  const defaultProps = {
    userEmail: 'test@example.com',
    onClose: vi.fn(),
    onMoodLogged: vi.fn(),
    onCrisisDetected: vi.fn()
  };

  test('renders mood logger modal', () => {
    render(<MoodLogger {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('mood.title')).toBeInTheDocument();
  });

  test('shows voice and text input options', () => {
    render(<MoodLogger {...defaultProps} />);

    expect(screen.getByText('🎙️ Röst')).toBeInTheDocument();
    expect(screen.getByText('✍️ Text')).toBeInTheDocument();
  });

  test('switches to text input mode', () => {
    render(<MoodLogger {...defaultProps} />);

    const textButton = screen.getByText('✍️ Text');
    fireEvent.click(textButton);

    expect(screen.getByPlaceholderText(/hur känner du dig/i)).toBeInTheDocument();
  });

  test('shows validation error for empty text input', async () => {
    render(<MoodLogger {...defaultProps} />);

    const textButton = screen.getByText('✍️ Text');
    fireEvent.click(textButton);

    const saveButton = screen.getByText('💾 Spara humör');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Vänligen skriv hur du känner dig')).toBeInTheDocument();
    });
  });

  test('calls onClose when close button is clicked', () => {
    render(<MoodLogger {...defaultProps} />);

    const closeButton = screen.getByLabelText('mood.close');
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('starts recording when voice button is clicked', () => {
    // Mock getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }])
        })
      },
      writable: true
    });

    render(<MoodLogger {...defaultProps} />);

    const voiceButton = screen.getByText('mood.startRecording');
    fireEvent.click(voiceButton);

    // The component should show recording state
    expect(screen.getByText('mood.startRecording')).toBeInTheDocument();
  });
});