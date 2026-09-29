# Documentation Index

| File | Description |
|---|---|
| [AGENTS.md](../AGENTS.md) | Agent strict rules and context |
| [ADR 0001: Modular monolith and stack](adr/0001-modular-monolith-and-stack.md) | Stack and monolith decisions |
| [ADR 0002: Postgres source of truth](adr/0002-postgres-source-of-truth.md) | Database and cache decisions |
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
