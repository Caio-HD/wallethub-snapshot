export function formatCurrency(value: number, lang: string): string {
  const currencyMap: Record<string, string> = {
    pt: 'BRL',
    en: 'USD',
    es: 'EUR',
    de: 'EUR',
    fr: 'EUR',
    it: 'EUR',
    zh: 'CNY',
    ja: 'JPY',
    ar: 'SAR'
  };
  return new Intl.NumberFormat(lang, { style: 'currency', currency: currencyMap[lang] ?? 'USD' }).format(value);
}

export function formatDate(date: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}