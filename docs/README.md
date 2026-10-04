# Documentation Index

| File | Description |
|---|---|
| [AGENTS.md](../AGENTS.md) | Agent strict rules and context |
| [ADR 0001: Modular monolith and stack](adr/0001-modular-monolith-and-stack.md) | Stack and monolith decisions |
| [ADR 0002: Postgres source of truth](adr/0002-postgres-source-of-truth.md) | Database and cache decisions |
| [ADR 0003: Database roles and the Prisma pin](adr/0003-database-roles-and-prisma-pin.md) | Database roles and the Prisma pin |
| [ERD (Conceptual)](diagrams/erd.md) | Entity relationship diagram |
| [Order state machine](diagrams/order-state-machine.md) | State machine for orders |
| [Auth flow](diagrams/auth-flow.md) | Authentication sequence |
| [Branch protection runbook](runbooks/branch-protection.md) | Branch protection configuration |

## ADR conventions
- Append-only.
- Never edit an accepted decision, supersede it with a new ADR.
- The template has Status, Context, Decision, Consequences, Alternatives.

## Flags & open questions register
- F-1: ERD, state machine and auth flow are PROVISIONAL because P0 introduces no schema.
- F-2: Order states are proposed, not in the master context; P12 to P14 finalize.
- F-3: Complaints has no assigned phase (OQ-3); guest representation (OQ-1); stock-hold entity and ownership (OQ-2).
- F-4: Refresh tokens are Redis-only and fail closed on outage (A-1), needing owner confirmation before P3/P4.
- F-5: Branch protection depends on the GitHub plan; approvals set to 0 for a solo maintainer.
- F-6: "Buildable and tests" in P0 means docs-verify is green; the forbidden-path check in scripts/verify-docs.mjs is P0-only and must be retired or relaxed by P1.
- F-7: P1 exceeds the sizing constraint and is split into P1A (database foundation), P1B (API hardening), P1C (web and full-stack Compose). P1A still touches 14 hand-authored files because the P0 contract amendments cannot be deferred.
- F-8: Prisma is pinned to major 6. Prisma 7 needs driver adapters, prisma.config.ts and ESM, so adopting it needs its own ADR.
- F-9: Role model: bootstrap superuser (container init only), webstore_migrator (DDL, CREATEDB for the shadow database, never in the runtime environment), webstore_app (DML only). Role names are fixed. New env vars: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, MIGRATOR_DB_PASSWORD, APP_DB_PASSWORD, DATABASE_URL, MIGRATE_DATABASE_URL. The DB port is bound to 127.0.0.1 for dev tooling and must be removed at P25.
- F-10: Baseline contents are proposals awaiting owner confirmation: extension citext; app-role statement_timeout 15s and idle_in_transaction_session_timeout 30s.
- F-11: P1A amends P0 (Rule 2): 16 rules; the Stage-0 guard replaces the P0 forbidden-path list; required files are now 12; P0 AC-1 and AC-2(b) are superseded; required checks are now docs-verify and app-verify.
- F-12: P1B forward flags: use the helmet package (there is no @nestjs/helmet in the NestJS docs); health path /api/health; Prisma 6 needs prisma generate --allow-no-models while there are zero models.
- F-13: P1B touches 15 paths (10 new, 5 amended), about 5 over the sizing target. The natural split point, if enforced, is Nest core hardening versus Prisma client, health and CI smoke.
- F-14: Env config and logging (in the original P1 scope, absent from the P1B scope line) are included minimally with no new dependency: `readEnv` with fail-fast validation, the built-in Nest logger (JSON when `NODE_ENV=production`) and an access log without query strings.
- F-15: New optional runtime variables `NODE_ENV` (default development) and `PORT` (default 3001). There is no HOST variable, so the server binds all interfaces, and P1C must publish the API port on loopback only or not at all. `readEnv` rejects a `DATABASE_URL` whose user is `webstore_migrator` or `postgres`.
- F-16: P1B amends P1A `schema.prisma` (Rule 2) by adding the `prisma-client-js` generator block. The datasource and baseline migration are untouched.
- F-17: Error contract: 5xx bodies are `{statusCode, error, message}` with generic status text. 4xx messages pass through, except 404, which is generic. There are no path or timestamp fields. P4 may extend the filter for domain errors.
- F-18: Open risks checked in P1B: `prisma generate --allow-no-models` needs no DB variables; the Prisma client does not need `MIGRATE_DATABASE_URL` at runtime; Jest 30 with ts-jest 29 peer dependencies.
- F-19: P1C touches 16 paths (12 new including one lockfile, 4 amended), over the sizing target. The split point, if enforced, is web scaffold versus stack, CI and ADR.
- F-20: New configuration: server-only `API_INTERNAL_URL` (set in Compose to `http://api:3001`, defaulting to `http://127.0.0.1:3001` for host-side dev); fixed loopback ports 3000 and 3001; container `DATABASE_URL` assembled in Compose from existing variables, so `.env.example` is unchanged; the web image sets `HOSTNAME=0.0.0.0` and `PORT=3000`.
- F-21: Web scope: a status scaffold with the working title "Webstore" (brand name not specified); no catalog, no extra routes; the web healthcheck uses `/`; `poweredByHeader` is off; web security headers and CSP are deferred to the edge stage.
- F-22: Containers are non-root with `cap_drop: ALL`, `no-new-privileges` and `init: true`. `read_only` filesystems, digest-pinned images and resource limits are deferred to P25. Containers do not run migrations; a one-shot migrate job is deferred to P25.
- F-23: Versions and amendments: Next.js 16, React 19, TypeScript 5, `node:22-alpine`. ADR-0003 is Accepted and treats the F-10 defaults as accepted. `docker-compose.yml`, `app-ci.yml` and `.gitignore` are amended additively (Rule 2).
- F-24: The pasted scope omits the master P2 items OpenAPI and cache seam. Both were added. Seeding is not in the master row; kept as dev/CI-only, refuses NODE_ENV=production.
- F-25: Sizing is about 21 paths, over the ~10 target, under your explicit no-split override. No split is proposed. Acceptance criteria stay at 6.
- F-26: The GIN indexes products_attrs_gin and products_tags_gin from the target schema are deferred. No P2 query filters on attributes or tags. The columns exist, so re-adding the indexes later is a pure additive migration.
- F-27: New public API decisions (the contract in the OpenAPI file): fixed page size 12, page 1–1000, category slug filter, inStock boolean, effective price, and category output {name, slug} only.
- F-28: No new dependencies. swagger-cli is used via one-off npx for validation and is not installed.
- F-29: The images jsonb shape is string[] of absolute https URLs. P10 must conform. The API defensively filters non-strings.
- F-31: The web image could not write the ISR cache (.next/cache ownership under USER node). Fixed ownership in the web Dockerfile (a P1C defect fix).
- F-32: P3 scope: Redis cache for the product-list endpoint only. Categories and product-detail remain uncached (categories are cheap; detail TTL requires a P9 invalidation strategy).
- F-33: Two new required env vars: `REDIS_PASSWORD` (URL-safe hex secret, generate with `openssl rand -hex 32`) and `REDIS_URL` (`redis://:$pw@redis:6379` in Compose; `redis://:$pw@127.0.0.1:6379` for host-side dev/e2e). Neither must appear in logs.
- F-34: Image `redis:8-alpine` is BSD-licensed. The redis module itself is BSD-2-Clause; ioredis is MIT. No licensing conflict.
- F-35: AOF with `everysec` fsync and `volatile-lru` eviction at 256 MB. AOF provides single-node durability for a warm cache (not a source of truth — Rule 5 is unaffected). `volatile-lru` evicts only keys with a TTL set, protecting non-catalog keys that may be added in future phases.
- F-36: P3 touches approximately 15 paths, over the ~10 sizing target. The user explicitly authorized no split.
- F-37: Two Stage-0 guardrails retired on user authorization: (a) `FORBIDDEN_COMPOSE_PATTERNS` Redis entries removed from `verify-docs.mjs`; (b) expected services list updated from `api,db,web` to `api,db,redis,web` in `verify-stack.mjs`. Nginx guard remains active until P23.

