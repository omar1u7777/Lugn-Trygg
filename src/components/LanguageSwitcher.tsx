import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'sv', name: t('language.swedish'), flag: '🇸🇪' },
    { code: 'en', name: t('language.english'), flag: '🇺🇸' },
    { code: 'no', name: t('language.norwegian'), flag: '🇳🇴' }
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
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="px-4 py-2 bg-[#f2e4d4] dark:bg-slate-800 hover:bg-[#e8dcd0] dark:hover:bg-slate-700 border border-[#e8dcd0] dark:border-slate-700 rounded-xl text-[#2f2a24] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2c8374] cursor-pointer appearance-none pr-10 min-w-[120px] text-sm transition-all duration-200"
        aria-label={t('language.selectLanguage')}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
