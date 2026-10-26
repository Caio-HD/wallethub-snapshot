import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QUEUE_NOTION_SYNC } from '../../../queues';
import { NotionSyncJob } from '../notion.types.js';
import { TransactionsSyncService } from '../sync/transactions-sync.service.js';
import { AccountsSyncService } from '../sync/accounts-sync.service.js';
import { CategoriesSyncService } from '../sync/categories-sync.service.js';
import { ProjectionsSyncService } from '../sync/projections-sync.service.js';
import { TransactionEntity } from '../../../database/entities/transaction.entity.js';
import { AccountEntity } from '../../../database/entities/account.entity.js';
import { CategoryEntity } from '../../../database/entities/category.entity.js';
import { ProjectionEntity } from '../../../database/entities/projection.entity.js';

@Injectable()
@Processor(QUEUE_NOTION_SYNC)
export class NotionSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(NotionSyncProcessor.name);

  constructor(
    private readonly transactionsSyncService: TransactionsSyncService,
    private readonly accountsSyncService: AccountsSyncService,
    private readonly categoriesSyncService: CategoriesSyncService,
    private readonly projectionsSyncService: ProjectionsSyncService,
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountsRepository: Repository<AccountEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    @InjectRepository(ProjectionEntity)
    private readonly projectionsRepository: Repository<ProjectionEntity>,
  ) {
    super();
  }

  async process(job: Job<NotionSyncJob>): Promise<void> {
    const { entityType, entityId, operation } = job.data;

    this.logger.debug(`Processing ${operation} for ${entityType} ${entityId}`);

    try {
      switch (entityType) {
        case 'transaction':
          await this.processTransaction(entityId, operation);
          break;
        case 'account':
          await this.processAccount(entityId, operation);
          break;
        case 'category':
          await this.processCategory(entityId, operation);
          break;
        case 'projection':
          await this.processProjection(entityId, operation);
          break;
        default:
          this.logger.warn(`Unknown entity type: ${String(entityType)}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process ${entityType} ${entityId} (${operation}):`, error);
      throw error;
    }
  }

  private async processTransaction(entityId: string, operation: string): Promise<void> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: entityId },
      relations: ['account', 'category', 'user'],
    });

    if (!transaction) {
      this.logger.warn(`Transaction ${entityId} not found`);
      return;
    }

    if (operation === 'delete') {
      // For delete, we need to find the Notion page first
      // This would require storing notionPageId in the entity
      this.logger.warn('Delete operation for transactions not fully implemented');
      return;
    }

    await this.transactionsSyncService.syncToNotion(transaction);
  }

  private async processAccount(entityId: string, operation: string): Promise<void> {
    const account = await this.accountsRepository.findOne({
      where: { id: entityId },
    });

    if (!account) {
      this.logger.warn(`Account ${entityId} not found`);
      return;
    }

    if (operation === 'delete') {
      this.logger.warn('Delete operation for accounts not fully implemented');
      return;
    }

    await this.accountsSyncService.syncToNotion(account);
  }

  private async processCategory(entityId: string, operation: string): Promise<void> {
    const category = await this.categoriesRepository.findOne({
      where: { id: entityId },
    });

    if (!category) {
      this.logger.warn(`Category ${entityId} not found`);
      return;
    }

    if (operation === 'delete') {
      this.logger.warn('Delete operation for categories not fully implemented');
      return;
    }

    await this.categoriesSyncService.syncToNotion(category);
  }

  private async processProjection(entityId: string, operation: string): Promise<void> {
    const projection = await this.projectionsRepository.findOne({
      where: { id: entityId },
    });

    if (!projection) {
      this.logger.warn(`Projection ${entityId} not found`);
      return;
    }

    if (operation === 'delete') {
      this.logger.warn('Delete operation for projections not fully implemented');
      return;
    }

    await this.projectionsSyncService.syncToNotion(projection);
  }
}
