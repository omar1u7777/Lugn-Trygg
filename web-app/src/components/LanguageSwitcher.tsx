import React from 'react';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import 'moment/locale/sv';
import 'moment/locale/nb';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'sv', name: t('language.swedish'), flag: '🇸🇪' },
    { code: 'en', name: t('language.english'), flag: '🇺🇸' },
    { code: 'no', name: t('language.norwegian'), flag: '🇳🇴' }
  ];

  const changeLanguage = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    moment.locale(languageCode === 'no' ? 'nb' : languageCode);
    localStorage.setItem('i18nextLng', languageCode);
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