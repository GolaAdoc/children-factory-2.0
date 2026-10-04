ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_guest_has_phone_chk";
ALTER TABLE "users" ADD CONSTRAINT "users_registered_has_phone_chk" CHECK (is_guest = true OR phone_number IS NOT NULL);
