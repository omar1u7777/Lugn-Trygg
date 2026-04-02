import React, { useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Language configuration with display names and flags
const LANGUAGE_CONFIG = {
  sv: { code: 'sv', name: 'Svenska', flag: '🇸🇪', label: 'SV', translationKey: 'language.swedish' },
  en: { code: 'en', name: 'English', flag: '🇬🇧', label: 'EN', translationKey: 'language.english' },
  no: { code: 'no', name: 'Norsk', flag: '🇳🇴', label: 'NO', translationKey: 'language.norwegian' }
} as const;

type LanguageCode = keyof typeof LANGUAGE_CONFIG;

const normalizeLanguageCode = (code: string): LanguageCode => {
  const lowered = code.toLowerCase();
  if (lowered.startsWith('sv')) return 'sv';
  if (lowered === 'nb' || lowered.startsWith('nb-') || lowered.startsWith('no')) return 'no';
  if (lowered.startsWith('en')) return 'en';
  return 'sv'; // Default fallback
};

interface LanguageSwitcherProps {
  compact?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ compact = false }) => {
  const { i18n, t } = useTranslation();
  const currentLanguage = useMemo(() => normalizeLanguageCode(i18n.language), [i18n.language]);

  // Sync HTML lang attribute when language changes
  useEffect(() => {
    const normalizedLanguage = currentLanguage === 'no' ? 'nb' : currentLanguage;
    document.documentElement.lang = normalizedLanguage;
  }, [currentLanguage]);

  const changeLanguage = useCallback((languageCode: LanguageCode) => {
    try {
      i18n.changeLanguage(languageCode);
      localStorage.setItem('i18nextLng', languageCode);

      // Update HTML lang attribute immediately
      const htmlLang = languageCode === 'no' ? 'nb' : languageCode;
      document.documentElement.lang = htmlLang;
      
      // Track language change for analytics
      if (typeof window !== 'undefined' && (window as any).analytics) {
        (window as any).analytics.track('Language Changed', {
          from: currentLanguage,
          to: languageCode,
          component: 'LanguageSwitcher'
        });
      }
    } catch (error) {
      console.error('Failed to change language:', error);
      // Fallback: reload page with new language
      window.location.reload();
    }
  }, [i18n, currentLanguage]);

  const currentConfig = LANGUAGE_CONFIG[currentLanguage];

  return (
    <div className="relative">
      <select
        value={currentLanguage}
        onChange={(e) => changeLanguage(e.target.value as LanguageCode)}
        className={compact 
          ? "px-2 py-1 bg-transparent border-none text-gray-900 dark:text-white focus:outline-none cursor-pointer appearance-none pr-6 text-sm"
          : "px-2 sm:px-3 py-2 bg-[#f2e4d4] dark:bg-slate-800 hover:bg-[#e8dcd0] dark:hover:bg-slate-700 border border-[#e8dcd0] dark:border-slate-700 rounded-xl text-[#2f2a24] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2c8374] cursor-pointer appearance-none pr-8 sm:pr-10 min-w-[80px] sm:min-w-[140px] text-sm transition-all duration-200"
        }
        aria-label={t('language.selectLanguage', 'Välj språk')}
      >
        {Object.values(LANGUAGE_CONFIG).map((lang) => (
          <option 
            key={lang.code} 
            value={lang.code}
          >
            {lang.flag} {t(lang.translationKey)}
          </option>
        ))}
      </select>
      
      {/* Custom dropdown arrow */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 pointer-events-none">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Current language indicator (visible on mobile) */}
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 rounded-full border-2 border-white dark:border-slate-800 sm:hidden" 
            aria-hidden="true" 
            title={`Current: ${currentConfig.name}`} />
    </div>
  );
};

export default LanguageSwitcher;
