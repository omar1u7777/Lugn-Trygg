import React, { useState, useRef, useEffect } from 'react';
import { transcribeVoiceAudio, analyzeVoiceEmotionDetailed, blobToBase64, recordAudio, getVoiceServiceStatus, VoiceServiceStatus } from '@/api/voice';

interface VoiceRecorderProps {
  onTranscriptComplete?: (transcript: string, emotion?: string) => void;
  maxDuration?: number; // milliseconds
  autoAnalyzeEmotion?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscriptComplete,
  maxDuration = 10000, // 10 seconds default
  autoAnalyzeEmotion = true,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [emotion, setEmotion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<VoiceServiceStatus | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check service status on mount
    const checkStatus = async () => {
      try {
        const status = await getVoiceServiceStatus();
        setServiceStatus(status);
      } catch (err) {
        console.error('Failed to check voice service status:', err);
      }
    };
    checkStatus();
  }, []);

  useEffect(() => {
    // Update recording time
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 100);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setError(null);
      setTranscript(null);
      setEmotion(null);
      setIsRecording(true);
    } catch (err) {
      setError('Kunde inte starta inspelning. Kontrollera mikrofonbehörigheter.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setIsProcessing(true);

    try {
      // Record audio
      const audioBlob = await recordAudio(maxDuration);
      const base64Audio = await blobToBase64(audioBlob);

      // Transcribe
      const transcriptionResult = await transcribeVoiceAudio(base64Audio, 'sv-SE');
      
      if (transcriptionResult.transcript) {
        setTranscript(transcriptionResult.transcript);

        // Analyze emotion if enabled
        if (autoAnalyzeEmotion) {
          const emotionResult = await analyzeVoiceEmotionDetailed(
            base64Audio,
            transcriptionResult.transcript
          );
          setEmotion(emotionResult.primaryEmotion);

          if (onTranscriptComplete) {
            onTranscriptComplete(transcriptionResult.transcript, emotionResult.primaryEmotion);
          }
        } else {
          if (onTranscriptComplete) {
            onTranscriptComplete(transcriptionResult.transcript);
          }
        }
      } else if (transcriptionResult.fallback === 'web_speech_api') {
        setError('Transkribering misslyckades. Prova att tala tydligare.');
      }
    } catch (err: any) {
      console.error('Voice recording error:', err);
      setError(err.message || 'Ett fel uppstod vid bearbetning av röstinspelningen.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 100);
    return `${seconds}.${milliseconds}s`;
  };

  const getEmotionEmoji = (emotion: string | null) => {
    if (!emotion) return '';
    const emojiMap: { [key: string]: string } = {
      happy: '😊',
      sad: '😢',
      anxious: '😰',
      angry: '😠',
      calm: '😌',
      neutral: '😐',
      tired: '😴',
    };
    return emojiMap[emotion] || '🎭';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          🎤 Röstinspelning
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Spela in din röst för transkribering och känsloanalys
        </p>
      </div>

      {/* Service Status */}
      {serviceStatus && !serviceStatus.googleSpeech && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Google Speech API är inte tillgänglig. Använder webbläsarens talröst-API.
          </p>
        </div>
      )}

      {/* Recording Status */}
      <div className="mb-6">
        {isRecording && (
          <div className="flex items-center justify-center space-x-3 py-4">
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-lg font-mono text-gray-900 dark:text-white">
              {formatTime(recordingTime)}
            </span>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-gray-700 dark:text-gray-300">
              Bearbetar inspelning...
            </span>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex justify-center space-x-4">
          {!isRecording && !isProcessing && (
            <button
              onClick={startRecording}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              <span className="flex items-center space-x-2">
                <span>🎙️</span>
                <span>Starta Inspelning</span>
              </span>
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              <span className="flex items-center space-x-2">
                <span>⏹️</span>
                <span>Stoppa Inspelning</span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            ❌ {error}
          </p>
        </div>
      )}

      {/* Results */}
      {transcript && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Transkribering:
            </h4>
            <p className="text-gray-900 dark:text-white">
              "{transcript}"
            </p>
          </div>

          {emotion && (
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Känsla:
              </h4>
              <p className="text-2xl">
                {getEmotionEmoji(emotion)} {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!isRecording && !transcript && !isProcessing && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 Tips: Tala tydligt i 3-10 sekunder för bästa resultat
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
