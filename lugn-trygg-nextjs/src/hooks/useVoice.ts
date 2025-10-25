import { useState, useEffect, useCallback } from 'react';
// Use DOM types from globalThis for SpeechRecognition
type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : any;
type SpeechRecognitionEventType = typeof window extends { SpeechRecognitionEvent: infer T } ? T : any;
import { useTranslation } from 'react-i18next';

interface VoiceCommand {
  command: string;
  action: () => void;
  keywords: string[];
}

interface UseVoiceProps {
  commands: VoiceCommand[];
  isListening?: boolean;
}

export const useVoice = ({ commands, isListening = false }: UseVoiceProps) => {
  const { i18n } = useTranslation();
  // Use explicit type for recognition (SpeechRecognition | null)
  const [recognition, setRecognition] = useState<SpeechRecognitionType | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition)) {
      const SpeechRecognitionCtor = (window as typeof window & { SpeechRecognition?: any; webkitSpeechRecognition?: any; }).SpeechRecognition || (window as typeof window & { SpeechRecognition?: any; webkitSpeechRecognition?: any; }).webkitSpeechRecognition;
  const recognitionInstance: SpeechRecognitionType = new SpeechRecognitionCtor();

      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = i18n.language === 'sv' ? 'sv-SE' : i18n.language === 'no' ? 'nb-NO' : 'en-US';

      recognitionInstance.onstart = () => setError(null);

  recognitionInstance.onresult = (event: SpeechRecognitionEventType) => {
        const result = event.results[0]?.[0]?.transcript.toLowerCase();
        if (result) {
          setTranscript(result);
          processCommand(result);
        }
      };

  recognitionInstance.onerror = (event: Event & { error?: string }) => setError(event.error || 'speech_error');

      recognitionInstance.onend = () => {
        if (isListening) {
          setTimeout(() => startListening(), 1000);
        }
      };

      setRecognition(recognitionInstance);
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, [i18n.language]);

  const processCommand = useCallback((spokenText: string) => {
    for (const cmd of commands) {
      const matched = cmd.keywords.some(keyword => spokenText.includes(keyword.toLowerCase()));
      if (matched) {
        cmd.action();
        break;
      }
    }
  }, [commands]);

  const startListening = useCallback(() => {
  if (recognition && !(recognition as SpeechRecognitionType).continuous) {
      try { recognition.start(); } catch (e) { /* ignore */ }
    }
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (recognition) recognition.stop();
  }, [recognition]);

  useEffect(() => {
    if (isListening) startListening(); else stopListening();
  }, [isListening, startListening, stopListening]);

  return { isSupported, transcript, error, startListening, stopListening };
};
