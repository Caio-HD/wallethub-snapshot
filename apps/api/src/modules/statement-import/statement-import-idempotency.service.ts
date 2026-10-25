import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class StatementImportIdempotencyService implements OnModuleDestroy {
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

  private key(organizationId: string, idempotencyKey: string): string {
    return `stmt-import:idem:${organizationId}:${idempotencyKey}`;
  }

  async get<T>(organizationId: string, idempotencyKey: string): Promise<T | null> {
    if (!idempotencyKey) return null;
    const raw = await this.getClient().get(this.key(organizationId, idempotencyKey));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(organizationId: string, idempotencyKey: string, value: T): Promise<void> {
    if (!idempotencyKey) return;
    await this.getClient().set(
      this.key(organizationId, idempotencyKey),
      JSON.stringify(value),
      'EX',
      TTL_SECONDS,
    );
  }
}
