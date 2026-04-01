import React, { useState, useEffect, useRef } from 'react';
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
  StopCircleIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../hooks/useAccessibility';
import { analytics } from '../services/analytics';
import { getChatHistory } from '../api/api';
import { clearDashboardCache } from '../hooks/useDashboardData';
import useAuth from '../hooks/useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import useStreamingChat from '../hooks/useStreamingChat';
import useChatCache from '../hooks/useChatCache';
import useErrorRecovery from '../hooks/useErrorRecovery';
import useVoiceInput from '../hooks/useVoiceInput';
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
  sentiment?: string;
  emotions?: string[];
}

// ----------------------------------------------------------------------
// Component: Message Bubble
// ----------------------------------------------------------------------

const MessageBubble: React.FC<{ 
  message: ChatMessage; 
  isLast: boolean; 
  isStreaming?: boolean;
}> = ({ message, isLast, isStreaming = false }) => {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
    >
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-sm
          ${isUser
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
            : 'bg-gradient-to-br from-teal-400 to-emerald-600'}
        `}>
          {isUser ? (
            <UserIcon className="w-5 h-5 text-white" />
          ) : (
            <SparklesIcon className="w-5 h-5 text-white animate-pulse" />
          )}
        </div>

        {/* Bubble */}
        <div className={`
          relative p-4 md:p-5 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed
          ${isUser
            ? 'bg-primary-600 text-white rounded-tr-sm'
            : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-gray-800 dark:text-gray-100 rounded-tl-sm border border-white/40 dark:border-white/10'}
        `}>
          {/* Use GradualReveal for AI messages */}
          {!isUser && (isStreaming || isLast) ? (
            <GradualReveal 
              text={message.content} 
              speed={20}
              className="text-gray-800 dark:text-gray-100"
              showCursor={isStreaming}
            />
          ) : (
            message.content
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
                {message.sentiment === 'crisis' ? 'KRIS' : message.sentiment}
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

const WorldClassAIChat: React.FC<WorldClassAIChatProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const { canSendMessage, incrementChatMessage, getRemainingMessages, plan } = useSubscription();

  // Streaming hook - onComplete adds the completed AI message to messages state
  const { isStreaming, currentMessage, streamMessage, clearStreamingMessage } = useStreamingChat({
    onComplete: (fullMessage, crisisDetected) => {
      if (fullMessage.trim()) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
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
      announceToScreenReader(t('aiChat.newResponse'), 'polite');
    },
    onError: (error) => {
      logger.error('Streaming error:', error);
      clearStreamingMessage();
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: t('aiChat.errorFallback'),
        timestamp: new Date()
      }]);
    }
  });

  // Voice input hook
  const { isListening, isSupported: voiceSupported, startListening, stopListening, transcript, clearTranscript } = useVoiceInput({
    onTranscript: (text) => {
      setInputMessage(text);
    },
    language: 'sv-SE'
  });

  const { 
    isLoaded: cacheLoaded, 
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
  const isMountedRef = useRef(true);

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load History
  useEffect(() => {
    analytics.page('World Class AI Chat', { component: 'WorldClassAIChat' });
    loadChatHistory();
    announceToScreenReader(t('aiChat.welcomeMessage'), 'polite');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll - also triggers on currentMessage so streaming text scrolls live
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, currentMessage?.content]);

  const loadChatHistory = async () => {
    if (!user?.user_id) { setLoading(false); return; }
    
    // Wait for cache to load
    if (!cacheLoaded) return;

    try {
      // First, load from cache for instant display
      const cachedMessages = getCachedMessages();
      if (cachedMessages.length > 0 && isMountedRef.current) {
        setMessages(cachedMessages);
        setLoading(false);
      }

      // Then fetch from server and sync
      await executeWithRecovery('load-chat-history', async () => {
        const historyResponse = await getChatHistory(user.user_id);
        
        // Only update state if component is still mounted
        if (!isMountedRef.current) return [];
        
        const history = historyResponse?.conversation || [];
        const formatted: ChatMessage[] = (history || []).map((msg: any, i: number) => ({
          id: `history-${i}`,
          role: msg?.role === 'user' ? 'user' : 'assistant',
          content: msg?.content || msg?.message || '',
          timestamp: new Date(msg?.timestamp?.toDate?.() || msg?.timestamp || Date.now()),
          sentiment: msg?.sentiment,
          emotions: msg?.emotions,
        }));

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
      if (!isOnline) {
        setNetworkError(t('aiChat.offlineMode'));
      }
    } finally { 
      setLoading(false); 
    }
  };

  const handleSendMessage = async () => {
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
      id: `user-${Date.now()}`,
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
      await streamMessage(user.user_id, userMsg.content, messages);
      // onComplete callback handles adding message to state + cache
      incrementChatMessage();
    } catch (error: any) {
      if (error?.response?.status === 429 || (error as any)?.message === 'Daily limit reached') {
        setLimitError(t('aiChat.dailyLimitReached'));
      } else {
        logger.error('Send message error:', error);
        if (!isOnline) {
          setNetworkError(t('aiChat.messageQueued'));
        }
      }
    } finally {
      setIsTyping(false);
    }
  };

  const quickSuggestions = [
    { text: t('aiChat.suggestions.stressed'), icon: <HeartIcon className="w-4 h-4" /> },
    { text: t('aiChat.suggestions.motivation'), icon: <LightBulbIcon className="w-4 h-4" /> },
    { text: t('aiChat.suggestions.sleep'), icon: <SparklesIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center p-0 md:p-6 bg-black/40 backdrop-blur-sm">
      {/* Main Container - The "Sanctuary" */}
      <div className="w-full h-full md:h-[85vh] md:max-w-4xl bg-[#fdfbf7] dark:bg-slate-950 rounded-none md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">

        {/* Ambient Background Glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-200/20 rounded-full blur-[100px] pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-200/20 rounded-full blur-[80px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '2s' }} />

        {/* Header */}
        <div className="relative z-10 px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <SparklesIcon className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-display">{t('aiChat.sanctuary')}</h1>
              <p className="text-xs text-teal-600 dark:text-teal-400 font-medium uppercase tracking-wider flex items-center gap-2">
                {isTyping || isStreaming ? t('aiChat.thinking') : t('aiChat.alwaysHere')}
                {!isOnline && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <WifiIcon className="w-3 h-3" />
                    Offline
                  </span>
                )}
                {isRecovering && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Återansluter...
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChatLimit && (
              <div className="hidden sm:flex px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400">
                {remainingMessages > 0 ? t('aiChat.messagesLeft', { count: remainingMessages }) : t('aiChat.limitReached')}
              </div>
            )}
            <button onClick={onClose} aria-label={t('common.close')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <XMarkIcon className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth relative z-10">
          {loading ? (
            <div className="flex items-center justify-center h-full flex-col gap-4">
              <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin" />
              <p className="text-gray-400 animate-pulse">{t('aiChat.opening')}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto animate-fade-in-up">
              <div className="w-20 h-20 bg-gradient-to-tr from-teal-50 to-emerald-50 dark:from-slate-800 dark:to-slate-800 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm rotate-3">
                <ChatBubbleLeftRightIcon className="w-10 h-10 text-teal-600 dark:text-teal-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t('aiChat.welcomeHome')}</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                {t('aiChat.welcomeText')}
              </p>

              <div className="flex flex-wrap gap-3 justify-center">
                {quickSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInputMessage(s.text)}
                    aria-label={s.text}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:shadow-md hover:border-teal-300 dark:hover:border-teal-700 transition-all transform hover:-translate-y-0.5 text-sm text-gray-600 dark:text-gray-300"
                  >
                    {s.icon} {s.text}
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
                      Laddar äldre meddelanden...
                    </div>
                  ) : (
                    <button
                      onClick={loadMore}
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      Ladda äldre meddelanden
                    </button>
                  )}
                </div>
              )}

              {displayedMessages.map((msg, i) => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isLast={i === displayedMessages.length - 1} 
                  isStreaming={false}
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
                  isLast={true}
                  isStreaming={!currentMessage.isComplete}
                />
              )}

              {/* Network error notification */}
              {networkError && (
                <div className="flex justify-center mb-6 animate-fade-in-up">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-center gap-2 max-w-md">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">{networkError}</p>
                  </div>
                </div>
              )}

              {isTyping && !isStreaming && (
                <div className="flex justify-start mb-6 animate-fade-in-up">
                  <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-4 py-3 rounded-2xl rounded-tl-sm border border-white/40 shadow-sm flex items-center gap-1.5 ml-12">
                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="relative z-20 p-4 md:p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-t border-white/20 dark:border-white/5">
          {limitError && (
            <div className="absolute top-[-3rem] left-0 w-full px-6 flex justify-center animate-fade-in-up">
              <div className="bg-rose-100 text-rose-700 px-4 py-1.5 rounded-full text-sm font-medium shadow-sm">
                {limitError}
              </div>
            </div>
          )}

          <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
            {/* Voice input button (mobile-first, only if browser supports it) */}
            {voiceSupported && (
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
                aria-label={isListening ? 'Stoppa röstinspelning' : 'Starta röstinspelning'}
                className={`flex-shrink-0 p-3 rounded-full transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {isListening ? (
                  <StopCircleIcon className="w-5 h-5" />
                ) : (
                  <MicrophoneIcon className="w-5 h-5" />
                )}
              </button>
            )}

            <textarea
              ref={inputRef}
              rows={1}
              value={isListening ? transcript : inputMessage}
              onChange={(e) => { if (!isListening) setInputMessage(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              placeholder={isListening ? '🎤 Lyssnar...' : !isOnline ? t('aiChat.offlinePlaceholder') : t('aiChat.inputPlaceholder')}
              aria-label={!isOnline ? t('aiChat.offlinePlaceholder') : t('aiChat.inputPlaceholder')}
              disabled={!canSendMore || (isTyping && !isStreaming)}
              readOnly={isListening}
              className="w-full pl-6 pr-14 py-4 bg-white dark:bg-slate-800 border-0 rounded-[2rem] shadow-lg ring-1 ring-gray-100 dark:ring-gray-700 focus:ring-2 focus:ring-teal-500/50 transition-all resize-none text-gray-700 dark:text-gray-200 placeholder-gray-400 min-h-[3.5rem] max-h-32 disabled:opacity-60"
            />

            <div className="absolute right-2 bottom-2">
              <button
                onClick={handleSendMessage}
                disabled={(!inputMessage.trim() && !transcript) || !canSendMore || (isTyping && !isStreaming)}
                aria-label={t('aiChat.send', 'Skicka meddelande')}
                className={`p-3 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50 ${
                  !isOnline
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-gray-900 hover:bg-black dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
                }`}
              >
                {!isOnline ? (
                  <WifiIcon className="w-5 h-5" />
                ) : canSendMore ? (
                  <PaperAirplaneIcon className="w-5 h-5 -rotate-90 translate-x-[1px]" />
                ) : (
                  <LockClosedIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="text-center mt-3">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
              {t('aiChat.footer')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldClassAIChat;
