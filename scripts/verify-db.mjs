#!/usr/bin/env node
// P1A database verification. Node built-ins only. Runs psql inside the `db` container.
// Usage (repo root, DB up):  node --env-file=.env scripts/verify-db.mjs
import { spawnSync } from 'node:child_process';

const env = process.env;
const REQUIRED_ENV = ['POSTGRES_DB', 'POSTGRES_USER', 'MIGRATOR_DB_PASSWORD', 'APP_DB_PASSWORD', 'DATABASE_URL', 'MIGRATE_DATABASE_URL'];
const missing = REQUIRED_ENV.filter((k) => !env[k]);
if (missing.length) {
  console.error('verify-db: FAIL\n - missing env: ' + missing.join(', ') + ' (run: node --env-file=.env scripts/verify-db.mjs)');
  process.exit(1);
}

const APP = 'webstore_app';
const MIG = 'webstore_migrator';
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(name + (detail ? ' :: ' + detail : '')); };

function psql(role, password, sql) {
  const r = spawnSync(
    'docker',
    ['compose', 'exec', '-T', '-e', 'PGPASSWORD=' + password, 'db',
      'psql', '-h', 'db', '-U', role, '-d', env.POSTGRES_DB, '-v', 'ON_ERROR_STOP=1', '-tA', '-c', sql],
    { encoding: 'utf8' },
  );
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
const asApp = (sql) => psql(APP, env.APP_DB_PASSWORD, sql);
const asMig = (sql) => psql(MIG, env.MIGRATOR_DB_PASSWORD, sql);
const deniedCheck = (name, r) =>
  check(name, !r.ok && /permission denied|must be owner/i.test(r.err), r.ok ? 'statement unexpectedly succeeded' : r.err);
const urlUser = (u) => { try { return decodeURIComponent(new URL(u).username); } catch { return ''; } };

// 1. Connection identities
check('DATABASE_URL user is ' + APP, urlUser(env.DATABASE_URL) === APP, urlUser(env.DATABASE_URL));
check('MIGRATE_DATABASE_URL user is ' + MIG, urlUser(env.MIGRATE_DATABASE_URL) === MIG, urlUser(env.MIGRATE_DATABASE_URL));
check('neither URL uses the bootstrap superuser',
  ![urlUser(env.DATABASE_URL), urlUser(env.MIGRATE_DATABASE_URL)].includes(env.POSTGRES_USER));

// 2. Password authentication is enforced (connection goes to the container IP, not loopback)
const bad = psql(APP, 'wrong-password', 'SELECT 1');
check('wrong password is rejected', !bad.ok && /password authentication failed/i.test(bad.err), bad.err);

// 3. Role attributes: super | createrole | createdb | replication | bypassrls | login
const attrs = (role) => asMig(
  `SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = '${role}'`);
const a = attrs(APP);
check(APP + ' attributes', a.ok && a.out === 'f|f|f|f|f|t', a.out || a.err);
const m = attrs(MIG);
check(MIG + ' attributes', m.ok && m.out === 'f|f|t|f|f|t', m.out || m.err);

// 4. Session limits on the app role
const st = asApp('SHOW statement_timeout');
check('app statement_timeout is 15s', st.out === '15s', st.out || st.err);
const it = asApp('SHOW idle_in_transaction_session_timeout');
check('app idle_in_transaction_session_timeout is 30s', it.out === '30s', it.out || it.err);

// 5. App role cannot do DDL or administration
deniedCheck('app cannot CREATE TABLE', asApp('CREATE TABLE public.p1a_probe_ddl (id int)'));
deniedCheck('app cannot CREATE DATABASE', asApp('CREATE DATABASE p1a_probe_db'));
deniedCheck('app cannot CREATE ROLE', asApp('CREATE ROLE p1a_probe_role'));

// 6. Default privileges: DML only on migrator-created tables
asMig('DROP TABLE IF EXISTS public.p1a_probe');
try {
  const c = asMig('CREATE TABLE public.p1a_probe (id serial PRIMARY KEY, v text)');
  check('migrator can CREATE TABLE', c.ok, c.err);
  const ins = asApp("INSERT INTO public.p1a_probe (v) VALUES ('x')");
  check('app can INSERT (table and sequence privileges)', ins.ok, ins.err);
  const sel = asApp('SELECT count(*) FROM public.p1a_probe');
  check('app can SELECT', sel.out === '1', sel.out || sel.err);
  deniedCheck('app cannot DROP TABLE', asApp('DROP TABLE public.p1a_probe'));
  deniedCheck('app cannot TRUNCATE', asApp('TRUNCATE public.p1a_probe'));
  deniedCheck('app cannot ALTER TABLE', asApp('ALTER TABLE public.p1a_probe ADD COLUMN w int'));
} finally {
  const d = asMig('DROP TABLE IF EXISTS public.p1a_probe');
  check('probe table cleaned up', d.ok, d.err);
}

// 7. Migration provenance
const own = asMig("SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations'");
check('_prisma_migrations owned by ' + MIG, own.out === MIG, own.out || own.err);
const applied = asMig(
  "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL AND migration_name ~ '^[0-9]{14}_baseline$'");
check('baseline migration applied exactly once', applied.out === '1', applied.out || applied.err);
deniedCheck('app cannot read _prisma_migrations', asApp('SELECT 1 FROM public._prisma_migrations'));

// 8. Baseline content
const ext = asMig("SELECT extname FROM pg_extension WHERE extname = 'citext'");
check('citext installed', ext.out === 'citext', ext.out || ext.err);
const acl = asMig(
  "SELECT count(*) FROM pg_default_acl d JOIN pg_roles r ON r.oid = d.defaclrole WHERE r.rolname = 'webstore_migrator'");
check('default privileges exist for tables and sequences', acl.out === '2', acl.out || acl.err);
const tables = asMig("SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'");
check('no business tables yet (P1A-only assertion; retire in P2)', tables.out === '0', tables.out || tables.err);

// 9. Network exposure
const port = spawnSync('docker', ['compose', 'port', 'db', '5432'], { encoding: 'utf8' });
check('Postgres published on loopback only', port.status === 0 && port.stdout.trim().startsWith('127.0.0.1:'), port.stdout.trim());

if (failures.length) {
  console.error('verify-db: FAIL');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('verify-db: OK');
process.exit(0);
