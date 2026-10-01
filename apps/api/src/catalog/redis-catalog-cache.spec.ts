import { Logger } from '@nestjs/common';

// Mock ioredis before importing the module under test
jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});

import Redis from 'ioredis';
import { RedisCatalogCache } from './redis-catalog-cache';

const MockRedis = Redis as jest.MockedClass<typeof Redis>;

function makeClient(overrides: Partial<Record<string, unknown>> = {}): jest.Mocked<Redis> {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  const client = {
    status: 'ready',
    get: jest.fn(),
    set: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(cb);
      return client;
    }),
    emit: (event: string, ...args: unknown[]) => {
      (handlers[event] ?? []).forEach((h) => h(...args));
    },
    ...overrides,
  } as unknown as jest.Mocked<Redis>;
  return client;
}

describe('RedisCatalogCache', () => {
  let client: ReturnType<typeof makeClient>;
  let cache: RedisCatalogCache;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    client = makeClient();
    MockRedis.mockImplementation(() => client as unknown as Redis);
    cache = new RedisCatalogCache('redis://:pw@127.0.0.1:6379');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('get', () => {
    it('returns null immediately when client is not ready', async () => {
      (client as unknown as { status: string }).status = 'connecting';
      const result = await cache.get('catalog:all:1');
      expect(result).toBeNull();
      expect(client.get).not.toHaveBeenCalled();
    });

    it('returns null when key does not exist', async () => {
      client.get.mockResolvedValue(null);
      expect(await cache.get('catalog:all:1')).toBeNull();
    });

    it('returns parsed JSON when key exists', async () => {
      const payload = { items: [], page: 1, pageSize: 12, total: 0 };
      client.get.mockResolvedValue(JSON.stringify(payload));
      expect(await cache.get('catalog:all:1')).toEqual(payload);
    });

    it('returns null and logs warn on JSON parse failure', async () => {
      client.get.mockResolvedValue('{bad json');
      const result = await cache.get('catalog:all:1');
      expect(result).toBeNull();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('parse error'));
    });

    it('returns null and marks degraded on Redis error', async () => {
      client.get.mockRejectedValue(new Error('ECONNRESET'));
      const result = await cache.get('catalog:all:1');
      expect(result).toBeNull();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('degraded'));
    });
  });

  describe('set', () => {
    it('does nothing when client is not ready', async () => {
      (client as unknown as { status: string }).status = 'connecting';
      await cache.set('catalog:all:1', { data: 1 }, 300);
      expect(client.set).not.toHaveBeenCalled();
    });

    it('stores JSON-serialised value with clamped TTL', async () => {
      client.set.mockResolvedValue('OK');
      await cache.set('catalog:all:1', { data: 1 }, 300);
      expect(client.set).toHaveBeenCalledWith('catalog:all:1', '{"data":1}', 'EX', 300);
    });

    it('clamps TTL below 1 to 1', async () => {
      client.set.mockResolvedValue('OK');
      await cache.set('catalog:all:1', {}, 0);
      expect(client.set).toHaveBeenCalledWith('catalog:all:1', '{}', 'EX', 1);
    });

    it('clamps TTL above 600 to 600', async () => {
      client.set.mockResolvedValue('OK');
      await cache.set('catalog:all:1', {}, 1000);
      expect(client.set).toHaveBeenCalledWith('catalog:all:1', '{}', 'EX', 600);
    });

    it('marks degraded on Redis error without throwing', async () => {
      client.set.mockRejectedValue(new Error('ECONNRESET'));
      await expect(cache.set('catalog:all:1', {}, 300)).resolves.toBeUndefined();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('degraded'));
    });
  });

  describe('degradation lifecycle', () => {
    it('logs warn exactly once per 30 s on repeated client errors', async () => {
      const err = Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' });
      // Simulate two rapid client error events
      (client as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit('error', err);
      (client as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit('error', err);
      expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
    });

    it('logs recovery on ready event after degraded', async () => {
      client.get.mockRejectedValue(new Error('ECONNRESET'));
      await cache.get('x');
      // Now simulate reconnect
      (client as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit('ready');
      expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('restored'));
    });
  });

  describe('onModuleDestroy', () => {
    it('calls disconnect directly if client is not ready', async () => {
      (client as unknown as { status: string }).status = 'connecting';
      await cache.onModuleDestroy();
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.quit).not.toHaveBeenCalled();
    });

    it('calls quit on destroy if client is ready', async () => {
      await cache.onModuleDestroy();
      expect(client.quit).toHaveBeenCalled();
    });

    it('calls disconnect if quit rejects', async () => {
      client.quit.mockRejectedValue(new Error('closed'));
      await cache.onModuleDestroy();
      expect(client.disconnect).toHaveBeenCalled();
    });
  });
});
