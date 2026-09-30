# ADR 0003: Database roles and the Prisma pin

## Status

Accepted (P1C). Records decisions made in P1A and P1B. The values marked "proposal" (citext, 15s and 30s timeouts; flag F-10) can be changed only by superseding this ADR.

## Context

Design priority 1 requires least privilege at the database. The API must never hold DDL or superuser credentials, yet Prisma Migrate needs DDL, and in development it needs to create a shadow database. The master context requires PostgreSQL 16 with Prisma and a non-superuser application role. See [ADR 0001](0001-modular-monolith-and-stack.md) for the stack and [ADR 0002](0002-postgres-source-of-truth.md) for the source-of-truth rules.

## Decision

### 1. Three identities

| Identity | Name | Purpose | Notable attributes | Credentials live in |
|---|---|---|---|---|
| Bootstrap superuser | `POSTGRES_USER` (default `postgres`) | Container initialisation only | Superuser | The database container only |
| Migrator | `webstore_migrator` | Owns the database, runs migrations | Not superuser, CREATEDB (Prisma shadow database), no CREATEROLE | Prisma CLI (`MIGRATE_DATABASE_URL`), never the running app |
| Application | `webstore_app` | Runtime DML | Not superuser, no CREATEDB, no CREATEROLE, statement timeout 15s, idle-in-transaction timeout 30s (proposals) | The API (`DATABASE_URL`) |

Role names are fixed constants. Only the passwords are configurable.

### 2. Where things are created

- Roles, database ownership and the CONNECT grant are created by `db/init/01-roles.sql`, because `CREATE ROLE` needs CREATEROLE, which the migrator deliberately lacks. It runs once, on an empty data volume.
- Schema grants and default privileges live in the tracked baseline migration, so they follow the schema into every environment. The application role receives SELECT, INSERT, UPDATE, DELETE on tables and USAGE, SELECT on sequences created by the migrator. It cannot create, alter, drop or truncate. It cannot read `_prisma_migrations`, because that table exists before the default privileges do.

### 3. Runtime configuration

- Prisma's `url` is `DATABASE_URL` (application role). `directUrl` is `MIGRATE_DATABASE_URL` (migrator), which only the CLI uses.
- The API refuses to start if its `DATABASE_URL` user is `webstore_migrator` or `postgres` (defence in depth).
- The API container receives only the application URL. The web container receives no database variables.
- Containers do not run migrations. Migrations are applied by an operator or CI as the migrator.

### 4. Prisma is pinned to major 6

Prisma 7 requires driver adapters, moves connection settings into `prisma.config.ts` and is ESM-first. The API is a CommonJS NestJS application and the master workflow assumes a native `schema.prisma`, so major 6 keeps the workflow verbatim (design priority 3). Adopting Prisma 7 needs a new ADR that supersedes this section, covering the adapter, the config file, the module system and the generator change.

### 5. Baseline proposals

The baseline migration installs the `citext` extension for case-insensitive email identity in the auth phase. It creates no tables.

## Consequences

- A compromised API process cannot change the schema, read migration history or administer roles.
- Every future table inherits DML-only access for the application role without per-table grants.
- Running migrations needs a second credential in CI and deployment.
- Staying on Prisma 6 means revisiting this ADR when Prisma 6 support ends.
- Changing role names or the init script needs a new ADR and a migration plan for existing volumes, because the init script only runs on an empty volume.

## Alternatives rejected

- **One superuser for everything.** Violates the internal isolation invariant.
- **Two roles, with the application role owning the tables.** The API could then drop or truncate tables.
- **Grants in the init script only.** They would not follow the schema through migrations into other environments.
- **Prisma 7 now.** Adapter, config and ESM changes with no benefit at this scale, against a CommonJS backend.
- **Row-level security as the primary control.** Deferred. It is not needed at this scale and does not replace the role split.
