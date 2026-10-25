import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@notionhq/client';
import { NotionConfig, defaultNotionConfig } from '../../core/config/notion.config';
import {
  PageObjectResponse,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints.js';

@Injectable()
export class NotionService implements OnModuleInit {
  private readonly logger = new Logger(NotionService.name);
  private client: Client | null = null;
  private readonly config: NotionConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<NotionConfig>('notion') ?? { ...defaultNotionConfig };
  }

  onModuleInit() {
    if (!this.config.syncEnabled) {
      this.logger.warn('Notion sync is disabled');
      return;
    }

    if (!this.config.apiKey) {
      this.logger.warn('Notion API key is not configured');
      return;
    }

    this.client = new Client({
      auth: this.config.apiKey,
    });

    this.logger.log('Notion client initialized');
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error('Notion client is not initialized. Check configuration.');
    }
    return this.client;
  }

  isEnabled(): boolean {
    return this.config.syncEnabled && !!this.config.apiKey;
  }

  async createPage(
    databaseId: string,
    properties: Record<string, unknown>,
  ): Promise<PageObjectResponse> {
    const client = this.getClient();

    try {
      const response = await client.pages.create({
        parent: { database_id: databaseId },
        properties: properties as Parameters<Client['pages']['create']>[0]['properties'],
      });

      return response as PageObjectResponse;
    } catch (error) {
      this.logger.error(`Failed to create page in database ${databaseId}:`, error);
      throw error;
    }
  }

  async updatePage(
    pageId: string,
    properties: Record<string, unknown>,
  ): Promise<PageObjectResponse> {
    const client = this.getClient();

    try {
      const response = await client.pages.update({
        page_id: pageId,
        properties: properties as Parameters<Client['pages']['update']>[0]['properties'],
      });

      return response as PageObjectResponse;
    } catch (error) {
      this.logger.error(`Failed to update page ${pageId}:`, error);
      throw error;
    }
  }

  async getPage(pageId: string): Promise<PageObjectResponse> {
    const client = this.getClient();

    try {
      const response = await client.pages.retrieve({ page_id: pageId });
      return response as PageObjectResponse;
    } catch (error) {
      this.logger.error(`Failed to retrieve page ${pageId}:`, error);
      throw error;
    }
  }

  async deletePage(pageId: string): Promise<PageObjectResponse> {
    const client = this.getClient();

    try {
      const response = await client.pages.update({
        page_id: pageId,
        archived: true,
      });

      return response as PageObjectResponse;
    } catch (error) {
      this.logger.error(`Failed to delete page ${pageId}:`, error);
      throw error;
    }
  }

  async queryDatabase(
    databaseId: string,
    filter?: Record<string, unknown>,
    sorts?: Array<Record<string, unknown>>,
  ): Promise<PageObjectResponse[]> {
    const client = this.getClient();

    try {
      const response = await client.databases.query({
        database_id: databaseId,
        filter: filter as Parameters<Client['databases']['query']>[0]['filter'],
        sorts: sorts as Parameters<Client['databases']['query']>[0]['sorts'],
      });

      return response.results as PageObjectResponse[];
    } catch (error) {
      this.logger.error(`Failed to query database ${databaseId}:`, error);
      throw error;
    }
  }

  async getDatabase(databaseId: string): Promise<DatabaseObjectResponse> {
    const client = this.getClient();

    try {
      const response = await client.databases.retrieve({ database_id: databaseId });
      return response as DatabaseObjectResponse;
    } catch (error) {
      this.logger.error(`Failed to retrieve database ${databaseId}:`, error);
      throw error;
    }
  }

  async findPageByProperty(
    databaseId: string,
    propertyName: string,
    propertyValue: string,
  ): Promise<PageObjectResponse | null> {
    const pages = await this.queryDatabase(databaseId, {
      property: propertyName,
      rich_text: {
        equals: propertyValue,
      },
    } as Record<string, unknown>);

    return pages.length > 0 ? pages[0] : null;
  }

  getDatabaseId(entityType: 'transaction' | 'account' | 'category' | 'projection'): string {
    switch (entityType) {
      case 'transaction':
        return this.config.transactionsDbId;
      case 'account':
        return this.config.accountsDbId;
      case 'category':
        return this.config.categoriesDbId;
      case 'projection':
        return this.config.projectionsDbId;
      default: {
        const _exhaustive: never = entityType;
        throw new Error(`Unknown entity type: ${String(_exhaustive)}`);
      }
    }
  }

  getWebhookSecret(): string {
    return this.config.webhookSecret;
  }

  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts: number = this.config.retryMaxAttempts,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);

        if (attempt < maxAttempts) {
          this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Retry failed');
  }
}
