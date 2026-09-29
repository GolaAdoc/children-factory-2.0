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

## What docs-verify asserts
- The 10 required files exist.
- No forbidden root paths exist.
- AGENTS.md has 4 ordered priorities, 15 numbered rules and P0 to P25 in the Phase Map.
- Every diagram block starts with the correct Mermaid type.
- Each diagram file contains Status: PROVISIONAL, and its required markers.
- The workflow declares job docs-verify, top-level permissions: contents: read, triggers on pull_request and push, and has no paths or paths-ignore filter.
- All relative markdown links resolve.
- Mermaid diagrams render with @mermaid-js/mermaid-cli@11 (separate CI step).
- Running locally: node scripts/verify-docs.mjs (exit 0 means OK).
