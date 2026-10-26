import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class InMemoryRefreshTokenStore implements OnModuleDestroy {
  private readonly entries = new Map<string, number>();

  async store(key: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, Date.now() + ttlSeconds * 1000);
  }

  async has(key: string): Promise<boolean> {
    const expiresAt = this.entries.get(key);
    if (!expiresAt) {
      return false;
    }

    if (expiresAt <= Date.now()) {
      this.entries.delete(key);
      return false;
    }

    return true;
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async onModuleDestroy(): Promise<void> {
    this.entries.clear();
  }
}

