import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionService } from '../notion.service.js';
import { CategoryEntity } from '../../../database/entities/category.entity.js';
import { UserEntity } from '../../../database/entities/user.entity.js';
import { NotionCategoryProperties, NotionSyncResult, NotionPage } from '../notion.types.js';
import {
  loadActiveUserIdsOrdered,
  notionOwnerSelectToOwnerUserId,
  ownerUserIdToNotionOwnerSelect,
} from '../notion-scope-mapper.js';

@Injectable()
export class CategoriesSyncService {
  private readonly logger = new Logger(CategoriesSyncService.name);

  constructor(
    private readonly notionService: NotionService,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async syncToNotion(category: CategoryEntity): Promise<NotionSyncResult> {
    if (!this.notionService.isEnabled()) {
      return { success: false, error: 'Notion sync is disabled' };
    }

    try {
      const databaseId = this.notionService.getDatabaseId('category');
      const orderedIds = await loadActiveUserIdsOrdered(this.usersRepository);
      const properties = this.mapCategoryToNotion(category, orderedIds);

      const existingPage = await this.notionService.findPageByProperty(
        databaseId,
        'WalletHubId',
        category.id,
      );

      let notionPageId: string;

      if (existingPage) {
        await this.notionService.updatePage(
          existingPage.id,
          properties as unknown as Record<string, unknown>,
        );
        notionPageId = existingPage.id;
        this.logger.debug(`Updated category ${category.id} in Notion`);
      } else {
        const page = await this.notionService.createPage(
          databaseId,
          properties as unknown as Record<string, unknown>,
        );
        notionPageId = page.id;
        this.logger.debug(`Created category ${category.id} in Notion`);
      }

      return { success: true, notionPageId };
    } catch (error) {
      this.logger.error(`Failed to sync category ${category.id} to Notion:`, error);
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
      const categoryData = this.mapNotionToCategory(page, orderedIds);
      const walletHubId = this.extractWalletHubId(page);

      if (!walletHubId) {
        return { success: false, error: 'WalletHubId not found in Notion page' };
      }

      const existingCategory = await this.categoriesRepository.findOne({
        where: { id: walletHubId },
      });

      if (existingCategory) {
        Object.assign(existingCategory, categoryData);
        await this.categoriesRepository.save(existingCategory);
        this.logger.debug(`Updated category ${existingCategory.id} from Notion`);
        return { success: true, notionPageId: page.id };
      } else {
        const newCategory = this.categoriesRepository.create({
          ...categoryData,
          id: walletHubId,
        });
        await this.categoriesRepository.save(newCategory);
        this.logger.debug(`Created category ${newCategory.id} from Notion`);
        return { success: true, notionPageId: page.id };
      }
    } catch (error) {
      this.logger.error(`Failed to sync category from Notion page ${page.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private mapCategoryToNotion(
    category: CategoryEntity,
    orderedIds: string[],
  ): NotionCategoryProperties {
    return {
      Name: {
        title: [{ text: { content: category.name } }],
      },
      Type: {
        select: { name: category.type },
      },
      'Owner Scope': {
        select: { name: ownerUserIdToNotionOwnerSelect(category.ownerUserId, orderedIds) },
      },
      'Is Active': {
        checkbox: category.isActive,
      },
      'Sort Order': {
        number: category.sortOrder,
      },
      WalletHubId: {
        rich_text: [{ text: { content: category.id } }],
      },
    };
  }

  private mapNotionToCategory(page: NotionPage, orderedIds: string[]): Partial<CategoryEntity> {
    const properties = page.properties as unknown as NotionCategoryProperties;
    const selectName = properties['Owner Scope']?.select?.name;

    return {
      name: properties.Name?.title?.[0]?.text?.content ?? '',
      type: properties.Type?.select?.name ?? 'expense',
      ownerUserId: notionOwnerSelectToOwnerUserId(selectName, orderedIds),
      isActive: properties['Is Active']?.checkbox ?? true,
      sortOrder: properties['Sort Order']?.number ?? 0,
    };
  }

  private extractWalletHubId(page: NotionPage): string | null {
    const properties = page.properties as unknown as NotionCategoryProperties;
    return properties.WalletHubId?.rich_text?.[0]?.text?.content ?? null;
  }
}
