const crypto = require('crypto');
const fs = require('fs');

async function signup(body) {
  const res = await fetch('http://127.0.0.1:3001/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  return { status: res.status, body: await res.text() };
}

function randEmail() { return `qa-p4-${crypto.randomUUID()}@x.com`; }
function randPhone() { return `+92300${Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 8)}`; }
const pw = 'Password123!';

async function main() {
  const valid = () => ({ email: randEmail(), password: pw, name: 'Test', phoneNumber: randPhone() });

  console.log('--- Boundaries ---');
  let cases = [
    { label: 'pw 7', body: { ...valid(), password: 'Pass12!' } },
    { label: 'pw 8', body: { ...valid(), password: 'Password' } },
    { label: 'pw 128', body: { ...valid(), password: 'a'.repeat(128) } },
    { label: 'pw 129', body: { ...valid(), password: 'a'.repeat(129) } },
    { label: 'name 1', body: { ...valid(), name: 'a' } },
    { label: 'name 100', body: { ...valid(), name: 'a'.repeat(100) } },
    { label: 'name 101', body: { ...valid(), name: 'a'.repeat(101) } },
    { label: 'name whitespace', body: { ...valid(), name: '   ' } },
    { label: 'name missing', body: { ...valid(), name: undefined } },
    { label: 'name unicode', body: { ...valid(), name: 'مرحبا 😀' } },
    { label: 'email 120', body: { ...valid(), email: 'a'.repeat(114) + '@x.com' } },
    { label: 'email 121', body: { ...valid(), email: 'a'.repeat(115) + '@x.com' } },
    { label: 'email invalid', body: { ...valid(), email: 'not-an-email' } },
    { label: 'phone 03001234567', body: { ...valid(), phoneNumber: '03001234567' } },
    { label: 'phone +92 300 1234567', body: { ...valid(), phoneNumber: '+92 300 1234567' } },
    { label: 'phone +923001234567 (valid)', body: { ...valid(), phoneNumber: '+923001234567' } },
    { label: 'phone 14-digit', body: { ...valid(), phoneNumber: '+9230012345678' } },
    { label: 'phone +924...', body: { ...valid(), phoneNumber: '+924001234567' } },
  ];
  for (let c of cases) {
    const res = await signup(c.body);
    console.log(`${c.label} -> ${res.status}`);
  }

  console.log('\n--- Bodies ---');
  console.log(`empty -> ${(await signup({})).status}`);
  console.log(`non-JSON -> ${(await signup('foo=bar')).status}`);
  console.log(`array -> ${(await signup([])).status}`);
  console.log(`null fields -> ${(await signup({email:null,password:null,name:null,phoneNumber:null})).status}`);
  console.log(`SQLi -> ${(await signup({ ...valid(), email: "' OR 1=1 --" })).status}`);
  
  console.log('\n--- Mass Assignment ---');
  let maCases = [
    { label: 'role', body: { ...valid(), role: 'admin' } },
    { label: 'isGuest', body: { ...valid(), isGuest: true } },
    { label: 'riskFlag', body: { ...valid(), riskFlag: 3 } },
    { label: 'id', body: { ...valid(), id: crypto.randomUUID() } },
    { label: 'googleId', body: { ...valid(), googleId: '123' } },
    { label: 'passwordHash', body: { ...valid(), passwordHash: 'hash' } },
    { label: 'nested', body: { ...valid(), extra: { foo: 'bar' } } },
    { label: '__proto__', body: JSON.parse(`{"email":"${randEmail()}","password":"${pw}","name":"T","phoneNumber":"${randPhone()}","__proto__":{"admin":true}}`) },
  ];
  for (let c of maCases) {
    const res = await signup(c.body);
    console.log(`${c.label} -> ${res.status}`);
  }

  console.log('\n--- Duplicates ---');
  let d1 = valid();
  let d2 = { ...valid(), email: d1.email.toUpperCase() };
  await signup(d1);
  const dupEmailRes = await signup(d2);
  console.log(`Dup email -> ${dupEmailRes.status}`);

  let p1 = valid();
  let p2 = { ...valid(), phoneNumber: p1.phoneNumber };
  await signup(p1);
  const dupPhoneRes = await signup(p2);
  console.log(`Dup phone -> ${dupPhoneRes.status}`);
  console.log(`Identical 409 body: ${dupEmailRes.body === dupPhoneRes.body}`);
  console.log(`409 body: ${dupEmailRes.body}`);

  console.log('\n--- Races ---');
  const race10Email = valid();
  const res10 = await Promise.all(Array(10).fill(0).map(() => signup(race10Email)));
  console.log(`10-way: ${res10.filter(r=>r.status===201).length} 201s, ${res10.filter(r=>r.status===409).length} 409s, ${res10.filter(r=>r.status>=500).length} 5xxs`);
  
  const race50Email = valid();
  const res50 = await Promise.all(Array(50).fill(0).map(() => signup(race50Email)));
  console.log(`50-way: ${res50.filter(r=>r.status===201).length} 201s, ${res50.filter(r=>r.status===409).length} 409s, ${res50.filter(r=>r.status>=500).length} 5xxs`);

  const raceCaseEmail = valid();
  const caseBodies = Array(10).fill(0).map((_, i) => ({ ...raceCaseEmail, email: i % 2 === 0 ? raceCaseEmail.email : raceCaseEmail.email.toUpperCase() }));
  const resCase = await Promise.all(caseBodies.map(b => signup(b)));
  console.log(`Case race: ${resCase.filter(r=>r.status===201).length} 201s, ${resCase.filter(r=>r.status===409).length} 409s`);

  const racePhoneBase = valid();
  const phoneBodies = Array(10).fill(0).map(() => ({ ...valid(), phoneNumber: racePhoneBase.phoneNumber }));
  const resPhone = await Promise.all(phoneBodies.map(b => signup(b)));
  console.log(`Phone race: ${resPhone.filter(r=>r.status===201).length} 201s, ${resPhone.filter(r=>r.status===409).length} 409s`);

  const raceLoginBase = valid();
  // We need to login concurrently with signup. Let's do it 10 times each.
  const loginReq = async () => {
    const res = await fetch('http://127.0.0.1:3001/api/auth/login', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: raceLoginBase.email, password: pw })
    });
    return res.status;
  };
  const raceRes = await Promise.all([
    ...Array(5).fill(0).map(() => signup(raceLoginBase).then(r=>r.status)),
    ...Array(5).fill(0).map(() => loginReq())
  ]);
  console.log(`Login/Signup race 201s: ${raceRes.filter(s=>s===201).length}`);
  console.log(`Login/Signup race 200s: ${raceRes.filter(s=>s===200).length}`);
}
main();
