import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NOTION_SYNC } from '../../../queues';
import { NotionSyncJob } from '../notion.types.js';
import { TransactionEntity } from '../../../database/entities/transaction.entity.js';
import { AccountEntity } from '../../../database/entities/account.entity.js';
import { CategoryEntity } from '../../../database/entities/category.entity.js';
import { ProjectionEntity } from '../../../database/entities/projection.entity.js';

type NotionEntityType = 'transaction' | 'account' | 'category' | 'projection';

const ENTITY_TYPE_MAP: Record<string, NotionEntityType> = {
  [TransactionEntity.name]: 'transaction',
  [AccountEntity.name]: 'account',
  [CategoryEntity.name]: 'category',
  [ProjectionEntity.name]: 'projection',
};

@Injectable()
@EventSubscriber()
export class NotionEntitySubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(NotionEntitySubscriber.name);
  private readonly skipSyncFlag = Symbol('skipNotionSync');

  constructor(
    @InjectQueue(QUEUE_NOTION_SYNC)
    private readonly notionSyncQueue: Queue<NotionSyncJob>,
  ) {}

  afterInsert(event: InsertEvent<unknown>): void {
    const entityType = this.getEntityType(event.metadata?.targetName);
    if (!entityType) return;
    const entityId = (event.entity as { id?: string })?.id;
    if (!entityId) return;
    this.handleEntityEvent(entityType, entityId, 'create');
  }

  afterUpdate(event: UpdateEvent<unknown>): void {
    if (this.shouldSkipSync(event)) return;
    const entityType = this.getEntityType(event.metadata?.targetName);
    if (!entityType) return;
    const entityId = (event.entity as { id?: string })?.id;
    if (!entityId) return;
    this.handleEntityEvent(entityType, entityId, 'update');
  }

  afterRemove(event: RemoveEvent<unknown>): void {
    const entityType = this.getEntityType(event.metadata?.targetName);
    if (!entityType) return;
    const entityId = (event.entity as { id?: string })?.id ?? (event.entityId as string);
    if (!entityId) return;
    this.handleEntityEvent(entityType, entityId, 'delete');
  }

  private getEntityType(targetName: string | undefined): NotionEntityType | null {
    if (!targetName) return null;
    return ENTITY_TYPE_MAP[targetName] ?? null;
  }

  private handleEntityEvent(
    entityType: NotionEntityType,
    entityId: string,
    operation: 'create' | 'update' | 'delete',
  ): void {
    if (!this.notionSyncQueue) return;
    const job: NotionSyncJob = {
      entityType,
      entityId,
      operation,
    };

    this.notionSyncQueue
      .add(`sync-${entityType}-${operation}`, job, {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      })
      .catch((error) => {
        this.logger.error(`Failed to enqueue sync job for ${entityType} ${entityId}:`, error);
      });
  }

  private shouldSkipSync(event: UpdateEvent<unknown>): boolean {
    return (event.entity as Record<symbol, unknown>)?.[this.skipSyncFlag] === true;
  }

  static markSkipSync(entity: Record<string, unknown>): void {
    (entity as Record<symbol, unknown>)[Symbol.for('skipNotionSync')] = true;
  }
}
