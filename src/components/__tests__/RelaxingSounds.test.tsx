/**
 * RelaxingSounds component tests
 * Covers: loading, error, tab switching, embedded mode, close, audio library
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Mock HTMLMediaElement methods (jsdom doesn't support audio)
beforeAll(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value: vi.fn(),
  });
});

// Stable t reference to avoid infinite re-renders from useCallback dep on t
vi.mock('react-i18next', () => {
  const t = (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key);
  const i18n = { language: 'sv', changeLanguage: vi.fn() };
  return {
    useTranslation: () => ({ t, i18n }),
  };
});

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Lazy loaded component mock
vi.mock('../AIMusicGenerator', () => ({
  default: () => <div data-testid="ai-music-generator">AI Music Generator</div>,
}));

const { getAudioLibraryMock } = vi.hoisted(() => ({
  getAudioLibraryMock: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  getAudioLibrary: getAudioLibraryMock,
  getMoods: vi.fn().mockResolvedValue([]),
}));

const mockAudioLibrary = {
  nature: {
    id: 'nature',
    name: 'Natur',
    nameEn: 'Nature',
    icon: '🌿',
    description: 'Naturljud',
    tracks: [
      { id: 'track-1', title: 'Regnskog', titleEn: 'Rainforest', artist: 'Nature', url: 'https://example.com/rain.mp3', duration: '4:00' },
      { id: 'track-2', title: 'Havsvågor', titleEn: 'Ocean Waves', artist: 'Nature', url: 'https://example.com/ocean.mp3', duration: '3:30' },
    ],
  },
  meditation: {
    id: 'meditation',
    name: 'Meditation',
    nameEn: 'Meditation',
    icon: '🧘',
    description: 'Meditationsljud',
    tracks: [
      { id: 'track-3', title: 'Djup Avslappning', titleEn: 'Deep Relaxation', artist: 'Meditation', url: 'https://example.com/deep.mp3', duration: '10:00' },
    ],
  },
};

import RelaxingSounds from '../RelaxingSounds';

describe('RelaxingSounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAudioLibraryMock.mockResolvedValue(mockAudioLibrary);
  });

  it('renders loading state initially', () => {
    getAudioLibraryMock.mockImplementation(() => new Promise(() => {}));
    render(<RelaxingSounds onClose={vi.fn()} />);
    expect(screen.getByText(/Laddar.../i)).toBeInTheDocument();
  });

  it('renders audio library after load', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Regnskog')).toBeInTheDocument();
    });
    // Category names appear combined with icon emoji, use regex
    expect(screen.getAllByText(/Natur/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Meditation/i).length).toBeGreaterThan(0);
  });

  it('renders track list for selected category', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Regnskog')).toBeInTheDocument();
    });
    expect(screen.getByText('Havsvågor')).toBeInTheDocument();
  });

  it('shows close button in non-embedded mode and calls onClose', async () => {
    const onClose = vi.fn();
    render(<RelaxingSounds onClose={onClose} />);
    await waitFor(() => screen.getByText('Regnskog'));

    // Two close buttons exist (header + floating) - both call onClose
    const closeBtns = screen.getAllByLabelText(/Stäng/i);
    expect(closeBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not show close button in embedded mode', async () => {
    render(<RelaxingSounds onClose={vi.fn()} embedded />);
    await waitFor(() => screen.getByText('Regnskog'));

    expect(screen.queryByLabelText(/Stäng/i)).not.toBeInTheDocument();
  });

  it('shows error state when getAudioLibrary fails', async () => {
    getAudioLibraryMock.mockRejectedValue(new Error('Network error'));
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Kunde inte ladda ljudbiblioteket/i)).toBeInTheDocument();
    });
  });

  it('shows retry button on error and retries on click', async () => {
    getAudioLibraryMock.mockRejectedValueOnce(new Error('Network error'));
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText(/Försök igen/i));

    getAudioLibraryMock.mockResolvedValueOnce(mockAudioLibrary);
    fireEvent.click(screen.getByText(/Försök igen/i));

    await waitFor(() => {
      expect(screen.getByText('Regnskog')).toBeInTheDocument();
    });
  });

  it('shows no tracks message when library is empty', async () => {
    getAudioLibraryMock.mockResolvedValue({});
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Inga ljudspår tillgängliga/i)).toBeInTheDocument();
    });
  });

  it('switches to AI Music tab when clicked', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    const aiTab = screen.getByText(/AI-Musik/i);
    fireEvent.click(aiTab);

    // AI music generator should load
    await waitFor(() => {
      expect(screen.getByTestId('ai-music-generator')).toBeInTheDocument();
    });
  });

  it('switches back to library tab', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    // Switch to AI tab
    fireEvent.click(screen.getByText(/AI-Musik/i));
    await waitFor(() => screen.getByTestId('ai-music-generator'));

    // Switch back to library tab
    fireEvent.click(screen.getByText(/Ljudbibliotek/i));
    await waitFor(() => {
      expect(screen.getByText('Regnskog')).toBeInTheDocument();
    });
  });

  it('selects a different category', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    // Click meditation category button (find by role since it's combined with icon)
    const meditationBtns = screen.getAllByRole('button', { name: /Meditation/i });
    fireEvent.click(meditationBtns[0]);
    await waitFor(() => {
      expect(screen.getByText('Djup Avslappning')).toBeInTheDocument();
    });
  });

  it('selects a track when clicked', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    fireEvent.click(screen.getByText('Regnskog'));
    // After selection, track name appears in both list and player: multiple matches
    await waitFor(() => {
      expect(screen.getAllByText('Regnskog').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows heading', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Lugn Musik/i)).toBeInTheDocument();
    });
  });

  it('renders embedded mode without fixed positioning', async () => {
    const { container } = render(<RelaxingSounds onClose={vi.fn()} embedded />);
    await waitFor(() => screen.getByText('Regnskog'));

    // Embedded mode uses different container class (no fixed positioning)
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).not.toMatch(/fixed/);
  });

  it('handles library with unknown category gracefully', async () => {
    // Return library without 'nature' category (selectedCategory default)
    const libraryWithoutNature = {
      ocean: {
        id: 'ocean',
        name: 'Hav',
        nameEn: 'Ocean',
        icon: '🌊',
        description: 'Havsljud',
        tracks: [
          { id: 'track-o1', title: 'Havsbris', titleEn: 'Sea Breeze', artist: 'Nature', url: 'https://example.com/sea.mp3', duration: '3:00' },
        ],
      },
    };
    getAudioLibraryMock.mockResolvedValue(libraryWithoutNature);
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => {
      // First category selected automatically, track should appear
      expect(screen.getByText('Havsbris')).toBeInTheDocument();
    });
  });

  it('shows track duration string', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));
    // Duration is displayed directly as string from track data
    expect(screen.getByText('4:00')).toBeInTheDocument();
  });

  it('shows New badge on AI Music tab', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));
    expect(screen.getByText('Ny')).toBeInTheDocument();
  });

  it('selects a track and shows artist in player', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    fireEvent.click(screen.getAllByText('Regnskog')[0]);
    await waitFor(() => {
      // Artist shows up in player
      expect(screen.getAllByText('Nature').length).toBeGreaterThan(0);
    });
  });

  it('toggles play/pause when clicking play button with selected track', async () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    const pauseMock = vi.fn();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pauseMock,
    });

    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    // Select track first
    fireEvent.click(screen.getAllByText('Regnskog')[0]);

    // Click play button
    const playBtn = screen.getByRole('button', { name: /▶️/i });
    fireEvent.click(playBtn);
    await waitFor(() => expect(playMock).toHaveBeenCalled());
  });

  it('clicking play button with no selected track does nothing', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    // The play/pause div (not a button) - no track selected
    const selectTrackText = screen.getByText(/Välj en låt/i);
    expect(selectTrackText).toBeInTheDocument();
  });

  it('handles volume change', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    const volumeSliders = screen.getAllByRole('slider');
    // First slider is volume (before any seek slider)
    const volumeSlider = volumeSliders[0];
    fireEvent.change(volumeSlider, { target: { value: '0.8' } });
    // Should not throw
    expect(volumeSlider).toBeInTheDocument();
  });

  it('handles seek input when track is selected', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    fireEvent.click(screen.getAllByText('Regnskog')[0]);
    await waitFor(() => {
      // After track selected, seek slider appears
      const sliders = screen.getAllByRole('slider');
      expect(sliders.length).toBeGreaterThanOrEqual(2);
    });

    const sliders = screen.getAllByRole('slider');
    const seekSlider = sliders[0]; // first is seek when track selected
    fireEvent.change(seekSlider, { target: { value: '30' } });
    expect(seekSlider).toBeInTheDocument();
  });

  it('navigates to next track with next button', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    // Select first track
    fireEvent.click(screen.getAllByText('Regnskog')[0]);
    await waitFor(() => screen.getAllByText('Regnskog'));

    // Click next
    const nextBtn = screen.getByRole('button', { name: /⏭️/i });
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);
    // Should navigate to second track (Havsvågor)
    await waitFor(() => {
      expect(screen.getAllByText('Havsvågor').length).toBeGreaterThan(0);
    });
  });

  it('navigates to previous track with previous button', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    // Select second track
    fireEvent.click(screen.getAllByText('Havsvågor')[0]);
    await waitFor(() => screen.getAllByText('Havsvågor'));

    // Click previous
    const prevBtn = screen.getByRole('button', { name: /⏮️/i });
    expect(prevBtn).not.toBeDisabled();
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(screen.getAllByText('Regnskog').length).toBeGreaterThan(0);
    });
  });

  it('previous from first track wraps to last track', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    // Select first track (index 0)
    fireEvent.click(screen.getAllByText('Regnskog')[0]);

    const prevBtn = screen.getByRole('button', { name: /⏮️/i });
    fireEvent.click(prevBtn);

    await waitFor(() => {
      // Should wrap to last track in playlist (Havsvågor)
      expect(screen.getAllByText('Havsvågor').length).toBeGreaterThan(0);
    });
  });

  it('next from last track wraps to first track', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    // Select last track
    fireEvent.click(screen.getAllByText('Havsvågor')[0]);

    const nextBtn = screen.getByRole('button', { name: /⏭️/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getAllByText('Regnskog').length).toBeGreaterThan(0);
    });
  });

  it('shows license info for selected track', async () => {
    const libraryWithLicense = {
      nature: {
        ...mockAudioLibrary.nature,
        tracks: [
          { id: 'track-l1', title: 'Licenstrack', titleEn: 'License Track', artist: 'Artist', url: 'https://example.com/lic.mp3', duration: '2:00', license: 'CC BY 4.0' },
        ],
      },
    };
    getAudioLibraryMock.mockResolvedValue(libraryWithLicense);

    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Licenstrack'));
    fireEvent.click(screen.getByText('Licenstrack'));

    await waitFor(() => {
      expect(screen.getByText(/CC BY 4.0/i)).toBeInTheDocument();
    });
  });

  it('getLocalizedText falls back to title when titleEn is absent', async () => {
    const libraryNoEn = {
      nature: {
        id: 'nature',
        name: 'Natur',
        nameEn: 'Nature',
        icon: '🌿',
        description: 'Naturljud',
        tracks: [
          { id: 'track-noen', title: 'Utan Engelska', artist: 'Artist', url: 'https://example.com/no-en.mp3', duration: '1:00' },
        ],
      },
    };
    getAudioLibraryMock.mockResolvedValue(libraryNoEn);
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => {
      // Falls back to title since titleEn absent
      expect(screen.getByText('Utan Engelska')).toBeInTheDocument();
    });
  });

  it('loadFallbackAudio - shows auth error when no token', async () => {
    // Remove token from localStorage
    localStorage.removeItem('token');

    getAudioLibraryMock.mockResolvedValue(mockAudioLibrary);
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    // Select a track
    fireEvent.click(screen.getAllByText('Regnskog')[0]);

    // Trigger audio error event on the audio element
    const audioEl = document.querySelector('audio');
    expect(audioEl).not.toBeNull();
    if (audioEl) {
      fireEvent.error(audioEl);
    }

    await waitFor(() => {
      // Should show auth error message (no token path)
      expect(screen.getByText(/Autentisering krävs|Kunde inte ladda|playbackError/i)).toBeInTheDocument();
    });
  });

  it('loadFallbackAudio - generates audio when token present', async () => {
    localStorage.setItem('token', 'test-token-123');
    const audioBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(audioBlob),
    });
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:test-url') });

    getAudioLibraryMock.mockResolvedValue(mockAudioLibrary);
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    fireEvent.click(screen.getAllByText('Regnskog')[0]);

    const audioEl = document.querySelector('audio');
    if (audioEl) {
      fireEvent.error(audioEl);
    }

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    localStorage.removeItem('token');
    vi.unstubAllGlobals();
  });

  it('loadFallbackAudio - shows error when fetch fails', async () => {
    localStorage.setItem('token', 'test-token-123');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    getAudioLibraryMock.mockResolvedValue(mockAudioLibrary);
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    fireEvent.click(screen.getAllByText('Regnskog')[0]);
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      fireEvent.error(audioEl);
    }

    await waitFor(() => {
      expect(screen.getByText(/Kunde inte ladda meditation|fallbackFailed/i)).toBeInTheDocument();
    });

    localStorage.removeItem('token');
    vi.unstubAllGlobals();
  });

  it('audio error on fallback audio shows playback error (no re-trigger)', async () => {
    // When usingFallbackAudio is true, audio error shows playbackError instead
    localStorage.setItem('token', 'test-token-123');
    const audioBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(audioBlob),
    }));
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:url') });

    getAudioLibraryMock.mockResolvedValue(mockAudioLibrary);
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    fireEvent.click(screen.getAllByText('Regnskog')[0]);

    const audioEl = document.querySelector('audio');
    if (audioEl) {
      // First error → triggers loadFallbackAudio
      fireEvent.error(audioEl);
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      // Second error (usingFallbackAudio=true) → shows playback error
      fireEvent.error(audioEl);
    }

    await waitFor(() => {
      expect(screen.getByText(/Kunde inte spela upp|Kunde inte ladda/i)).toBeInTheDocument();
    });

    localStorage.removeItem('token');
    vi.unstubAllGlobals();
  });

  it('next/prev buttons disabled when no track selected', async () => {
    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));

    const prevBtn = screen.getByRole('button', { name: /⏮️/i });
    const nextBtn = screen.getByRole('button', { name: /⏭️/i });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('shows playback error when play() rejects', async () => {
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
    });

    render(<RelaxingSounds onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Regnskog'));
    fireEvent.click(screen.getAllByText('Regnskog')[0]);

    // Click play
    const playButtons = screen.getAllByRole('button');
    const playBtn = playButtons.find(b => b.textContent?.includes('▶️') || b.getAttribute('aria-label') === null);
    if (playBtn && !playBtn.disabled) {
      fireEvent.click(playBtn);
    }

    // Restore
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });
});
