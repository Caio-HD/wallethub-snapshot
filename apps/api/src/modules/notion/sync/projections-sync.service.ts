import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionService } from '../notion.service.js';
import { ProjectionEntity } from '../../../database/entities/projection.entity.js';
import { UserEntity } from '../../../database/entities/user.entity.js';
import { NotionProjectionProperties, NotionSyncResult, NotionPage } from '../notion.types.js';
import { format } from 'date-fns';
import {
  loadActiveUserIdsOrdered,
  notionOwnerSelectToOwnerUserId,
  ownerUserIdToNotionOwnerSelect,
} from '../notion-scope-mapper.js';

@Injectable()
export class ProjectionsSyncService {
  private readonly logger = new Logger(ProjectionsSyncService.name);

  constructor(
    private readonly notionService: NotionService,
    @InjectRepository(ProjectionEntity)
    private readonly projectionsRepository: Repository<ProjectionEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async syncToNotion(projection: ProjectionEntity): Promise<NotionSyncResult> {
    if (!this.notionService.isEnabled()) {
      return { success: false, error: 'Notion sync is disabled' };
    }

    try {
      const databaseId = this.notionService.getDatabaseId('projection');
      const orderedIds = await loadActiveUserIdsOrdered(this.usersRepository);
      const properties = this.mapProjectionToNotion(projection, orderedIds);

      const existingPage = await this.notionService.findPageByProperty(
        databaseId,
        'WalletHubId',
        projection.id,
      );

      let notionPageId: string;

      if (existingPage) {
        await this.notionService.updatePage(
          existingPage.id,
          properties as unknown as Record<string, unknown>,
        );
        notionPageId = existingPage.id;
        this.logger.debug(`Updated projection ${projection.id} in Notion`);
      } else {
        const page = await this.notionService.createPage(
          databaseId,
          properties as unknown as Record<string, unknown>,
        );
        notionPageId = page.id;
        this.logger.debug(`Created projection ${projection.id} in Notion`);
      }

      return { success: true, notionPageId };
    } catch (error) {
      this.logger.error(`Failed to sync projection ${projection.id} to Notion:`, error);
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
      const projectionData = this.mapNotionToProjection(page, orderedIds);
      const walletHubId = this.extractWalletHubId(page);

      if (!walletHubId) {
        return { success: false, error: 'WalletHubId not found in Notion page' };
      }

      const existingProjection = await this.projectionsRepository.findOne({
        where: { id: walletHubId },
      });

      if (existingProjection) {
        Object.assign(existingProjection, projectionData);
        await this.projectionsRepository.save(existingProjection);
        this.logger.debug(`Updated projection ${existingProjection.id} from Notion`);
        return { success: true, notionPageId: page.id };
      } else {
        const newProjection = this.projectionsRepository.create({
          ...projectionData,
          id: walletHubId,
        });
        await this.projectionsRepository.save(newProjection);
        this.logger.debug(`Created projection ${newProjection.id} from Notion`);
        return { success: true, notionPageId: page.id };
      }
    } catch (error) {
      this.logger.error(`Failed to sync projection from Notion page ${page.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private mapProjectionToNotion(
    projection: ProjectionEntity,
    orderedIds: string[],
  ): NotionProjectionProperties {
    return {
      'Period Start': {
        date: { start: format(new Date(projection.periodStart), 'yyyy-MM-dd') },
      },
      'Period End': {
        date: { start: format(new Date(projection.periodEnd), 'yyyy-MM-dd') },
      },
      Scope: {
        select: { name: ownerUserIdToNotionOwnerSelect(projection.scopeUserId, orderedIds) },
      },
      'Projected Income': {
        number: parseFloat(projection.projectedIncome),
      },
      'Projected Expense': {
        number: parseFloat(projection.projectedExpense),
      },
      'Projected Balance': {
        number: parseFloat(projection.projectedBalance),
      },
      Trend: {
        select: { name: projection.trend },
      },
      'Generated At': {
        date: { start: format(new Date(projection.generatedAt), 'yyyy-MM-dd') },
      },
      WalletHubId: {
        rich_text: [{ text: { content: projection.id } }],
      },
    };
  }

  private mapNotionToProjection(page: NotionPage, orderedIds: string[]): Partial<ProjectionEntity> {
    const properties = page.properties as unknown as NotionProjectionProperties;
    const scopeName = properties.Scope?.select?.name;

    return {
      periodStart: properties['Period Start']?.date?.start
        ? new Date(properties['Period Start'].date.start)
        : new Date(),
      periodEnd: properties['Period End']?.date?.start
        ? new Date(properties['Period End'].date.start)
        : new Date(),
      scopeUserId: notionOwnerSelectToOwnerUserId(scopeName, orderedIds),
      projectedIncome: (properties['Projected Income']?.number ?? 0).toFixed(2),
      projectedExpense: (properties['Projected Expense']?.number ?? 0).toFixed(2),
      projectedBalance: (properties['Projected Balance']?.number ?? 0).toFixed(2),
      trend: properties.Trend?.select?.name ?? 'flat',
      generatedAt: properties['Generated At']?.date?.start
        ? new Date(properties['Generated At'].date.start)
        : new Date(),
    };
  }

  private extractWalletHubId(page: NotionPage): string | null {
    const properties = page.properties as unknown as NotionProjectionProperties;
    return properties.WalletHubId?.rich_text?.[0]?.text?.content ?? null;
  }
}
