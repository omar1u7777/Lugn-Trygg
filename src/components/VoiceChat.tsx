import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, Typography, Button, Input, Avatar } from './ui/tailwind';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import { blobToBase64, transcribeVoiceAudio, analyzeVoiceEmotionDetailed, AnalyzeVoiceEmotionResponse, saveVoiceRecording } from '../api/voice';
import { chatWithAI } from '../api/ai';
import useAuth from '../hooks/useAuth';
import { useMountedRef } from '../hooks/useMountedRef';
import { MicrophoneIcon, PaperAirplaneIcon, StopIcon, ExclamationTriangleIcon, HeartIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';

// ─── Psychological emotion profiles (evidence-based, i18n labels) ────────
interface EmotionProfile {
  emoji: string;
  color: string;
  bgColor: string;
  crisisLevel: 0 | 1 | 2;
}

const EMOTION_PROFILES: Record<string, EmotionProfile> = {
  happy: {
    emoji: '😊',
    color: '#16a34a',
    bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    crisisLevel: 0,
  },
  sad: {
    emoji: '😢',
    color: '#2563eb',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    crisisLevel: 1,
  },
  anxious: {
    emoji: '😰',
    color: '#d97706',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    crisisLevel: 1,
  },
  angry: {
    emoji: '😠',
    color: '#dc2626',
    bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    crisisLevel: 0,
  },
  fearful: {
    emoji: '😨',
    color: '#7c3aed',
    bgColor: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',
    crisisLevel: 2,
  },
  neutral: {
    emoji: '😐',
    color: '#4b5563',
    bgColor: 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600',
    crisisLevel: 0,
  },
  surprised: {
    emoji: '😮',
    color: '#0891b2',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
    crisisLevel: 0,
  },
  disgusted: {
    emoji: '🤢',
    color: '#65a30d',
    bgColor: 'bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800',
    crisisLevel: 0,
  },
  frustrated: {
    emoji: '😤',
    color: '#ea580c',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    crisisLevel: 0,
  },
};

const getEmotionProfile = (emotion: string): EmotionProfile | undefined => {
  return EMOTION_PROFILES[emotion] ?? EMOTION_PROFILES.neutral;
};


interface VoiceChatProps {
  onMessageSent?: (message: string, isVoice: boolean) => void;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isVoice?: boolean;
  emotionContext?: string | undefined;
}

const MAX_RECORDING_SECONDS = 300; // 5 minutes hard limit
const MAX_AUDIO_MB = 9; // Leave margin below backend 10 MB limit

const VoiceChat: React.FC<VoiceChatProps> = ({ onMessageSent }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'no' ? 'nb-NO' : i18n.language === 'en' ? 'en-US' : 'sv-SE';
  const voiceLanguage = i18n.language === 'no' ? 'no-NO' : i18n.language === 'en' ? 'en-US' : 'sv-SE';
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const isMountedRef = useMountedRef();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: t('voiceChat.welcomeMessage'),
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [emotionResult, setEmotionResult] = useState<AnalyzeVoiceEmotionResponse | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const [processingStep, setProcessingStep] = useState<'idle' | 'transcribing' | 'analyzing' | 'done'>('idle');

  const quickActions = useMemo(() => [
    t('voiceChat.quickActions.stressed'),
    t('voiceChat.quickActions.mindfulness'),
    t('voiceChat.quickActions.calmStory'),
    t('voiceChat.quickActions.sleep'),
    t('voiceChat.quickActions.anxious'),
    t('voiceChat.quickActions.understandEmotions'),
  ], [t]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const processVoiceMessageRef = useRef<(blob: Blob) => Promise<void>>(async () => {});

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>): Message | null => {
    if (!isMountedRef.current) return null;
    const newMessage: Message = {
      ...message,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, [isMountedRef]);

  const cleanupRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        logger.warn('MediaRecorder stop error during cleanup:', e);
      }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    audioChunksRef.current = [];
    if (isMountedRef.current) setIsRecording(false);
  }, [isMountedRef]);

  const cleanupPendingRequests = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRecording();
      cleanupPendingRequests();
    };
  }, [cleanupRecording, cleanupPendingRequests]);

  useEffect(() => {
    analytics.page('Voice Chat', { component: 'VoiceChat' });
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;

    cleanupPendingRequests();
    abortControllerRef.current = new AbortController();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
      });
      streamRef.current = stream;

      // Choose best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onerror = (event) => {
        logger.error('MediaRecorder error:', event);
        cleanupRecording();
        addMessage({
          text: t('voiceChat.recordingError'),
          isUser: false,
        });
        announceToScreenReader(t('voiceChat.recordingError'), 'assertive');
      };

      mediaRecorder.onstop = async () => {
        if (maxDurationTimerRef.current) {
          clearTimeout(maxDurationTimerRef.current);
          maxDurationTimerRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        if (audioBlob.size === 0) {
          addMessage({
            text: t('voiceChat.emptyRecording'),
            isUser: false,
          });
          if (isMountedRef.current) {
            setIsProcessing(false);
            setIsRecording(false);
          }
          return;
        }

        if (audioBlob.size > MAX_AUDIO_MB * 1024 * 1024) {
          addMessage({
            text: t('voiceChat.recordingTooLarge', { max: MAX_AUDIO_MB }),
            isUser: false,
          });
          if (isMountedRef.current) {
            setIsProcessing(false);
            setIsRecording(false);
          }
          return;
        }

        await processVoiceMessageRef.current(audioBlob);
      };

      mediaRecorder.start(250); // collect data every 250 ms
      if (isMountedRef.current) {
        setIsRecording(true);
        setRecordingSeconds(0);
      }
      setEmotionResult(null);
      setLastTranscript('');
      setProcessingStep('idle');

      // Recording timer
      timerRef.current = setInterval(() => {
        if (isMountedRef.current) setRecordingSeconds((s) => s + 1);
      }, 1000);

      // Hard max duration guard
      maxDurationTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          try {
            mediaRecorderRef.current.stop();
          } catch (e) {
            logger.warn('MediaRecorder auto-stop error:', e);
          }
          cleanupRecording();
          addMessage({
            text: t('voiceChat.autoStopped', { seconds: MAX_RECORDING_SECONDS }),
            isUser: false,
          });
        }
      }, MAX_RECORDING_SECONDS * 1000);

      announceToScreenReader(t('voiceChat.recordingStarted'), 'polite');
      analytics.track('Voice Recording Started', { component: 'VoiceChat' });

    } catch (error) {
      logger.error('Error starting recording:', error);
      addMessage({
        text: t('voiceChat.recordingStartError'),
        isUser: false,
      });
      announceToScreenReader(t('voiceChat.recordingStartErrorAria'), 'assertive');
      cleanupRecording();
    }
  }, [isRecording, isProcessing, cleanupPendingRequests, addMessage, isMountedRef, cleanupRecording, announceToScreenReader, t]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    // Stop timer immediately for UI responsiveness, but don't clear audioChunksRef —
    // the async onstop handler needs them to build the Blob.
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      if (isMountedRef.current) setIsProcessing(true);
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        logger.warn('MediaRecorder stop error:', e);
      }
    }
    // setIsRecording(false) is deferred to onstop → processVoiceMessage → finally block,
    // so the recording state stays consistent until processing completes.
    announceToScreenReader(t('voiceChat.recordingStopped'), 'polite');
    analytics.track('Voice Recording Stopped', { component: 'VoiceChat' });
  }, [isRecording, isMountedRef, announceToScreenReader, t]);

  const processVoiceMessage = useCallback(async (audioBlob: Blob) => {
    if (isMountedRef.current) {
      setIsProcessing(true);
      setProcessingStep('transcribing');
    }
    announceToScreenReader(t('voiceChat.processingVoice'), 'polite');

    let transcribedText = '';
    let detectedEmotion: AnalyzeVoiceEmotionResponse | null = null;

    try {
      // Convert blob to base64 (what the backend expects)
      const base64Audio = await blobToBase64(audioBlob);

      // Step 1: Transcribe with Google Cloud STT
      try {
        const transcriptionResult = await transcribeVoiceAudio(base64Audio, voiceLanguage);
        if (transcriptionResult.transcript) {
          transcribedText = transcriptionResult.transcript;
          logger.debug('✅ Transcription success:', transcribedText.substring(0, 60));
        }
      } catch (sttErr) {
        logger.error('STT error:', sttErr);
      }

      // Step 2: Analyse voice emotion (with transcript for multimodal fusion)
      if (isMountedRef.current) setProcessingStep('analyzing');
      try {
        detectedEmotion = await analyzeVoiceEmotionDetailed(base64Audio, transcribedText || undefined);
        if (isMountedRef.current) {
          setEmotionResult(detectedEmotion);
          setLastTranscript(transcribedText);
        }
        analytics.track('Voice Emotion Detected', {
          component: 'VoiceChat',
          primaryEmotion: detectedEmotion.primaryEmotion,
          energyLevel: detectedEmotion.energyLevel,
          speakingPace: detectedEmotion.speakingPace,
        });
      } catch (emoErr) {
        logger.warn('Emotion analysis error (non-fatal):', emoErr);
      }

      if (isMountedRef.current) setProcessingStep('done');

      // If no transcript, show a single instructive error and stop
      if (!transcribedText) {
        addMessage({
          text: t('voiceChat.transcribeFailed'),
          isUser: false,
        });
        return;
      }

      // Add user message with voice indicator + emotion context
      addMessage({
        text: transcribedText,
        isUser: true,
        isVoice: true,
        emotionContext: detectedEmotion?.primaryEmotion,
      });

      // Save voice recording metadata (best-effort)
      if (user?.user_id && detectedEmotion) {
        try {
          await saveVoiceRecording({
            transcript: transcribedText,
            primary_emotion: detectedEmotion.primaryEmotion,
            emotion_confidences: detectedEmotion.emotions,
            energy_level: detectedEmotion.energyLevel,
            speaking_pace: detectedEmotion.speakingPace,
            volume_variation: detectedEmotion.volumeVariation,
            audio_duration_ms: recordingSeconds * 1000,
            language: voiceLanguage,
            ...(detectedEmotion.valence !== undefined && { valence: detectedEmotion.valence }),
            ...(detectedEmotion.arousal !== undefined && { arousal: detectedEmotion.arousal }),
          });
        } catch (saveErr) {
          logger.warn('Failed to save voice recording metadata:', saveErr);
        }
      }

      // Step 3: Send to AI chat with emotion context for personalized response
      if (user?.user_id) {
        const emotionContext = detectedEmotion
          ? `[Voice analysis: user sounds ${detectedEmotion.primaryEmotion}, energy level: ${detectedEmotion.energyLevel}, speaking pace: ${detectedEmotion.speakingPace}] `
          : '';
        const aiInput = `${emotionContext}${transcribedText}`;

        try {
          const aiResult = await chatWithAI(user.user_id, aiInput, abortControllerRef.current?.signal);
          addMessage({
            text: aiResult.response || aiResult.message || t('voiceChat.aiResponseFallback'),
            isUser: false,
          });
          announceToScreenReader(t('voiceChat.aiResponseReceived'), 'polite');

          // Backend can detect crisis from text even when audio emotion looks neutral
          if (aiResult.crisisDetected) {
            addMessage({
              text: t('voiceChat.crisisWarning'),
              isUser: false,
            });
          }
        } catch (aiError) {
          logger.error('AI response error:', aiError);
          const isTimeout = aiError instanceof Error && (
            aiError.message.includes('timeout') ||
            aiError.message.includes('timed out')
          );
          addMessage({
            text: isTimeout
              ? t('voiceChat.aiTimeoutError')
              : t('voiceChat.aiGenericError'),
            isUser: false,
          });
        }
      }

      analytics.track('Voice Message Processed', {
        component: 'VoiceChat',
        messageLength: transcribedText.length,
      });

      onMessageSent?.(transcribedText, true);

    } catch (error) {
      logger.error('Error processing voice message:', error);
      addMessage({
        text: t('voiceChat.processError'),
        isUser: false,
      });
      announceToScreenReader(t('voiceChat.processErrorAria'), 'assertive');
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        setIsRecording(false);
        setProcessingStep('idle');
      }
    }
  }, [user, recordingSeconds, addMessage, isMountedRef, onMessageSent, announceToScreenReader, t]);
  processVoiceMessageRef.current = processVoiceMessage;

  const sendTextMessage = useCallback(async (overrideText?: string) => {
    const messageText = (overrideText ?? inputText).trim();
    if (!messageText || isProcessing) return;

    addMessage({ text: messageText, isUser: true, isVoice: false });
    if (isMountedRef.current) {
      setInputText('');
      setIsProcessing(true);
    }

    analytics.track('Text Message Sent', {
      component: 'VoiceChat',
      messageLength: messageText.length,
    });

    if (!user?.user_id) {
      addMessage({
        text: t('voiceChat.loginRequired'),
        isUser: false,
      });
      if (isMountedRef.current) setIsProcessing(false);
      return;
    }

    cleanupPendingRequests();
    abortControllerRef.current = new AbortController();

    try {
      const aiResult = await chatWithAI(user.user_id, messageText, abortControllerRef.current?.signal);
      addMessage({
        text: aiResult.response || aiResult.message || t('voiceChat.aiResponseFallbackExtended'),
        isUser: false,
      });
      announceToScreenReader(t('voiceChat.aiResponseReceived'), 'polite');

      if (aiResult.crisisDetected) {
        addMessage({
          text: t('voiceChat.crisisWarning'),
          isUser: false,
        });
      }
    } catch (error) {
      logger.error('AI response error:', error);
      const isTimeout = error instanceof Error && (
        error.message.includes('timeout') ||
        error.message.includes('timed out')
      );
      addMessage({
        text: isTimeout
          ? t('voiceChat.aiTimeoutError')
          : t('voiceChat.aiGenericErrorShort'),
        isUser: false,
      });
    } finally {
      if (isMountedRef.current) setIsProcessing(false);
      abortControllerRef.current = null;
    }

    onMessageSent?.(messageText, false);
  }, [inputText, isProcessing, user, addMessage, isMountedRef, onMessageSent, announceToScreenReader, cleanupPendingRequests, t]);

  const handleQuickAction = useCallback(async (action: string) => {
    if (isProcessing) return;
    if (isMountedRef.current) setInputText(action);
    await sendTextMessage(action);
    analytics.track('Quick Action Used', { component: 'VoiceChat', action });
  }, [isProcessing, sendTextMessage, isMountedRef]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendTextMessage();
      }
    },
    [sendTextMessage]
  );

  const processingLabel =
    processingStep === 'transcribing' ? t('voiceChat.transcribing') :
    processingStep === 'analyzing'    ? t('voiceChat.analyzingEmotions') :
    t('voiceChat.processing');

  const profile = emotionResult ? getEmotionProfile(emotionResult.primaryEmotion) : null;

  // Sorted emotion list for confidence bars (top emotions first)
  const sortedEmotions = emotionResult
    ? Object.entries(emotionResult.emotions)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
    : [];

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto gap-4">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('voiceChat.title')}
          </h1>
          <button
            onClick={() => {
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: t('voiceChat.helpText'),
                isUser: false,
                timestamp: new Date(),
              }]);
            }}
            className="text-gray-400 hover:text-teal-500 transition-colors"
            aria-label={t('voiceChat.helpAriaLabel')}
          >
            <ExclamationTriangleIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('voiceChat.subtitle')}
        </p>
      </div>

      {/* ── Recording Panel ─────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-teal-50 to-violet-50 dark:from-teal-900/20 dark:to-violet-900/20 border-teal-200 dark:border-teal-800">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Mic button + timer */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                aria-label={isRecording ? t('voiceChat.stopRecordingAria') : t('voiceChat.startRecordingAria')}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all
                  ${isRecording
                    ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 animate-pulse shadow-red-500/50'
                    : isProcessing
                      ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-br from-teal-500 to-violet-600 hover:from-teal-600 hover:to-violet-700 hover:scale-110 shadow-teal-500/50'
                  }`}
              >
                {isRecording
                  ? <StopIcon className="w-12 h-12 text-white" />
                  : <MicrophoneIcon className="w-12 h-12 text-white" />
                }
              </button>
              {isRecording && (
                <span className="text-red-600 dark:text-red-400 font-mono font-bold text-xl bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow">
                  {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
                </span>
              )}
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {isRecording
                  ? t('voiceChat.recording')
                  : isProcessing
                    ? processingLabel
                    : t('voiceChat.pressToStart')
                }
              </span>
            </div>

            {/* Waveform / processing indicator */}
            <div className="flex-1 flex items-center justify-center h-20 bg-white dark:bg-gray-800 rounded-2xl shadow-inner">
              {isRecording ? (
                <div className="flex items-end gap-1 h-full px-4">
                  {[...Array(24)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-gradient-to-t from-red-400 to-red-500 rounded-full"
                      style={{
                        height: `${30 + Math.random() * 50}%`,
                        animationDuration: `${0.4 + Math.random() * 0.4}s`,
                        animation: 'pulse 0.5s ease-in-out infinite alternate',
                        animationDelay: `${i * 25}ms`,
                      }}
                    />
                  ))}
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-2">
                    {[0, 150, 300].map(delay => (
                      <div key={delay} className="w-4 h-4 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                  <span className="text-teal-600 dark:text-teal-400 font-medium text-sm">{processingLabel}</span>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center px-4">
                  {lastTranscript
                    ? `"${lastTranscript.substring(0, 100)}${lastTranscript.length > 100 ? '...' : ''}"`
                    : t('voiceChat.speakNaturally')
                  }
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Emotion Analysis Results ─────────────────────────────── */}
      {emotionResult && profile && (
        <Card className={`border-2 ${profile.bgColor}`}>
          <CardContent className="p-5 space-y-5">

            {/* Primary emotion header */}
            <div className="flex items-center gap-4">
              <span className="text-5xl" role="img" aria-label={t(`voiceChat.emotionLabels.${emotionResult.primaryEmotion}`)}>{profile.emoji}</span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold" style={{ color: profile.color }}>{t(`voiceChat.emotionLabels.${emotionResult.primaryEmotion}`)}</h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({Math.round((emotionResult.emotions[emotionResult.primaryEmotion] ?? 0) * 100)}% {t('voiceChat.confidenceLabel')})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                    ⚡ {t('voiceChat.energyLabel')}: {emotionResult.energyLevel === 'high' ? t('voiceChat.energyHigh') : emotionResult.energyLevel === 'medium' ? t('voiceChat.energyMedium') : t('voiceChat.energyLow')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                    🗣 {t('voiceChat.paceLabel')}: {emotionResult.speakingPace === 'fast' ? t('voiceChat.paceFast') : emotionResult.speakingPace === 'slow' ? t('voiceChat.paceSlow') : t('voiceChat.paceNormal')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                    🔊 {t('voiceChat.volumeLabel')}: {emotionResult.volumeVariation === 'high' ? t('voiceChat.volumeHigh') : emotionResult.volumeVariation === 'low' ? t('voiceChat.volumeLow') : t('voiceChat.volumeModerate')}
                  </span>
                </div>
              </div>
            </div>

            {/* Emotion confidence bars */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                {t('voiceChat.emotionProfileTitle')}
              </h3>
              <div className="space-y-2">
                {sortedEmotions.map(([emotion, score]) => {
                  const ep = getEmotionProfile(emotion);
                  if (!ep) return null;
                  return (
                    <div key={emotion} className="flex items-center gap-2">
                      <span className="text-base w-5" role="img" aria-label={t(`voiceChat.emotionLabels.${emotion}`)}>{ep.emoji}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-20 truncate">{t(`voiceChat.emotionLabels.${emotion}`)}</span>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.round(score * 100)}%`, backgroundColor: ep.color }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
                        {Math.round(score * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* VAD Valence/Arousal */}
            {emotionResult.valence !== undefined && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                  {t('voiceChat.emotionDimensionsTitle')}
                </h3>
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  {[
                    { label: t('voiceChat.valenceLabel'), desc: t('voiceChat.valenceDesc'), value: ((emotionResult.valence ?? 0) + 1) / 2, color: '#16a34a' },
                    { label: t('voiceChat.arousalLabel'), desc: t('voiceChat.arousalDesc'), value: emotionResult.arousal, color: '#d97706' },
                    { label: t('voiceChat.dominanceLabel'), desc: t('voiceChat.dominanceDesc'), value: emotionResult.dominance, color: '#7c3aed' },
                  ].map(dim => (
                    <div key={dim.label} className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                      <div className="font-semibold text-gray-700 dark:text-gray-300">{dim.label}</div>
                      <div className="text-gray-400 text-xs mb-1">{dim.desc}</div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mb-1">
                        <div className="h-full rounded-full" style={{ width: `${Math.round((dim.value ?? 0.5) * 100)}%`, backgroundColor: dim.color }} />
                      </div>
                      <div className="font-mono font-bold" style={{ color: dim.color }}>
                        {Math.round((dim.value ?? 0.5) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Psychological insight */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <HeartIcon className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('voiceChat.insightTitle')}</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t(`voiceChat.emotionInsights.${emotionResult.primaryEmotion}`)}</p>
            </div>

            {/* Coping recommendations */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="w-4 h-4 text-teal-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('voiceChat.recommendationsTitle')}</h3>
              </div>
              <ul className="space-y-2">
                {(t(`voiceChat.emotionRecommendations.${emotionResult.primaryEmotion}`, { returnObjects: true }) as string[]).map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-teal-500 font-bold mt-0.5">→</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Crisis escalation */}
            {profile.crisisLevel >= 2 && (
              <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-600 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                  <h3 className="font-bold text-red-700 dark:text-red-400">{t('voiceChat.crisisTitle')}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <a href="tel:112" className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors">
                    {t('voiceChat.crisisSos')}
                  </a>
                  <a href="tel:90101" className="flex items-center gap-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg font-semibold hover:bg-red-200 transition-colors">
                    {t('voiceChat.crisisMind')}
                  </a>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  {t('voiceChat.crisisDisclaimer')}
                </p>
              </div>
            )}
            {profile.crisisLevel === 1 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 flex items-start gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t('voiceChat.crisisWarningLevel1')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Chat Messages ────────────────────────────────────────── */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full flex flex-col">
          <div className="px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {t('voiceChat.aiTherapistLabel')}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${message.isUser ? 'flex-row-reverse' : ''}`}>
                  <Avatar className={message.isUser ? 'bg-teal-500' : 'bg-emerald-500'}>
                    {message.isUser ? '👤' : '🤖'}
                  </Avatar>
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.isUser
                      ? 'bg-gradient-to-br from-teal-500 to-violet-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}>
                    <Typography variant="body1" className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.text}
                    </Typography>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs opacity-60">
                        {message.timestamp.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {message.isVoice && (
                        <span className="text-xs opacity-70">{t('voiceChat.voiceLabel')}</span>
                      )}
                      {message.emotionContext && message.isUser && (() => {
                        const ep = getEmotionProfile(message.emotionContext);
                        return ep ? <span className="text-xs opacity-70">{ep.emoji}</span> : null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[80%]">
                  <Avatar className="bg-emerald-500">🤖</Avatar>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      {[0, 150, 300].map(d => (
                        <div key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                      <span className="text-xs text-gray-500 ml-1">{processingLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
              {t('voiceChat.quickActionsTitle')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => handleQuickAction(action)}
                  disabled={isProcessing}
                  className="px-3 py-2 text-sm bg-white dark:bg-gray-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-gray-700 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-600 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Input Area ───────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-teal-50 to-violet-50 dark:from-teal-900/20 dark:to-violet-900/20 border-teal-200 dark:border-teal-800">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              aria-label={isRecording ? t('voiceChat.stopRecordingAria') : t('voiceChat.voiceInputAria')}
              className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all shadow-md
                ${isRecording
                  ? 'bg-gradient-to-br from-red-500 to-red-600 text-white animate-pulse'
                  : isProcessing
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-br from-teal-500 to-violet-600 text-white hover:from-teal-600 hover:to-violet-700 hover:scale-105'
                }`}
            >
              {isRecording ? <StopIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
            </button>

            <div className="flex-1 relative">
              <Input
                fullWidth
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('voiceChat.inputPlaceholder')}
                disabled={isProcessing}
                className="flex-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-teal-500 focus:ring-teal-500"
              />
            </div>

            <Button
              variant="primary"
              onClick={sendTextMessage}
              disabled={!inputText.trim() || isProcessing}
              aria-label={t('voiceChat.sendAria')}
              className="bg-gradient-to-r from-teal-500 to-violet-600 hover:from-teal-600 hover:to-violet-700 shadow-md px-6"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </Button>
          </div>

          {isRecording && (
            <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-medium">{t('voiceChat.recordingHint')}</span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800/50 px-4 py-2 rounded-full">
            <span>🔒</span>
            <span>{t('voiceChat.disclaimer')}</span>
            <span className="text-teal-600 dark:text-teal-400 font-medium">{t('voiceChat.mindHelpline')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceChat;

