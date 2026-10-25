import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvestmentInstrumentEntity } from '../../database/entities/investment-instrument.entity.js';
import { InvestmentQuoteSnapshotEntity } from '../../database/entities/investment-quote-snapshot.entity.js';
import type { InvestmentsConfig } from '../../core/config/investments.config';
import { QUEUE_INVESTMENT_QUOTES } from '../../queues';
import { InvestmentMarketDataService } from './market-data/investment-market-data.service';
import { InvestmentsService } from './investments.service';

@Injectable()
@Processor(QUEUE_INVESTMENT_QUOTES)
export class InvestmentQuotesProcessor extends WorkerHost {
  private readonly logger = new Logger(InvestmentQuotesProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly marketData: InvestmentMarketDataService,
    private readonly investmentsService: InvestmentsService,
    @InjectRepository(InvestmentInstrumentEntity)
    private readonly instruments: Repository<InvestmentInstrumentEntity>,
    @InjectRepository(InvestmentQuoteSnapshotEntity)
    private readonly quotes: Repository<InvestmentQuoteSnapshotEntity>,
  ) {
    super();
  }

  private getInv(): InvestmentsConfig {
    return this.configService.getOrThrow<InvestmentsConfig>('investments');
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'sync-instrument') {
      const data = job.data as { instrumentId?: string; force?: boolean };
      if (data.instrumentId) await this.syncOne(data.instrumentId, Boolean(data.force));
      return;
    }
    await this.syncAll();
  }

  private async shouldRefresh(inst: InvestmentInstrumentEntity): Promise<boolean> {
    const cfg = this.getInv();
    const minSec = inst.market === 'BR' ? cfg.brMinRefreshSec : cfg.intlMinRefreshSec;
    const last = await this.quotes.findOne({
      where: { instrumentId: inst.id },
      order: { recordedAt: 'DESC' },
    });
    if (!last) return true;
    const elapsed = (Date.now() - new Date(last.recordedAt).getTime()) / 1000;
    return elapsed >= minSec;
  }

  /** `force` ignora TTL (ex.: após novo movimento) para uma única chamada à API. */
  private async syncOne(instrumentId: string, force = false): Promise<void> {
    const inst = await this.instruments.findOne({ where: { id: instrumentId } });
    if (!inst) return;
    if (!force && !(await this.shouldRefresh(inst))) return;
    const quote = await this.marketData.fetchForInstrument(inst);
    if (!quote) {
      this.logger.warn(`Sem cotação para ${inst.symbol} (${inst.market})`);
      return;
    }
    await this.investmentsService.saveQuoteSnapshot(
      inst.id,
      quote.lastPrice,
      quote.currency,
      inst.market === 'BR' ? 'brapi' : 'stooq',
    );
  }

  private async syncAll(): Promise<void> {
    const list = await this.investmentsService.listInstrumentsInUse();
    const br = list.filter((i) => i.market === 'BR');
    const intl = list.filter((i) => i.market === 'INTL');

    const brToFetch = [];
    for (const inst of br) {
      if (await this.shouldRefresh(inst)) brToFetch.push(inst);
    }
    if (brToFetch.length > 0) {
      const map = await this.marketData.fetchBatchBr(brToFetch);
      for (const inst of brToFetch) {
        const q = map.get(inst.symbol.toUpperCase());
        if (!q) continue;
        await this.investmentsService.saveQuoteSnapshot(inst.id, q.lastPrice, q.currency, 'brapi');
      }
    }

    for (const inst of intl) {
      if (!(await this.shouldRefresh(inst))) continue;
      const q = await this.marketData.fetchForInstrument(inst);
      if (!q) continue;
      await this.investmentsService.saveQuoteSnapshot(inst.id, q.lastPrice, q.currency, 'stooq');
    }
  }
}
