import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ko from './locales/ko/translation.json';
import en from './locales/en/translation.json';
import ja from './locales/ja/translation.json';
import zh from './locales/zh/translation.json';

const resources = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
  zh: { translation: zh }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ko',  // 한국어 기본 (한국 사용자 대상 서비스)
    supportedLngs: ['ko', 'en', 'ja', 'zh'],
    interpolation: {
      escapeValue: false // React already does escaping
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'wm_customer_lang',
      caches: ['localStorage']
    }
  });

export default i18n;
