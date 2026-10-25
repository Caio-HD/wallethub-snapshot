import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionService } from '../notion.service.js';
import { AccountEntity } from '../../../database/entities/account.entity.js';
import { UserEntity } from '../../../database/entities/user.entity.js';
import { NotionAccountProperties, NotionSyncResult, NotionPage } from '../notion.types.js';
import {
  loadActiveUserIdsOrdered,
  notionOwnerSelectToOwnerUserId,
  ownerUserIdToNotionOwnerSelect,
} from '../notion-scope-mapper.js';
import { TransactionEntity } from '../../../database/entities/transaction.entity.js';

@Injectable()
export class AccountsSyncService {
  private readonly logger = new Logger(AccountsSyncService.name);

  constructor(
    private readonly notionService: NotionService,
    @InjectRepository(AccountEntity)
    private readonly accountsRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
  ) {}

  async syncToNotion(account: AccountEntity): Promise<NotionSyncResult> {
    if (!this.notionService.isEnabled()) {
      return { success: false, error: 'Notion sync is disabled' };
    }

    try {
      const databaseId = this.notionService.getDatabaseId('account');
      const orderedIds = await loadActiveUserIdsOrdered(this.usersRepository);

      // Calculate current balance for Notion
      const balance = await this.calculateBalance(account.id);
      const properties = this.mapAccountToNotion(account, balance, orderedIds);

      const existingPage = await this.notionService.findPageByProperty(
        databaseId,
        'WalletHubId',
        account.id,
      );

      let notionPageId: string;

      if (existingPage) {
        await this.notionService.updatePage(
          existingPage.id,
          properties as unknown as Record<string, unknown>,
        );
        notionPageId = existingPage.id;
        this.logger.debug(`Updated account ${account.id} in Notion`);
      } else {
        const page = await this.notionService.createPage(
          databaseId,
          properties as unknown as Record<string, unknown>,
        );
        notionPageId = page.id;
        this.logger.debug(`Created account ${account.id} in Notion`);
      }

      return { success: true, notionPageId };
    } catch (error) {
      this.logger.error(`Failed to sync account ${account.id} to Notion:`, error);
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
      const orderedIds = await loadActiveUserIdsOrdered(this.usersRepository);
      const accountData = this.mapNotionToAccount(page, orderedIds);
      const walletHubId = this.extractWalletHubId(page);

      if (!walletHubId) {
        return { success: false, error: 'WalletHubId not found in Notion page' };
      }

      const existingAccount = await this.accountsRepository.findOne({
        where: { id: walletHubId },
      });

      if (existingAccount) {
        Object.assign(existingAccount, accountData);
        await this.accountsRepository.save(existingAccount);
        this.logger.debug(`Updated account ${existingAccount.id} from Notion`);
        return { success: true, notionPageId: page.id };
      } else {
        const newAccount = this.accountsRepository.create({
          ...accountData,
          id: walletHubId,
        });
        await this.accountsRepository.save(newAccount);
        this.logger.debug(`Created account ${newAccount.id} from Notion`);
        return { success: true, notionPageId: page.id };
      }
    } catch (error) {
      this.logger.error(`Failed to sync account from Notion page ${page.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async calculateBalance(accountId: string): Promise<number> {
    const transactions = await this.transactionsRepository.find({
      where: { account: { id: accountId } },
      select: ['amount', 'direction'],
    });

    return transactions.reduce((acc, t) => {
      const val = parseFloat(t.amount);
      return t.direction === 'income' ? acc + val : acc - val;
    }, 0);
  }

  private mapAccountToNotion(
    account: AccountEntity,
    balance: number,
    orderedIds: string[],
  ): NotionAccountProperties {
    return {
      Name: {
        title: [{ text: { content: account.name } }],
      },
      Balance: {
        number: balance,
      },
      'Owner Scope': {
        select: {
          name: ownerUserIdToNotionOwnerSelect(
            account.ownerUserIds?.length ? account.ownerUserIds[0] : null,
            orderedIds,
          ),
        },
      },
      'Is Active': {
        checkbox: account.isActive,
      },
      WalletHubId: {
        rich_text: [{ text: { content: account.id } }],
      },
    };
  }

  private mapNotionToAccount(
    page: NotionPage,
    orderedIds: string[],
  ): Partial<AccountEntity> & { balance?: number } {
    const properties = page.properties as unknown as NotionAccountProperties;
    const selectName = properties['Owner Scope']?.select?.name;

    const scopeUserId = notionOwnerSelectToOwnerUserId(selectName, orderedIds);
    return {
      name: properties.Name?.title?.[0]?.text?.content ?? '',
      // Note: mapping Notion Balance to a field that will trigger adjustment in AccountsService if used via a service update
      balance: properties.Balance?.number ?? 0,
      ownerUserIds: scopeUserId ? [scopeUserId] : null,
      isActive: properties['Is Active']?.checkbox ?? true,
    };
  }

  private extractWalletHubId(page: NotionPage): string | null {
    const properties = page.properties as unknown as NotionAccountProperties;
    return properties.WalletHubId?.rich_text?.[0]?.text?.content ?? null;
  }
}
