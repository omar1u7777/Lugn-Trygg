import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import sv from './locales/sv.json';
import en from './locales/en.json';
import no from './locales/no.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      sv: { translation: sv },
      en: { translation: en },
      no: { translation: no },
    },
    lng: 'sv', // Force Swedish to prevent detection issues
    fallbackLng: 'sv',
    interpolation: { escapeValue: false },
  });

export default i18n;