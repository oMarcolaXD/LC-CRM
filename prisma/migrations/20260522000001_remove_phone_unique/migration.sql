-- Remove unique index on phone (production has duplicate phone numbers)
DROP INDEX IF EXISTS "users_phone_key";
