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
    <div className="language-switcher">
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="language-select"
        aria-label={t('language.selectLanguage')}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
