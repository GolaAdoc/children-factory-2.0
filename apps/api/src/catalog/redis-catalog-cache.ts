import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { CatalogCache } from './catalog-cache';

@Injectable()
export class RedisCatalogCache implements CatalogCache, OnModuleDestroy {
  private readonly logger = new Logger(RedisCatalogCache.name);
  private readonly client: Redis;
  private degraded = false;
  private lastErrorLog = 0;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      commandTimeout: 250,
      keepAlive: 5000,
      retryStrategy: (n) => Math.min(n * 200, 5000),
      lazyConnect: false,
    });

    this.client.on('ready', () => {
      if (this.degraded) {
        this.logger.log('Redis connection restored — cache active');
        this.degraded = false;
      }
    });

    this.client.on('error', (err: NodeJS.ErrnoException) => {
      const now = Date.now();
      if (now - this.lastErrorLog >= 30_000) {
        this.logger.warn('Redis error: ' + (err.code ?? err.name));
        this.lastErrorLog = now;
      }
    });
  }

  private markFailure(): void {
    if (!this.degraded) {
      this.logger.warn('Redis degraded — falling back to Postgres');
      this.degraded = true;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.client.status !== 'ready') return null;
    try {
      const raw = await this.client.get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch (parseErr: unknown) {
        const e = parseErr as { code?: string; name?: string };
        this.logger.warn('Redis parse error: ' + (e.code ?? e.name));
        return null;
      }
    } catch (err: unknown) {
      this.markFailure();
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.client.status !== 'ready') return;
    const ttl = Math.max(1, Math.min(ttlSeconds, 600));
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err: unknown) {
      this.markFailure();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'ready') {
      this.client.disconnect();
      return;
    }
    try {
      await this.client.quit();
    } catch {
      try {
        this.client.disconnect();
      } catch {
        // swallow
      }
    }
  }
}
