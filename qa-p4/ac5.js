const crypto = require('crypto');

function encodeB64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function sign(header, payload, secret) {
  const h = encodeB64(header);
  const p = encodeB64(payload);
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

async function me(token, headerName = 'Authorization', prefix = 'Bearer ') {
  const headers = {};
  if (token !== null) headers[headerName] = `${prefix}${token}`;
  const res = await fetch('http://127.0.0.1:3001/api/auth/me', { headers });
  return { status: res.status, body: await res.text() };
}

async function main() {
  const secret = '12345678901234567890123456789012';
  const h = { alg: 'HS256', typ: 'JWT' };
  const p = { sub: crypto.randomUUID(), role: 'customer', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 900 };

  console.log('--- Forgery ---');
  console.log(`wrong secret -> ${(await me(sign(h, p, 'wrongsecret'))).body}`);
  
  const validSigned = sign(h, p, secret);
  const [vh, vp, vs] = validSigned.split('.');
  const pAdmin = encodeB64({ ...p, role: 'admin' });
  console.log(`tampered payload -> ${(await me(`${vh}.${pAdmin}.${vs}`)).body}`);
  
  const hNone = encodeB64({ alg: 'none', typ: 'JWT' });
  console.log(`alg:none -> ${(await me(`${hNone}.${vp}.`)).body}`);
  
  console.log(`empty key -> ${(await me(sign(h, p, ''))).body}`);
  console.log(`malformed -> ${(await me('not.a.jwt')).body}`);
  console.log(`no header -> ${(await me(null)).body}`);
  console.log(`wrong scheme -> ${(await me(validSigned, 'Authorization', 'Basic ')).body}`);
}
main();
