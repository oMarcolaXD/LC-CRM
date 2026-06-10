-- Reconciliação de drift: captura mudanças que entraram via `prisma db push`
-- mas nunca viraram migration (lessons: lessonType/title/capacity, subjectId
-- nulável; students.name sem default; nova tabela password_reset_tokens).
--
-- Escrita de forma IDEMPOTENTE (IF NOT EXISTS / guards) para ser segura em
-- qualquer ambiente: aplica só o que falta, pula o que já existe. Permite que
-- o `prisma migrate deploy` do build alinhe a produção sem risco de erro.

-- ─── Enum LessonType ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "LessonType" AS ENUM ('INDIVIDUAL', 'GROUP');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─── lessons ──────────────────────────────────────────────────────────────────
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "lessonType" "LessonType" NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;
ALTER TABLE "lessons" ALTER COLUMN "subjectId" DROP NOT NULL;

-- ─── students ─────────────────────────────────────────────────────────────────
ALTER TABLE "students" ALTER COLUMN "name" DROP DEFAULT;

-- ─── password_reset_tokens ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_userId_fkey'
  ) THEN
    ALTER TABLE "password_reset_tokens"
      ADD CONSTRAINT "password_reset_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
