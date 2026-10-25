import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../../../common/constants/languages.js';

const DEFAULT_LOCALE: SupportedLanguage = 'pt';
const SUPPORTED = new Set<string>(SUPPORTED_LANGUAGES);

/**
 * Normaliza um locale possivelmente com sub-tag (ex.: `pt-BR`, `en-US`) para um
 * idioma suportado. Locale desconhecido cai no fallback `pt`.
 */
export function resolveOtpLocale(raw?: string | null): SupportedLanguage {
  const base = raw?.split('-')[0]?.trim().toLowerCase();
  return base && SUPPORTED.has(base) ? (base as SupportedLanguage) : DEFAULT_LOCALE;
}

type Unit = 'minute' | 'hour' | 'day';

/** Lexicon mínimo de unidades de tempo por idioma (singular, plural). */
const UNIT_LABELS: Record<SupportedLanguage, Record<Unit, [string, string]>> = {
  pt: { minute: ['minuto', 'minutos'], hour: ['hora', 'horas'], day: ['dia', 'dias'] },
  en: { minute: ['minute', 'minutes'], hour: ['hour', 'hours'], day: ['day', 'days'] },
  es: { minute: ['minuto', 'minutos'], hour: ['hora', 'horas'], day: ['día', 'días'] },
  fr: { minute: ['minute', 'minutes'], hour: ['heure', 'heures'], day: ['jour', 'jours'] },
  de: { minute: ['Minute', 'Minuten'], hour: ['Stunde', 'Stunden'], day: ['Tag', 'Tage'] },
  it: { minute: ['minuto', 'minuti'], hour: ['ora', 'ore'], day: ['giorno', 'giorni'] },
  zh: { minute: ['分钟', '分钟'], hour: ['小时', '小时'], day: ['天', '天'] },
  ja: { minute: ['分', '分'], hour: ['時間', '時間'], day: ['日', '日'] },
  ar: { minute: ['دقيقة', 'دقائق'], hour: ['ساعة', 'ساعات'], day: ['يوم', 'أيام'] },
};

/** Idiomas em que não se insere espaço entre número e unidade. */
const NO_SPACE_LOCALES = new Set<SupportedLanguage>(['zh', 'ja']);

function label(lang: SupportedLanguage, unit: Unit, value: number): string {
  const [singular, plural] = UNIT_LABELS[lang][unit];
  const word = value === 1 ? singular : plural;
  return NO_SPACE_LOCALES.has(lang) ? `${value}${word}` : `${value} ${word}`;
}

/**
 * Formata um TTL em minutos para um rótulo humano e localizado, evitando
 * absurdos como "1440 minutos". Colapsa para horas/dias quando exato.
 */
export function formatOtpTtl(minutes: number, rawLang?: string | null): string {
  const lang = resolveOtpLocale(rawLang);
  const m = Math.max(1, Math.floor(minutes));
  if (m % 1440 === 0) return label(lang, 'day', m / 1440);
  if (m % 60 === 0 && m < 1440) return label(lang, 'hour', m / 60);
  return label(lang, 'minute', m);
}
