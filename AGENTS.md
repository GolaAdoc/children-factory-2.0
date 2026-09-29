## Purpose
this file is the binding contract for all agents. Where it conflicts with a prompt, stop and flag (Rule 15).

## Project Parameters
- Children's clothing webstore for Pakistan (catalog, cart, COD checkout).
- About 100 DAU and about 5 concurrent users; do not over-engineer.
- Next.js App Router (SSR/ISR for catalog).
- NestJS modular monolith (catalog, cart, orders, auth, complaints), single instance, NO microservices.
- PostgreSQL 16 with Prisma; Redis for cache and sessions.
- Cloudflare free tier in front of one Hostinger KVM2 VPS (2 vCPU, 8 GB RAM, 100 GB NVMe); Nginx (TLS, caching, connection/rate limiting); Docker Compose; S3 object storage; background jobs via @nestjs/schedule.
- Auth: Google OAuth, email/password (Argon2id), guest; JWT plus Redis-backed refresh tokens.
- Payment: COD only.
- Notifications: Gupshup (WhatsApp primary, SMS fallback), async webhook delivery.

## Design Priorities
1. Correctness, data integrity, and strict security invariant enforcement.
2. Economic abuse protection (DDoS, SMS pumping fraud).
3. Simple deployment & maintainable code.
4. Reasonable future scalability & measured performance optimization.

## Phase Map
| Stage | Phases | Scope |
|---|---|---|
| Stage 0 | P0, P1, P2 | Foundation (Postgres only, no Redis or Nginx). P0 Workflow baseline; P1 Scaffold & hardening; P2 Catalog read. |
| Stage 1 | P3 | Redis (P3). |
| Stage 2 | P4, P5, P6, P7, P8 | Identity (P4 to P8). |
| Stage 3 | P9, P10, P11 | Admin (P9 to P11). |
| Stage 4 | P12, P13, P14 | Cart and checkout (P12 to P14). |
| Stage 5 | P15, P16, P17, P18 | OTP and notifications (P15 to P18). |
| Stage 6 | P19, P20, P21, P22 | Operations (P19 to P22). |
| Stage 7 | P23, P24, P25 | Edge and production (P23 to P25). |

Stage 0 excludes Redis and Nginx.
P1 is delivered as sub-phases P1A (database foundation), P1B (API hardening) and P1C (web and full-stack Compose); see docs/README.md flag F-7.

## Agent Strict Rules
1. Never invent schema fields, endpoints, providers, or environment variables not specified in the master context without flagging it first.

2. Never silently modify a finalized schema decision from a prior phase. Flag and justify any amendment.

3. Never introduce a dependency without explaining why.

4. Never build deferred items.

5. Never replace Postgres with Redis for persistent business data.

6. Never let a Redis cache miss, eviction, or outage surface as a user-facing error for data with a Postgres source of truth.

7. Never treat a third-party API's synchronous HTTP response as its actual outcome when that provider documents async delivery via webhook.

8. Never restore a resource (stock, hold, reservation) before confirming, via an affected-row check in the same transaction, that the state change applied.

9. Never skip migrations. Never hand-write untracked SQL.

10. Execution order is strict. CLI commands must be in chronological dependency order.

11. Phase scope discipline. Do not implement any feature, table, endpoint, or infrastructure component that belongs to a future phase.

12. Testability mandate. Every acceptance criterion must be independently testable from docs alone, without reading actual code.

13. Text-substitution verification (non-negotiable). Any edit via PowerShell `-replace`, `sed`, or similar MUST be followed by a `Get-Content`/`cat` view of the file before reporting it done.

14. Every phase must leave the repository buildable and include tests.

15. If requirements conflict, stop. Identify the conflict.

16. Phase Reporting: Every phase must generate a markdown report in docs/phase-reports/P[X]-[name].md detailing the executive summary, modules modified, technical implementation, and a placeholder for visual evidence.

## Migration protocol
- prisma migrate dev --create-only --name <name>.
- Append any custom SQL to the generated migration.sql.
- prisma migrate dev.
- No untracked SQL (Rule 9).

## Definition of done per phase
buildable; tests included; acceptance criteria independently testable from docs; no future-phase items; flags recorded in docs/README.md.

## Doc map
- [README.md](docs/README.md)
- [ADR 0001: Modular monolith and stack](docs/adr/0001-modular-monolith-and-stack.md)
- [ADR 0002: Postgres source of truth](docs/adr/0002-postgres-source-of-truth.md)
- [ERD](docs/diagrams/erd.md)
- [Order state machine](docs/diagrams/order-state-machine.md)
- [Auth flow](docs/diagrams/auth-flow.md)
- [Branch protection runbook](docs/runbooks/branch-protection.md)
