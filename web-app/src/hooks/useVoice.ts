import { useState, useEffect, useCallback } from 'react';
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
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = i18n.language === 'sv' ? 'sv-SE' : i18n.language === 'no' ? 'nb-NO' : 'en-US';

      recognitionInstance.onstart = () => {
        setError(null);
      };

      recognitionInstance.onresult = (event) => {
        const result = event.results[0]?.[0]?.transcript.toLowerCase();
        if (result) {
          setTranscript(result);
          processCommand(result);
        }
      };

      recognitionInstance.onerror = (event) => {
        setError(event.error);
      };

      recognitionInstance.onend = () => {
        // Auto-restart if still listening
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
      const matched = cmd.keywords.some(keyword =>
        spokenText.includes(keyword.toLowerCase())
      );
      if (matched) {
        cmd.action();
        break;
      }
    }
  }, [commands]);

  const startListening = useCallback(() => {
    if (recognition && !recognition.continuous) {
      recognition.start();
    }
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
    }
  }, [recognition]);

  useEffect(() => {
    if (isListening) {
      startListening();
    } else {
      stopListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isSupported,
    transcript,
    error,
    startListening,
    stopListening,
  };
};