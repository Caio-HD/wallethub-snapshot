import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@shared/i18n/config';
import { RTL_LANGUAGES, type SupportedLanguage } from '@shared/i18n/config';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleLanguageChange = (lng: SupportedLanguage) => {
      document.documentElement.lang = lng;
      document.documentElement.dir = RTL_LANGUAGES.includes(lng) ? 'rtl' : 'ltr';
    };

    // Set initial values
    const currentLang = i18n.language as SupportedLanguage;
    handleLanguageChange(currentLang);

    // Subscribe to language changes
    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}