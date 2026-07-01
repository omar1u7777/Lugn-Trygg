import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('react-i18next', () => {
  const tr: Record<string, string> = {
    'aiChat.sanctuary': 'Tysta rummet', 'aiChat.alwaysHere': 'Alltid här',
    'aiChat.thinking': 'Tänker...', 'aiChat.welcomeHome': 'Välkommen hem',
    'aiChat.welcomeText': 'Hur kan jag hjälpa?', 'aiChat.welcomeMessage': 'Välkommen',
    'aiChat.inputPlaceholder': 'Skriv ditt meddelande...', 'aiChat.offlinePlaceholder': 'Offline',
    'aiChat.send': 'Skicka', 'aiChat.footer': 'Privat och säker',
    'aiChat.disclaimer': 'Ej ersättning för vård', 'aiChat.opening': 'Öppnar...',
    'aiChat.errorFallback': 'Något gick fel', 'aiChat.offlineMode': 'Offline',
    'aiChat.limitReached': 'Daglig gräns nådd', 'aiChat.dailyLimitReached': 'Daglig gräns nådd',
    'aiChat.messageQueued': 'Köad', 'aiChat.newResponse': 'Nytt svar',
    'aiChat.suggestions.stressed': 'Jag är stressad', 'aiChat.suggestions.motivation': 'Behöver motivation',
    'aiChat.suggestions.sleep': 'Kan inte sova', 'aiChat.crisis': 'Kris',
    'aiChat.stopRecording': 'Stoppa', 'aiChat.startRecording': 'Spela in',
    'aiChat.listening': 'Lyssnar...', 'aiChat.loadingOlder': 'Laddar...',
    'aiChat.loadOlder': 'Ladda fler', 'aiChat.offline': 'Offline',
    'aiChat.reconnecting': 'Återansluter', 'aiChat.messagesLeft': '{{count}} kvar',
    'aiChat.stopSpeaking': 'Stoppa', 'aiChat.listenToMessage': 'Lyssna',
    'aiChat.mindHelpline': 'Mind: 90101', 'aiChat.crisisTitle': 'Om du mår mycket dåligt',
    'aiChat.crisisSos': '📞 SOS Alarm: 112', 'aiChat.crisisMind': '💙 Mind: 90101 (dygnet runt)',
    'aiChat.crisisDisclaimer': 'Lugn & Trygg ersätter inte professionell vård.',
    'aiChat.voicePremium': 'Röst är en Premium-funktion',
    'common.close': 'Stäng',
  };
  const t = (k: string, second?: string | { count?: number }) => {
    if (typeof second === 'string') return second;
    let val = tr[k] ?? k;
    if (second && typeof second === 'object' && typeof second.count === 'number') {
      val = val.replace('{{count}}', String(second.count));
    }
    return val;
  };
  return { useTranslation: () => ({ t, i18n: { language: 'sv' } }) };
});

vi.mock('../../utils/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../../services/analytics', () => ({ analytics: { track: vi.fn(), page: vi.fn(), identify: vi.fn() } }));
vi.mock('../../hooks/useAccessibility', () => ({ useAccessibility: () => ({ announceToScreenReader: vi.fn() }) }));
vi.mock('../../api/ai', () => ({ closeChatSession: vi.fn().mockResolvedValue(undefined) }));

const { getChatHistoryMock } = vi.hoisted(() => ({ getChatHistoryMock: vi.fn() }));
vi.mock('../../api/api', () => ({ getChatHistory: getChatHistoryMock }));
vi.mock('../../hooks/useDashboardData', () => ({ clearDashboardCache: vi.fn() }));

const { useAuthMock, useSubscriptionMock, useStreamingChatMock, useVoiceInputMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(), useSubscriptionMock: vi.fn(), useStreamingChatMock: vi.fn(), useVoiceInputMock: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({ default: useAuthMock }));
vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: useSubscriptionMock }));
vi.mock('../../hooks/useStreamingChat', () => ({ default: useStreamingChatMock }));
vi.mock('../../hooks/useVoiceInput', () => ({ default: useVoiceInputMock }));

