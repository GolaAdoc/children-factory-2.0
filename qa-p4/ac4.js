const crypto = require('crypto');

async function login(body) {
  const res = await fetch('http://127.0.0.1:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.text() };
}

async function main() {
  const unknownEmail = `unknown-${crypto.randomUUID()}@x.com`;
  
  console.log('--- Seeding ---');
  // I will assume bash scripts seeded the DB. I'll pass the emails as arguments.
  const nullHashEmail = process.argv[2];
  const mixedCaseEmail = process.argv[3];
  const toDeleteEmail = process.argv[4];
  const knownPwEmail = process.argv[5]; // from AC3
  const pw = 'Password123!';

  console.log('--- Unknown email ---');
  const r1 = await login({ email: unknownEmail, password: pw });
  console.log(r1.status, r1.body);

  console.log('\n--- Wrong password ---');
  const r2 = await login({ email: knownPwEmail, password: 'wrong' });
  console.log(r2.status, r2.body);

  console.log('\n--- NULL hash ---');
  const r3 = await login({ email: nullHashEmail, password: pw });
  console.log(r3.status, r3.body);

  console.log('\nIdentical 401s:', r1.body === r2.body && r2.body === r3.body);

  console.log('\n--- Mixed case login ---');
  const r4 = await login({ email: mixedCaseEmail.toUpperCase(), password: pw });
  console.log(r4.status, r4.body.substring(0, 50) + '...');

  console.log('\n--- Missing/extra fields ---');
  console.log((await login({ email: knownPwEmail })).status);
  console.log((await login({ email: knownPwEmail, password: pw, extra: 1 })).status);
}
main();
