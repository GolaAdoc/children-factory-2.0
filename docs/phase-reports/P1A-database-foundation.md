# P1A: Database foundation

## Executive summary
Phase P1A established the database foundation. It introduced a Postgres container in Docker Compose, enforced least-privilege roles (`webstore_app` and `webstore_migrator`), configured Prisma migration tooling, created the baseline migration, and introduced an end-to-end database verification script mapped to an `app-verify` GitHub Actions workflow.

## Modules modified
- `db/init/01-roles.sql` - Bootstrapped the application and migrator roles.
- `apps/api/prisma` - Initialized Prisma schema and created baseline migration `20260929184752_baseline` with least-privilege grants and the `citext` extension.
- `docker-compose.yml` - Defined the Postgres service and healthchecks.
- `.github/workflows/app-ci.yml` - Created the CI workflow testing the full database lifecycle.
- `scripts/verify-db.mjs` - Added rigorous checks for permissions and configurations.
- Documentation - Updated `AGENTS.md`, `README.md`, and branch-protection runbooks to enforce Phase 1 scope and document architectural flags.

## Technical implementation
- **Postgres Initialization**: `db/init/01-roles.sql` successfully set up `webstore_migrator` (DDL only) and `webstore_app` (DML only, statement timeouts configured). Verified that no role holds unnecessary `Superuser` privileges using `\du`.
- **Prisma Tooling**: Installed `prisma@6.19.3` and `dotenv-cli`.
- **Baseline Migration**: Created a draft baseline, manually appended `GRANT USAGE ON SCHEMA` and `ALTER DEFAULT PRIVILEGES`, and applied it successfully.
- **Verification Script**: Executed `scripts/verify-db.mjs` successfully across cold starts. It verified connections, password authentication, role attributes, and table default privileges.
- **CI Workflow**: Orchestrated cold-start test mirroring CI `app-ci.yml`, which ran cleanly. 

## Visual evidence
_Placeholder: attach terminal captures (verify-db: OK, migrate status) and the green CI run here._

## Flags and deviations
- **Execution Policy Error**: Had to use `npm.cmd` explicitly instead of `npm` to bypass PowerShell script execution restrictions locally.
- **Rule Count Modification**: Checked `AGENTS.md` and observed 16 rules already present, bypassing the `str_replace` for Rule 16 but amending the Phase Map definition.
