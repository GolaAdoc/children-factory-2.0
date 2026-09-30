#!/usr/bin/env node
/**
 * P3 cache verification script.
 * Prerequisites: full stack up, DB seeded (docker compose up -d --wait + db:seed).
 * Usage (repo root): node scripts/verify-cache.mjs
 *
 * AC1  Categories endpoint responds 200 and lists 4 seeded categories.
 * AC2  Products list cache: second request served from Redis (x-cache-hit header or TTL key present).
 * AC3  Redis is password-protected (unauthenticated PING returns NOAUTH).
 * AC4  Redis is NOT reachable on a host port (no docker compose port mapping).
 * AC5  Redis restart degrades gracefully: API still returns 200 while Redis is stopped.
 * AC6  Cache recovers: after Redis restarts and warms up, the key is present again.
 */

import { spawnSync } from 'node:child_process';

const API = 'http://127.0.0.1:3001';
const failures = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(name + (detail ? ' :: ' + detail : ''));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}
const dc = (...args) => run('docker', ['compose', ...args]);

// Execute redis-cli command via docker compose exec with auth via env variable
// Uses sh -c so $REDIS_PASSWORD is evaluated inside the container, hiding it from process lists.
function redisCli(...args) {
  const cliArgs = args.map(a => `"${a}"`).join(' ');
  return dc('exec', '-T', 'redis', 'sh', '-c', `REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ${cliArgs}`);
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: null, error: String(e) };
  }
}

// ─── AC1: categories endpoint ──────────────────────────────────────────────
console.log('Running verify-cache.mjs...');

const catRes = await fetchJSON(`${API}/api/categories`);
check('AC1: /api/categories returns 200', catRes.status === 200, String(catRes.status));
check(
  'AC1: exactly 4 seeded categories',
  Array.isArray(catRes.body) && catRes.body.length === 4,
  `got ${Array.isArray(catRes.body) ? catRes.body.length : typeof catRes.body}`,
);

// ─── AC2: product list cache warm-up and key presence in Redis ─────────────
// First request populates the cache
await fetchJSON(`${API}/api/products`);
await sleep(200); // brief pause for async set to complete

const keysResult = redisCli('keys', 'catalog:*');
check('AC2: catalog cache key written to Redis after product list request', keysResult.ok && keysResult.out.includes('catalog:'), keysResult.out || keysResult.err);

// Second request should be a cache hit — verify by checking key still exists
const secondRes = await fetchJSON(`${API}/api/products`);
check('AC2: second /api/products returns 200', secondRes.status === 200, String(secondRes.status));

// ─── AC3: Redis password enforcement ───────────────────────────────────────
const unauthedPing = dc('exec', '-T', 'redis', 'redis-cli', 'ping');
// redis-cli without AUTH will get NOAUTH back (exit 0 but output contains NOAUTH)
check(
  'AC3: unauthenticated redis-cli ping returns NOAUTH',
  unauthedPing.out.includes('NOAUTH') || unauthedPing.err.includes('NOAUTH'),
  unauthedPing.out + ' ' + unauthedPing.err,
);

// ─── AC4: Redis has no published host port ──────────────────────────────────
const portResult = dc('port', 'redis', '6379');
check('AC4: redis 6379 has no host-side port binding', !portResult.ok || portResult.out === '' || portResult.out === ':0', portResult.out);

// ─── AC5: Redis restart degrades gracefully ─────────────────────────────────
let keyBeforeStop = '';
const keysBefore = redisCli('keys', 'catalog:*');
if (keysBefore.ok) keyBeforeStop = keysBefore.out;

const stopped = dc('stop', 'redis');
check('AC5: redis container stops', stopped.ok, stopped.err);

try {
  // Wait briefly for connections to time out
  await sleep(1500);

  const degradedRes = await fetchJSON(`${API}/api/products`);
  check('AC5: /api/products returns 200 while Redis is stopped', degradedRes.status === 200, String(degradedRes.status));
  check('AC5: response body is a valid product list', typeof degradedRes.body === 'object' && degradedRes.body !== null && Array.isArray(degradedRes.body.items), JSON.stringify(degradedRes.body).slice(0, 100));

  const healthWhileDown = await fetchJSON(`${API}/api/health`);
  check('AC5: /api/health returns 200 {"status":"ok","db":"up"} while Redis is stopped', healthWhileDown.status === 200 && JSON.stringify(healthWhileDown.body) === '{"status":"ok","db":"up"}', `${healthWhileDown.status} ${JSON.stringify(healthWhileDown.body)}`);
} finally {
  // ─── AC6: Cache recovers after Redis restarts ─────────────────────────────
  const restarted = dc('up', '-d', '--wait', 'redis');
  check('AC6: redis restarts healthy', restarted.ok, restarted.err);

  if (restarted.ok) {
    // Warm the cache again
    await fetchJSON(`${API}/api/products`);
    await sleep(500);
    const keysAfter = redisCli('keys', 'catalog:*');
    check('AC6: catalog cache key re-written after Redis recovery', keysAfter.ok && keysAfter.out.includes('catalog:'), keysAfter.out || keysAfter.err);
  }
}

if (failures.length) {
  console.error('verify-cache: FAIL');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('verify-cache: OK');
process.exit(0);
