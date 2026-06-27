import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  transcribeVoiceAudio,
  analyzeVoiceEmotionDetailed,
  blobToBase64,
  getVoiceServiceStatus,
  saveVoiceRecording,
  VoiceServiceStatus,
  SaveVoiceRecordingRequest,
} from '@/api/voice';
import { logger } from '../../utils/logger';


interface VoiceRecorderProps {
  onTranscriptComplete?: (transcript: string, emotion?: string, audioDurationMs?: number) => void;
  maxDuration?: number; // milliseconds
  maxFileSize?: number; // bytes (default 10MB to match backend limit)
  autoAnalyzeEmotion?: boolean;
  autoSaveRecording?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscriptComplete,
  maxDuration = 60000, // 60 seconds default
  maxFileSize = 10 * 1024 * 1024, // 10MB default (matches backend limit)
  autoAnalyzeEmotion = true,
  autoSaveRecording = true,
}) => {
  const { t, i18n } = useTranslation();
  const voiceLanguage = i18n.language === 'no' ? 'no-NO' : i18n.language === 'en' ? 'en-US' : 'sv-SE';
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [emotion, setEmotion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<VoiceServiceStatus | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    // Check service status on mount
    const checkStatus = async () => {
      try {
        const status = await getVoiceServiceStatus();
        setServiceStatus(status);
      } catch (err) {
        logger.error('Failed to check voice service status:', err);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      setTranscript(null);
      setEmotion(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);

          // Check total file size (only count Blobs, not strings)
          const totalSize = chunksRef.current.reduce((acc, chunk) => {
            if (chunk instanceof Blob) {
              return acc + chunk.size;
            }
            return acc;
          }, 0);
          if (totalSize > maxFileSize) {
            logger.warn(`Recording exceeded max file size (${maxFileSize} bytes), stopping`);
            mediaRecorder.stop();
            setError(t('voiceRecorder.recordingTooLarge'));
          }
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        setIsProcessing(true);
        try {
          const base64Audio = await blobToBase64(blob);
          const transcriptionResult = await transcribeVoiceAudio(base64Audio, voiceLanguage);

          if (transcriptionResult.transcript) {
            setTranscript(transcriptionResult.transcript);

            let emotionResult = null;
            if (autoAnalyzeEmotion) {
              emotionResult = await analyzeVoiceEmotionDetailed(
                base64Audio,
                transcriptionResult.transcript
              );
              setEmotion(emotionResult.primaryEmotion);

              if (onTranscriptComplete) {
                onTranscriptComplete(transcriptionResult.transcript, emotionResult.primaryEmotion, recordingTime);
              }
            } else {
              if (onTranscriptComplete) {
                onTranscriptComplete(transcriptionResult.transcript);
              }
            }

            // Auto-save recording to Firestore
            if (autoSaveRecording && transcriptionResult.transcript) {
              try {
                const saveData: SaveVoiceRecordingRequest = {
                  transcript: transcriptionResult.transcript,
                  primary_emotion: emotionResult?.primaryEmotion || 'neutral',
                  emotion_confidences: emotionResult?.emotions || {},
                  energy_level: emotionResult?.energyLevel || 'medium',
                  speaking_pace: emotionResult?.speakingPace || 'normal',
                  volume_variation: emotionResult?.volumeVariation || 'moderate',
                  audio_duration_ms: recordingTime,
                  language: voiceLanguage,
                };

                // Only include valence/arousal if they exist
                if (emotionResult?.valence !== undefined) {
                  saveData.valence = emotionResult.valence;
                }
                if (emotionResult?.arousal !== undefined) {
                  saveData.arousal = emotionResult.arousal;
                }

                await saveVoiceRecording(saveData);
                logger.info('Voice recording saved to Firestore');
              } catch (saveError) {
                logger.error('Failed to save voice recording:', saveError);
                // Don't show error to user, just log it
              }
            }
          } else if (transcriptionResult.fallback === 'web_speech_api') {
            setError(t('voiceRecorder.transcribeFailed'));
          }
        } catch (err: unknown) {
          logger.error('Voice recording error:', err);
          setError(err instanceof Error ? err.message : t('voiceRecorder.processingError'));
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Auto-stop after maxDuration
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, maxDuration);

    } catch (err: unknown) {
      logger.error('Failed to start recording:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError(t('voiceRecorder.micPermissionDenied'));
        } else if (err.name === 'NotFoundError') {
          setError(t('voiceRecorder.noMicrophone'));
        } else {
          setError(`${t('voiceRecorder.startErrorPrefix')} ${err.message}`);
        }
      } else {
        setError(t('voiceRecorder.startError'));
      }
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t('voiceRecorder.title')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('voiceRecorder.subtitle')}
        </p>
      </div>

      {/* Service Status */}
      {serviceStatus && !serviceStatus.googleSpeech && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {t('voiceRecorder.googleSpeechUnavailable')}
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            <span className="ml-3 text-gray-700 dark:text-gray-300">
              {t('voiceRecorder.processing')}
            </span>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex justify-center space-x-4">
          {!isRecording && !isProcessing && (
            <button
              onClick={startRecording}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              <span className="flex items-center space-x-2">
                <span>🎙️</span>
                <span>{t('voiceRecorder.startRecording')}</span>
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
                <span>{t('voiceRecorder.stopRecording')}</span>
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
              {t('voiceRecorder.transcriptLabel')}
            </h4>
            <p className="text-gray-900 dark:text-white">
              "{transcript}"
            </p>
          </div>

          {emotion && (
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('voiceRecorder.emotionLabel')}
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
        <div className="mt-6 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
          <p className="text-sm text-teal-800 dark:text-teal-200">
            {t('voiceRecorder.tips')}
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
