-- AlterTable
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "recurrenceGroupId" TEXT;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "recurrenceRule" TEXT;
