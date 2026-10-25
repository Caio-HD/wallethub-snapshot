import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface BrapiConfig {
  brapiToken?: string;
}

interface BrapiResponse {
  currency?: Array<{
    bid?: string;
  }>;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(private readonly configService: ConfigService) {}

  async getExchangeRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    const config = this.configService.get<BrapiConfig>('investments');
    const token = config?.brapiToken;
    const pair = `${from.toUpperCase()}-${to.toUpperCase()}`;
    const url = new URL('https://brapi.dev/api/v2/currency');
    url.searchParams.set('currency', pair);
    if (token) url.searchParams.set('token', token);

    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = (await res.json()) as BrapiResponse;
        const price = data.currency?.[0]?.bid;
        if (price) return parseFloat(price);
      }
    } catch (e) {
      this.logger.error(`Failed to fetch FX rate for ${pair}: ${(e as Error).message}`);
    }

    if (from === 'USD' && to === 'BRL') return 5.0; // Fallback
    return 1;
  }
}
