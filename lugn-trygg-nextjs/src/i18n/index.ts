import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import sv from './locales/sv.json';
import en from './locales/en.json';
import no from './locales/no.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      sv: { translation: sv },
      en: { translation: en },
      no: { translation: no },
    },
    lng: 'sv', // Force Swedish for tests
    fallbackLng: 'sv',
    interpolation: { escapeValue: false },
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
