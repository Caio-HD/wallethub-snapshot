import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

@Injectable()
export class WhatsAppRedisLockService implements OnModuleDestroy {
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Redis {
    if (!this.client) {
      const redis = this.configService.get<{
        url?: string;
        host?: string;
        port?: number;
        password?: string;
      }>('redis');
      this.client = redis?.url
        ? new Redis(redis.url)
        : new Redis({
            host: redis?.host ?? '127.0.0.1',
            port: redis?.port ?? 6379,
            password: redis?.password,
          });
    }
    return this.client;
  }

  async withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const client = this.getClient();
    const acquired = await client.set(key, token, 'EX', ttlSeconds, 'NX');
    if (acquired !== 'OK') {
      const err = new Error('LOCK_NOT_ACQUIRED') as Error & { code: string };
      err.code = 'LOCK_NOT_ACQUIRED';
      throw err;
    }
    try {
      return await fn();
    } finally {
      await client.eval(RELEASE_SCRIPT, 1, key, token);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }
}
