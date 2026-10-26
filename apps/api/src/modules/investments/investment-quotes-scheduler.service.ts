import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { InvestmentsConfig } from '../../core/config/investments.config';
import { QUEUE_INVESTMENT_QUOTES } from '../../queues';

@Injectable()
export class InvestmentQuotesSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(InvestmentQuotesSchedulerService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_INVESTMENT_QUOTES) private readonly quotesQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const cfg = this.configService.get<InvestmentsConfig>('investments');
    if (!cfg) return;
    try {
      await this.quotesQueue.add(
        'sync-all',
        {},
        {
          repeat: { every: cfg.quotesRepeatMs },
          jobId: 'investment-quotes-sync-all-repeat',
        },
      );
      this.logger.log(
        `Job repetível de cotações (modo económico/free-friendly): a cada ${cfg.quotesRepeatMs}ms — BullMQ id investment-quotes-sync-all-repeat`,
      );
    } catch (e) {
      this.logger.warn(
        `Não foi possível registar job repetível de cotações: ${(e as Error).message}`,
      );
    }
  }
}
