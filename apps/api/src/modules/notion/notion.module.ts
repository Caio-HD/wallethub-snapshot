import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { NotionController } from './notion.controller.js';
import { NotionService } from './notion.service.js';
import { NotionSyncProcessor } from './processors/notion-sync.processor.js';
import { NotionWebhookProcessor } from './processors/notion-webhook.processor.js';
import { NotionEntitySubscriber } from './listeners/notion-entity.subscriber.js';
import { TransactionsSyncService } from './sync/transactions-sync.service.js';
import { AccountsSyncService } from './sync/accounts-sync.service.js';
import { CategoriesSyncService } from './sync/categories-sync.service.js';
import { ProjectionsSyncService } from './sync/projections-sync.service.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { ProjectionEntity } from '../../database/entities/projection.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { QUEUE_NOTION_SYNC, QUEUE_NOTION_WEBHOOK } from '../../queues';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionEntity,
      AccountEntity,
      CategoryEntity,
      ProjectionEntity,
      UserEntity,
    ]),
    BullModule.registerQueue({ name: QUEUE_NOTION_SYNC }),
    BullModule.registerQueue({ name: QUEUE_NOTION_WEBHOOK }),
  ],
  controllers: [NotionController],
  providers: [
    NotionService,
    NotionSyncProcessor,
    NotionWebhookProcessor,
    NotionEntitySubscriber,
    TransactionsSyncService,
    AccountsSyncService,
    CategoriesSyncService,
    ProjectionsSyncService,
  ],
  exports: [NotionService],
})
export class NotionModule {}
