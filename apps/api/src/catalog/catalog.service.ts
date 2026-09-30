import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CATALOG_CACHE, CatalogCache } from './catalog-cache';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto, ProductDetailDto, ProductListResponse } from './catalog.dto';

const PAGE_SIZE = 12;
const LIST_CACHE_TTL_SECONDS = 300;

function toImages(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CATALOG_CACHE) private readonly cache: CatalogCache,
  ) {}

  async listCategories(): Promise<CategoryDto[]> {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, slug: true },
    });
  }

  async listProducts({ category, page }: { category?: string; page?: number }): Promise<ProductListResponse> {
    const p = page ?? 1;
    const key = `catalog:${category ?? 'all'}:${p}`;
    const cached = await this.cache.get<ProductListResponse>(key);
    if (cached) return cached;

    const where = { isActive: true, ...(category ? { category: { slug: category } } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (p - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          images: true,
          category: { select: { name: true, slug: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result: ProductListResponse = {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        basePrice: r.basePrice,
        images: toImages(r.images),
        category: r.category,
      })),
      page: p,
      pageSize: PAGE_SIZE,
      total,
    };

    await this.cache.set(key, result, LIST_CACHE_TTL_SECONDS);
    return result;
  }

  async getProductBySlug(slug: string): Promise<ProductDetailDto> {
    const p = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        basePrice: true,
        images: true,
        attributes: true,
        tags: true,
        category: { select: { name: true, slug: true } },
        variants: {
          where: { isActive: true },
          orderBy: [{ color: 'asc' }, { size: 'asc' }],
          select: { id: true, size: true, color: true, priceOverride: true, stockQuantity: true },
        },
      },
    });
    if (!p) throw new NotFoundException('Product not found');

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      basePrice: p.basePrice,
      images: toImages(p.images),
      attributes: (typeof p.attributes === 'object' && p.attributes !== null && !Array.isArray(p.attributes) ? p.attributes : {}) as Record<string, unknown>,
      tags: p.tags,
      category: p.category,
      variants: p.variants.map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        price: v.priceOverride ?? p.basePrice,
        inStock: v.stockQuantity > 0,
      })),
    };
  }
}
