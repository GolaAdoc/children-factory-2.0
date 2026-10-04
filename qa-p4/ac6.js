const crypto = require('crypto');

async function test(path, bodyStr, method = 'POST') {
  const res = await fetch(`http://127.0.0.1:3001/api/auth/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: bodyStr
  });
  return { status: res.status, body: await res.text() };
}

async function main() {
  console.log('--- Malformed JSON ---');
  console.log('signup:', (await test('signup', '{invalid')).body);
  console.log('login:', (await test('login', '{invalid')).body);

  console.log('\n--- Oversized body (2MB) ---');
  const bigName = 'a'.repeat(2000000);
  console.log('oversized:', (await test('signup', JSON.stringify({ email: `a${crypto.randomUUID()}@x.com`, password: 'pw', name: bigName, phoneNumber: '+923001234567' }))).status);
}
main();
