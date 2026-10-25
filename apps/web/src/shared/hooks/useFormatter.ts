import { useMemo } from 'react';
import { useLocale } from './useLocale';
import type { SupportedLanguage } from '@shared/i18n/config';

const LOCALE_MAP: Record<SupportedLanguage, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ar: 'ar-SA',
};

const CURRENCY_MAP: Record<SupportedLanguage, string> = {
  pt: 'BRL',
  en: 'USD',
  es: 'EUR',
  fr: 'EUR',
  de: 'EUR',
  it: 'EUR',
  zh: 'CNY',
  ja: 'JPY',
  ar: 'SAR',
};

export function useFormatter() {
  const { currentLang } = useLocale();

  const bcp47 = LOCALE_MAP[currentLang] ?? 'pt-BR';
  const currency = CURRENCY_MAP[currentLang] ?? 'BRL';

  const formatCurrency = useMemo(
    () =>
      new Intl.NumberFormat(bcp47, { style: 'currency', currency }).format,
    [bcp47, currency],
  );

  const formatDate = useMemo(
    () =>
      (dateStr: string | null | undefined): string => {
        if (!dateStr) return '—';
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '—';
          return new Intl.DateTimeFormat(bcp47, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }).format(d);
        } catch {
          return '—';
        }
      },
    [bcp47],
  );

  return { formatCurrency, formatDate, bcp47, currency };
}
