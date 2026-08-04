-- Turmas de acompanhamento: grade fixa + contrato por período.
-- A tabela "courses" já existia (migration 20260730150000_add_courses), mas sem
-- nenhuma tela usando. Aqui ela ganha o que faltava para virar contrato.

-- ── Grade fixa do encontro semanal ──────────────────────────────────────────
ALTER TABLE "courses" ADD COLUMN "weekday"       INTEGER;
ALTER TABLE "courses" ADD COLUMN "startTime"     TEXT;
ALTER TABLE "courses" ADD COLUMN "duration"      INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "courses" ADD COLUMN "teacherOnsite" BOOLEAN NOT NULL DEFAULT false;

-- ── Contrato: valor por aluno no período, dividido em parcelas ──────────────
ALTER TABLE "courses" ADD COLUMN "pricePerStudent" DECIMAL(10,2);
ALTER TABLE "courses" ADD COLUMN "installments"    INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "courses_status_idx" ON "courses"("status");

-- ── Cobranças geradas pela turma ────────────────────────────────────────────
-- Mesma regra do pacote: excluir a turma leva as cobranças junto.
ALTER TABLE "payments" ADD COLUMN "courseId" TEXT;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "payments_courseId_idx" ON "payments"("courseId");
