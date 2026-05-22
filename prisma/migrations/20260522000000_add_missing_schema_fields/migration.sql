-- CreateTable student_notes (safe - IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "student_notes" (
    "id"        TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId"  TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (safe - IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "student_notes_studentId_idx" ON "student_notes"("studentId");

-- AddForeignKey student_notes -> students (safe - checks existence first)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'student_notes_studentId_fkey'
  ) THEN
    ALTER TABLE "student_notes"
      ADD CONSTRAINT "student_notes_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey student_notes -> users (safe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'student_notes_authorId_fkey'
  ) THEN
    ALTER TABLE "student_notes"
      ADD CONSTRAINT "student_notes_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Add missing columns to students (safe - IF NOT EXISTS)
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tags"      TEXT[];
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Make users.email nullable (safe even if already nullable)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Unique index on users.phone (safe - IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users"("phone");
