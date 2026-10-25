import { Injectable } from '@nestjs/common';
import { BrapiQuoteClient } from './brapi-quote.client';
import { StooqQuoteClient } from './stooq-quote.client';
import type { InvestmentInstrumentEntity } from '../../../database/entities/investment-instrument.entity';
import type { MarketQuoteResult } from './market-quote.types';

@Injectable()
export class InvestmentMarketDataService {
  constructor(
    private readonly brapi: BrapiQuoteClient,
    private readonly stooq: StooqQuoteClient,
  ) {}

  async fetchForInstrument(inst: InvestmentInstrumentEntity): Promise<MarketQuoteResult | null> {
    if (inst.market === 'BR') {
      const map = await this.brapi.fetchQuotes([inst.symbol]);
      return map.get(inst.symbol.toUpperCase()) ?? null;
    }
    const qsym = (inst.quoteSymbol ?? `${inst.symbol.toLowerCase()}.us`).trim();
    return this.stooq.fetchQuote(qsym);
  }

  async fetchBatchBr(
    instruments: InvestmentInstrumentEntity[],
  ): Promise<Map<string, MarketQuoteResult>> {
    const syms = instruments.filter((i) => i.market === 'BR').map((i) => i.symbol);
    return this.brapi.fetchQuotes(syms);
  }
}
