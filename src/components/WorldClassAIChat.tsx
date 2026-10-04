import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PaperAirplaneIcon,
  XMarkIcon,
  SparklesIcon,
  UserIcon,
  ChatBubbleLeftRightIcon, // Changed to BubbleLeftRight for better semantics
  LockClosedIcon,
  HeartIcon,
  LightBulbIcon,
  FaceSmileIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  MicrophoneIcon,
  StopCircleIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAccessibility } from '../hooks/useAccessibility';
import { analytics } from '../services/analytics';
import { getChatHistory } from '../api/api';
import { closeChatSession } from '../api/ai';
import { clearDashboardCache } from '../hooks/useDashboardData';
import useAuth from '../hooks/useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import useStreamingChat from '../hooks/useStreamingChat';
import useChatCache from '../hooks/useChatCache';
import useErrorRecovery from '../hooks/useErrorRecovery';
import useVoiceInput from '../hooks/useVoiceInput';
import useTextToSpeech from '../hooks/useTextToSpeech';
import useMessagePagination from '../hooks/useMessagePagination';
import GradualReveal from './ui/GradualReveal';

import { logger } from '../utils/logger';

// ----------------------------------------------------------------------
// Types & Constants
// ----------------------------------------------------------------------

interface WorldClassAIChatProps {
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sentiment?: string | undefined;
  emotions?: string[] | undefined;
}

// ----------------------------------------------------------------------
// Markdown helpers — block + inline renderer, pure JSX (no innerHTML)
// ----------------------------------------------------------------------

function renderInline(text: string): React.ReactNode {
  // Priority: **bold** before *italic* before `code`
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let ki = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      // Sanitize bold text to prevent XSS
      parts.push(<strong key={ki++}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      // Sanitize italic text to prevent XSS
      parts.push(<em key={ki++}>{m[2]}</em>);
    } else {
      // Sanitize code content to prevent XSS - escape HTML entities
      const codeContent = m[3]
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      parts.push(
        <code key={ki++} className="bg-black/10 dark:bg-white/10 px-1 rounded-sm text-[0.8em] font-mono">
          {codeContent}
        </code>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    // Sanitize plain text to prevent XSS
    const plainText = text.slice(last)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    parts.push(plainText);
  }
  return <>{parts}</>;
}

const ChatMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let bk = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Unordered list: consecutive "- item" / "* item" lines
    if (/^[-*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(lines[i].slice(2).trim());
        i++;
      }
      blocks.push(
        <ul key={bk++} className="list-disc list-outside ml-4 space-y-0.5 my-1">
          {items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
        </ul>
      );
      continue;
    }

    // Ordered list: consecutive "1. item" lines
    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={bk++} className="list-decimal list-outside ml-4 space-y-0.5 my-1">
          {items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
        </ol>
      );
      continue;
    }

    // Empty line → thin spacer (skip consecutive)
    if (line.trim() === '') {
      if (blocks.length > 0) blocks.push(<div key={bk++} className="h-1.5" />);
      i++;
      continue;
    }

    // Text block: collect until next list / empty line
    const textLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^[-*•]\s/.test(lines[i]) &&
      !/^\d+[.)]\s/.test(lines[i])
    ) {
      textLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <span key={bk++}>
        {textLines.map((tl, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(tl)}
          </React.Fragment>
        ))}
      </span>
    );
  }

  return <>{blocks}</>;
};

// ----------------------------------------------------------------------
// Component: Message Bubble
// ----------------------------------------------------------------------

