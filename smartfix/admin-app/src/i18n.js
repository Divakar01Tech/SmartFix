import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en.json';
import taTranslation from './locales/ta.json';

const savedLang = localStorage.getItem('smartfix_lang');
const initialLang = (savedLang === 'ta' || savedLang === 'ta_en') ? 'ta' : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      ta: { translation: taTranslation },
    },
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