## What docs-verify asserts
- The 12 required files exist (list in `scripts/verify-docs.mjs`).
- No `nginx` or `redis` path at the repo root and no redis or nginx service or image in `docker-compose.yml` (Stage-0 guard; retire redis in P3 and nginx in P23).
- AGENTS.md has 4 ordered priorities, 16 numbered rules and P0 to P25 in the Phase Map.
- Every diagram block starts with the correct Mermaid type; each diagram file has `Status: PROVISIONAL` and its required markers.
- Both workflows (`docs-ci.yml` and `app-ci.yml`) declare their job (`docs-verify`, `app-verify`), top-level `permissions: contents: read`, triggers on `pull_request` and `push`, and no `paths` or `paths-ignore` filter.
- Every `docs/phase-reports/P*.md` has the four Rule 16 headings.
- All relative markdown links resolve.
- Mermaid diagrams render with `@mermaid-js/mermaid-cli@11` (separate CI step).

## Phase reports

- [P1A: Database foundation](phase-reports/P1A-database-foundation.md)
- [P1B: API hardening](phase-reports/P1B-api-hardening.md)
- [P1C: Web and full-stack Compose](phase-reports/P1C-web-and-full-stack-compose.md)
- [P2: Catalog read](phase-reports/P2-catalog-read.md)
- [P3: Catalog cache](phase-reports/P3-catalog-cache.md)

- F-38: Phone required at signup and unverified, due to the schema CHECK chain.
- F-39: The Google-only attach branch is deferred because anonymous attach enables pre-hijack. A human must decide the design (recommended: attach only from an authenticated Google session).
- F-40: New env vars (JWT_ACCESS_SECRET, JWT_ACCESS_TTL_SECONDS) and new dependencies (argon2, @nestjs/jwt), with reasons.
- F-41: Signup 409 permits email/phone enumeration, because there is no email verification yet.
- F-42: GET /api/auth/me is added for token testability, outside the literal scope list.
- F-43: No login/signup throttling in P4. It is a residual credential-stuffing and CPU-abuse risk until the edge or throttling phase.
- F-44: Access-token-only, 15-minute sessions, with no revocation, refresh or logout.
- F-45: Sizing: 10 feature files plus 4 housekeeping groups.
