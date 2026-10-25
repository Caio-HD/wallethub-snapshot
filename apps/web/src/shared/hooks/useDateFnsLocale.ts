import { useMemo } from 'react';
import { useLocale } from './useLocale';
import type { SupportedLanguage } from '@shared/i18n/config';
import type { Locale } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { fr } from 'date-fns/locale/fr';
import { de } from 'date-fns/locale/de';
import { it } from 'date-fns/locale/it';
import { zhCN } from 'date-fns/locale/zh-CN';
import { ja } from 'date-fns/locale/ja';
import { ar } from 'date-fns/locale/ar';

const DATE_FNS_LOCALE_MAP: Record<SupportedLanguage, Locale> = {
  pt: ptBR,
  en: enUS,
  es,
  fr,
  de,
  it,
  zh: zhCN,
  ja,
  ar,
};

export function useDateFnsLocale(): Locale {
  const { currentLang } = useLocale();
  return useMemo(() => DATE_FNS_LOCALE_MAP[currentLang] ?? ptBR, [currentLang]);
}
