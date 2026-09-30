export const CATALOG_CACHE = Symbol('CATALOG_CACHE');

export interface CatalogCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

export class NoopCatalogCache implements CatalogCache {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }
  async set<T>(_key: string, _value: T, _ttlSeconds: number): Promise<void> {
    /* intentionally empty: P3 replaces this binding with Redis */
  }
}
