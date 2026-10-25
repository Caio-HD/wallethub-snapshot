import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { StatementImportBatchEntity } from '../../database/entities/statement-import-batch.entity.js';
import { DebtEntity } from '../../database/entities/debt.entity.js';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      TransactionEntity,
      CategoryEntity,
      StatementImportBatchEntity,
      DebtEntity,
    ]),
  ],
  providers: [AccountsService],
  controllers: [AccountsController],
  exports: [AccountsService],
})
export class AccountsModule {}
