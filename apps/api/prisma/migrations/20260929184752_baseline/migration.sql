-- This is an empty migration.-- P1A baseline: extension and least-privilege grants. No tables.
-- Runs as webstore_migrator. Roles are created by db/init/01-roles.sql.
CREATE EXTENSION IF NOT EXISTS citext;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO webstore_app;

ALTER DEFAULT PRIVILEGES FOR ROLE webstore_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO webstore_app;
ALTER DEFAULT PRIVILEGES FOR ROLE webstore_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO webstore_app;
