import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { ProjectionEntity } from '../../database/entities/projection.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { ProjectionsModule } from '../projections/projections.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity, ProjectionEntity, CategoryEntity]),
    ProjectionsModule,
    BudgetsModule,
    UsersModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}
