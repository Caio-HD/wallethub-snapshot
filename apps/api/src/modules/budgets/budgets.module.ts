import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryBudgetEntity } from '../../database/entities/category-budget.entity.js';
import { MonthlyBudgetEntity } from '../../database/entities/monthly-budget.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CategoryBudgetEntity, MonthlyBudgetEntity, TransactionEntity]),
    UsersModule,
  ],
  providers: [BudgetsService],
  controllers: [BudgetsController],
  exports: [BudgetsService],
})
export class BudgetsModule {}
