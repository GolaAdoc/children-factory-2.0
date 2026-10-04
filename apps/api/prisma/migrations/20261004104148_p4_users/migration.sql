-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('customer', 'admin');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone_number" VARCHAR(15),
    "email" VARCHAR(120),
    "google_id" VARCHAR(60),
    "password_hash" VARCHAR(100),
    "name" VARCHAR(100),
    "role" "user_role" NOT NULL DEFAULT 'customer',
    "is_guest" BOOLEAN NOT NULL DEFAULT true,
    "risk_flag" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

ALTER TABLE "users"
  ADD CONSTRAINT users_guest_no_credentials_chk
    CHECK (is_guest = false OR (google_id IS NULL AND password_hash IS NULL)),
  ADD CONSTRAINT users_guest_has_phone_chk
    CHECK (is_guest = false OR phone_number IS NOT NULL),
  ADD CONSTRAINT users_password_requires_email_chk
    CHECK (password_hash IS NULL OR email IS NOT NULL),
  ADD CONSTRAINT users_risk_flag_range_chk
    CHECK (risk_flag BETWEEN 0 AND 2);

CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email)) WHERE email IS NOT NULL;
