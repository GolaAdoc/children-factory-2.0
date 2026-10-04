const crypto = require('crypto');
const fs = require('fs');

async function main() {
  const email = `qa-p4-${crypto.randomUUID()}@example.com`;
  const phone = `+92300${Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 8)}`;
  const password = 'Password123!';
  const name = 'Test User';

  console.log(`\n--- Signup ---`);
  const signupRes = await fetch('http://127.0.0.1:3001/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, phoneNumber: phone })
  });
  const signupBody = await signupRes.text();
  console.log(`Status: ${signupRes.status}`);
  console.log(`Body: ${signupBody}`);
  
  if (signupRes.status !== 201) return;
  const token = JSON.parse(signupBody).accessToken;

  console.log(`\n--- Login (mixed case) ---`);
  const loginRes = await fetch('http://127.0.0.1:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toUpperCase(), password })
  });
  const loginBody = await loginRes.text();
  console.log(`Status: ${loginRes.status}`);
  console.log(`Body: ${loginBody}`);

  console.log(`\n--- /me ---`);
  const meRes = await fetch('http://127.0.0.1:3001/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const meBody = await meRes.text();
  console.log(`Status: ${meRes.status}`);
  console.log(`Body: ${meBody}`);

  // Decode JWT manually (split by .)
  console.log(`\n--- JWT Decode ---`);
  const [headerB64, payloadB64] = token.split('.');
  const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
  console.log('Header:', header);
  console.log('Payload:', payload);
  console.log(`exp - iat = ${payload.exp - payload.iat}`);

  // Save email for DB script
  fs.writeFileSync('qa-p4/test_email.txt', email);
}
main();
