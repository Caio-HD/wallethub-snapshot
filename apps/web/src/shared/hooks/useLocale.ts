import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, RTL_LANGUAGES, type SupportedLanguage } from '@shared/i18n/config';

export function useLocale() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language as SupportedLanguage;

  return {
    currentLang,
    isRTL: RTL_LANGUAGES.includes(currentLang),
    supportedLanguages: SUPPORTED_LANGUAGES,
    setLanguage: (lang: SupportedLanguage) => i18n.changeLanguage(lang),
  };
}