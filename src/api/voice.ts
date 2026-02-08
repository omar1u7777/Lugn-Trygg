/**
 * Voice API Client
 * 
 * Provides TypeScript API for voice transcription and emotion analysis
 */

import { api } from './client';
import { API_ENDPOINTS } from './constants';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TranscribeAudioRequest {
  audio_data: string; // Base64-encoded audio
  language?: string;  // Default: 'sv-SE'
}

export interface TranscribeAudioResponse {
  transcript: string | null;
  confidence?: number;
  language: string;
  fallback?: string;
  message?: string;
}

export interface AnalyzeVoiceEmotionRequest {
  audio_data: string; // Base64-encoded audio
  transcript?: string;
}

export interface VoiceEmotions {
  happy: number;
  sad: number;
  anxious: number;
  angry: number;
  calm: number;
  neutral: number;
  [key: string]: number;
}

export interface AnalyzeVoiceEmotionResponse {
  emotions: VoiceEmotions;
  primaryEmotion: string;
  energyLevel: 'low' | 'medium' | 'high';
  speakingPace: 'slow' | 'normal' | 'fast';
  volumeVariation: 'low' | 'moderate' | 'high';
}

export interface VoiceServiceStatus {
  googleSpeech: boolean;
  webSpeechFallback: boolean;
  emotionAnalysis: boolean;
  supportedLanguages: string[];
  error?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Transcribe audio to text using Google Cloud Speech-to-Text
 * 
 * @param audioData - Base64-encoded audio data (WAV, WEBM, OGG)
 * @param language - Language code (default: 'sv-SE')
 * @returns Transcription result with confidence score
 * 
 * @example
 * ```typescript
 * const result = await transcribeVoiceAudio(base64Audio, 'sv-SE');
 * if (result.transcript) {
 *   console.log('Transcript:', result.transcript);
 * } else if (result.fallback) {
 *   // Use client-side Web Speech API as fallback
 * }
 * ```
 */
export const transcribeVoiceAudio = async (
  audioData: string,
  language: string = 'sv-SE'
): Promise<TranscribeAudioResponse> => {
  const response = await api.post(
    API_ENDPOINTS.VOICE.TRANSCRIBE_AUDIO,
    { audio_data: audioData, language }
  );
  return response.data?.data || response.data;
};

/**
 * Analyze emotion from voice recording
 * 
 * Combines audio features (energy, pace, pitch) with optional text sentiment
 * analysis to detect emotions.
 * 
 * @param audioData - Base64-encoded audio data
 * @param transcript - Optional transcript for combined analysis
 * @returns Emotion analysis with primary emotion and confidence scores
 * 
 * @example
 * ```typescript
 * const analysis = await analyzeVoiceEmotionDetailed(base64Audio, 'Jag är glad');
 * console.log('Primary emotion:', analysis.primaryEmotion);
 * console.log('Energy level:', analysis.energyLevel);
 * ```
 */
export const analyzeVoiceEmotionDetailed = async (
  audioData: string,
  transcript?: string
): Promise<AnalyzeVoiceEmotionResponse> => {
  const response = await api.post(
    API_ENDPOINTS.VOICE.ANALYZE_VOICE_EMOTION,
    { audio_data: audioData, transcript }
  );
  return response.data?.data || response.data;
};

/**
 * Check voice service availability
 * 
 * Returns status of Google Speech API, fallback options, and supported languages.
 * 
 * @returns Voice service status
 * 
 * @example
 * ```typescript
 * const status = await getVoiceServiceStatus();
 * if (status.googleSpeech) {
 *   // Use server-side transcription
 * } else if (status.webSpeechFallback) {
 *   // Use client-side Web Speech API
 * }
 * ```
 */
export const getVoiceServiceStatus = async (): Promise<VoiceServiceStatus> => {
  const response = await api.get(
    API_ENDPOINTS.VOICE.VOICE_STATUS
  );
  return response.data?.data || response.data;
};

/**
 * Helper: Convert audio Blob to Base64 string
 * 
 * @param blob - Audio Blob from MediaRecorder
 * @returns Promise<string> Base64-encoded audio
 * 
 * @example
 * ```typescript
 * const audioBlob = new Blob([audioData], { type: 'audio/webm' });
 * const base64 = await blobToBase64(audioBlob);
 * await transcribeAudio(base64);
 * ```
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = reader.result.split(',')[1] || reader.result;
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Helper: Record audio from microphone
 * 
 * @param durationMs - Recording duration in milliseconds
 * @returns Promise<Blob> Recorded audio blob
 * 
 * @example
 * ```typescript
 * const audioBlob = await recordAudio(3000); // 3 seconds
 * const base64 = await blobToBase64(audioBlob);
 * const result = await transcribeAudio(base64);
 * ```
 */
export const recordAudio = async (durationMs: number = 3000): Promise<Blob> => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      resolve(blob);
    };

    mediaRecorder.onerror = (error) => {
      stream.getTracks().forEach(track => track.stop());
      reject(error);
    };

    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), durationMs);
  });
};

// ============================================================================
// Export all
// ============================================================================

export default {
  transcribeVoiceAudio,
  analyzeVoiceEmotionDetailed,
  getVoiceServiceStatus,
  blobToBase64,
  recordAudio,
};
