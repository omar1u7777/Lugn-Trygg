import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}

interface TranslationCache {
  [key: string]: {
    original: string;
    translated: string;
    from: string;
    to: string;
    timestamp: Date;
  };
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' }
];

export const useMultiLanguageChat = (userId: string) => {
  const { i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<string>(i18n.language);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationCache, setTranslationCache] = useState<TranslationCache>({});
  const [autoDetect, setAutoDetect] = useState(true);

  // Load cached translations
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`translation-cache-${userId}`);
      if (cached) {
        const parsed = JSON.parse(cached) as Record<string, Omit<TranslationCache[string], 'timestamp'> & { timestamp: string }>;
        // Convert timestamps back to Date objects
        const converted: TranslationCache = {};
        Object.entries(parsed).forEach(([key, value]) => {
          converted[key] = {
            ...value,
            timestamp: new Date(value.timestamp)
          };
        });
        setTranslationCache(converted);
      }
    } catch (error) {
      logger.error('Failed to load translation cache:', error);
    }
  }, [userId]);

  // Detect language of text
  const detectLanguage = useCallback(async (text: string): Promise<string> => {
    // Simple detection based on characters
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[ñáéíóúü]/i.test(text)) return 'es';
    if (/[àâäçéèêëïîôöùûüÿ]/i.test(text)) return 'fr';
    if (/[äöüß]/i.test(text)) return 'de';
    if (/[åæø]/i.test(text)) return 'no';
    if (/[åäö]/i.test(text)) return 'sv';
    
    // Default to English
    return 'en';
  }, []);

  // Translate text using cached or API
  const translateText = useCallback(async (
    text: string,
    from: string,
    to: string
  ): Promise<string> => {
    // No translation needed
    if (from === to) return text;

    // Check cache first
    const cacheKey = `${from}-${to}-${text.substring(0, 100)}`;
    const cached = translationCache[cacheKey];
    
    if (cached) {
      // Check if cache is still valid (24 hours)
      const age = Date.now() - cached.timestamp.getTime();
      if (age < CACHE_TTL_MS) {
        return cached.translated;
      }
    }

    setIsTranslating(true);
    
    try {
      // Mock translation removed (F4 audit): avoid fake [LANG] prefixes and synthetic delays.
      // Until a dedicated translation endpoint exists, return original text as a safe fallback.
      const translated = text;

      logger.warn('Translation service unavailable; returning original text', {
        from,
        to,
      });
      
      // Cache the translation
      const newCache = {
        ...translationCache,
        [cacheKey]: {
          original: text,
          translated,
          from,
          to,
          timestamp: new Date()
        }
      };
      
      setTranslationCache(newCache);
      
      // Save to localStorage
      try {
        localStorage.setItem(`translation-cache-${userId}`, JSON.stringify(newCache));
      } catch (error) {
        logger.error('Failed to save translation cache:', error);
      }
      
      return translated;
    } catch (error) {
      logger.error('Translation failed:', error);
      return text; // Return original on error
    } finally {
      setIsTranslating(false);
    }
  }, [translationCache, userId]);

  // Process message with translation
  const processMessage = useCallback(async (
    message: string,
    userLanguage?: string
  ): Promise<{
    original: string;
    translated: string;
    detectedLanguage: string;
    targetLanguage: string;
  }> => {
    // Detect or use provided language
    const detected = userLanguage || await detectLanguage(message);
    const target = selectedLanguage;
    
    // Translate if needed
    const translated = await translateText(message, detected, target);
    
    return {
      original: message,
      translated,
      detectedLanguage: detected,
      targetLanguage: target
    };
  }, [selectedLanguage, detectLanguage, translateText]);

  // Switch language
  const switchLanguage = useCallback((languageCode: string) => {
    setSelectedLanguage(languageCode);
    i18n.changeLanguage(languageCode);
    
    // Save preference
    try {
      localStorage.setItem(`preferred-language-${userId}`, languageCode);
    } catch (error) {
      logger.error('Failed to save language preference:', error);
    }
    
    logger.info('Language switched to:', languageCode);
  }, [i18n, userId]);

  // Get language info
  const getLanguageInfo = useCallback((code: string): Language | undefined => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
  }, []);

  // Get available languages
  const getAvailableLanguages = useCallback((): Language[] => {
    return SUPPORTED_LANGUAGES;
  }, []);

  // Clear translation cache
  const clearCache = useCallback(() => {
    setTranslationCache({});
    localStorage.removeItem(`translation-cache-${userId}`);
    logger.info('Translation cache cleared');
  }, [userId]);

  // Language selector component props
  const languageSelectorProps = {
    currentLanguage: selectedLanguage,
    languages: SUPPORTED_LANGUAGES,
    onLanguageChange: switchLanguage,
    isTranslating
  };

  return {
    selectedLanguage,
    isTranslating,
    autoDetect,
    translationCache,
    processMessage,
    translateText,
    switchLanguage,
    detectLanguage,
    getLanguageInfo,
    getAvailableLanguages,
    clearCache,
    setAutoDetect,
    languageSelectorProps
  };
};

export default useMultiLanguageChat;
