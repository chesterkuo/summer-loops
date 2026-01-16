import { create } from 'zustand';
import i18n from '../i18n';
import { supportedLanguages } from '../i18n';

interface LocaleState {
  currentLocale: string;
  supportedLanguages: typeof supportedLanguages;
  setLocale: (locale: string) => void;
  getCurrentLanguage: () => typeof supportedLanguages[0] | undefined;
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  currentLocale: i18n.language || 'en',
  supportedLanguages,

  setLocale: (locale: string) => {
    i18n.changeLanguage(locale);
    set({ currentLocale: locale });
  },

  getCurrentLanguage: () => {
    const { currentLocale, supportedLanguages } = get();
    return supportedLanguages.find(lang => lang.code === currentLocale);
  },
}));

// Listen for language changes from i18n
i18n.on('languageChanged', (lng) => {
  useLocaleStore.setState({ currentLocale: lng });
});
