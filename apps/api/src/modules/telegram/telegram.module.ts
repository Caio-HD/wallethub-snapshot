import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { TelegramEventEntity } from '../../database/entities/telegram-event.entity';
import { TelegramLinkNonceEntity } from '../../database/entities/telegram-link-nonce.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { QUEUE_TELEGRAM_INBOUND, QUEUE_TELEGRAM_OUTBOUND } from '../../queues';
import { UsersModule } from '../users/users.module';
import { WalletInboundMessagingModule } from '../messaging/wallet-inbound-messaging.module';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TelegramWorkerService } from './telegram-worker.service';
import { TelegramDispatcherProcessor } from './telegram-dispatcher.processor';
import { TelegramObservabilityService } from './telegram-observability.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramHttpSenderService } from './telegram-http-sender.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramEventEntity, TelegramLinkNonceEntity, UserEntity]),
    BullModule.registerQueue({ name: QUEUE_TELEGRAM_INBOUND }),
    BullModule.registerQueue({ name: QUEUE_TELEGRAM_OUTBOUND }),
    UsersModule,
    WalletInboundMessagingModule,
  ],
  controllers: [TelegramController],
  providers: [
    makeCounterProvider({
      name: 'telegram_inbound_messages_total',
      help: 'Total de mensagens recebidas pelo Telegram',
    }),
    makeCounterProvider({
      name: 'telegram_outbound_messages_total',
      help: 'Total de mensagens enviadas pelo Telegram',
    }),
    TelegramObservabilityService,
    TelegramHttpSenderService,
    TelegramLinkService,
    TelegramService,
    TelegramWorkerService,
    TelegramDispatcherProcessor,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
