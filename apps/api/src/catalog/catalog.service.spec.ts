import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogCache } from './catalog-cache';
import { PrismaService } from '../prisma/prisma.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let cache: jest.Mocked<CatalogCache>;
  let prisma: any;

  beforeEach(() => {
    cache = {
      get: jest.fn(),
      set: jest.fn(),
    };
    prisma = {
      category: {
        findMany: jest.fn(),
      } as any,
      product: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      } as any,
      $transaction: jest.fn(),
    };
    service = new CatalogService(prisma as any, cache);
  });

  describe('listProducts', () => {
    it('(1) cache miss then DB query, then set called with key catalog:all:1 and ttl 300', async () => {
      cache.get.mockResolvedValueOnce(null);
      prisma.$transaction.mockResolvedValueOnce([[], 0]);
      
      await service.listProducts({});
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith('catalog:all:1', expect.any(Object), 300);
    });

    it('(2) cache hit returns cached value and calls no Prisma method', async () => {
      const cached = { items: [], page: 1, pageSize: 12, total: 0 };
      cache.get.mockResolvedValueOnce(cached);

      const result = await service.listProducts({});
      expect(result).toBe(cached);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('(3) category key catalog:boys:2', async () => {
      cache.get.mockResolvedValueOnce(null);
      prisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.listProducts({ category: 'boys', page: 2 });
      expect(cache.get).toHaveBeenCalledWith('catalog:boys:2');
      expect(cache.set).toHaveBeenCalledWith('catalog:boys:2', expect.any(Object), 300);
    });

    it('(4) toImages drops non-strings and handles non-arrays', async () => {
      cache.get.mockResolvedValueOnce(null);
      prisma.$transaction.mockResolvedValueOnce([
        [
          { id: '1', name: 'A', slug: 'a', basePrice: 100, images: ['ok', 123, null], category: { name: 'C', slug: 'c' } },
          { id: '2', name: 'B', slug: 'b', basePrice: 200, images: null, category: { name: 'C', slug: 'c' } },
        ],
        2,
      ]);

      const res = await service.listProducts({});
      expect(res.items[0].images).toEqual(['ok']);
      expect(res.items[1].images).toEqual([]);
    });

    it('(8) returned objects contain no forbidden keys', async () => {
      cache.get.mockResolvedValueOnce(null);
      prisma.$transaction.mockResolvedValueOnce([
        [
          {
            id: '1', name: 'A', slug: 'a', basePrice: 100, images: [], category: { name: 'C', slug: 'c' },
            // even if prisma returned forbidden keys for some reason
            isActive: false, createdAt: new Date(), categoryId: 1
          },
        ],
        1,
      ]);
      const res = await service.listProducts({});
      const keys = Object.keys(res.items[0]);
      expect(keys).not.toContain('isActive');
      expect(keys).not.toContain('createdAt');
      expect(keys).not.toContain('categoryId');
    });
  });

  describe('getProductBySlug', () => {
    it('(5) price uses the override when non-null, else basePrice (including override 0)', async () => {
      prisma.product.findFirst.mockResolvedValueOnce({
        id: '1', name: 'A', slug: 'a', description: null, basePrice: 1000, images: [], attributes: {}, tags: [],
        category: { name: 'C', slug: 'c' },
        variants: [
          { id: 'v1', size: 'S', color: 'Red', priceOverride: null, stockQuantity: 5 },
          { id: 'v2', size: 'M', color: 'Red', priceOverride: 1200, stockQuantity: 5 },
          { id: 'v3', size: 'L', color: 'Red', priceOverride: 0, stockQuantity: 5 },
        ],
      });
      const p = await service.getProductBySlug('a');
      expect(p.variants[0].price).toBe(1000); // fallback
      expect(p.variants[1].price).toBe(1200); // override
      expect(p.variants[2].price).toBe(0);    // override 0
    });

    it('(6) inStock is true only when stock > 0', async () => {
      prisma.product.findFirst.mockResolvedValueOnce({
        id: '1', name: 'A', slug: 'a', description: null, basePrice: 1000, images: [], attributes: {}, tags: [],
        category: { name: 'C', slug: 'c' },
        variants: [
          { id: 'v1', size: 'S', color: 'Red', priceOverride: null, stockQuantity: 1 },
          { id: 'v2', size: 'M', color: 'Red', priceOverride: null, stockQuantity: 0 },
          { id: 'v3', size: 'L', color: 'Red', priceOverride: null, stockQuantity: -1 }, // constraint normally prevents this
        ],
      });
      const p = await service.getProductBySlug('a');
      expect(p.variants[0].inStock).toBe(true);
      expect(p.variants[1].inStock).toBe(false);
      expect(p.variants[2].inStock).toBe(false);
    });

    it('(7) detail with null result throws NotFoundException', async () => {
      prisma.product.findFirst.mockResolvedValueOnce(null);
      await expect(service.getProductBySlug('not-found')).rejects.toThrow(NotFoundException);
    });

    it('(8) returned objects contain no forbidden keys', async () => {
      prisma.product.findFirst.mockResolvedValueOnce({
        id: '1', name: 'A', slug: 'a', description: null, basePrice: 1000, images: [], attributes: {}, tags: [],
        categoryId: 1, isActive: true, createdAt: new Date(),
        category: { name: 'C', slug: 'c' },
        variants: [
          { id: 'v1', size: 'S', color: 'Red', priceOverride: 100, stockQuantity: 5, sku: 'SKU1', isActive: true },
        ],
      });
      const p = await service.getProductBySlug('a');
      const rootKeys = Object.keys(p);
      expect(rootKeys).not.toContain('isActive');
      expect(rootKeys).not.toContain('createdAt');
      expect(rootKeys).not.toContain('categoryId');

      const varKeys = Object.keys(p.variants[0]);
      expect(varKeys).not.toContain('sku');
      expect(varKeys).not.toContain('priceOverride');
      expect(varKeys).not.toContain('stockQuantity');
      expect(varKeys).not.toContain('isActive');
    });
  });
});
