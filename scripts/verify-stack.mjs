#!/usr/bin/env node
// P1C stack verification. Node built-ins only (global fetch needs Node 18+).
// Prerequisite: the full stack is up (docker compose up -d --build --wait).
// Usage (repo root):  node --env-file=.env scripts/verify-stack.mjs
import { spawnSync } from 'node:child_process';

const failures = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(name + (detail ? ' :: ' + detail : ''));
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
const dc = (...args) => run('docker', ['compose', ...args]);
const exec = (service, ...cmd) => dc('exec', '-T', service, ...cmd);
const lines = (s) => s.split(/\r?\n/).filter(Boolean);

async function get(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { status: res.status, text: await res.text(), headers: res.headers };
  } catch (e) {
    return { status: 0, text: '', headers: new Headers(), error: String(e) };
  }
}

async function until(probe, seconds) {
  let last = { ok: false, detail: 'not probed' };
  for (let i = 0; i < seconds; i++) {
    last = await probe();
    if (last.ok) return last;
    await sleep(1000);
  }
  return last;
}

const webShows = (state) => async () => {
  const r = await get('http://127.0.0.1:3000/');
  return { ok: r.status === 200 && r.text.includes(`data-api-status="${state}"`), detail: `status ${r.status}` };
};

const startedAt = (service) => {
  const id = dc('ps', '-q', service).out;
  return id ? run('docker', ['inspect', '-f', '{{.State.StartedAt}}', id]).out : '';
};

const GENERIC_503 = '{"statusCode":503,"error":"Service Unavailable","message":"Service Unavailable"}';

// 1. Services and health
const services = dc('config', '--services');
check('services are exactly api, db, web', services.ok && lines(services.out).sort().join(',') === 'api,db,web', services.out || services.err);
const ps = dc('ps', '--format', '{{.Service}}={{.Health}}');
const health = Object.fromEntries(lines(ps.out).map((l) => l.split('=')));
for (const svc of ['db', 'api', 'web']) {
  check(`${svc} is healthy`, health[svc] === 'healthy', String(health[svc]));
}

// 2. Loopback-only ports
for (const [svc, port] of [['db', '5432'], ['api', '3001'], ['web', '3000']]) {
  const p = dc('port', svc, port);
  check(`${svc} port ${port} is published on loopback only`, p.ok && p.out.startsWith('127.0.0.1:'), p.out || p.err);
}

// 3. HTTP behaviour
const api = await get('http://127.0.0.1:3001/api/health');
check('API health is 200 {"status":"ok","db":"up"}', api.status === 200 && api.text === '{"status":"ok","db":"up"}', `${api.status} ${api.text}`);
check('API sends no X-Powered-By', !api.headers.get('x-powered-by'));
const web = await get('http://127.0.0.1:3000/');
check('web / is 200', web.status === 200, String(web.status));
check('web page reports API ok (SSR over the Compose network)', web.text.includes('data-api-status="ok"'));
check('web sends no X-Powered-By', !web.headers.get('x-powered-by'));

// 4. Non-root
for (const svc of ['api', 'web']) {
  const id = exec(svc, 'id', '-u');
  check(`${svc} runs as non-root`, id.ok && id.out !== '0', id.out || id.err);
}

// 5. Environment isolation (names only, never values)
const envKeys = (svc) => lines(exec(svc, 'printenv').out).map((l) => l.split('=')[0]);
const apiKeys = envKeys('api');
const webKeys = envKeys('web');
check('api printenv works', apiKeys.includes('NODE_ENV'), apiKeys.join(','));
check('web printenv works', webKeys.includes('NODE_ENV'), webKeys.join(','));
check('api has DATABASE_URL', apiKeys.includes('DATABASE_URL'));
check('api DATABASE_URL uses webstore_app', exec('api', 'printenv', 'DATABASE_URL').out.startsWith('postgresql://webstore_app:'));
for (const k of ['MIGRATE_DATABASE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'MIGRATOR_DB_PASSWORD']) {
  check(`api environment has no ${k}`, !apiKeys.includes(k));
}
for (const k of ['DATABASE_URL', 'MIGRATE_DATABASE_URL', 'APP_DB_PASSWORD', 'MIGRATOR_DB_PASSWORD', 'POSTGRES_PASSWORD']) {
  check(`web environment has no ${k}`, !webKeys.includes(k));
}

// 6. No secrets and no sources or dev tooling in images
for (const svc of ['api', 'web']) {
  const r = exec(svc, 'sh', '-c', 'test ! -e /app/.env && echo clean');
  check(`${svc} image contains no .env`, r.out === 'clean', r.out || r.err);
}
const slimApi = exec('api', 'sh', '-c', 'test ! -e /app/src && test ! -e /app/node_modules/typescript && test ! -e /app/node_modules/jest && echo slim');
check('api image ships no sources or dev tooling', slimApi.out === 'slim', slimApi.out || slimApi.err);
const slimWeb = exec('web', 'sh', '-c', 'test ! -e /app/tsconfig.json && echo slim');
check('web image ships no tsconfig', slimWeb.out === 'slim', slimWeb.out || slimWeb.err);

// 7. Database outage and recovery without restarting api or web
const apiStart = startedAt('api');
const webStart = startedAt('web');
const stopped = dc('stop', 'db');
check('db stops', stopped.ok, stopped.err);
try {
  const degraded = await until(webShows('unavailable'), 20);
  check('web still returns 200 and reports API unavailable while the database is down', degraded.ok, degraded.detail);
  const down = await get('http://127.0.0.1:3001/api/health');
  check('API health is the generic 503 while the database is down', down.status === 503 && down.text === GENERIC_503, `${down.status} ${down.text}`);
} finally {
  const started = dc('up', '-d', '--wait', 'db');
  check('db restarts healthy', started.ok, started.err);
}
const recovered = await until(webShows('ok'), 30);
check('web reports API ok again within 30 seconds', recovered.ok, recovered.detail);
check('api was not restarted', apiStart !== '' && startedAt('api') === apiStart);
check('web was not restarted', webStart !== '' && startedAt('web') === webStart);

if (failures.length) {
  console.error('verify-stack: FAIL');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('verify-stack: OK');
process.exit(0);
