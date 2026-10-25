import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { StatementCategoryMappingModule } from '../statement-import/statement-category-mapping.module';
import { TransactionAuditEntity } from '../../database/entities/transaction-audit.entity.js';
import { AttachmentEntity } from '../../database/entities/attachment.entity.js';
import { ProjectionEntity } from '../../database/entities/projection.entity.js';
import { QUEUE_PROJECTIONS } from '../../queues';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { DebtInstallmentEntity } from '../../database/entities/debt-installment.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionEntity,
      TransactionAuditEntity,
      AttachmentEntity,
      ProjectionEntity,
      CategoryEntity,
      AccountEntity,
      UserEntity,
      DebtInstallmentEntity,
    ]),
    BullModule.registerQueue({ name: QUEUE_PROJECTIONS }),
    AccountsModule,
    CategoriesModule,
    UsersModule,
    StatementCategoryMappingModule,
  ],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
