/**
 * Redis-degraded e2e spec.
 *
 * Starts the real AppModule with a real Postgres connection and a REDIS_URL
 * that points to an unreachable Redis (port 1). Asserts that all catalog
 * endpoints return correct data from Postgres within 1500 ms on every call,
 * and that /api/health is unaffected.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomUUID } from 'node:crypto';

const UNREACHABLE_REDIS = 'redis://:x@127.0.0.1:1';
const TIMEOUT_MS = 1500;
const REPETITIONS = 5;

describe('Catalog graceful degradation (Redis unreachable)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = randomUUID().split('-')[0];
  const catSlug = `deg-cat-${runId}`;
  const prodSlug = `deg-prod-${runId}`;

  // Capture ground-truth from first successful call
  let expectedCategories: unknown[];
  let expectedProducts: unknown;
  let expectedDetail: unknown;

  beforeAll(async () => {
    process.env.REDIS_URL = UNREACHABLE_REDIS;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    // Seed test data
    const cat = await prisma.category.create({
      data: { name: 'Degraded Category', slug: catSlug },
    });
    const prod = await prisma.product.create({
      data: {
        name: 'Degraded Product',
        slug: prodSlug,
        categoryId: cat.id,
        basePrice: 1000,
        images: ['https://example.com/deg.jpg'],
        variants: {
          create: [{ sku: `SKU-${runId}`, size: 'M', color: 'red', stockQuantity: 10 }],
        },
      },
    });

    // Fetch ground truth from Postgres (no cache warm-up possible with broken Redis)
    const catRes = await request(app.getHttpServer()).get('/api/categories');
    expect(catRes.status).toBe(200);
    expectedCategories = catRes.body as unknown[];

    const listRes = await request(app.getHttpServer()).get(`/api/products?category=${catSlug}`);
    expect(listRes.status).toBe(200);
    expectedProducts = listRes.body;

    const detailRes = await request(app.getHttpServer()).get(`/api/products/${prodSlug}`);
    expect(detailRes.status).toBe(200);
    expectedDetail = detailRes.body;
  }, 30_000);

  afterAll(async () => {
    await prisma.productVariant.deleteMany({ where: { sku: { contains: runId } } });
    await prisma.product.deleteMany({ where: { slug: { contains: runId } } });
    await prisma.category.deleteMany({ where: { slug: { contains: runId } } });
    delete process.env.REDIS_URL;
    await app.close();
  });

  it.each(Array.from({ length: REPETITIONS }, (_, i) => [i + 1]))(
    'GET /api/categories returns data on attempt %i',
    async (_attempt) => {
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/api/categories');
      expect(Date.now() - start).toBeLessThan(TIMEOUT_MS);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slug: catSlug }),
        ]),
      );
    },
  );

  it.each(Array.from({ length: REPETITIONS }, (_, i) => [i + 1]))(
    'GET /api/products returns data on attempt %i',
    async (_attempt) => {
      const start = Date.now();
      const res = await request(app.getHttpServer()).get(`/api/products?category=${catSlug}`);
      expect(Date.now() - start).toBeLessThan(TIMEOUT_MS);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ slug: prodSlug }),
          ]),
        }),
      );
    },
  );

  it.each(Array.from({ length: REPETITIONS }, (_, i) => [i + 1]))(
    `GET /api/products/:slug returns data on attempt %i`,
    async (_attempt) => {
      const start = Date.now();
      const res = await request(app.getHttpServer()).get(`/api/products/${prodSlug}`);
      expect(Date.now() - start).toBeLessThan(TIMEOUT_MS);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expectedDetail);
    },
  );

  it('GET /api/health returns 200 {"status":"ok","db":"up"} while Redis is down', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });
});

