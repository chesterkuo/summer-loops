import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import en from './locales/en.json';
import zhTW from './locales/zh-TW.json';
import zhCN from './locales/zh-CN.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import vi from './locales/vi.json';
import th from './locales/th.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export const resources = {
  en: { translation: en },
  'zh-TW': { translation: zhTW },
  'zh-CN': { translation: zhCN },
  ja: { translation: ja },
  ko: { translation: ko },
  vi: { translation: vi },
  th: { translation: th },
  es: { translation: es },
  fr: { translation: fr },
};

export const supportedLanguages = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', label: 'ไทย', flag: '🇹🇭' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

// Map browser language codes to our supported codes
// iOS/Android may report zh-Hans/zh-Hant instead of zh-CN/zh-TW
const languageMap: Record<string, string> = {
  'zh-Hans': 'zh-CN',
  'zh-Hans-CN': 'zh-CN',
  'zh-Hans-SG': 'zh-CN',
  'zh-Hant': 'zh-TW',
  'zh-Hant-TW': 'zh-TW',
  'zh-Hant-HK': 'zh-TW',
  'zh-Hant-MO': 'zh-TW',
  'zh': 'zh-CN', // Default Chinese to Simplified
};

// Custom language detector that maps variants
const customNavigatorDetector = {
  name: 'customNavigator',
  lookup(): string | undefined {
    const browserLangs = navigator.languages || [navigator.language];
    for (const lang of browserLangs) {
      // Check direct mapping first
      if (languageMap[lang]) {
        return languageMap[lang];
      }
      // Check if it's a supported language
      const supported = supportedLanguages.find(l => l.code === lang);
      if (supported) {
        return lang;
      }
      // Check base language (e.g., 'ja-JP' -> 'ja')
      const baseLang = lang.split('-')[0];
      const baseSupported = supportedLanguages.find(l => l.code === baseLang);
      if (baseSupported) {
        return baseLang;
      }
    }
    return undefined;
  },
};

// Add custom detector to LanguageDetector
const languageDetector = new LanguageDetector();
languageDetector.addDetector(customNavigatorDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: supportedLanguages.map(l => l.code),

    detection: {
      order: ['localStorage', 'customNavigator', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;
