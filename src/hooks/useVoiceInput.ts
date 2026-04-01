import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

interface UseVoiceInputOptions {
  onTranscript?: (transcript: string) => void;
  onError?: (error: Error) => void;
  language?: string;
}

// Define proper types for Speech Recognition API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export const useVoiceInput = (options: UseVoiceInputOptions = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef('');
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Initialize speech recognition on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      logger.warn('Speech recognition not supported in this browser');
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = optionsRef.current.language || 'sv-SE';

    recognition.onstart = () => {
      setIsListening(true);
      logger.info('Voice recognition started');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk: string = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += chunk + ' ';
          const full = finalTranscriptRef.current.trim();
          setTranscript(full);
          optionsRef.current.onTranscript?.(full);
        } else {
          interimTranscript += chunk;
        }
      }
      setTranscript((finalTranscriptRef.current + interimTranscript).trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      logger.error('Speech recognition error:', event.error);
      const messages: Record<string, string> = {
        'no-speech': 'Inget tal upptäcktes',
        'audio-capture': 'Kunde inte komma åt mikrofonen',
        'not-allowed': 'Mikrofonåtkomst nekad',
        'network': 'Nätverksfel vid röstigenkänning',
      };
      const msg = messages[event.error as string] ?? 'Röstigenkänning misslyckades';
      optionsRef.current.onError?.(new Error(msg));
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      logger.info('Voice recognition ended');
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.abort(); } catch { /* ignore */ }
    };
  }, []); // only on mount - language changes require remount

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      optionsRef.current.onError?.(new Error('Röstigenkänning stöds inte i denna webbläsare'));
      return;
    }
    finalTranscriptRef.current = '';
    setTranscript('');
    try {
      recognitionRef.current.start();
    } catch (err) {
      logger.error('Failed to start speech recognition:', err);
      optionsRef.current.onError?.(err instanceof Error ? err : new Error('Kunde inte starta röstigenkänning'));
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
  }, []);

  const clearTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
  };
};

export default useVoiceInput;