vi.mock('../../hooks/useChatCache', () => ({
  default: () => ({ isLoaded: true, getCachedMessages: () => [], addToCache: vi.fn(), syncWithServer: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('../../hooks/useErrorRecovery', () => ({
  default: () => ({ isOnline: true, isRecovering: false, executeWithRecovery: async (_k: string, fn: () => Promise<unknown>) => fn() }),
}));
vi.mock('../../hooks/useTextToSpeech', () => ({
  default: () => ({ isSupported: false, speakingId: null, speak: vi.fn(), stop: vi.fn() }),
}));
vi.mock('../../hooks/useMessagePagination', () => ({
  default: (m: unknown[]) => ({ displayedMessages: m, isLoading: false, hasMore: false, loadMore: vi.fn(), loadingRef: { current: null } }),
}));
vi.mock('../ui/GradualReveal', () => ({ default: ({ text }: { text: string }) => <span>{text}</span> }));

import WorldClassAIChat from '../WorldClassAIChat';

const defaultUser = { user_id: 'user-1', email: 'test@test.com' };
const defaultSub = {
  canSendMessage: () => true, incrementChatMessage: vi.fn(),
  getRemainingMessages: () => 10, plan: { tier: 'free', limits: { chatMessagesPerDay: 20 } },
  isPremium: false,
};
const defaultStream = { isStreaming: false, currentMessage: null, streamMessage: vi.fn().mockResolvedValue(undefined), clearStreamingMessage: vi.fn() };
const defaultVoice = { isListening: false, isSupported: false, startListening: vi.fn(), stopListening: vi.fn(), transcript: '', clearTranscript: vi.fn() };

function setupMocks(o: { user?: unknown; streaming?: Partial<typeof defaultStream>; voice?: Partial<typeof defaultVoice>; subscription?: Partial<typeof defaultSub>; chatHistory?: unknown } = {}) {
  useAuthMock.mockReturnValue({ user: o.user ?? defaultUser });
  useSubscriptionMock.mockReturnValue({ ...defaultSub, ...o.subscription });
  useStreamingChatMock.mockReturnValue({ ...defaultStream, ...o.streaming });
  useVoiceInputMock.mockReturnValue({ ...defaultVoice, ...o.voice });
  getChatHistoryMock.mockResolvedValue(o.chatHistory ?? { conversation: [] });
}

function renderChat(onClose = vi.fn()) { return render(<WorldClassAIChat onClose={onClose} />); }

describe('WorldClassAIChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    // jsdom doesn't implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  describe('Rendering', () => {
    it('renders header with sanctuary title', () => {
      renderChat();
      expect(screen.getByText('Tysta rummet')).toBeInTheDocument();
    });
    it('renders close button', () => {
      renderChat();
      expect(screen.getByRole('button', { name: 'Stäng' })).toBeInTheDocument();
    });
    it('shows welcome screen when no messages', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByText('Välkommen hem')).toBeInTheDocument());
    });
    it('shows suggestion buttons on welcome screen', async () => {
      renderChat();
      await waitFor(() => {
        expect(screen.getByText('Jag är stressad')).toBeInTheDocument();
        expect(screen.getByText('Behöver motivation')).toBeInTheDocument();
      });
    });
    it('renders textarea input', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByPlaceholderText('Skriv ditt meddelande...')).toBeInTheDocument());
    });
    it('renders send button', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Skicka' })).toBeInTheDocument());
    });
  });

  describe('Close behavior', () => {
    it('calls onClose when close button clicked', async () => {
      const onClose = vi.fn();
      renderChat(onClose);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stäng' })); });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message sending', () => {
    it('send button disabled when input empty', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Skicka' })).toBeDisabled());
    });
    it('send button enabled when input has text', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByPlaceholderText('Skriv ditt meddelande...')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText('Skriv ditt meddelande...'), { target: { value: 'Hej!' } });
      expect(screen.getByRole('button', { name: 'Skicka' })).not.toBeDisabled();
    });
    it('sends message on click', async () => {
      const streamMessage = vi.fn().mockResolvedValue(undefined);
      setupMocks({ streaming: { streamMessage } });
      renderChat();
      await waitFor(() => expect(screen.getByPlaceholderText('Skriv ditt meddelande...')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText('Skriv ditt meddelande...'), { target: { value: 'Hej!' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Skicka' })); });
      await waitFor(() => expect(streamMessage).toHaveBeenCalledWith('user-1', 'Hej!', expect.any(Array)));
    });
    it('sends message on Enter key', async () => {
      const streamMessage = vi.fn().mockResolvedValue(undefined);
      setupMocks({ streaming: { streamMessage } });
      renderChat();
      await waitFor(() => expect(screen.getByPlaceholderText('Skriv ditt meddelande...')).toBeInTheDocument());
      const ta = screen.getByPlaceholderText('Skriv ditt meddelande...');
      fireEvent.change(ta, { target: { value: 'Test' } });
      await act(async () => { fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false }); });
      await waitFor(() => expect(streamMessage).toHaveBeenCalled());
    });
    it('clicking suggestion fills input', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByText('Jag är stressad')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Jag är stressad'));
      expect(screen.getByPlaceholderText('Skriv ditt meddelande...')).toHaveValue('Jag är stressad');
    });
  });

  describe('Chat history', () => {
    it('loads and displays history messages', async () => {
      setupMocks({ chatHistory: { conversation: [
        { role: 'user', content: 'Hej', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hej! Hur kan jag hjälpa?', timestamp: new Date().toISOString() },
      ] } });
      renderChat();
      await waitFor(() => {
        expect(screen.getByText('Hej')).toBeInTheDocument();
        expect(screen.getByText('Hej! Hur kan jag hjälpa?')).toBeInTheDocument();
      });
    });
    it('handles empty conversation', async () => {
      setupMocks({ chatHistory: { conversation: [] } });
      renderChat();
      await waitFor(() => expect(screen.getByText('Välkommen hem')).toBeInTheDocument());
    });
    it('handles Firestore timestamp objects', async () => {
      const fsDate = new Date();
      setupMocks({ chatHistory: { conversation: [
        { role: 'user', content: 'FS test', timestamp: { toDate: () => fsDate } },
      ] } });
      renderChat();
      await waitFor(() => expect(screen.getByText('FS test')).toBeInTheDocument());
    });
    it('filters entries with invalid timestamps', async () => {
      setupMocks({ chatHistory: { conversation: [
        { role: 'user', content: 'Valid', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Invalid', timestamp: 'not-a-date' },
      ] } });
      renderChat();
      await waitFor(() => expect(screen.getByText('Valid')).toBeInTheDocument());
      expect(screen.queryByText('Invalid')).not.toBeInTheDocument();
    });
    it('shows crisis indicator for crisis messages', async () => {
      setupMocks({ chatHistory: { conversation: [
        { role: 'assistant', content: 'Du är inte ensam.', timestamp: new Date().toISOString(), crisis_detected: true },
      ] } });
      renderChat();
      await waitFor(() => expect(screen.getByText('Kris')).toBeInTheDocument());
    });
  });

  describe('Subscription limits', () => {
    it('shows limit error when cannot send', async () => {
      setupMocks({ subscription: { canSendMessage: () => false, getRemainingMessages: () => 0, incrementChatMessage: vi.fn(), plan: { tier: 'free', limits: { chatMessagesPerDay: 5 } } } });
      renderChat();
      await waitFor(() => expect(screen.getByPlaceholderText('Skriv ditt meddelande...')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText('Skriv ditt meddelande...'), { target: { value: 'Test' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Skicka' })); });
      await waitFor(() => expect(screen.getByText('Daglig gräns nådd')).toBeInTheDocument());
    });
    it('disables textarea when limit reached', async () => {
      setupMocks({ subscription: { canSendMessage: () => false, getRemainingMessages: () => 0, incrementChatMessage: vi.fn(), plan: { tier: 'free', limits: { chatMessagesPerDay: 5 } } } });
      renderChat();
      await waitFor(() => expect(screen.getByPlaceholderText('Skriv ditt meddelande...')).toBeDisabled());
    });
    it('shows remaining messages count', async () => {
      setupMocks({ subscription: { canSendMessage: () => true, getRemainingMessages: () => 5, incrementChatMessage: vi.fn(), plan: { tier: 'free', limits: { chatMessagesPerDay: 20 } } } });
      renderChat();
      await waitFor(() => expect(screen.getByText('5 kvar')).toBeInTheDocument());
    });
  });

  describe('Voice input — premium gate', () => {
    it('shows active mic button for premium users when voice supported', async () => {
      setupMocks({ voice: { isSupported: true }, subscription: { isPremium: true } });
      renderChat();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Spela in' })).toBeInTheDocument());
    });
    it('shows PRO badge on mic for free users when voice supported', async () => {
      setupMocks({ voice: { isSupported: true }, subscription: { isPremium: false } });
      const { container } = renderChat();
      await waitFor(() => expect(screen.getByText('PRO')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Spela in' })).not.toBeInTheDocument();
    });
    it('hides mic button entirely when voice not supported', async () => {
      setupMocks({ voice: { isSupported: false }, subscription: { isPremium: true } });
      renderChat();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Spela in' })).not.toBeInTheDocument());
      expect(screen.queryByText('PRO')).not.toBeInTheDocument();
    });
    it('shows stop button when premium user is listening', async () => {
      setupMocks({ voice: { isSupported: true, isListening: true }, subscription: { isPremium: true } });
      renderChat();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Stoppa' })).toBeInTheDocument());
    });
    it('shows listening placeholder when premium user is recording', async () => {
      setupMocks({ voice: { isSupported: true, isListening: true }, subscription: { isPremium: true } });
      renderChat();
      await waitFor(() => expect(screen.getByPlaceholderText('Lyssnar...')).toBeInTheDocument());
    });
  });

  describe('Crisis banner', () => {
    it('shows crisis banner with clickable 90101 and 112 when message has crisis sentiment', async () => {
      setupMocks({ chatHistory: { conversation: [
        { role: 'assistant', content: 'Du är inte ensam.', timestamp: new Date().toISOString(), sentiment: 'crisis' },
      ] } });
      const { container } = renderChat();
      await waitFor(() => expect(screen.getByText('Du är inte ensam.')).toBeInTheDocument());
      const sosLink = container.querySelector('a[href="tel:112"]');
      expect(sosLink).toBeTruthy();
      const mindCrisisLink = container.querySelector('a[href="tel:90101"]');
      expect(mindCrisisLink).toBeTruthy();
      expect(screen.getByText('Om du mår mycket dåligt')).toBeInTheDocument();
    });
    it('does not show crisis banner when no crisis messages', async () => {
      setupMocks({ chatHistory: { conversation: [
        { role: 'assistant', content: 'Allt är bra.', timestamp: new Date().toISOString() },
      ] } });
      const { container } = renderChat();
      await waitFor(() => expect(screen.getByText('Allt är bra.')).toBeInTheDocument());
      expect(container.querySelector('a[href="tel:112"]')).toBeNull();
      expect(screen.queryByText('Om du mår mycket dåligt')).not.toBeInTheDocument();
    });
  });

  describe('Footer crisis link', () => {
    it('renders clickable tel:90101 link in footer', async () => {
      const { container } = renderChat();
      await waitFor(() => expect(screen.getByPlaceholderText('Skriv ditt meddelande...')).toBeInTheDocument());
      const mindLinks = container.querySelectorAll('a[href="tel:90101"]');
      expect(mindLinks.length).toBeGreaterThanOrEqual(1);
      mindLinks.forEach(link => expect(link).toHaveAttribute('href', 'tel:90101'));
    });
  });

  describe('Error handling', () => {
    it('shows error fallback when onError callback fires', async () => {
      let onErrorCb: ((error: Error) => void) | null = null;
      useStreamingChatMock.mockImplementation((opts: { onError: (e: Error) => void }) => {
        onErrorCb = opts.onError;
        return { ...defaultStream, ...{ streamMessage: vi.fn().mockResolvedValue(undefined) } };
      });
      renderChat();
      await waitFor(() => expect(screen.getByPlaceholderText('Skriv ditt meddelande...')).toBeInTheDocument());
      await act(async () => { onErrorCb?.(new Error('stream failed')); });
      await waitFor(() => expect(screen.getByText('Något gick fel')).toBeInTheDocument());
    });
    it('handles 429 rate limit from server', async () => {
      const streamMessage = vi.fn().mockRejectedValue({ response: { status: 429 } });
      setupMocks({ streaming: { streamMessage } });
      renderChat();
      await waitFor(() => expect(screen.getByPlaceholderText('Skriv ditt meddelande...')).toBeInTheDocument());
      const ta = screen.getByPlaceholderText('Skriv ditt meddelande...');
      fireEvent.change(ta, { target: { value: 'Test' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Skicka' })); });
      await waitFor(() => expect(screen.getByText('Daglig gräns nådd')).toBeInTheDocument(), { timeout: 3000 });
    });
  });

  describe('Markdown rendering', () => {
    it('renders bold text in assistant messages', async () => {
      setupMocks({ chatHistory: { conversation: [
        { role: 'assistant', content: 'Det här är **viktigt**.', timestamp: new Date().toISOString() },
      ] } });
      renderChat();
      await waitFor(() => expect(screen.getByText('viktigt')).toBeInTheDocument());
    });
    it('renders bullet lists in assistant messages', async () => {
      setupMocks({ chatHistory: { conversation: [
        { role: 'assistant', content: '- Punkt 1\n- Punkt 2', timestamp: new Date().toISOString() },
      ] } });
      renderChat();
      await waitFor(() => {
        expect(screen.getByText('Punkt 1')).toBeInTheDocument();
        expect(screen.getByText('Punkt 2')).toBeInTheDocument();
      });
    });
  });
});
