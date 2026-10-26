import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { WhatsAppController } from './whatsapp.controller.js';
import { WhatsAppService } from './whatsapp.service.js';
import { WhatsAppWorkerService } from './whatsapp-worker.service.js';
import { WhatsAppDispatcherProcessor } from './whatsapp-dispatcher.processor.js';
import { EvolutionClientService } from './evolution-client.service.js';
import { DevEvolutionClient } from './dev-evolution.client.js';
import { TenantEvolutionClient } from './tenant-evolution.client.js';
import { EvolutionApiService } from './evolution-api.service.js';
import { WhatsAppSessionService } from './whatsapp-session.service.js';
import { WhatsAppRedisLockService } from './whatsapp-redis-lock.service.js';
import { WhatsAppNotificationSettingsService } from './whatsapp-notification-settings.service.js';
import { WhatsAppSessionHealthCron } from './whatsapp-session-health.cron.js';
import { OrganizationWhatsAppController } from './organization-whatsapp.controller.js';
import { WhatsAppEventEntity } from '../../database/entities/whatsapp-event.entity.js';
import { WhatsAppSessionEntity } from '../../database/entities/whatsapp-session.entity.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { QUEUE_WHATSAPP_INBOUND, QUEUE_WHATSAPP_OUTBOUND } from '../../queues/queue.constants';
import { WhatsAppObservabilityService } from './whatsapp-observability.service.js';
import { AiModule } from '../ai/ai.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { SettingEntity } from '../../database/entities/setting.entity.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { AlertsModule } from '../alerts/alerts.module.js';
import { EntitlementsModule } from '../plan-entitlements/entitlements.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WhatsAppEventEntity,
      WhatsAppSessionEntity,
      CategoryEntity,
      AccountEntity,
      SettingEntity,
    ]),
    BullModule.registerQueue({ name: QUEUE_WHATSAPP_INBOUND }),
    BullModule.registerQueue({ name: QUEUE_WHATSAPP_OUTBOUND }),
    TransactionsModule,
    AiModule,
    UsersModule,
    AccountsModule,
    DashboardModule,
    OrganizationsModule,
    AlertsModule,
    EntitlementsModule,
  ],
  controllers: [WhatsAppController, OrganizationWhatsAppController],
  providers: [
    makeCounterProvider({
      name: 'whatsapp_inbound_messages_total',
      help: 'Total de mensagens recebidas pelo WhatsApp',
    }),
    makeCounterProvider({
      name: 'whatsapp_outbound_messages_total',
      help: 'Total de mensagens enviadas pelo WhatsApp',
    }),
    makeCounterProvider({
      name: 'whatsapp_digest_sent_total',
      help: 'Total de digests diários enviados via WhatsApp',
    }),
    makeGaugeProvider({
      name: 'whatsapp_connection_status',
      help: 'Status da instância Evolution (0=down,3=connected)',
    }),
    makeHistogramProvider({
      name: 'whatsapp_ai_tokens_histogram',
      help: 'Distribuição de tokens consumidos pelas integrações de IA',
      buckets: [10, 50, 100, 250, 500, 1000],
    }),
    makeHistogramProvider({
      name: 'whatsapp_message_latency_seconds',
      help: 'Latência entre recebimento e processamento da mensagem',
      buckets: [0.5, 1, 2, 3, 5, 10, 30],
    }),
    WhatsAppService,
    WhatsAppWorkerService,
    WhatsAppDispatcherProcessor,
    WhatsAppObservabilityService,
    EvolutionClientService,
    DevEvolutionClient,
    TenantEvolutionClient,
    EvolutionApiService,
    WhatsAppRedisLockService,
    WhatsAppSessionService,
    WhatsAppNotificationSettingsService,
    WhatsAppSessionHealthCron,
  ],
  exports: [WhatsAppService, DevEvolutionClient, EvolutionApiService, WhatsAppSessionService],
})
export class WhatsAppModule {}
