import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const normalizeLanguageCode = (code: string): string => {
  const lowered = code.toLowerCase();
  if (lowered.startsWith('sv')) {
    return 'sv';
  }

  if (lowered === 'nb' || lowered.startsWith('nb-') || lowered.startsWith('no')) {
    return 'no';
  }

  if (lowered.startsWith('en')) {
    return 'en';
  }

  return lowered;
};

const normalizeLanguageDisplayName = (code: string, name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) {
    return name;
  }

  // Safety guard for odd locale strings such as "se Svenska".
  if (code === 'sv' && /^se\s+svenska$/i.test(trimmed)) {
    return 'Svenska';
  }

  return trimmed;
};

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const currentLanguage = normalizeLanguageCode(i18n.language);

  const languages = [
    { code: 'sv', name: t('language.swedish') },
    { code: 'en', name: t('language.english') },
    { code: 'no', name: t('language.norwegian') }
  ];

  useEffect(() => {
    const activeLanguage = i18n.language === 'no' ? 'nb' : i18n.language;
    document.documentElement.lang = activeLanguage;
  }, [i18n.language]);

  const changeLanguage = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    localStorage.setItem('i18nextLng', languageCode);
    const normalizedLanguage = languageCode === 'no' ? 'nb' : languageCode;
    document.documentElement.lang = normalizedLanguage;
  };

  return (
    <div className="relative">
      <select
        value={currentLanguage}
        onChange={(e) => changeLanguage(e.target.value)}
        className="px-2 sm:px-4 py-2 bg-[#f2e4d4] dark:bg-slate-800 hover:bg-[#e8dcd0] dark:hover:bg-slate-700 border border-[#e8dcd0] dark:border-slate-700 rounded-xl text-[#2f2a24] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2c8374] cursor-pointer appearance-none pr-7 sm:pr-10 min-w-[60px] sm:min-w-[120px] text-sm transition-all duration-200"
        aria-label={t('language.selectLanguage')}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.code.toUpperCase()}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 pointer-events-none">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
