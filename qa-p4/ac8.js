const fs = require('fs');
const crypto = require('crypto');

async function timeLogin(body) {
  const start = performance.now();
  await fetch('http://127.0.0.1:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return performance.now() - start;
}

async function timeSignup(body) {
  const start = performance.now();
  await fetch('http://127.0.0.1:3001/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return performance.now() - start;
}

function median(arr) {
  const mid = Math.floor(arr.length / 2), nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}
function p95(arr) {
  const nums = [...arr].sort((a, b) => a - b);
  return nums[Math.floor(nums.length * 0.95)];
}

async function main() {
  const nullHashEmail = process.argv[2];
  const knownPwEmail = process.argv[3];
  const pw = 'Password123!';

  console.log('Warming up...');
  await timeLogin({ email: knownPwEmail, password: pw });

  const unknownTimes = [];
  const wrongPwTimes = [];
  const nullHashTimes = [];
  const signupTimes = [];

  for (let i = 0; i < 30; i++) {
    unknownTimes.push(await timeLogin({ email: `u-${crypto.randomUUID()}@x.com`, password: pw }));
    wrongPwTimes.push(await timeLogin({ email: knownPwEmail, password: 'wrong' }));
    nullHashTimes.push(await timeLogin({ email: nullHashEmail, password: pw }));
    signupTimes.push(await timeSignup({ email: `s-${crypto.randomUUID()}@x.com`, password: pw, name: 'A', phoneNumber: `+92300${100000000+i}` }));
  }

  console.log('--- Timing (ms) ---');
  console.log(`Unknown Email: med=${median(unknownTimes).toFixed(1)}, p95=${p95(unknownTimes).toFixed(1)}`);
  console.log(`Wrong Pw: med=${median(wrongPwTimes).toFixed(1)}, p95=${p95(wrongPwTimes).toFixed(1)}`);
  console.log(`NULL Hash: med=${median(nullHashTimes).toFixed(1)}, p95=${p95(nullHashTimes).toFixed(1)}`);
  console.log(`Signup: med=${median(signupTimes).toFixed(1)}`);
}
main();
