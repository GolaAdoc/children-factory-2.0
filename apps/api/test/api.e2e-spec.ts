import { Body, Controller, Get, INestApplication, Logger, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

class EchoDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

// Test-only routes. They exist only inside this test module and are never shipped.
@Controller('__test')
class TestOnlyController {
  @Post('echo')
  echo(@Body() dto: EchoDto) {
    return { name: dto.name };
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret at /var/app/src/db.ts:12');
  }
}

async function makeApp(prismaStub?: unknown): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule], controllers: [TestOnlyController] });
  if (prismaStub) builder = builder.overrideProvider(PrismaService).useValue(prismaStub);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

const GENERIC_503 = { statusCode: 503, error: 'Service Unavailable', message: 'Service Unavailable' };

describe('hardening', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await makeApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets helmet security headers and no X-Powered-By', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('serves routes only under the /api prefix', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(404);
  });

  it('rejects unknown properties with 400 (forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer()).post('/api/__test/echo').send({ name: 'a', isAdmin: true });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('isAdmin');
  });

  it('accepts a body containing only declared properties', async () => {
    const res = await request(app.getHttpServer()).post('/api/__test/echo').send({ name: 'a' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ name: 'a' });
  });

  it('rejects a wrong-typed declared property with 400', async () => {
    const res = await request(app.getHttpServer()).post('/api/__test/echo').send({ name: 123 });
    expect(res.status).toBe(400);
  });

  it('returns a generic 500 body without stack or paths', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const res = await request(app.getHttpServer()).get('/api/__test/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ statusCode: 500, error: 'Internal Server Error', message: 'Internal Server Error' });
    expect(res.text).not.toContain('secret');
    expect(res.text).not.toContain('/var/app');
  });

  it('logs the full error server-side only', async () => {
    const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const res = await request(app.getHttpServer()).get('/api/__test/boom');
    expect(res.text).not.toContain('secret');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('secret at /var/app/src/db.ts:12'),
      expect.any(String),
    );
  });

  it('returns 404 JSON for unknown routes without stack or paths', async () => {
    const res = await request(app.getHttpServer()).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ statusCode: 404, error: 'Not Found', message: 'Not Found' });
  });

  it('returns 400 JSON for malformed JSON bodies without stack or paths', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/__test/echo')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.text).not.toMatch(/stack|node_modules|\.ts|\/home\/|[A-Za-z]:\\/);
  });

  it('access log records method, path, status and duration but not the query string', async () => {
    const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await request(app.getHttpServer()).get('/api/nope?token=abc123');
    await new Promise((resolve) => setTimeout(resolve, 100));
    const lines = spy.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => /^GET \/api\/nope 404 [\d.]+ms$/.test(l))).toBe(true);
    expect(lines.some((l) => l.includes('abc123'))).toBe(false);
  });
});

describe('health', () => {
  it('GET /api/health returns 200 with status ok and db up when the database is reachable', async () => {
    const app = await makeApp();
    try {
      const res = await request(app.getHttpServer()).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', db: 'up' });
    } finally {
      await app.close();
    }
  });

  it('GET /api/health returns a generic 503 when the database check fails', async () => {
    const app = await makeApp({ $queryRaw: () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432')) });
    try {
      const res = await request(app.getHttpServer()).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body).toEqual(GENERIC_503);
      expect(res.text).not.toContain('10.0.0.5');
    } finally {
      await app.close();
    }
  });

  it('GET /api/health returns a generic 503 when the database check times out', async () => {
    const app = await makeApp({ $queryRaw: () => new Promise(() => undefined) });
    try {
      const res = await request(app.getHttpServer()).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body).toEqual(GENERIC_503);
    } finally {
      await app.close();
    }
  }, 10000);
});
