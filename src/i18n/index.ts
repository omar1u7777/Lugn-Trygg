import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { isDevEnvironment } from '../config/env';

import svTranslations from './locales/sv.json';
import enTranslations from './locales/en.json';
import noTranslations from './locales/no.json';

const resources = {
  sv: {
    translation: svTranslations
  },
  en: {
    translation: enTranslations
  },
  no: {
    translation: noTranslations
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: 'sv', // Force Swedish for tests
    fallbackLng: 'sv',
    debug: isDevEnvironment(),

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'language'
    },

    react: {
      useSuspense: false
    }
  });

export default i18n;