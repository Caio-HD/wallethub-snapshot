export const SUPPORTED_CURRENCIES = [
  'BRL',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'CHF',
  'CNY',
  'ARS',
  'MXN',
  'CLP',
  'COP',
  'PEN',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
