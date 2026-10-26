import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from '../../database/entities/category.entity';
import { AccountEntity } from '../../database/entities/account.entity';
import { SettingEntity } from '../../database/entities/setting.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { AccountsModule } from '../accounts/accounts.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AiModule } from '../ai/ai.module';
import { StatementImportModule } from '../statement-import/statement-import.module';
import { WalletInboundMessagingService } from './wallet-inbound-messaging.service';
import { MessagingAiSettingsService } from './messaging-ai-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CategoryEntity, AccountEntity, SettingEntity, OrganizationEntity]),
    TransactionsModule,
    AccountsModule,
    DashboardModule,
    AiModule,
    StatementImportModule,
  ],
  providers: [WalletInboundMessagingService, MessagingAiSettingsService],
  exports: [WalletInboundMessagingService, MessagingAiSettingsService],
})
export class WalletInboundMessagingModule {}
