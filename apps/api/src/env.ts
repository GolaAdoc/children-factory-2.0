export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
}

// Defense in depth: the runtime must never connect as the DDL role or the bootstrap superuser.
// The database enforces the real limits (see db/init/01-roles.sql and the baseline migration).
const FORBIDDEN_RUNTIME_DB_USERS = ['webstore_migrator', 'postgres'];

// Never put values in error messages (DATABASE_URL contains a password).
export function readEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const errors: string[] = [];

  const nodeEnv = raw.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push('NODE_ENV must be development, test or production');
  }

  const port = Number(raw.PORT ?? '3001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535');
  }

  const url = raw.DATABASE_URL ?? '';
  let dbUser = '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      throw new Error('unsupported protocol');
    }
    dbUser = decodeURIComponent(parsed.username);
  } catch {
    errors.push('DATABASE_URL must be a valid postgresql:// URL');
  }
  if (FORBIDDEN_RUNTIME_DB_USERS.includes(dbUser)) {
    errors.push('DATABASE_URL must use the least-privilege application role');
  }

  if (errors.length > 0) {
    throw new Error('Invalid environment: ' + errors.join('; '));
  }
  return { NODE_ENV: nodeEnv as Env['NODE_ENV'], PORT: port, DATABASE_URL: url };
}
