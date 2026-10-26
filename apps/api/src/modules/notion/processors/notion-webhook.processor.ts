import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NOTION_WEBHOOK } from '../../../queues';
import { NotionWebhookJob, NotionPage } from '../notion.types.js';
import { NotionService } from '../notion.service.js';
import { TransactionsSyncService } from '../sync/transactions-sync.service.js';
import { AccountsSyncService } from '../sync/accounts-sync.service.js';
import { CategoriesSyncService } from '../sync/categories-sync.service.js';
import { ProjectionsSyncService } from '../sync/projections-sync.service.js';

@Injectable()
@Processor(QUEUE_NOTION_WEBHOOK)
export class NotionWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(NotionWebhookProcessor.name);

  constructor(
    private readonly notionService: NotionService,
    private readonly transactionsSyncService: TransactionsSyncService,
    private readonly accountsSyncService: AccountsSyncService,
    private readonly categoriesSyncService: CategoriesSyncService,
    private readonly projectionsSyncService: ProjectionsSyncService,
  ) {
    super();
  }

  async process(job: Job<NotionWebhookJob>): Promise<void> {
    const { pageId, databaseId, eventType } = job.data;

    this.logger.debug(
      `Processing webhook: ${eventType} for page ${pageId} in database ${databaseId}`,
    );

    try {
      // Determine entity type from database ID
      const entityType = this.getEntityTypeFromDatabaseId(databaseId);

      if (!entityType) {
        this.logger.warn(`Unknown database ID: ${databaseId}`);
        return;
      }

      if (eventType === 'deleted') {
        // Handle deletion if needed
        this.logger.debug(`Page ${pageId} was deleted in Notion`);
        return;
      }

      // Fetch the page from Notion
      const page = await this.notionService.getPage(pageId);

      // Sync from Notion to WalletHub
      await this.syncFromNotion(entityType, page);
    } catch (error) {
      this.logger.error(`Failed to process webhook for page ${pageId}:`, error);
      throw error;
    }
  }

  private getEntityTypeFromDatabaseId(
    databaseId: string,
  ): 'transaction' | 'account' | 'category' | 'projection' | null {
    const config = this.notionService['config'];

    if (databaseId === config.transactionsDbId) return 'transaction';
    if (databaseId === config.accountsDbId) return 'account';
    if (databaseId === config.categoriesDbId) return 'category';
    if (databaseId === config.projectionsDbId) return 'projection';

    return null;
  }

  private async syncFromNotion(
    entityType: 'transaction' | 'account' | 'category' | 'projection',
    page: NotionPage,
  ): Promise<void> {
    switch (entityType) {
      case 'transaction':
        await this.transactionsSyncService.syncFromNotion(page);
        break;
      case 'account':
        await this.accountsSyncService.syncFromNotion(page);
        break;
      case 'category':
        await this.categoriesSyncService.syncFromNotion(page);
        break;
      case 'projection':
        await this.projectionsSyncService.syncFromNotion(page);
        break;
    }
  }
}
