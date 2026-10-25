import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { OFXBankInfo, ParsedStatementRow } from './statement-import.types';

/**
 * Cache de curta duração das linhas já parseadas de um lote de extratos.
 *
 * Motivação: o fluxo de import em lote precisava reenviar os ficheiros a cada
 * re-preview (mudança de roteamento), o que duplicava upload e causava 400
 * intermitente ("Ficheiros em falta"). Com este cache, o `preview-batch`
 * parseia os ficheiros UMA vez, guarda o resultado sob um token e os
 * re-previews subsequentes enviam só `{ token, routing }` (sem ficheiros).
 *
 * Guarda apenas linhas já parseadas (não os buffers crus) — payload pequeno,
 * TTL curto. Dados financeiros: TTL de 30 min, nunca logados (Regra 9).
 */
export type CachedParsedFile = {
  filename: string;
  rows: ParsedStatementRow[];
  format: 'csv' | 'ofx';
  bankInfo?: OFXBankInfo;
};

export type CachedBatchPreview = {
  files: CachedParsedFile[];
};

const TTL_SECONDS = 30 * 60;

@Injectable()
export class StatementImportPreviewCacheService implements OnModuleDestroy {
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): Redis {
    if (this.client) return this.client;
    const url = this.config.get<string>('REDIS_URL');
    this.client = url
      ? new Redis(url)
      : new Redis({ host: '127.0.0.1', port: 6379, lazyConnect: true });
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }

  private key(organizationId: string, token: string): string {
    return `stmt-import:preview:${organizationId}:${token}`;
  }

  async store(organizationId: string, token: string, value: CachedBatchPreview): Promise<void> {
    await this.getClient().set(
      this.key(organizationId, token),
      JSON.stringify(value),
      'EX',
      TTL_SECONDS,
    );
  }

  async get(organizationId: string, token: string): Promise<CachedBatchPreview | null> {
    if (!token) return null;
    const raw = await this.getClient().get(this.key(organizationId, token));
    if (!raw) return null;
    return JSON.parse(raw) as CachedBatchPreview;
  }
}
