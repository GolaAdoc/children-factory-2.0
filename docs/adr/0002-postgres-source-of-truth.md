# ADR 0002: Postgres source of truth

## Status
Accepted

## Decision
- Postgres holds all persistent business data.
- Redis holds only derived or ephemeral data (cache, rate-limit counters, refresh-token records).
- Redis misses, evictions and outages must never surface as user-facing errors for Postgres-backed data; degrade to Postgres (Rules 5 and 6).
- Refresh tokens are session data with no Postgres source of truth; on a Redis outage refresh fails closed and users re-authenticate (assumption A-1; needs owner confirmation before P3/P4).
- Notification outcome is decided by the Gupshup webhook, not the synchronous HTTP response (Rule 7).
- Any stock, hold or reservation restoration happens only after an affected-row check in the same transaction confirms the state change applied (Rule 8).
- All schema changes use tracked Prisma migrations (Rule 9).

## Consequences
a Redis-only session store is rejected for persistent business data.

## Alternatives rejected
a Redis-only session store is rejected for persistent business data.
