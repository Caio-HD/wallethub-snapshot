import { registerAs } from '@nestjs/config';

/** 24h — poucos pedidos HTTP, alinhado a planos gratuitos (brapi/Stooq). */
const DEFAULT_QUOTES_REPEAT_MS = 86_400_000;
/** 24h entre refreshes BR no job agendado (evita martelar a API). */
const DEFAULT_BR_MIN_REFRESH_SEC = 86_400;
/** 24h entre refreshes internacionais (Stooq EOD). */
const DEFAULT_INTL_MIN_REFRESH_SEC = 86_400;

export interface InvestmentsConfig {
  /** Opcional: token brapi.dev para limites melhores no plano gratuito ou plano pago. */
  brapiToken: string;
  /** Intervalo do job repetível BullMQ (ms). */
  quotesRepeatMs: number;
  /** Mínimo entre refreshes de cotação BR (s), exceto quando o job pede `force`. */
  brMinRefreshSec: number;
  /** Mínimo entre refreshes de cotação internacional (s). */
  intlMinRefreshSec: number;
}

export const investmentsConfig = registerAs('investments', (): InvestmentsConfig => ({
  brapiToken: process.env.BRAPI_TOKEN?.trim() ?? '',
  quotesRepeatMs: Math.max(
    60_000,
    parseInt(process.env.INVESTMENT_QUOTES_REPEAT_MS ?? String(DEFAULT_QUOTES_REPEAT_MS), 10) ||
      DEFAULT_QUOTES_REPEAT_MS,
  ),
  brMinRefreshSec: Math.max(
    60,
    parseInt(process.env.INVESTMENT_BR_MIN_REFRESH_SEC ?? String(DEFAULT_BR_MIN_REFRESH_SEC), 10) ||
      DEFAULT_BR_MIN_REFRESH_SEC,
  ),
  intlMinRefreshSec: Math.max(
    3600,
    parseInt(
      process.env.INVESTMENT_INTL_MIN_REFRESH_SEC ?? String(DEFAULT_INTL_MIN_REFRESH_SEC),
      10,
    ) || DEFAULT_INTL_MIN_REFRESH_SEC,
  ),
}));
