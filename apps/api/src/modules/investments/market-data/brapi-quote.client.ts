import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InvestmentsConfig } from '../../../core/config/investments.config';
import type { MarketQuoteResult } from './market-quote.types';

/**
 * Cotações B3 via brapi.dev (https://brapi.dev/docs).
 * Uso típico **gratuito**: sem `BRAPI_TOKEN` ou com token do plano free; menos pedidos = mais seguro
 * para limites — ver intervalos em `investments.config` (padrão ~1×/dia + batch por lista).
 */
@Injectable()
export class BrapiQuoteClient {
  private readonly logger = new Logger(BrapiQuoteClient.name);

  constructor(private readonly configService: ConfigService) {}

  private getCfg(): InvestmentsConfig {
    return this.configService.getOrThrow<InvestmentsConfig>('investments');
  }

  /**
   * Vários tickers num único pedido: `GET /api/quote/list?stock=PETR4,VALE3`
   */
  async fetchQuotes(symbols: string[]): Promise<Map<string, MarketQuoteResult>> {
    const out = new Map<string, MarketQuoteResult>();
    if (symbols.length === 0) return out;

    const cfg = this.getCfg();
    const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
    const chunkSize = 20;

    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const stock = chunk.join(',');
      const token = cfg.brapiToken;
      const url = new URL('https://brapi.dev/api/quote/list');
      url.searchParams.set('stock', stock);
      if (token) url.searchParams.set('token', token);

      try {
        const res = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(25_000),
        });
        if (!res.ok) {
          this.logger.warn(`brapi HTTP ${res.status} para ${stock}`);
          continue;
        }
        const data = (await res.json()) as {
          results?: Array<{
            symbol?: string;
            regularMarketPrice?: number;
            currency?: string;
          }>;
        };
        const rows = data.results ?? [];
        for (const row of rows) {
          const sym = row.symbol?.toUpperCase();
          const price = row.regularMarketPrice;
          if (!sym || price == null || Number.isNaN(Number(price))) continue;
          out.set(sym, {
            lastPrice: Number(price),
            currency: (row.currency ?? 'BRL').toUpperCase(),
          });
        }
      } catch (e) {
        this.logger.warn(`brapi falhou (${stock}): ${(e as Error).message}`);
      }
    }

    return out;
  }
}
