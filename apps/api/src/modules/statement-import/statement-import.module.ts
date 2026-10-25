import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatementImportService } from './statement-import.service';
import { StatementImportController } from './statement-import.controller';
import { StatementReconciliationService } from './statement-reconciliation.service';
import { StatementImportIdempotencyService } from './statement-import-idempotency.service';
import { StatementImportPreviewCacheService } from './statement-import-preview-cache.service';
import { StatementImportAuditService } from './statement-import-audit.service';
import { StatementCategoryMappingModule } from './statement-category-mapping.module';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { StatementImportBatchEntity } from '../../database/entities/statement-import-batch.entity.js';
import { InvestmentMovementEntity } from '../../database/entities/investment-movement.entity.js';
import { TransactionsModule } from '../transactions/transactions.module';
import { CategoriesModule } from '../categories/categories.module';
import { BanksModule } from '../banks/banks.module';
import { AccountsModule } from '../accounts/accounts.module';
import { InvestmentsModule } from '../investments/investments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionEntity,
      AccountEntity,
      StatementImportBatchEntity,
      InvestmentMovementEntity,
    ]),
    StatementCategoryMappingModule,
    TransactionsModule,
    CategoriesModule,
    BanksModule,
    AccountsModule,
    InvestmentsModule,
  ],
  controllers: [StatementImportController],
  providers: [
    StatementImportService,
    StatementReconciliationService,
    StatementImportIdempotencyService,
    StatementImportPreviewCacheService,
    StatementImportAuditService,
  ],
  exports: [StatementImportService, StatementReconciliationService],
})
export class StatementImportModule {}
