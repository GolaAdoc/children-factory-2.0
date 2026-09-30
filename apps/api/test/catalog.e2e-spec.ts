import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomUUID } from 'node:crypto';

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = randomUUID().split('-')[0];
  const catSlug = `e2e-${runId}`;

  let catId: number;
  let prodId1: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    // Seed fixtures
    const cat = await prisma.category.create({
      data: { name: 'E2E Category', slug: catSlug },
    });
    catId = cat.id;

    // We need 13 active products and 1 inactive product to test pagination and filtering
    const products = Array.from({ length: 14 }).map((_, i) => ({
      name: `Prod ${i}`,
      slug: `p-${runId}-${i}`,
      categoryId: catId,
      basePrice: 1000 + i,
      isActive: i < 13, // 13 active, 1 inactive
      createdAt: new Date(Date.now() - i * 1000), // desc order
    }));
    await prisma.product.createMany({ data: products });

    const dbProds = await prisma.product.findMany({ where: { categoryId: catId }, orderBy: { createdAt: 'desc' } });
    prodId1 = dbProds[0].id;

    await prisma.productVariant.createMany({
      data: [
        { productId: prodId1, size: 'S', color: 'Red', sku: `sku-${runId}-1`, stockQuantity: 5, isActive: true },
        { productId: prodId1, size: 'M', color: 'Red', sku: `sku-${runId}-2`, stockQuantity: 0, priceOverride: null, isActive: true },
        { productId: prodId1, size: 'L', color: 'Red', sku: `sku-${runId}-3`, stockQuantity: 10, priceOverride: 0, isActive: true },
        { productId: prodId1, size: 'XL', color: 'Red', sku: `sku-${runId}-4`, stockQuantity: 10, isActive: false }, // inactive
      ],
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.productVariant.deleteMany({ where: { sku: { contains: runId } } });
      await prisma.product.deleteMany({ where: { slug: { contains: runId } } });
      await prisma.category.deleteMany({ where: { slug: catSlug } });
    }
    if (app) await app.close();
  });

  it('AC1: Constraints and Ownership (Raw SQL)', async () => {
    const ac1Cat = await prisma.category.create({ data: { name: 'AC1', slug: `ac1-${runId}` } });
    const ac1CatId = ac1Cat.id;

    // negative base_price rejects
    await expect(prisma.$executeRawUnsafe(`INSERT INTO products (category_id, name, slug, base_price) VALUES (${ac1CatId}, 'A', 'a-${runId}', -1)`))
      .rejects.toThrow();
    // 0 base_price accepts
    await prisma.$executeRawUnsafe(`INSERT INTO products (category_id, name, slug, base_price) VALUES (${ac1CatId}, 'A', 'a0-${runId}', 0)`);
    
    const dbProds = await prisma.product.findMany({ where: { categoryId: ac1CatId } });
    const ac1ProdId = dbProds[0].id;

    // negative price_override rejects
    await expect(prisma.$executeRawUnsafe(`INSERT INTO product_variants (product_id, size, color, sku, price_override) VALUES ('${ac1ProdId}', 'S2', 'B', 'skuA-${runId}', -1)`))
      .rejects.toThrow();
    // NULL and 0 price_override accepts
    await prisma.$executeRawUnsafe(`INSERT INTO product_variants (product_id, size, color, sku, price_override) VALUES ('${ac1ProdId}', 'S2', 'B', 'skuNULL-${runId}', NULL)`);
    await prisma.$executeRawUnsafe(`INSERT INTO product_variants (product_id, size, color, sku, price_override) VALUES ('${ac1ProdId}', 'S3', 'B', 'sku0-${runId}', 0)`);

    // negative stock rejects
    await expect(prisma.$executeRawUnsafe(`INSERT INTO product_variants (product_id, size, color, sku, stock_quantity) VALUES ('${ac1ProdId}', 'S4', 'B', 'skuStk-${runId}', -1)`))
      .rejects.toThrow();

    // duplicate slug/sku/(product,size,color) rejects
    await expect(prisma.$executeRawUnsafe(`INSERT INTO products (category_id, name, slug, base_price) VALUES (${ac1CatId}, 'B', 'a0-${runId}', 10)`)).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`INSERT INTO product_variants (product_id, size, color, sku) VALUES ('${ac1ProdId}', 'S5', 'B', 'sku0-${runId}')`)).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`INSERT INTO product_variants (product_id, size, color, sku) VALUES ('${ac1ProdId}', 'S2', 'B', 'skuDUP-${runId}')`)).rejects.toThrow();

    // orphan FK rejects
    await expect(prisma.$executeRawUnsafe(`INSERT INTO products (category_id, name, slug, base_price) VALUES (-1, 'B', 'b-${runId}', 10)`)).rejects.toThrow();

    // pg_tables shows owner webstore_migrator
    const owners: any[] = await prisma.$queryRaw`SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('categories', 'products', 'product_variants')`;
    expect(owners).toHaveLength(3);
    for (const r of owners) {
      expect(r.tableowner).toBe('webstore_migrator');
    }

    // CREATE TABLE as app role rejects
    await expect(prisma.$executeRawUnsafe('CREATE TABLE p2_test (id int)')).rejects.toThrow(/permission denied/);
  });

  it('AC2: Exact key set, ascending name order for categories', async () => {
    const res = await request(app.getHttpServer()).get('/api/categories');
    expect(res.status).toBe(200);
    const cat = res.body.find((c: any) => c.slug === catSlug);
    expect(cat).toBeDefined();
    expect(Object.keys(cat).sort()).toEqual(['name', 'slug']);
    // Check ordering
    const names = res.body.map((c: any) => c.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });

  it('AC3: Product list pagination, filtering and validation matrix', async () => {
    // page 1
    const res1 = await request(app.getHttpServer()).get(`/api/products?category=${catSlug}&page=1`);
    expect(res1.status).toBe(200);
    expect(res1.body.items).toHaveLength(12);
    expect(res1.body.total).toBe(13);
    expect(res1.body.page).toBe(1);

    // page 2
    const res2 = await request(app.getHttpServer()).get(`/api/products?category=${catSlug}&page=2`);
    expect(res2.body.items).toHaveLength(1);

    // page 3
    const res3 = await request(app.getHttpServer()).get(`/api/products?category=${catSlug}&page=3`);
    expect(res3.body.items).toHaveLength(0);

    // inactive excluded (14 products created, 1 inactive, total returned 13)
    const allItems = [...res1.body.items, ...res2.body.items];
    expect(allItems.length).toBe(13);

    // ordering by createdAt desc then id asc
    for (let i = 0; i < allItems.length - 1; i++) {
      const p1 = await prisma.product.findUnique({ where: { id: allItems[i].id } });
      const p2 = await prisma.product.findUnique({ where: { id: allItems[i + 1].id } });
      expect(p1!.createdAt.getTime()).toBeGreaterThanOrEqual(p2!.createdAt.getTime());
      if (p1!.createdAt.getTime() === p2!.createdAt.getTime()) {
        expect(p1!.id < p2!.id).toBe(true);
      }
    }

    // Exact key sets and absent forbidden keys
    const item = res1.body.items[0];
    expect(Object.keys(item).sort()).toEqual(['basePrice', 'category', 'id', 'images', 'name', 'slug']);
    expect(Object.keys(item.category).sort()).toEqual(['name', 'slug']);

    // Validation matrix
    const badQueries = [
      '?page=0', '?page=-1', '?page=1001', '?page=abc', '?page=1.5', '?page=', '?page=1&page=2',
      '?category=UPPER', '?category=with space', '?category=' + 'a'.repeat(61), '?category=a&category=b',
      '?pageSize=5', '?sort=desc'
    ];
    for (const q of badQueries) {
      const r = await request(app.getHttpServer()).get(`/api/products${q}`);
      expect(r.status).toBe(400);
    }

    // unknown well-formed category gives 200 with empty result
    const emptyRes = await request(app.getHttpServer()).get('/api/products?category=does-not-exist-at-all');
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.items).toHaveLength(0);
    expect(emptyRes.body.total).toBe(0);
  });

  it('AC4: Product detail, variant mapping, 404/400 handling', async () => {
    const slug = `p-${runId}-0`; // prodId1
    const res = await request(app.getHttpServer()).get(`/api/products/${slug}`);
    expect(res.status).toBe(200);
    
    // exact keys
    const body = res.body;
    expect(Object.keys(body).sort()).toEqual([
      'attributes', 'basePrice', 'category', 'description', 'id', 'images', 'name', 'slug', 'tags', 'variants'
    ]);

    // inactive variants excluded
    expect(body.variants).toHaveLength(3); // 4 created, 1 inactive

    // variant logic
    const vM = body.variants.find((v: any) => v.size === 'M'); // stock 0, null override
    const vL = body.variants.find((v: any) => v.size === 'L'); // stock 10, 0 override
    
    expect(vM.price).toBe(body.basePrice);
    expect(vM.inStock).toBe(false);
    expect(vL.price).toBe(0);
    expect(vL.inStock).toBe(true);

    const inactiveSlug = `p-${runId}-13`;
    const rInactive = await request(app.getHttpServer()).get(`/api/products/${inactiveSlug}`);
    expect(rInactive.status).toBe(404);

    const rNonExistent = await request(app.getHttpServer()).get(`/api/products/no-such-slug-123`);
    expect(rNonExistent.status).toBe(404);
    
    expect(rInactive.body).toEqual(rNonExistent.body);

    const rUpper = await request(app.getHttpServer()).get(`/api/products/UPPER`);
    expect(rUpper.status).toBe(400);

    const rLong = await request(app.getHttpServer()).get(`/api/products/${'a'.repeat(161)}`);
    expect(rLong.status).toBe(400);

    const texts = [rInactive.text, rNonExistent.text, rUpper.text, rLong.text];
    for (const t of texts) {
      expect(t).not.toMatch(/stack|node_modules|prisma|SELECT|postgres:\/\//i);
    }
  });

  it('AC5: Write methods reject, Prisma side-effects visible, Headers', async () => {
    const p1Post = await request(app.getHttpServer()).post('/api/products');
    const p2Post = await request(app.getHttpServer()).post('/api/categories');
    const p3Post = await request(app.getHttpServer()).post(`/api/products/a`);
    expect(p1Post.status).toBe(404);
    expect(p2Post.status).toBe(404);
    expect(p3Post.status).toBe(404);

    // change base_price via Prisma
    const slug = `p-${runId}-0`;
    await prisma.product.update({ where: { slug }, data: { basePrice: 9999 } });

    // see it in next GET
    const rUpdate = await request(app.getHttpServer()).get(`/api/products/${slug}`);
    expect(rUpdate.body.basePrice).toBe(9999);

    // identical bodies with headers
    const rNoHeaders = await request(app.getHttpServer()).get('/api/categories');
    const rHeaders = await request(app.getHttpServer()).get('/api/categories')
      .set('Cookie', 'session=123')
      .set('Authorization', 'Bearer abc');
    expect(rNoHeaders.body).toEqual(rHeaders.body);

    // Helmet header present
    expect(rNoHeaders.headers['x-content-type-options']).toBe('nosniff');
    expect(rNoHeaders.headers['x-powered-by']).toBeUndefined();
  });
});
