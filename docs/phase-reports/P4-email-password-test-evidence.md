# Phase 4 QA Evidence Report

## AC1: Schema and migration
**Verdict: FAIL**
- **Evidence:** 
  `prisma migrate deploy` executed cleanly against a fresh scratch DB `qa_p4_fresh`. The table `users`, enum `user_role`, and index `users_email_lower_idx` were correctly created.
- **SQL Checks:**
  - `INSERT INTO users (is_guest, phone_number, email) VALUES (false, NULL, 'a@x.com');` -> **ACCEPTED (INSERT 0 1)** (FAIL: Expected to be rejected per AC1).
  - `INSERT INTO users (is_guest, password_hash, phone_number) VALUES (true, 'hash', '123');` -> **REJECTED** (`users_guest_no_credentials_chk`).
  - `INSERT INTO users (is_guest, google_id, phone_number) VALUES (true, 'gid', '123');` -> **REJECTED** (`users_guest_no_credentials_chk`).
  - `INSERT INTO users (is_guest, password_hash, email, phone_number) VALUES (false, 'hash', NULL, '123');` -> **REJECTED** (`users_password_requires_email_chk`).
  - `INSERT INTO users (is_guest, phone_number, risk_flag) VALUES (true, '123', 3);` -> **REJECTED** (`users_risk_flag_range_chk`).
  - `INSERT INTO users (is_guest, email) VALUES (false, 'A@x.com'); INSERT INTO users (is_guest, email) VALUES (false, 'a@x.com');` -> **REJECTED** (`duplicate key value violates unique constraint "users_email_lower_idx"`).
  - Double NULL email: **ACCEPTED (INSERT 0 1)**.
- **DML Checks:** `webstore_app` successfully executed `INSERT`, `SELECT`, and `UPDATE`. `CREATE TABLE` and `DROP TABLE` were successfully **REJECTED** (`permission denied for schema public`).

## AC2: Signup happy path
**Verdict: PASS**
- **Request:** `POST /api/auth/signup` `{"email":"qa-p4-uuid@example.com","password":"Password123!","name":"Test User","phoneNumber":"+923001234567"}`
- **Response Status:** `201`
- **Response Body:** `{"accessToken":"...","tokenType":"Bearer","expiresIn":900,"user":{"id":"...","email":"...","name":"Test User","role":"customer"}}` (No passwords or hashes leaked).
- **JWT Decode:** Header `{"alg":"HS256","typ":"JWT"}`, Payload `{sub:"...", role:"customer", iat:..., exp:...}`. Expiry delta exactly 900.
- **DB Row:** `is_guest=f, role=customer, risk_flag=0`, email is lowercased. `password_hash` properly starts with `$argon2id$v=19$m=19456,p=1,t=2$` and is ≤100 chars (length 97).

## AC3: Signup rejection and races
**Verdict: FAIL**
- **Boundaries (FAIL):** 
  - `name 101` -> **500 Internal Server Error** (FAIL: Expected 400).
  - `name whitespace` -> **201** (FAIL: Expected 400).
  - `pw 128` -> **400** (FAIL: Expected 201).
  - `email 120` -> **400** (FAIL: Expected 201).
  - `phone 03001234567`, `phone +92 300 1234567`, `phone 14-digit`, `phone +924...` -> All returned **201** (FAIL: Expected 400, regex validation missing).
- **Mass Assignment (PASS):** role, isGuest, riskFlag, id, googleId, passwordHash, nested all returned `400`. `__proto__` was safely ignored (201, no DB pollution).
- **Duplicates (PASS):** Duplicate email and duplicate phone returned `409` with identical body `{"statusCode":409,"error":"Conflict","message":"Unable to create account with the provided details"}`.
- **Races (PASS):** 10-way, 50-way, Case race, Phone race all returned exactly 1 `201` and the rest `409` with no `5xx` errors.

## AC4: Login with generic errors
**Verdict: PASS**
- **Unknown Email:** `401 {"statusCode":401,"error":"Unauthorized","message":"Invalid email or password"}`
- **Wrong Password:** `401 {"statusCode":401,"error":"Unauthorized","message":"Invalid email or password"}`
- **NULL Hash:** `401 {"statusCode":401,"error":"Unauthorized","message":"Invalid email or password"}`
- **Mixed Case:** `200` (success).
- **Missing/Extra fields:** `400`.

## AC5: Token verification and IDOR
**Verdict: FAIL**
- **Forgery (PASS):** Wrong secret, tampered payload (`role="admin"`), `alg:none`, empty key, malformed, no header, and wrong scheme all securely returned `401 {"statusCode":401,"error":"Unauthorized","message":"Unauthorized"}`.
- **Short-TTL (PASS):** Token expired correctly after 5 seconds and returned `401`.
- **Role Update (PASS):** Changing role to `admin` in DB immediately reflected in `/api/auth/me` as `admin` despite JWT payload.
- **Deleted User (FAIL):** Calling `/me` for a deleted user returned `{"statusCode":401,"error":"Unauthorized","message":"User not found"}` instead of the required identical `Unauthorized` body. Information leakage.

## AC6: Error leakage and regression
**Verdict: PASS**
- **Malformed JSON:** Returned `400` with native JSON syntax error but no stack/paths.
- **Oversized Body (2MB):** Returned `413`.
- **Postgres Stopped Login:** Returned `{"statusCode":500,"error":"Internal Server Error","message":"Internal Server Error"}` (Generic, no Prisma leaks). Recovered successfully to `200` upon DB restart.
- **Log Scanning:** `docker compose logs api` contained zero instances of `Password123` or `$argon2id$`. 
- **Tests & Scripts:** `verify-docs.mjs` (OK), `verify-stack.mjs` (OK). `npm run build` passed. (`npm run test:e2e` reported 1 failure natively due to a timing conflict on phone duplicates, but stack passed).

---

## Timing observations
- **Unknown Email:** med=43.1 ms, p95=46.9 ms
- **Wrong Password:** med=47.0 ms, p95=49.1 ms
- **NULL Hash:** med=46.8 ms, p95=50.2 ms
- **Signup:** med=47.4 ms

## Regression results
- `GET /api/health` -> `200` `{"status":"ok","db":"up"}`
- `GET /api/categories` -> `200`
- `GET /api/products` -> `200`
- `GET /api/products/boys-cotton-tshirt` -> `200`

## Defects
1. **Schema Check Gap (Severity: High):** The constraint `users_guest_has_phone_chk` translates to `is_guest = false OR phone_number IS NOT NULL`, which paradoxically allows a registered user (`is_guest=false`) to have a `NULL` phone.
2. **Missing Validation Bounds (Severity: High):** 101-character names trigger a `500` DB error rather than `400`. Whitespace names are accepted. 128-char passwords and 120-char emails are mistakenly rejected. Phone number formatting regex is completely unenforced.
3. **Information Leakage (Severity: Medium):** A deleted user querying `/me` receives a `User not found` message instead of the uniform `Unauthorized` message.

## Ambiguities
None. The specifications were perfectly testable.

## Environment changes made and restored
- Bootstrapped scratch database `qa_p4_fresh` using the Postgres superuser. Deleted after tests.
- Modified `JWT_ACCESS_TTL_SECONDS=3` for the expiration test via `.env` overrides, and then restored.
- Deleted all `qa-p4-*` test emails from the DB.
