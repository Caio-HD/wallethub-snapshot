import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtEntity } from '../../database/entities/debt.entity.js';
import { DebtInstallmentEntity } from '../../database/entities/debt-installment.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { SettingEntity } from '../../database/entities/setting.entity.js';
import { DebtsService } from './debts.service.js';
import { DebtsController } from './debts.controller.js';
import { DebtsCronService } from './debts.cron.js';
import { OrgTimezoneService } from './org-timezone.service.js';
import { AlertsModule } from '../alerts/alerts.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DebtEntity,
      DebtInstallmentEntity,
      CategoryEntity,
      AccountEntity,
      SettingEntity,
    ]),
    AlertsModule,
  ],
  controllers: [DebtsController],
  providers: [DebtsService, DebtsCronService, OrgTimezoneService],
  exports: [DebtsService],
})
export class DebtsModule {}
