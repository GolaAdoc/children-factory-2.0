import { readEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://webstore_app:secretpw123@127.0.0.1:5432/webstore?schema=public',
};

describe('readEnv', () => {
  it('accepts a valid environment and applies defaults', () => {
    expect(readEnv(valid)).toEqual({ NODE_ENV: 'development', PORT: 3001, DATABASE_URL: valid.DATABASE_URL });
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => readEnv({})).toThrow('Invalid environment');
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() => readEnv({ DATABASE_URL: 'mysql://webstore_app:x@127.0.0.1/db' })).toThrow('Invalid environment');
  });

  it('rejects DATABASE_URL using the migrator role', () => {
    expect(() => readEnv({ DATABASE_URL: 'postgresql://webstore_migrator:x@127.0.0.1:5432/webstore' })).toThrow(
      'least-privilege',
    );
  });

  it('rejects DATABASE_URL using the postgres superuser name', () => {
    expect(() => readEnv({ DATABASE_URL: 'postgresql://postgres:x@127.0.0.1:5432/webstore' })).toThrow(
      'least-privilege',
    );
  });

  it('rejects an invalid PORT', () => {
    expect(() => readEnv({ ...valid, PORT: '70000' })).toThrow('PORT');
    expect(() => readEnv({ ...valid, PORT: 'abc' })).toThrow('PORT');
  });

  it('never echoes the DATABASE_URL value in the error', () => {
    try {
      readEnv({ DATABASE_URL: 'mysql://webstore_app:secretpw123@127.0.0.1/db' });
    } catch (e) {
      expect((e as Error).message).not.toContain('secretpw123');
      return;
    }
    throw new Error('expected readEnv to throw');
  });
});
