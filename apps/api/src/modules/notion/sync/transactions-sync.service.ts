import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionService } from '../notion.service.js';
import { TransactionEntity } from '../../../database/entities/transaction.entity.js';
import { NotionTransactionProperties, NotionSyncResult, NotionPage } from '../notion.types.js';
import { format } from 'date-fns';

@Injectable()
export class TransactionsSyncService {
  private readonly logger = new Logger(TransactionsSyncService.name);

  constructor(
    private readonly notionService: NotionService,
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
  ) {}

  async syncToNotion(transaction: TransactionEntity): Promise<NotionSyncResult> {
    if (!this.notionService.isEnabled()) {
      return { success: false, error: 'Notion sync is disabled' };
    }

    try {
      const databaseId = this.notionService.getDatabaseId('transaction');
      const properties = this.mapTransactionToNotion(transaction);

      // Check if page already exists
      const existingPage = await this.notionService.findPageByProperty(
        databaseId,
        'WalletHubId',
        transaction.id,
      );

      let notionPageId: string;

      if (existingPage) {
        await this.notionService.updatePage(
          existingPage.id,
          properties as unknown as Record<string, unknown>,
        );
        notionPageId = existingPage.id;
        this.logger.debug(`Updated transaction ${transaction.id} in Notion`);
      } else {
        const page = await this.notionService.createPage(
          databaseId,
          properties as unknown as Record<string, unknown>,
        );
        notionPageId = page.id;
        this.logger.debug(`Created transaction ${transaction.id} in Notion`);
      }

      return { success: true, notionPageId };
    } catch (error) {
      this.logger.error(`Failed to sync transaction ${transaction.id} to Notion:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async syncFromNotion(page: NotionPage): Promise<NotionSyncResult> {
    if (!this.notionService.isEnabled()) {
      return { success: false, error: 'Notion sync is disabled' };
    }

    try {
      const transaction = this.mapNotionToTransaction(page);

      // Find existing transaction by WalletHubId property
      const walletHubId = this.extractWalletHubId(page);
      let existingTransaction: TransactionEntity | null = null;

      if (walletHubId) {
        existingTransaction = await this.transactionsRepository.findOne({
          where: { id: walletHubId },
          relations: ['account', 'category', 'user'],
        });
      }

      if (existingTransaction) {
        Object.assign(existingTransaction, transaction);
        await this.transactionsRepository.save(existingTransaction);
        this.logger.debug(`Updated transaction ${existingTransaction.id} from Notion`);
        return { success: true, notionPageId: page.id };
      } else {
        // For new transactions, we need relations - this should be handled via webhook with full context
        this.logger.warn(`Cannot create transaction from Notion without relations`);
        return { success: false, error: 'Cannot create transaction without relations' };
      }
    } catch (error) {
      this.logger.error(`Failed to sync transaction from Notion page ${page.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private mapTransactionToNotion(transaction: TransactionEntity): NotionTransactionProperties {
    return {
      Amount: {
        number: parseFloat(transaction.amount),
      },
      Date: {
        date: {
          start: format(new Date(transaction.occurredAt), 'yyyy-MM-dd'),
        },
      },
      Category: {
        relation: [{ id: transaction.category.id }],
      },
      Account: {
        relation: [{ id: transaction.account.id }],
      },
      User: {
        relation: [{ id: transaction.user.id }],
      },
      Direction: {
        select: { name: transaction.direction },
      },
      Description: {
        rich_text: transaction.description ? [{ text: { content: transaction.description } }] : [],
      },
      Source: {
        select: { name: transaction.source },
      },
      WalletHubId: {
        rich_text: [{ text: { content: transaction.id } }],
      },
    };
  }

  private mapNotionToTransaction(page: NotionPage): Partial<TransactionEntity> {
    const properties = page.properties as unknown as NotionTransactionProperties;

    const amount = properties.Amount?.number ?? 0;
    const date = properties.Date?.date?.start ? new Date(properties.Date.date.start) : new Date();
    const direction = properties.Direction?.select?.name ?? 'expense';
    const description = properties.Description?.rich_text?.[0]?.text?.content ?? null;
    const source = properties.Source?.select?.name ?? 'web';

    return {
      amount: amount.toFixed(2),
      occurredAt: date,
      direction,
      description: description || undefined,
      source,
    };
  }

  private extractWalletHubId(page: NotionPage): string | null {
    const properties = page.properties as unknown as NotionTransactionProperties;
    return properties.WalletHubId?.rich_text?.[0]?.text?.content ?? null;
  }
}
