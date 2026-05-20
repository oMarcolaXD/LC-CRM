-- Fix students table: add name column and make userId nullable
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "students" ALTER COLUMN "userId" DROP NOT NULL;

-- Remove birthDate if present (no longer in schema)
ALTER TABLE "students" DROP COLUMN IF EXISTS "birthDate";
