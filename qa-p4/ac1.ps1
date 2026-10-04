$ErrorActionPreference = "Stop"

# Create scratch DB
docker compose exec -e PGPASSWORD=change_me_bootstrap db psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS qa_p4_fresh;"
docker compose exec -e PGPASSWORD=change_me_bootstrap db psql -U postgres -d postgres -c "CREATE DATABASE qa_p4_fresh OWNER webstore_migrator;"
docker compose exec -e PGPASSWORD=change_me_bootstrap db psql -U postgres -d qa_p4_fresh -c "GRANT ALL PRIVILEGES ON DATABASE qa_p4_fresh TO webstore_migrator;"

# Run migrations
$env:DATABASE_URL="postgresql://webstore_app:change_me_app@127.0.0.1:5432/qa_p4_fresh?schema=public"
$env:MIGRATE_DATABASE_URL="postgresql://webstore_migrator:change_me_migrator@127.0.0.1:5432/qa_p4_fresh?schema=public"
Push-Location apps/api
npx prisma migrate deploy
Pop-Location

# Inspect
Write-Host "`n--- Inspection ---"
docker compose exec -e PGPASSWORD=change_me_migrator db psql -U webstore_migrator -d qa_p4_fresh -c "\dT+"
docker compose exec -e PGPASSWORD=change_me_migrator db psql -U webstore_migrator -d qa_p4_fresh -c "\d+ users"
docker compose exec -e PGPASSWORD=change_me_migrator db psql -U webstore_migrator -d qa_p4_fresh -c "\di+ users_email_lower_idx"

# Rejected inserts
Write-Host "`n--- Rejected inserts ---"
$inserts = @(
  "INSERT INTO users (is_guest, phone_number, email) VALUES (false, NULL, 'a@x.com');",
  "INSERT INTO users (is_guest, password_hash, phone_number) VALUES (true, 'hash', '123');",
  "INSERT INTO users (is_guest, google_id, phone_number) VALUES (true, 'gid', '123');",
  "INSERT INTO users (is_guest, password_hash, email, phone_number) VALUES (false, 'hash', NULL, '123');",
  "INSERT INTO users (is_guest, phone_number, risk_flag) VALUES (true, '123', 3);",
  "INSERT INTO users (is_guest, email) VALUES (false, 'A@x.com'); INSERT INTO users (is_guest, email) VALUES (false, 'a@x.com');"
)

foreach ($q in $inserts) {
  Write-Host "Trying: $q"
  docker compose exec -e PGPASSWORD=change_me_migrator db psql -U webstore_migrator -d qa_p4_fresh -c "$q"
}

# Accepted inserts
Write-Host "`n--- Accepted double NULL email ---"
docker compose exec -e PGPASSWORD=change_me_migrator db psql -U webstore_migrator -d qa_p4_fresh -c "INSERT INTO users (email, phone_number) VALUES (NULL, '111'); INSERT INTO users (email, phone_number) VALUES (NULL, '222');"

# App user privileges
Write-Host "`n--- webstore_app DML test ---"
docker compose exec -e PGPASSWORD=change_me_app db psql -U webstore_app -d qa_p4_fresh -c "INSERT INTO users (email, phone_number) VALUES ('app@x.com', 'app1');"
docker compose exec -e PGPASSWORD=change_me_app db psql -U webstore_app -d qa_p4_fresh -c "SELECT email FROM users WHERE email='app@x.com';"
docker compose exec -e PGPASSWORD=change_me_app db psql -U webstore_app -d qa_p4_fresh -c "UPDATE users SET name='app' WHERE email='app@x.com';"
docker compose exec -e PGPASSWORD=change_me_app db psql -U webstore_app -d qa_p4_fresh -c "CREATE TABLE fail_table (id int);"
docker compose exec -e PGPASSWORD=change_me_app db psql -U webstore_app -d qa_p4_fresh -c "DROP TABLE users;"

# Drop scratch
docker compose exec -e PGPASSWORD=change_me_bootstrap db psql -U postgres -d postgres -c "DROP DATABASE qa_p4_fresh;"
