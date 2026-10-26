import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { redisConfig } from '../../core/config/redis.config';

@Injectable()
export class RefreshTokenStore implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redis = this.configService.getOrThrow<ReturnType<typeof redisConfig>>('redis');

    if (redis.url) {
      this.client = new Redis(redis.url);
    } else {
      const options: RedisOptions = {
        host: redis.host ?? '127.0.0.1',
        port: redis.port ?? 6379,
        password: redis.password ?? undefined,
      };

      if (redis.tls) {
        options.tls = {};
      }

      this.client = new Redis(options);
    }
  }

  async store(key: string, ttlSeconds: number, value = '1'): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.client.exists(key);
    return value > 0;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
