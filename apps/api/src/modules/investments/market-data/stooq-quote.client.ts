import { Injectable, Logger } from '@nestjs/common';
import type { MarketQuoteResult } from './market-quote.types';

/**
 * Cotação atrasada / EOD via Stooq (CSV público, sem chave nem custo de API).
 * Respeitar os termos de uso do site. Ex.: `aapl.us`.
 */
@Injectable()
export class StooqQuoteClient {
  private readonly logger = new Logger(StooqQuoteClient.name);

  async fetchQuote(stooqSymbol: string): Promise<MarketQuoteResult | null> {
    const s = stooqSymbol.trim().toLowerCase();
    if (!s) return null;

    const url = new URL('https://stooq.com/q/l/');
    url.searchParams.set('s', s);
    url.searchParams.set('f', 'sd2t2ohlcv');
    url.searchParams.set('h', '');
    url.searchParams.set('e', 'csv');

    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: 'text/csv' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        this.logger.warn(`stooq HTTP ${res.status} para ${s}`);
        return null;
      }
      const text = await res.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
      if (lines.length < 2) return null;
      const header = lines[0].split(',');
      const values = lines[lines.length - 1].split(',');
      const closeIdx = header.findIndex((h) => h.trim().toLowerCase() === 'close');
      if (closeIdx < 0 || values[closeIdx] == null) return null;
      const close = parseFloat(values[closeIdx].trim());
      if (Number.isNaN(close)) return null;
      const currency = s.endsWith('.us') || s.endsWith('.de') ? 'USD' : 'USD';
      return { lastPrice: close, currency };
    } catch (e) {
      this.logger.warn(`stooq falhou (${s}): ${(e as Error).message}`);
      return null;
    }
  }
}
