import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, Typography, Button, Input, Avatar } from './ui/tailwind';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';
import { blobToBase64, transcribeVoiceAudio, analyzeVoiceEmotionDetailed, AnalyzeVoiceEmotionResponse } from '../api/voice';
import { chatWithAI } from '../api/ai';
import useAuth from '../hooks/useAuth';
import { MicrophoneIcon, PaperAirplaneIcon, StopIcon, ExclamationTriangleIcon, HeartIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';

// ─── Psychological emotion profiles (evidence-based, all in Swedish) ────────
interface EmotionProfile {
  sv: string;
  emoji: string;
  color: string;
  bgColor: string;
  insight: string;
  recommendations: string[];
  crisisLevel: 0 | 1 | 2;
}

const EMOTION_PROFILES: Record<string, EmotionProfile> = {
  happy: {
    sv: 'Glad',
    emoji: '😊',
    color: '#16a34a',
    bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    insight: 'Din röst förmedlar glädje och energi – ett starkt tecken på välmående. Positiva känslor stärker din motståndskraft och närer dina relationer.',
    recommendations: ['Njut av stunden – uppmärksamma vad som skapat glädjen', 'Dela din energi med någon du bryr dig om', 'Skriv ner tre saker du är tacksam för idag'],
    crisisLevel: 0,
  },
  sad: {
    sv: 'Ledsen',
    emoji: '😢',
    color: '#2563eb',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    insight: 'Din röst bär en viss tyngd och sorg. Det är helt okej – sorg är en viktig del av att vara människa och hjälper oss att bearbeta förluster. Du behöver inte bära det ensam.',
    recommendations: ['Tillåt dig att känna, inte fly känslan', 'Andas djupt: in 4 sek → håll 2 sek → ut 6 sek', 'Ring någon du litar på – ett samtal hjälper'],
    crisisLevel: 1,
  },
  anxious: {
    sv: 'Orolig',
    emoji: '😰',
    color: '#d97706',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    insight: 'Din röst visar tecken på oro och inre spänning. Din hjärna försöker skydda dig – men oro kan ibland bli oproportionerlig. Du är inte ensam med det här, och det går att lära sig hantera.',
    recommendations: ['4-7-8-andning: in 4 sek → håll 7 sek → ut 8 sek', 'Jordeningsteknik: Namnge 5 saker du ser, 4 du hör, 3 du rör', 'Fråga dig: Hur sannolikt är detta scenario verkligen?'],
    crisisLevel: 1,
  },
  angry: {
    sv: 'Arg',
    emoji: '😠',
    color: '#dc2626',
    bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    insight: 'Din röst bär intensiv energi som tyder på frustration eller ilska. Ilska är en signal om att något viktigt kränkts – det är mänskligt. Det handlar om att kanalisera den konstruktivt.',
    recommendations: ['Boxandning: in 4 → håll 4 → ut 4 → håll 4 sek', 'Ta ett steg tillbaka och räkna till 10 innan du reagerar', 'Rör på dig – en snabb promenad sänker stresshormoner'],
    crisisLevel: 0,
  },
  fearful: {
    sv: 'Rädd',
    emoji: '😨',
    color: '#7c3aed',
    bgColor: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',
    insight: 'Din röst visar tecken på rädsla eller stor oro. Rädsla är kroppens larmsystem – men ibland går det på överdrift. Om du befinner dig i fara eller mår mycket dåligt: sök hjälp nu.',
    recommendations: ['Om akut fara: Ring 112 omedelbart', 'Mind självmordslinjen: 90101 (dygnet runt)', 'Jordeningsteknik: Tryck fötterna mot golvet, andas långsamt'],
    crisisLevel: 2,
  },
  neutral: {
    sv: 'Neutral',
    emoji: '😐',
    color: '#4b5563',
    bgColor: 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600',
    insight: 'Din röst låter balanserad och neutral. Det kan tyda på lugn och välmående – eller att du håller tillbaka känslor. Ibland är det svårare att nå de djupare lagren.',
    recommendations: ['Reflektera: Hur mår du egentligen djupast inne?', 'Mindfulness: Sitt still i 5 minuter och observera tankarna', 'Skriv ner dina tankar i en dagbok'],
    crisisLevel: 0,
  },
  surprised: {
    sv: 'Förvånad',
    emoji: '😮',
    color: '#0891b2',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
    insight: 'Din röst visar förvåning eller oväntat engagemang. Förvåning är ofta kortvarig – lägg märke till vad som skapade den.',
    recommendations: ['Fundera: Vad överraskade dig och vad säger det om dina förväntningar?', 'Nyfikenhet är positivt – låt förvåningen leda till utforskning'],
    crisisLevel: 0,
  },
  disgusted: {
    sv: 'Äcklad',
    emoji: '🤢',
    color: '#65a30d',
    bgColor: 'bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800',
    insight: 'Avsky eller avsmak i rösten kan signalera att något strider mot dina värderingar. Det är viktigt information om dina gränser.',
    recommendations: ['Identifiera vad som utlöste känslan', 'Kommunicera dina gränser tydligt och respektfullt', 'Är det något du behöver ta avstånd från?'],
    crisisLevel: 0,
  },
  frustrated: {
    sv: 'Frustrerad',
    emoji: '😤',
    color: '#ea580c',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    insight: 'Frustration är en signal om ett hinder eller ojämlikhet. Det är en aktiv känsla som säger: "Något stämmer inte." Lyssna på den med nyfikenhet.',
    recommendations: ['Identifiera det specifika hindret: vad kan du kontrollera?', 'Dela upp problemet i mindre delar', 'Rör på dig – fysisk aktivitet löser upp frustrationstänkande'],
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

const VoiceChat: React.FC<VoiceChatProps> = ({ onMessageSent }) => {
  const { t: _t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hej! Jag är din AI-terapeut. Hur känns det idag? Du kan prata med mig genom att trycka på mikrofon-knappen eller skriva.',
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
  const [quickActions] = useState([
    'Jag känner mig stressad idag',
    'Hjälp mig med mindfulness',
    'Berätta en lugnande historia',
    'Vad kan jag göra för bättre sömn?',
    'Jag känner mig orolig',
    'Hjälp mig förstå mina känslor',
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    analytics.page('Voice Chat', { component: 'VoiceChat' });
    scrollToBottom();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startRecording = async () => {
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

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        await processVoiceMessage(audioBlob);
      };

      mediaRecorder.start(250); // collect data every 250 ms
      setIsRecording(true);
      setRecordingSeconds(0);
      setEmotionResult(null);
      setLastTranscript('');
      setProcessingStep('idle');

      // Recording timer
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);

      announceToScreenReader('Röstinspelning startad', 'polite');
      analytics.track('Voice Recording Started', { component: 'VoiceChat' });

    } catch (error) {
      logger.error('Error starting recording:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: 'Kunde inte starta inspelning. Kontrollera att webbläsaren har tillgång till mikrofonen.',
        isUser: false,
        timestamp: new Date(),
      }]);
      announceToScreenReader('Kunde inte starta röstinspelning', 'assertive');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      announceToScreenReader('Röstinspelning stoppad', 'polite');

      analytics.track('Voice Recording Stopped', {
        component: 'VoiceChat',
      });
    }
  };

  const processVoiceMessage = async (audioBlob: Blob) => {
    setIsProcessing(true);
    announceToScreenReader('Bearbetar röstmeddelande...', 'polite');

    try {
      // Convert blob to base64 (what the backend expects)
      const base64Audio = await blobToBase64(audioBlob);

      // Step 1: Transcribe with Google Cloud STT
      setProcessingStep('transcribing');
      let transcribedText = '';
      try {
        const transcriptionResult = await transcribeVoiceAudio(base64Audio, 'sv-SE');
        if (transcriptionResult.transcript) {
          transcribedText = transcriptionResult.transcript;
          logger.debug('✅ Transcription success:', transcribedText.substring(0, 60));
        } else {
          // Google STT failed – show instructive message, do NOT silently skip
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: '⚠️ Kunde inte transkribera din röst. Tala tydligare och längre (minst 2 sekunder). Eller skriv ditt meddelande nedan.',
            isUser: false,
            timestamp: new Date(),
          }]);
          setIsProcessing(false);
          setProcessingStep('idle');
          return;
        }
      } catch (sttErr) {
        logger.error('STT error:', sttErr);
        // Still continue to emotion analysis even without transcript
        transcribedText = '';
      }

      // Step 2: Analyse voice emotion (with transcript for multimodal fusion)
      setProcessingStep('analyzing');
      let detectedEmotion: AnalyzeVoiceEmotionResponse | null = null;
      try {
        detectedEmotion = await analyzeVoiceEmotionDetailed(base64Audio, transcribedText || undefined);
        setEmotionResult(detectedEmotion);
        setLastTranscript(transcribedText);

        analytics.track('Voice Emotion Detected', {
          component: 'VoiceChat',
          primaryEmotion: detectedEmotion.primaryEmotion,
          energyLevel: detectedEmotion.energyLevel,
          speakingPace: detectedEmotion.speakingPace,
        });

        logger.debug(`🎭 Emotion: ${detectedEmotion.primaryEmotion}, confidence: ${detectedEmotion.emotions[detectedEmotion.primaryEmotion]}`);
      } catch (emoErr) {
        logger.warn('Emotion analysis error (non-fatal):', emoErr);
      }

      setProcessingStep('done');

      if (!transcribedText) {
        setIsProcessing(false);
        return;
      }

      // Add user message with voice indicator + emotion context
      const userMessage: Message = {
        id: Date.now().toString(),
        text: transcribedText,
        isUser: true,
        timestamp: new Date(),
        isVoice: true,
        emotionContext: detectedEmotion?.primaryEmotion,
      };
      setMessages(prev => [...prev, userMessage]);

      // Step 3: Send to AI chat with emotion context for personalized response
      if (user?.user_id) {
        // Build context-aware message that includes emotional cues for the AI
        const emotionContext = detectedEmotion
          ? `[Röstanalys: användaren låter ${getEmotionProfile(detectedEmotion.primaryEmotion)?.sv.toLowerCase() || 'neutral'}, energinivå: ${detectedEmotion.energyLevel}, taltempo: ${detectedEmotion.speakingPace}] `
          : '';
        const aiInput = `${emotionContext}${transcribedText}`;

        try {
          const aiResult = await chatWithAI(user.user_id, aiInput);
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            text: aiResult.response || aiResult.message || 'Tack för att du delade det med mig.',
            isUser: false,
            timestamp: new Date(),
          }]);
          announceToScreenReader('AI svar mottaget', 'polite');
        } catch (aiError) {
          logger.error('AI response error:', aiError);
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            text: 'Jag kunde inte svara just nu. Prova igen om en stund.',
            isUser: false,
            timestamp: new Date(),
          }]);
        }
      }

      analytics.track('Voice Message Processed', {
        component: 'VoiceChat',
        messageLength: transcribedText.length,
      });

      if (onMessageSent) onMessageSent(transcribedText, true);

    } catch (error) {
      logger.error('Error processing voice message:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: 'Ett oväntat fel uppstod vid bearbetning av röstmeddelandet. Försök igen.',
        isUser: false,
        timestamp: new Date(),
      }]);
      announceToScreenReader('Kunde inte bearbeta röstmeddelande', 'assertive');
    } finally {
      setIsProcessing(false);
    }
  };

  const sendTextMessage = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
      isVoice: false,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    analytics.track('Text Message Sent', {
      component: 'VoiceChat',
      messageLength: messageText.length,
    });

    // Call AI API
    if (user?.user_id) {
      try {
        const aiResult = await chatWithAI(user.user_id, messageText);
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: aiResult.response || aiResult.message || 'Tack för att du delade det med mig. Berätta mer om hur du känner.',
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiResponse]);
        announceToScreenReader('AI svar mottaget', 'polite');
      } catch (error) {
        logger.error('AI response error:', error);
        const errorResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Jag kunde inte bearbeta ditt meddelande just nu. Försök igen om en stund.',
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorResponse]);
      }
    } else {
      // No user logged in - show message
      const loginMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Logga in för att prata med AI-terapeuten.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, loginMessage]);
    }

    setIsProcessing(false);

    if (onMessageSent) {
      onMessageSent(messageText, false);
    }
  };

  const handleQuickAction = async (action: string) => {
    setInputText(action);
    await sendTextMessage();
    analytics.track('Quick Action Used', { component: 'VoiceChat', action });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendTextMessage();
    }
  };

  const processingLabel =
    processingStep === 'transcribing' ? 'Transkriberar tal...' :
    processingStep === 'analyzing'    ? 'Analyserar känslor...' :
    'Bearbetar...';

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
            🎤 Röstanalys &amp; AI Terapeut
          </h1>
          <button
            onClick={() => {
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: '💡 **Hur det fungerar:**\n\n1. Tryck på mikrofonen och prata i minst 3 sekunder\n2. Jag analyserar din röst och känslor\n3. Du får personliga insikter och rekommendationer\n4. Du kan också skriva eller klicka på snabbval nedan',
                isUser: false,
                timestamp: new Date(),
              }]);
            }}
            className="text-gray-400 hover:text-indigo-500 transition-colors"
            aria-label="Hjälp"
          >
            <ExclamationTriangleIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Prata fritt – jag analyserar din röst och ger personliga insikter för ditt välmående
        </p>
      </div>

      {/* ── Recording Panel ─────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Mic button + timer */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                aria-label={isRecording ? 'Stoppa inspelning' : 'Starta röstinspelning'}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all
                  ${isRecording
                    ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 animate-pulse shadow-red-500/50'
                    : isProcessing
                      ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 hover:scale-110 shadow-indigo-500/50'
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
                  ? '🔴 Spelar in...'
                  : isProcessing
                    ? processingLabel
                    : 'Tryck för att börja'
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
                      <div key={delay} className="w-4 h-4 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium text-sm">{processingLabel}</span>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center px-4">
                  {lastTranscript
                    ? `"${lastTranscript.substring(0, 100)}${lastTranscript.length > 100 ? '...' : ''}"`
                    : 'Tala naturligt i minst 3 sekunder. Jag analyserar din röst och känslor.'
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
              <span className="text-5xl" role="img" aria-label={profile.sv}>{profile.emoji}</span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold" style={{ color: profile.color }}>{profile.sv}</h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({Math.round((emotionResult.emotions[emotionResult.primaryEmotion] ?? 0) * 100)}% konfidens)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                    ⚡ Energi: {emotionResult.energyLevel === 'high' ? 'Hög' : emotionResult.energyLevel === 'medium' ? 'Medel' : 'Låg'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                    🗣 Taltempo: {emotionResult.speakingPace === 'fast' ? 'Snabbt' : emotionResult.speakingPace === 'slow' ? 'Långsamt' : 'Normalt'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                    🔊 Volym: {emotionResult.volumeVariation === 'high' ? 'Varierad' : emotionResult.volumeVariation === 'low' ? 'Konstant' : 'Måttlig'}
                  </span>
                </div>
              </div>
            </div>

            {/* Emotion confidence bars */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                Känsloprofil
              </h3>
              <div className="space-y-2">
                {sortedEmotions.map(([emotion, score]) => {
                  const ep = getEmotionProfile(emotion);
                  if (!ep) return null;
                  return (
                    <div key={emotion} className="flex items-center gap-2">
                      <span className="text-base w-5" role="img" aria-label={ep.sv}>{ep.emoji}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-20 truncate">{ep.sv}</span>
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
                  Känslodimensioner
                </h3>
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  {[
                    { label: 'Valens', desc: 'Neg ↔ Pos', value: ((emotionResult.valence ?? 0) + 1) / 2, color: '#16a34a' },
                    { label: 'Aktivering', desc: 'Lugn ↔ Aktiv', value: emotionResult.arousal, color: '#d97706' },
                    { label: 'Dominans', desc: 'Submissiv ↔ Dominant', value: emotionResult.dominance, color: '#7c3aed' },
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
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Psykologisk insikt</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{profile.insight}</p>
            </div>

            {/* Coping recommendations */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Vad du kan göra nu</h3>
              </div>
              <ul className="space-y-2">
                {profile.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-indigo-500 font-bold mt-0.5">→</span>
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
                  <h3 className="font-bold text-red-700 dark:text-red-400">Om du mår mycket dåligt</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <a href="tel:112" className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors">
                    📞 SOS Alarm: 112
                  </a>
                  <a href="tel:90101" className="flex items-center gap-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg font-semibold hover:bg-red-200 transition-colors">
                    💙 Mind: 90101 (dygnet runt)
                  </a>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Lugn &amp; Trygg ersätter inte professionell vård. Sök hjälp om du mår dåligt.
                </p>
              </div>
            )}
            {profile.crisisLevel === 1 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 flex items-start gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Om du behöver prata med någon kan du ringa <strong>Mind självmordslinjen: 90101</strong> (gratis, dygnet runt).
                  Lugn &amp; Trygg ersätter inte professionell psykologhjälp.
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
              💬 AI-terapeut
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${message.isUser ? 'flex-row-reverse' : ''}`}>
                  <Avatar className={message.isUser ? 'bg-indigo-500' : 'bg-emerald-500'}>
                    {message.isUser ? '👤' : '🤖'}
                  </Avatar>
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}>
                    <Typography variant="body1" className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.text}
                    </Typography>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs opacity-60">
                        {message.timestamp.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {message.isVoice && (
                        <span className="text-xs opacity-70">🎤 röst</span>
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
              Snabbval
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => handleQuickAction(action)}
                  disabled={isProcessing}
                  className="px-3 py-2 text-sm bg-white dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-700 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-600 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Input Area ───────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              aria-label={isRecording ? 'Stoppa inspelning' : 'Röstinmatning'}
              className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all shadow-md
                ${isRecording
                  ? 'bg-gradient-to-br from-red-500 to-red-600 text-white animate-pulse'
                  : isProcessing
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 hover:scale-105'
                }`}
            >
              {isRecording ? <StopIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
            </button>

            <div className="flex-1 relative">
              <Input
                fullWidth
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Skriv ditt meddelande..."
                disabled={isProcessing}
                className="flex-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <Button
              variant="primary"
              onClick={sendTextMessage}
              disabled={!inputText.trim() || isProcessing}
              aria-label="Skicka"
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md px-6"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </Button>
          </div>

          {isRecording && (
            <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-medium">Spelar in – tryck på stopp-knappen för att avsluta och analysera</span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800/50 px-4 py-2 rounded-full">
            <span>🔒</span>
            <span>Lugn &amp; Trygg ersätter inte professionell psykologhjälp</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">Mind: 90101</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceChat;

