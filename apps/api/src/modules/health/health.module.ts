import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { AiModule } from '../ai/ai.module';
import {
  QUEUE_ALERTS,
  QUEUE_INVESTMENT_QUOTES,
  QUEUE_NOTION_SYNC,
  QUEUE_NOTION_WEBHOOK,
  QUEUE_PROJECTIONS,
  QUEUE_TELEGRAM_INBOUND,
  QUEUE_TELEGRAM_OUTBOUND,
  QUEUE_WHATSAPP_INBOUND,
  QUEUE_WHATSAPP_OUTBOUND,
} from '../../queues';

@Module({
  imports: [
    AiModule,
    BullModule.registerQueue({ name: QUEUE_WHATSAPP_INBOUND }),
    BullModule.registerQueue({ name: QUEUE_WHATSAPP_OUTBOUND }),
    BullModule.registerQueue({ name: QUEUE_TELEGRAM_INBOUND }),
    BullModule.registerQueue({ name: QUEUE_TELEGRAM_OUTBOUND }),
    BullModule.registerQueue({ name: QUEUE_PROJECTIONS }),
    BullModule.registerQueue({ name: QUEUE_ALERTS }),
    BullModule.registerQueue({ name: QUEUE_INVESTMENT_QUOTES }),
    BullModule.registerQueue({ name: QUEUE_NOTION_SYNC }),
    BullModule.registerQueue({ name: QUEUE_NOTION_WEBHOOK }),
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
