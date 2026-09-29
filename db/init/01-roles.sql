\getenv migrator_pw MIGRATOR_DB_PASSWORD
\getenv app_pw APP_DB_PASSWORD
\getenv dbname POSTGRES_DB

CREATE ROLE webstore_migrator LOGIN PASSWORD :'migrator_pw'
  NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE webstore_app LOGIN PASSWORD :'app_pw'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

ALTER DATABASE :"dbname" OWNER TO webstore_migrator;
REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO webstore_app;

ALTER ROLE webstore_app SET statement_timeout = '15s';
ALTER ROLE webstore_app SET idle_in_transaction_session_timeout = '30s';
