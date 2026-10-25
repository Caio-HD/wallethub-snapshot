import { registerAs } from '@nestjs/config';

export interface NotionConfig {
  apiKey: string;
  syncEnabled: boolean;
  transactionsDbId: string;
  accountsDbId: string;
  categoriesDbId: string;
  projectionsDbId: string;
  webhookSecret: string;
  retryMaxAttempts: number;
  retryDelayMs: number;
}

export const defaultNotionConfig: NotionConfig = {
  apiKey: '',
  syncEnabled: false,
  transactionsDbId: '',
  accountsDbId: '',
  categoriesDbId: '',
  projectionsDbId: '',
  webhookSecret: '',
  retryMaxAttempts: 3,
  retryDelayMs: 1000,
};

export const notionConfig = registerAs('notion', (): NotionConfig => ({
  ...defaultNotionConfig,
  apiKey: process.env.NOTION_API_KEY ?? '',
  syncEnabled: process.env.NOTION_SYNC_ENABLED === 'true',
  transactionsDbId: process.env.NOTION_TRANSACTIONS_DB_ID ?? '',
  accountsDbId: process.env.NOTION_ACCOUNTS_DB_ID ?? '',
  categoriesDbId: process.env.NOTION_CATEGORIES_DB_ID ?? '',
  projectionsDbId: process.env.NOTION_PROJECTIONS_DB_ID ?? '',
  webhookSecret: process.env.NOTION_WEBHOOK_SECRET ?? '',
  retryMaxAttempts: Number(process.env.NOTION_RETRY_MAX_ATTEMPTS) || 3,
  retryDelayMs: Number(process.env.NOTION_RETRY_DELAY_MS) || 1000,
}));
