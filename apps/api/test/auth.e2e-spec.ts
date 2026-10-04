import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomUUID, createHmac } from 'node:crypto';
import * as jwt from 'jsonwebtoken';

process.env.JWT_ACCESS_SECRET = 'test-secret-at-least-32-chars-long!';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = randomUUID().split('-')[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Signup: 10-way concurrent, hash prefix, hash length <= 100', async () => {
    const signups = Array.from({ length: 10 }).map((_, i) => ({
      email: `concurrent${i}-${runId}@test.com`,
      password: 'password123',
      name: `User ${i}`,
      phoneNumber: `+923001234${i}00`
    }));

    const results = await Promise.all(
      signups.map(s => request(app.getHttpServer()).post('/api/auth/signup').send(s))
    );

    for (const res of results) {
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
    }

    const savedUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'concurrent' } }
    });
    for (const u of savedUsers) {
      expect(u.passwordHash).toBeDefined();
      expect(u.passwordHash?.startsWith('$argon2')).toBe(true);
      expect(u.passwordHash?.length).toBeLessThanOrEqual(100);
    }
  });

  it('Signup: 409 bodies are identical for email and phone duplicates', async () => {
    const email = `dup-${runId}@test.com`;
    const phone = `+92300000${1111}`;
    
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email, password: 'password123', name: 'N', phoneNumber: phone })
      .expect(201);

    const dupEmailRes = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email, password: 'password123', name: 'N2', phoneNumber: `+92300110${1111}` })
      .expect(409);

    const dupPhoneRes = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email: `dup2-${runId}@test.com`, password: 'password123', name: 'N3', phoneNumber: phone })
      .expect(409);

    expect(dupEmailRes.body).toEqual(dupPhoneRes.body);
  });

  it('Login: 401 bodies are identical across failure types', async () => {
    const email = `fail-${runId}@test.com`;
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email, password: 'correctpw', name: 'N', phoneNumber: `+92300220${1111}` })
      .expect(201);

    const nullUser = await prisma.user.create({
      data: {
        email: `null-${runId}@test.com`,
        isGuest: false,
        name: 'Null',
        phoneNumber: `+92300330${1111}`
      }
    });

    const wrongPwRes = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'wrong' }).expect(401);
    const noUserRes = await request(app.getHttpServer()).post('/api/auth/login').send({ email: `nouser${runId}@test.com`, password: 'password123' }).expect(401);
    const nullHashRes = await request(app.getHttpServer()).post('/api/auth/login').send({ email: nullUser.email, password: 'password123' }).expect(401);

    expect(wrongPwRes.body).toEqual(noUserRes.body);
    expect(wrongPwRes.body).toEqual(nullHashRes.body);
  });

  it('JWT Verification: expired, alg:none, tampered, wrong secret', async () => {
    const validPayload = { sub: randomUUID(), role: 'customer' };
    
    const expiredToken = jwt.sign(validPayload, process.env.JWT_ACCESS_SECRET!, { expiresIn: '-1s' });
    const noneToken = jwt.sign(validPayload, process.env.JWT_ACCESS_SECRET!, { algorithm: 'none' });
    const wrongSecretToken = jwt.sign(validPayload, 'wrong-secret-that-is-long-enough-12345');
    
    const validToken = jwt.sign(validPayload, process.env.JWT_ACCESS_SECRET!);
    const tamperedToken = validToken.substring(0, validToken.length - 5) + 'abcde';

    for (const token of [expiredToken, noneToken, wrongSecretToken, tamperedToken]) {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }
  });

  it('NODE_ENV=production: no stack, path, prisma, argon2 in error', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    const modRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const prodApp = modRef.createNestApplication({ logger: false });
    configureApp(prodApp);
    await prodApp.init();

    const res = await request(prodApp.getHttpServer())
      .post('/api/auth/signup')
      .send({ email: 'bad_email', password: '', name: '', phoneNumber: '' })
      .expect(400);

    const bodyStr = JSON.stringify(res.body).toLowerCase();
    expect(bodyStr).not.toContain('stack');
    expect(bodyStr).not.toContain('path');
    expect(bodyStr).not.toContain('prisma');
    expect(bodyStr).not.toContain('argon2');

    await prodApp.close();
    process.env.NODE_ENV = originalEnv;
  });
});




