import {
  PageObjectResponse,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints.js';

export type NotionEntityType = 'transaction' | 'account' | 'category' | 'projection';

export interface NotionSyncJob {
  entityType: NotionEntityType;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  skipNotionSync?: boolean;
}

export interface NotionWebhookJob {
  pageId: string;
  databaseId: string;
  eventType: 'created' | 'updated' | 'deleted';
}

export interface NotionTransactionProperties {
  Amount: { number: number };
  Date: { date: { start: string } };
  Category: { relation: Array<{ id: string }> };
  Account: { relation: Array<{ id: string }> };
  User: { relation: Array<{ id: string }> };
  Direction: { select: { name: 'income' | 'expense' | 'transfer' } };
  Description: { rich_text: Array<{ text: { content: string } }> };
  Source: { select: { name: 'web' | 'whatsapp' | 'telegram' | 'connector' } };
  WalletHubId: { rich_text: Array<{ text: { content: string } }> };
}

export interface NotionAccountProperties {
  Name: { title: Array<{ text: { content: string } }> };
  Balance: { number: number };
  'Owner Scope': { select: { name: 'all' | 'user1' | 'user2' } };
  'Is Active': { checkbox: boolean };
  WalletHubId: { rich_text: Array<{ text: { content: string } }> };
}

export interface NotionCategoryProperties {
  Name: { title: Array<{ text: { content: string } }> };
  Type: { select: { name: 'income' | 'expense' | 'transfer' } };
  'Owner Scope': { select: { name: 'all' | 'user1' | 'user2' } };
  'Is Active': { checkbox: boolean };
  'Sort Order': { number: number };
  WalletHubId: { rich_text: Array<{ text: { content: string } }> };
}

export interface NotionProjectionProperties {
  'Period Start': { date: { start: string } };
  'Period End': { date: { start: string } };
  Scope: { select: { name: 'all' | 'user1' | 'user2' } };
  'Projected Income': { number: number };
  'Projected Expense': { number: number };
  'Projected Balance': { number: number };
  Trend: { select: { name: 'up' | 'flat' | 'down' } };
  'Generated At': { date: { start: string } };
  WalletHubId: { rich_text: Array<{ text: { content: string } }> };
}

export type NotionPage = PageObjectResponse;
export type NotionDatabase = DatabaseObjectResponse;

export interface NotionSyncResult {
  success: boolean;
  notionPageId?: string;
  error?: string;
}
