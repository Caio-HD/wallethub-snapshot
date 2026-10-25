import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { InvestmentInstrumentEntity } from '../../database/entities/investment-instrument.entity.js';
import { InvestmentMovementEntity } from '../../database/entities/investment-movement.entity.js';
import { InvestmentQuoteSnapshotEntity } from '../../database/entities/investment-quote-snapshot.entity.js';
import { QUEUE_INVESTMENT_QUOTES } from '../../queues';
import { TransactionsModule } from '../transactions/transactions.module';
import { InvestmentsService } from './investments.service';
import { InvestmentsController } from './investments.controller';
import { InvestmentQuotesProcessor } from './investment-quotes.processor';
import { InvestmentQuotesSchedulerService } from './investment-quotes-scheduler.service';
import { BrapiQuoteClient } from './market-data/brapi-quote.client';
import { StooqQuoteClient } from './market-data/stooq-quote.client';
import { InvestmentMarketDataService } from './market-data/investment-market-data.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      InvestmentInstrumentEntity,
      InvestmentMovementEntity,
      InvestmentQuoteSnapshotEntity,
    ]),
    BullModule.registerQueue({ name: QUEUE_INVESTMENT_QUOTES }),
    TransactionsModule,
  ],
  controllers: [InvestmentsController],
  providers: [
    BrapiQuoteClient,
    StooqQuoteClient,
    InvestmentMarketDataService,
    InvestmentsService,
    InvestmentQuotesProcessor,
    InvestmentQuotesSchedulerService,
  ],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
