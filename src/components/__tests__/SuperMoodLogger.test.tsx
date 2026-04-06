/**
 * SuperMoodLogger component tests
 * Covers: mood selection, submission, limit errors, recent moods, voice recording UI
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';

// Stable t reference to avoid infinite re-renders
vi.mock('react-i18next', () => {
  const t = (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key);
  return {
    useTranslation: () => ({ t, i18n: { language: 'sv' } }),
  };
});

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../services/analytics', () => ({
  analytics: { track: vi.fn(), page: vi.fn(), identify: vi.fn() },
}));

vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({ announceToScreenReader: vi.fn() }),
}));

vi.mock('../../features/mood/utils', () => ({
  getMoodLabel: (score: number) => String(score),
}));

// Mock sub-components to keep tests simple
vi.mock('../mood/CircumplexSliders', () => ({
  CircumplexSliders: ({ onValenceChange, onArousalChange }: { onValenceChange: (v: number) => void; onArousalChange: (a: number) => void }) => (
    <div data-testid="circumplex-sliders">
      <input data-testid="valence-slider" type="range" onChange={(e) => onValenceChange(Number(e.target.value))} />
      <input data-testid="arousal-slider" type="range" onChange={(e) => onArousalChange(Number(e.target.value))} />
    </div>
  ),
}));

vi.mock('../mood/TagSelector', () => ({
  TagSelector: ({ onTagsChange }: { onTagsChange: (tags: string[]) => void }) => (
    <div data-testid="tag-selector">
      <button onClick={() => onTagsChange(['work', 'stress'])}>Add Tags</button>
    </div>
  ),
}));

vi.mock('../ui/tailwind', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}));

const { logMoodMock, getMoodsMock } = vi.hoisted(() => ({
  logMoodMock: vi.fn(),
  getMoodsMock: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  logMood: logMoodMock,
  getMoods: getMoodsMock,
}));

vi.mock('../../api/client', () => ({
  api: { post: vi.fn().mockResolvedValue({ data: {} }) },
}));

vi.mock('../../api/constants', () => ({
  API_ENDPOINTS: { MOOD: { LOG_MOOD: '/api/v1/moods' } },
}));

const { useAuthMock, useSubscriptionMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useSubscriptionMock: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  default: useAuthMock,
}));

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: useSubscriptionMock,
}));

import { SuperMoodLogger } from '../SuperMoodLogger';

const defaultUser = { user_id: 'user-1', email: 'test@test.com' };
const defaultSubscription = {
  canLogMood: () => true,
  incrementMoodLog: vi.fn(),
  plan: { tier: 'free', limits: {} },
};

const setupMocks = (options: { moods?: unknown[]; canLog?: boolean } = {}) => {
  useAuthMock.mockReturnValue({ user: defaultUser });
  useSubscriptionMock.mockReturnValue({
    ...defaultSubscription,
    canLogMood: () => options.canLog !== false,
    incrementMoodLog: vi.fn(),
  });
  getMoodsMock.mockResolvedValue(options.moods ?? []);
  logMoodMock.mockResolvedValue({ id: 'new-mood-1', score: 7 });
};

describe('SuperMoodLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders mood selection buttons', () => {
    render(<SuperMoodLogger />);
    expect(screen.getByText('Ledsen')).toBeInTheDocument();
    expect(screen.getByText('Orolig')).toBeInTheDocument();
    expect(screen.getByText('Neutral')).toBeInTheDocument();
    expect(screen.getByText('Bra')).toBeInTheDocument();
    expect(screen.getByText('Glad')).toBeInTheDocument();
    expect(screen.getByText('Super')).toBeInTheDocument();
  });

  it('submit button is disabled when no mood selected', () => {
    render(<SuperMoodLogger />);
    const submitBtn = screen.getByRole('button', { name: /logga/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit after selecting mood', () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Glad'));
    const submitBtn = screen.getByRole('button', { name: /logga/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('shows reflection prompt after mood selection', () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Glad'));
    // Shows reflection prompt (score 8 triggers "Vad bidrog till...")
    expect(screen.getByText(/Vad bidrog till/i)).toBeInTheDocument();
  });

  it('logs mood on submit', async () => {
    const onMoodLogged = vi.fn();
    render(<SuperMoodLogger onMoodLogged={onMoodLogged} />);

    fireEvent.click(screen.getByText('Glad'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });

    await waitFor(() => {
      expect(logMoodMock).toHaveBeenCalledWith('user-1', expect.objectContaining({ score: 8 }));
    });
    expect(onMoodLogged).toHaveBeenCalledWith(8, '');
  });

  it('shows daily limit error when cannot log mood', async () => {
    useSubscriptionMock.mockReturnValue({
      ...defaultSubscription,
      canLogMood: () => false,
      incrementMoodLog: vi.fn(),
    });
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Glad'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Du har nått din dagliga gräns/i)).toBeInTheDocument();
    });
  });

  it('loads recent moods when showRecentMoods is true', async () => {
    const recentMood = {
      id: 'r1',
      score: 8,
      mood_text: 'Glad',
      timestamp: new Date().toISOString(),
      note: 'Good day',
    };
    setupMocks({ moods: [recentMood] });
    render(<SuperMoodLogger showRecentMoods />);
    await waitFor(() => {
      expect(getMoodsMock).toHaveBeenCalled();
    });
  });

  it('does not load recent moods when showRecentMoods is false', async () => {
    render(<SuperMoodLogger showRecentMoods={false} />);
    await act(async () => {});
    expect(getMoodsMock).not.toHaveBeenCalled();
  });

  it('shows note textarea', () => {
    render(<SuperMoodLogger />);
    expect(screen.getByPlaceholderText(/Vad tänker du på/i)).toBeInTheDocument();
  });

  it('allows text entry in note field', () => {
    render(<SuperMoodLogger />);
    const textarea = screen.getByPlaceholderText(/Vad tänker du på/i);
    fireEvent.change(textarea, { target: { value: 'Feeling good today!' } });
    expect(textarea).toHaveValue('Feeling good today!');
  });

  it('shows advanced options when toggle clicked', () => {
    render(<SuperMoodLogger />);
    const advancedToggle = screen.getByRole('button', { name: /Visa avancerade/i });
    fireEvent.click(advancedToggle);
    expect(screen.getByTestId('circumplex-sliders')).toBeInTheDocument();
    expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
  });

  it('hides advanced options initially', () => {
    render(<SuperMoodLogger />);
    expect(screen.queryByTestId('circumplex-sliders')).not.toBeInTheDocument();
  });

  it('shows microphone button when enableVoiceRecording is true', () => {
    render(<SuperMoodLogger enableVoiceRecording />);
    const micBtn = screen.getByRole('button', { name: /spela in/i });
    expect(micBtn).toBeInTheDocument();
  });

  it('does not show microphone button when enableVoiceRecording is false', () => {
    render(<SuperMoodLogger enableVoiceRecording={false} />);
    expect(screen.queryByRole('button', { name: /spela in/i })).not.toBeInTheDocument();
  });

  it('shows reflection prompt for low mood score', () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Ledsen')); // score 2
    expect(screen.getByText(/Vad skulle kännas mest hjälpsamt/i)).toBeInTheDocument();
  });

  it('shows reflection prompt for mid mood score', () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Orolig')); // score 3
    expect(screen.getByText(/Vad skulle kännas mest hjälpsamt/i)).toBeInTheDocument();
  });

  it('shows reflection prompt for neutral mood', () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Neutral')); // score 5
    expect(screen.getByText(/Vad har påverkat ditt mående/i)).toBeInTheDocument();
  });

  it('shows reflection prompt for good mood', () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Bra')); // score 7
    expect(screen.getByText(/Vad bidrog till/i)).toBeInTheDocument();
  });

  it('shows reflection prompt for super mood', () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Super')); // score 10
    expect(screen.getByText(/Vad vill du ta med dig/i)).toBeInTheDocument();
  });

  it('logs mood with note when provided', async () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Bra'));
    const textarea = screen.getByPlaceholderText(/Vad bidrog till/i); // reflection prompt is placeholder when mood selected
    fireEvent.change(textarea, { target: { value: 'Great morning!' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });

    await waitFor(() => {
      expect(logMoodMock).toHaveBeenCalledWith('user-1', expect.objectContaining({
        note: 'Great morning!',
      }));
    });
  });

  it('handles log mood failure gracefully', async () => {
    logMoodMock.mockRejectedValueOnce(new Error('Network error'));
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Glad'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Kunde inte logga humör/i)).toBeInTheDocument();
    });
  });

  it('handles 429 rate limit from server', async () => {
    const error = {
      response: {
        status: 429,
        data: { error: 'Daglig gräns nådd' },
      },
    };
    logMoodMock.mockRejectedValueOnce(error);
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Glad'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Daglig gräns nådd/i)).toBeInTheDocument();
    });
  });

  it('does not call getMoods if no user', () => {
    useAuthMock.mockReturnValue({ user: null });
    render(<SuperMoodLogger showRecentMoods />);
    expect(getMoodsMock).not.toHaveBeenCalled();
  });

  it('logs mood with advanced options (valence/arousal/tags)', async () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Glad'));

    // Open advanced
    fireEvent.click(screen.getByRole('button', { name: /Visa avancerade/i }));

    // Add tags
    fireEvent.click(screen.getByText('Add Tags'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });

    await waitFor(() => {
      expect(logMoodMock).toHaveBeenCalledWith('user-1', expect.objectContaining({
        tags: ['work', 'stress'],
      }));
    });
  });

  it('shows Loggar... button text while submitting', async () => {
    logMoodMock.mockReturnValueOnce(new Promise(() => {})); // never resolves
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Glad'));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });
    expect(screen.getByText(/Loggar\.\.\./i)).toBeInTheDocument();
  });

  it('blocks duplicate mood submission within 5-min cooldown', async () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Glad'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });
    await waitFor(() => expect(logMoodMock).toHaveBeenCalledTimes(1));

    // Re-select same mood after form reset
    await waitFor(() => expect(screen.queryByText(/Loggar/i)).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Glad'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });

    // Duplicate blocked — only one API call total
    expect(logMoodMock).toHaveBeenCalledTimes(1);
  });

  it('hides advanced options when toggle clicked again', () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByRole('button', { name: /Visa avancerade/i }));
    expect(screen.getByTestId('circumplex-sliders')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dölj avancerade/i }));
    expect(screen.queryByTestId('circumplex-sliders')).not.toBeInTheDocument();
  });

  it('allows entering context in advanced options', () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByRole('button', { name: /Visa avancerade/i }));
    const contextInput = screen.getByPlaceholderText(/hemma/i);
    fireEvent.change(contextInput, { target: { value: 'på jobbet' } });
    expect(contextInput).toHaveValue('på jobbet');
  });

  it('submits context value when provided', async () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Glad'));
    fireEvent.click(screen.getByRole('button', { name: /Visa avancerade/i }));
    fireEvent.change(screen.getByPlaceholderText(/hemma/i), { target: { value: 'på jobbet' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });
    await waitFor(() => {
      expect(logMoodMock).toHaveBeenCalledWith('user-1', expect.objectContaining({
        context: 'på jobbet',
      }));
    });
  });

  it('submits changed valence and arousal from sliders', async () => {
    render(<SuperMoodLogger />);
    fireEvent.click(screen.getByText('Glad'));
    fireEvent.click(screen.getByRole('button', { name: /Visa avancerade/i }));
    fireEvent.change(screen.getByTestId('valence-slider'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('arousal-slider'), { target: { value: '7' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /logga/i }));
    });
    await waitFor(() => {
      expect(logMoodMock).toHaveBeenCalledWith('user-1', expect.objectContaining({
        valence: 3,
        arousal: 7,
      }));
    });
  });

  it('handles getMoods failure gracefully', async () => {
    getMoodsMock.mockRejectedValueOnce(new Error('Network error'));
    render(<SuperMoodLogger showRecentMoods />);
    await waitFor(() => expect(getMoodsMock).toHaveBeenCalled());
    expect(screen.queryByText(/Senaste humörloggningar/i)).not.toBeInTheDocument();
  });

  it('displays recent moods with note and tags', async () => {
    getMoodsMock.mockResolvedValueOnce([{
      id: 'r1', score: 8, mood_text: 'Glad',
      timestamp: new Date().toISOString(),
      note: 'Feeling great today',
      tags: ['work', 'exercise'],
    }]);
    render(<SuperMoodLogger showRecentMoods />);
    await waitFor(() => {
      expect(screen.getByText('Feeling great today')).toBeInTheDocument();
      expect(screen.getByText('#work')).toBeInTheDocument();
      expect(screen.getByText('#exercise')).toBeInTheDocument();
    });
  });

  it('shows Igår label for yesterday moods', async () => {
    getMoodsMock.mockResolvedValueOnce([{
      id: 'y1', score: 5, mood_text: 'Neutral',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    }]);
    render(<SuperMoodLogger showRecentMoods />);
    await waitFor(() => expect(screen.getByText('Igår')).toBeInTheDocument());
  });

  it('normalizes Firestore toDate() timestamp in recent moods', async () => {
    getMoodsMock.mockResolvedValueOnce([{
      id: 'f1', score: 7, mood_text: 'Bra',
      timestamp: { toDate: () => new Date() },
    }]);
    render(<SuperMoodLogger showRecentMoods />);
    await waitFor(() => expect(screen.getByText('7/10')).toBeInTheDocument());
  });

  it('falls back to sentiment_score when score is absent', async () => {
    getMoodsMock.mockResolvedValueOnce([{
      id: 's1', sentiment_score: 9, mood_text: 'Super',
      timestamp: new Date().toISOString(),
    }]);
    render(<SuperMoodLogger showRecentMoods />);
    await waitFor(() => expect(screen.getByText('9/10')).toBeInTheDocument());
  });

  describe('Voice recording', () => {
    let recorderState: { current: string };
    let recorderStart: ReturnType<typeof vi.fn>;
    let recorderStop: ReturnType<typeof vi.fn>;
    let originalMediaDevices: MediaDevices | undefined;

    beforeEach(() => {
      originalMediaDevices = globalThis.navigator.mediaDevices;

      recorderState = { current: 'inactive' };
      recorderStart = vi.fn().mockImplementation(() => {
        recorderState.current = 'recording';
      });
      recorderStop = vi.fn().mockImplementation(function (this: { ondataavailable?: (e: { data: Blob }) => void; onstop?: () => void }) {
        this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
        this.onstop?.();
        recorderState.current = 'inactive';
      });

      class MockMediaRecorder {
        start = recorderStart;
        stop = recorderStop;
        get state() {
          return recorderState.current;
        }
        ondataavailable?: (e: { data: Blob }) => void;
        onstop?: () => void;
      }

      vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder);
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
        },
        configurable: true,
        writable: true,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: originalMediaDevices,
        configurable: true,
        writable: true,
      });
    });

    it('starts recording and shows stop button', async () => {
      render(<SuperMoodLogger enableVoiceRecording />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /spela in/i }));
      });
      expect(recorderStart).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /stoppa inspelning/i })).toBeInTheDocument();
    });

    it('stops recording and shows audio confirmation', async () => {
      render(<SuperMoodLogger enableVoiceRecording />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /spela in/i }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stoppa inspelning/i }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Röstinspelning klar/i)).toBeInTheDocument();
      });
    });

    it('submits via api.post FormData when audioBlob is set', async () => {
      render(<SuperMoodLogger enableVoiceRecording />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /spela in/i }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stoppa inspelning/i }));
      });
      await waitFor(() => screen.getByText(/Röstinspelning klar/i));

      fireEvent.click(screen.getByText('Glad'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /logga/i }));
      });

      // audioBlob path uses api.post, not logMood
      await waitFor(() => expect(logMoodMock).not.toHaveBeenCalled());
    });
  });
});