const MessageBubble: React.FC<{
  message: ChatMessage;
  isStreaming?: boolean;
  ttsSupported?: boolean;
  isSpeaking?: boolean;
  onSpeak?: () => void;
  onStopSpeak?: () => void;
}> = ({ message, isStreaming = false, ttsSupported = false, isSpeaking = false, onSpeak, onStopSpeak }) => {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const showSpeakButton = !isUser && !isStreaming && ttsSupported && (message.content?.trim().length ?? 0) > 0;

  return (
    <div
      className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
    >
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* Avatar */}
        <div className={`
          shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-xs
          ${isUser
            ? 'bg-linear-to-br from-indigo-500 to-purple-600'
            : 'bg-linear-to-br from-teal-400 to-emerald-600'}
        `}>
          {isUser ? (
            <UserIcon className="w-5 h-5 text-white" />
          ) : (
            <SparklesIcon className="w-5 h-5 text-white animate-pulse" />
          )}
        </div>

        {/* Bubble */}
        <div className={`
          relative p-4 md:p-5 rounded-2xl shadow-xs text-sm md:text-base leading-relaxed
          ${isUser
            ? 'bg-primary-600 text-white rounded-tr-sm'
            : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-gray-800 dark:text-gray-100 rounded-tl-sm border border-white/40 dark:border-white/10'}
        `}>
          {/* Use GradualReveal only during live streaming — never on history messages */}
          {!isUser && isStreaming ? (
            <GradualReveal
              text={message.content || ''}
              speed={20}
              className="text-gray-800 dark:text-gray-100"
              showCursor={true}
            />
          ) : !isUser ? (
            <ChatMarkdown text={message.content || ''} />
          ) : (
            message.content || ''
          )}

          {/* Speak button (AI only, after streaming completes) */}
          {showSpeakButton && (
            <button
              onClick={isSpeaking ? onStopSpeak : onSpeak}
              aria-label={isSpeaking ? t('aiChat.stopSpeaking') : t('aiChat.listenToMessage')}
              className={`absolute -bottom-2 -right-2 p-1.5 rounded-full shadow-md transition-all hover:scale-110 ${
                isSpeaking
                  ? 'bg-teal-500 text-white animate-pulse'
                  : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 border border-gray-200 dark:border-gray-600'
              }`}
            >
              {isSpeaking ? (
                <SpeakerXMarkIcon className="w-3.5 h-3.5" />
              ) : (
                <SpeakerWaveIcon className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Metadata / Sentiment Indicator (AI only) */}
          {!isUser && message.sentiment && !isStreaming && (
            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/50 animate-fade-in">
              <span className={`
                 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                 ${message.sentiment === 'POSITIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                  message.sentiment === 'NEGATIVE' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                  message.sentiment === 'crisis' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}
               `}>
                {message.sentiment === 'POSITIVE' && <FaceSmileIcon className="w-3 h-3" />}
                {message.sentiment === 'crisis' && <ExclamationTriangleIcon className="w-3 h-3" />}
                {message.sentiment === 'crisis' ? t('aiChat.crisis') : message.sentiment}
              </span>
              {message.emotions?.map(e => (
                <span key={e} className="text-xs text-gray-400 capitalize">{e}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

// Message ids are React keys. A timestamp alone repeats when two messages are
// created in the same millisecond (a user message and an immediate error).
let messageSeq = 0;
const nextMessageId = (prefix: 'ai' | 'err' | 'user'): string =>
  `${prefix}-${Date.now()}-${++messageSeq}`;

const WorldClassAIChat: React.FC<WorldClassAIChatProps> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const { canSendMessage, incrementChatMessage, getRemainingMessages, plan, isPremium } = useSubscription();
  const navigate = useNavigate();

  // Streaming hook - onComplete adds the completed AI message to messages state
  const { isStreaming, currentMessage, streamMessage, stopStreaming, clearStreamingMessage } = useStreamingChat({
    onComplete: (fullMessage, crisisDetected) => {
      if (fullMessage.trim()) {
        const aiMsg: ChatMessage = {
          id: nextMessageId('ai'),
          role: 'assistant',
          content: fullMessage,
          timestamp: new Date(),
          ...(crisisDetected ? { sentiment: 'crisis' } : {}),
        };
        setMessages(prev => [...prev, aiMsg]);
        addToCache([aiMsg]);
        clearDashboardCache();
      }
      clearStreamingMessage();
      // FIX: Increment here instead of after await streamMessage() in handleSendMessage
      // so the client-side counter only advances when the stream actually completes,
      // not when it's aborted by a new message.
      incrementChatMessage();
      announceToScreenReader(t('aiChat.newResponse'), 'polite');
    },
    onError: (error) => {
      logger.error('Streaming error:', error);
      clearStreamingMessage();
      setMessages(prev => [...prev, {
        id: nextMessageId('err'),
        role: 'assistant',
        content: t('aiChat.errorFallback'),
        timestamp: new Date()
      }]);
    }
  });

  // Map i18next language code to BCP-47 speech recognition locale
  const speechLang = i18n.language === 'en' ? 'en-US' : i18n.language === 'no' ? 'nb-NO' : 'sv-SE';

  // Voice input hook
  const { isListening, isSupported: voiceSupported, startListening, stopListening, transcript, clearTranscript } = useVoiceInput({
    onTranscript: (text) => {
      setInputMessage(text);
    },
    onError: (error) => {
      logger.error('Voice input error:', error);
      setVoiceError(error.message);
      // Auto-clear error after 5 seconds
      if (voiceErrorTimerRef.current) {
        clearTimeout(voiceErrorTimerRef.current);
      }
      voiceErrorTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setVoiceError(null);
        }
      }, 5000);
    },
    language: speechLang,
  });

  // Text-to-speech: read AI replies aloud on demand
  const {
    isSupported: ttsSupported,
    speakingId,
    speak: speakMessage,
    stop: stopSpeaking,
  } = useTextToSpeech({ language: speechLang });

  const { 
    isLoaded: _cacheLoaded, 
    getCachedMessages, 
    addToCache, 
    syncWithServer 
  } = useChatCache(user?.user_id || '');

  const { 
    isOnline, 
    isRecovering, 
    executeWithRecovery,
  } = useErrorRecovery({
    maxRetries: 3,
    retryDelay: 1000
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const voiceErrorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Single cleanup effect: unmount safety + voice error timer cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (voiceErrorTimerRef.current) {
        clearTimeout(voiceErrorTimerRef.current);
      }
    };
  }, []);

  // Pagination - feeds from full messages array, shows latest 50, loads older on scroll up
  const {
    displayedMessages,
    isLoading: paginationLoading,
    hasMore: hasMoreMessages,
    loadMore,
    loadingRef,
  } = useMessagePagination(messages, { pageSize: 20, initialLoadCount: 50 });

  const canSendMore = canSendMessage();
  const remainingMessages = getRemainingMessages();
  const hasChatLimit = plan.limits.chatMessagesPerDay !== -1;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadChatHistory = useCallback(async () => {
    if (!user?.user_id) { setLoading(false); return; }
    // getCachedMessages() guards isLoaded internally — returns [] until cache is ready,
    // so we always fall through to the server fetch without any artificial delay.

    try {
      // First, load from cache for instant display
      const cachedMessages = getCachedMessages();
      if (cachedMessages.length > 0 && isMountedRef.current) {
        setMessages(cachedMessages);
        setLoading(false);
      } else if (isMountedRef.current) {
        // No cached messages but we're mounted - clear loading anyway
        setLoading(false);
      }

      // Then fetch from server and sync
      await executeWithRecovery('load-chat-history', async () => {
        const historyResponse = await getChatHistory(user.user_id);
        
        // Only update state if component is still mounted
        if (!isMountedRef.current) return [];
        
        const history = historyResponse?.conversation || [];
        const formatted: ChatMessage[] = (history || []).map((msg: { timestamp?: unknown; role?: string; content?: string }, i: number) => {
          // Helper to safely parse timestamp
          const ts = msg?.timestamp;
          let timestamp: Date | null = null;
          if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
            timestamp = (ts as { toDate: () => Date }).toDate();
          } else if (typeof ts === 'string' || typeof ts === 'number') {
            const parsed = new Date(ts);
            timestamp = isNaN(parsed.getTime()) ? null : parsed;
          }

          // Skip entries with invalid timestamps
          if (!timestamp) {
            return null;
          }

          const sentimentValue = msg?.crisis_detected ? 'crisis' : (msg?.sentiment as string | undefined);
          // Use stable ID derived from timestamp+role+index to prevent collisions
          const stableId = `srv-${msg?.role}-${timestamp.getTime()}-${i}`;
          return {
            id: stableId,
            role: msg?.role === 'user' ? 'user' : 'assistant',
            content: (msg?.content as string) || (msg?.message as string) || '',
            timestamp,
            // Backend saves crisis_detected (boolean), frontend uses sentiment: 'crisis' for display
            ...(sentimentValue ? { sentiment: sentimentValue } : {}),
            ...(msg?.emotions ? { emotions: msg?.emotions as string[] } : {}),
          };
        }).filter((msg): msg is ChatMessage => msg !== null);

        // Sync with cache
        await syncWithServer(formatted);
        
        // Update messages with server data only if still mounted
        if (isMountedRef.current) {
          setMessages(formatted);
        }
        
        return formatted;
      });
    } catch (e) {
      logger.error('Failed to load chat history:', e instanceof Error ? e.message : String(e));
      if (isMountedRef.current) {
        setNetworkError(isOnline ? t('aiChat.errorFallback') : t('aiChat.offlineMode'));
      }
    } finally {
      if (isMountedRef.current) setLoading(false); 
    }
  }, [user, getCachedMessages, isMountedRef, executeWithRecovery, isOnline, t, syncWithServer]);

  // Load History
  useEffect(() => {
    analytics.page('World Class AI Chat', { component: 'WorldClassAIChat' });
    loadChatHistory();
    announceToScreenReader(t('aiChat.welcomeMessage'), 'polite');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom on initial load after messages are loaded
  useEffect(() => {
    if (!loading && messages.length > 0) {
      const scrollTimer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return () => clearTimeout(scrollTimer);
    }
  }, [loading, messages.length]);

  // Safety timeout: always clear loading after 5 seconds max to prevent infinite spinner
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setLoading(current => {
          if (current) {
            logger.warn('Loading safety timeout triggered - forcing loading state to false');
            return false;
          }
          return current;
        });
      }
    }, 5000); // 5 second max loading time

    return () => clearTimeout(safetyTimer);
  }, []);

  // Auto-scroll - also triggers on currentMessage so streaming text scrolls live
  useEffect(() => {
    // Use setTimeout to ensure DOM has updated before scrolling
    const scrollTimer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [messages, isTyping, currentMessage?.content]);

  const handleSendMessage = useCallback(async () => {
    // Use transcript from voice if available, otherwise typed input
    const messageText = (isListening ? transcript : inputMessage).trim();
    if (!messageText || !user?.user_id) return;
    if (!canSendMore) {
      setLimitError(t('aiChat.limitReached'));
      return;
    }

    // Stop voice listening and clear transcript
    if (isListening) {
      stopListening();
      clearTranscript();
    }

    const userMsg: ChatMessage = {
      id: nextMessageId('user'),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    // Add user message to state and cache
    setMessages(prev => [...prev, userMsg]);
    addToCache([userMsg]);
    setInputMessage('');
    setIsTyping(true);
    setNetworkError(null);
    
    analytics.track('AI Chat Message Sent', { 
      length: userMsg.content.length,
      isOnline 
    });

    try {
      // Use real SSE streaming against /chatbot/chat/stream
      // onComplete callback handles adding message to state + cache + incrementChatMessage
      await streamMessage(user.user_id, userMsg.content, messages);
    } catch (error: unknown) {
      if ((error instanceof Error && error.message === 'Daily limit reached') || 
          (error as { response?: { status?: number } })?.response?.status === 429) {
        setLimitError(t('aiChat.dailyLimitReached'));
      } else {
        logger.error('Send message error:', error);
        if (!isOnline) {
          setNetworkError(t('aiChat.messageQueued'));
        }
      }
    } finally {
      if (isMountedRef.current) setIsTyping(false);
    }
  }, [isListening, transcript, inputMessage, user, canSendMore, t, stopListening, clearTranscript, addToCache, isOnline, streamMessage, messages, isMountedRef]);

  const quickSuggestions = [
    { text: t('aiChat.suggestions.stressed'), icon: <HeartIcon className="w-4 h-4" /> },
    { text: t('aiChat.suggestions.motivation'), icon: <LightBulbIcon className="w-4 h-4" /> },
    { text: t('aiChat.suggestions.sleep'), icon: <SparklesIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-1050 flex items-center justify-center p-0 md:p-6 bg-black/40 backdrop-blur-xs">
      {/* Main Container - The "Sanctuary" */}
      <div className="w-full h-full md:h-[85vh] md:max-w-4xl bg-[#fdfbf7] dark:bg-slate-950 rounded-none md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">

        {/* Ambient Background Glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-200/20 rounded-full blur-[100px] pointer-events-none animate-pulse-slow z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-200/20 rounded-full blur-[80px] pointer-events-none animate-pulse-slow z-0" style={{ animationDelay: '2s' }} />

        {/* Header */}
        <div className="sticky top-0 z-30 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-linear-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 shrink-0">
              <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 font-display truncate">{t('aiChat.sanctuary')}</h1>
              <div className="text-[10px] sm:text-xs text-teal-700 dark:text-teal-300 font-medium uppercase tracking-wider flex items-center gap-2">
                {isTyping || isStreaming ? t('aiChat.thinking') : t('aiChat.alwaysHere')}
                {!isOnline && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <WifiIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span className="hidden sm:inline">{t('aiChat.offline')}</span>
                  </span>
                )}
                {isRecovering && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="hidden sm:inline">{t('aiChat.reconnecting')}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {hasChatLimit && (
              <div className="hidden sm:flex px-2 sm:px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400">
                {remainingMessages > 0 ? t('aiChat.messagesLeft', { count: remainingMessages }) : t('aiChat.limitReached')}
              </div>
            )}
            <button
              onClick={() => {
                // BUG 5 FIX: Stop any in-flight stream before closing to prevent
                // backend/OpenAI resources from lingering after the UI is gone.
                stopStreaming();
                try { stopSpeaking(); } catch { /* ignore */ }
                void closeChatSession();
                onClose();
              }}
              aria-label={t('common.close')}
              className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors shrink-0"
            >
              <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 custom-scrollbar scroll-smooth relative z-10 scroll-container" id="chat-scroll-container">
          {loading ? (
            <div className="flex items-center justify-center h-full flex-col gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin" />
              <p className="text-xs sm:text-sm text-gray-400 animate-pulse">{t('aiChat.opening')}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto animate-fade-in-up px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-linear-to-tr from-teal-50 to-emerald-50 dark:from-slate-800 dark:to-slate-800 rounded-4xl flex items-center justify-center mb-4 sm:mb-6 shadow-xs rotate-3">
                <ChatBubbleLeftRightIcon className="w-8 h-8 sm:w-10 sm:h-10 text-teal-600 dark:text-teal-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t('aiChat.welcomeHome')}</h2>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 leading-relaxed">
                {t('aiChat.welcomeText')}
              </p>

              <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                {quickSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInputMessage(s.text)}
                    aria-label={s.text}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-xs hover:shadow-md hover:border-teal-300 dark:hover:border-teal-700 transition-all transform hover:-translate-y-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-300"
                  >
                    {s.icon} <span className="hidden sm:inline">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Load older messages trigger (IntersectionObserver target) */}
              {hasMoreMessages && (
                <div ref={loadingRef} className="flex justify-center py-3">
                  {paginationLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <div className="w-3 h-3 border border-gray-300 border-t-teal-500 rounded-full animate-spin" />
                      {t('aiChat.loadingOlder')}
                    </div>
                  ) : (
                    <button
                      onClick={loadMore}
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      {t('aiChat.loadOlder')}
                    </button>
                  )}
                </div>
              )}

              {displayedMessages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={false}
                  ttsSupported={ttsSupported}
                  isSpeaking={speakingId === msg.id}
                  onSpeak={() => speakMessage(msg.content, msg.id)}
                  onStopSpeak={stopSpeaking}
                />
              ))}

              {/* Streaming message */}
              {currentMessage && (
                <MessageBubble 
                  message={{
                    id: currentMessage.id,
                    role: 'assistant',
                    content: currentMessage.content,
                    timestamp: currentMessage.timestamp
                  }} 
                  isStreaming={!currentMessage.isComplete}
                />
              )}

              {/* Network error notification */}
              {networkError && (
                <div className="flex justify-center mb-4 sm:mb-6 animate-fade-in-up">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 max-w-md">
                    <ExclamationTriangleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">{networkError}</p>
                  </div>
                </div>
              )}

              {/* Crisis escalation banner — shown when any message has crisis sentiment */}
              {displayedMessages.some(m => m.sentiment === 'crisis') && (
                <div className="flex justify-center mb-4 sm:mb-6 animate-fade-in-up">
                  <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-600 rounded-xl p-3 sm:p-4 max-w-md w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                      <h3 className="font-bold text-red-700 dark:text-red-400 text-sm sm:text-base">
                        {t('aiChat.crisisTitle', { defaultValue: 'Om du mår mycket dåligt' })}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a href="tel:112" className="flex items-center justify-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm">
                        <span>📞</span> {t('aiChat.crisisSos', { defaultValue: 'SOS Alarm: 112' })}
                      </a>
                      <a href="tel:90101" className="flex items-center justify-center gap-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg font-semibold hover:bg-red-200 transition-colors text-sm">
                        <span>💙</span> {t('aiChat.crisisMind', { defaultValue: 'Mind: 90101 (dygnet runt)' })}
                      </a>
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                      {t('aiChat.crisisDisclaimer', { defaultValue: 'Lugn & Trygg ersätter inte professionell vård. Sök hjälp om du mår dåligt.' })}
                    </p>
                  </div>
                </div>
              )}

              {isTyping && !isStreaming && (
                <div className="flex justify-start mb-4 sm:mb-6 animate-fade-in-up">
                  <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-3 rounded-2xl rounded-tl-sm border border-white/40 shadow-xs flex items-center gap-1.5 ml-8 sm:ml-12">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="relative z-20 p-3 sm:p-4 md:p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-t border-white/20 dark:border-white/5">
          {limitError && (
            <div className="absolute -top-10 sm:-top-12 left-0 w-full px-4 sm:px-6 flex justify-center animate-fade-in-up">
              <div className="bg-rose-100 text-rose-700 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-sm font-medium shadow-xs">
                {limitError}
              </div>
            </div>
          )}
          {voiceError && (
            <div className="absolute -top-10 sm:-top-12 left-0 w-full px-4 sm:px-6 flex justify-center animate-fade-in-up">
              <div className="bg-amber-100 text-amber-700 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-sm font-medium shadow-xs">
                {voiceError}
              </div>
            </div>
          )}

          <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
            {/* Voice input button — premium feature with gate for free users */}
            {voiceSupported && (
              isPremium ? (
                <button
                  onClick={() => {
                    if (isListening) {
                      stopListening();
                      if (transcript) {
                        setInputMessage(transcript);
                        clearTranscript();
                      }
                    } else {
                      clearTranscript();
                      startListening();
                    }
                  }}
                  aria-label={isListening ? t('aiChat.stopRecording') : t('aiChat.startRecording')}
                  className={`shrink-0 p-2 sm:p-3 rounded-full transition-all min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] flex items-center justify-center ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {isListening ? (
                    <StopCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              ) : (
                /*
                  This was a <div> with a title and no handler: a control that
                  looks disabled, is not in the tab order, and does nothing at
                  all when pressed. The title is the only explanation offered,
                  and titles do not appear on touch — which is where most of
                  these users are.

                  It is the upsell for a paid feature, so it should sell: a real
                  button that goes to /upgrade, the same destination every other
                  premium prompt in the app uses.
                */
                <button
                  type="button"
                  onClick={() => navigate('/upgrade')}
                  className="shrink-0 p-2 sm:p-3 rounded-full min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors relative focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500"
                  aria-label={t('aiChat.voicePremiumAction', { defaultValue: 'Röst är en Premium-funktion — uppgradera' })}
                  title={t('aiChat.voicePremium', { defaultValue: 'Röst är en Premium-funktion' })}
                >
                  <MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[8px] font-bold bg-amber-400 text-amber-900 rounded-full">PRO</span>
                </button>
              )
            )}

            <textarea
              ref={inputRef}
              rows={1}
              value={isListening ? transcript : inputMessage}
              onChange={(e) => { if (!isListening) setInputMessage(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              placeholder={isListening ? t('aiChat.listening') : !isOnline ? t('aiChat.offlinePlaceholder') : t('aiChat.inputPlaceholder')}
              aria-label={!isOnline ? t('aiChat.offlinePlaceholder') : t('aiChat.inputPlaceholder')}
              disabled={!canSendMore || isTyping || isStreaming}
              readOnly={isListening}
              className="w-full pl-4 sm:pl-6 pr-12 sm:pr-14 py-2.5 sm:py-4 bg-white dark:bg-slate-800 border-0 rounded-3xl sm:rounded-4xl shadow-lg ring-1 ring-gray-100 dark:ring-gray-700 focus:ring-2 focus:ring-teal-500/50 transition-all resize-none text-sm sm:text-base text-gray-700 dark:text-gray-200 placeholder-gray-400 min-h-11 sm:min-h-14 max-h-24 sm:max-h-32 disabled:opacity-60"
            />

            <div className="absolute right-1.5 sm:right-2 bottom-1.5 sm:bottom-2">
              <button
                onClick={handleSendMessage}
                disabled={(!inputMessage.trim() && !transcript) || !canSendMore || isTyping || isStreaming}
                aria-label={t('aiChat.send')}
                className={`p-2 sm:p-3 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50 ${
                  !isOnline
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-gray-900 hover:bg-black dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
                }`}
              >
                {!isOnline ? (
                  <WifiIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : canSendMore ? (
                  <PaperAirplaneIcon className="w-4 h-4 sm:w-5 sm:h-5 -rotate-90 translate-x-px" />
                ) : (
                  <LockClosedIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="text-center mt-2 sm:mt-3 space-y-1">
            <span className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
              {t('aiChat.footer')}
            </span>
            <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 leading-snug max-w-xs mx-auto">
              {t('aiChat.disclaimer')}{' '}
              <a href="tel:90101" className="text-teal-600 dark:text-teal-400 font-medium hover:underline">
                {t('aiChat.mindHelpline', { defaultValue: 'Mind: 90101' })}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldClassAIChat;
