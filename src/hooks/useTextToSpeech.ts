import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../utils/logger';

interface UseTextToSpeechOptions {
  /** BCP-47 locale, e.g. 'sv-SE'. Defaults to 'sv-SE'. */
  language?: string;
  /** Speech rate, 0.1–10. Default 1.0. Slightly slower (0.95) reads more calming. */
  rate?: number;
  /** Speech pitch, 0–2. Default 1.0. */
  pitch?: number;
  /** Volume, 0–1. Default 1.0. */
  volume?: number;
}

export interface UseTextToSpeechResult {
  /** True if the browser supports SpeechSynthesis. */
  isSupported: boolean;
  /** True while any utterance is currently being spoken. */
  isSpeaking: boolean;
  /** Identifier (typically message id) of the currently spoken utterance. */
  speakingId: string | null;
  /** Speak text. Cancels any in-progress utterance first. */
  speak: (text: string, id?: string) => void;
  /** Cancel any in-progress speech. */
  stop: () => void;
}

/**
 * Browser-native text-to-speech using the Web Speech Synthesis API.
 *
 * Free, runs entirely client-side, supports Swedish voices when the OS provides
 * them (built-in on macOS / iOS / modern Windows / Android).
 */
export const useTextToSpeech = (
  options: UseTextToSpeechOptions = {}
): UseTextToSpeechResult => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    // Some browsers populate voices asynchronously.
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }

    return () => {
      if (typeof window.speechSynthesis.removeEventListener === 'function') {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      }
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const speak = useCallback(
    (text: string, id?: string) => {
      if (!isSupported || !text || !text.trim()) return;

      // Strip markdown syntax so the AI doesn't read "asterisk asterisk bold".
      const cleanText = text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^[-*•]\s+/gm, '')
        .replace(/^\d+[.)]\s+/gm, '')
        .trim();

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        const lang = options.language || 'sv-SE';
        utterance.lang = lang;
        utterance.rate = options.rate ?? 0.95;
        utterance.pitch = options.pitch ?? 1.0;
        utterance.volume = options.volume ?? 1.0;

        const voices = voicesRef.current;
        const langPrefix = lang.split('-')[0];
        const exact = voices.find((v) => v.lang === lang);
        const prefix = !exact ? voices.find((v) => v.lang.startsWith(langPrefix)) : undefined;
        const chosen = exact || prefix;
        if (chosen) {
          utterance.voice = chosen;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
          setSpeakingId(id || null);
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          setSpeakingId(null);
        };
        utterance.onerror = (event) => {
          // 'interrupted' / 'canceled' fire whenever we call cancel() — not real errors.
          const err = (event as SpeechSynthesisErrorEvent).error;
          if (err && err !== 'interrupted' && err !== 'canceled') {
            logger.warn('TTS error:', err);
          }
          setIsSpeaking(false);
          setSpeakingId(null);
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        logger.warn('TTS speak failed:', err);
        setIsSpeaking(false);
        setSpeakingId(null);
      }
    },
    [isSupported, options.language, options.rate, options.pitch, options.volume]
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    setIsSpeaking(false);
    setSpeakingId(null);
  }, [isSupported]);

  return { isSupported, isSpeaking, speakingId, speak, stop };
};

export default useTextToSpeech;
