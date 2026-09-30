/**
 * Redis-degraded e2e spec.
 *
 * Starts the real AppModule with a real Postgres connection and a REDIS_URL
 * that points to an unreachable Redis (port 1). Asserts that all catalog
 * endpoints return correct data from Postgres within 1500 ms on every call,
 * and that /api/health is unaffected.
 *
 * Prerequisite: the database must be seeded (seed.mjs run before this suite).
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

const SEEDED_SLUG = 'boys-cotton-tshirt';
const UNREACHABLE_REDIS = 'redis://:x@127.0.0.1:1';
const TIMEOUT_MS = 1500;
const REPETITIONS = 5;

async function makeApp(): Promise<INestApplication> {
  process.env.REDIS_URL = UNREACHABLE_REDIS;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

describe('Catalog graceful degradation (Redis unreachable)', () => {
  let app: INestApplication;
  // Capture ground-truth from first successful call
  let expectedCategories: unknown[];
  let expectedProducts: unknown;
  let expectedDetail: unknown;

  beforeAll(async () => {
    app = await makeApp();

    // Fetch ground truth from Postgres (no cache warm-up possible with broken Redis)
    const catRes = await request(app.getHttpServer()).get('/api/categories');
    expect(catRes.status).toBe(200);
    expectedCategories = catRes.body as unknown[];

    const listRes = await request(app.getHttpServer()).get('/api/products');
    expect(listRes.status).toBe(200);
    expectedProducts = listRes.body;

    const detailRes = await request(app.getHttpServer()).get(`/api/products/${SEEDED_SLUG}`);
    expect(detailRes.status).toBe(200);
    expectedDetail = detailRes.body;
  }, 30_000);

  afterAll(async () => {
    delete process.env.REDIS_URL;
    await app.close();
  });

  it.each(Array.from({ length: REPETITIONS }, (_, i) => [i + 1]))(
    'GET /api/categories returns seeded data on attempt %i',
    async (_attempt) => {
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/api/categories');
      expect(Date.now() - start).toBeLessThan(TIMEOUT_MS);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expectedCategories);
    },
  );

  it.each(Array.from({ length: REPETITIONS }, (_, i) => [i + 1]))(
    'GET /api/products returns seeded data on attempt %i',
    async (_attempt) => {
      const start = Date.now();
      const res = await request(app.getHttpServer()).get('/api/products');
      expect(Date.now() - start).toBeLessThan(TIMEOUT_MS);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expectedProducts);
    },
  );

  it.each(Array.from({ length: REPETITIONS }, (_, i) => [i + 1]))(
    `GET /api/products/${SEEDED_SLUG} returns seeded data on attempt %i`,
    async (_attempt) => {
      const start = Date.now();
      const res = await request(app.getHttpServer()).get(`/api/products/${SEEDED_SLUG}`);
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
