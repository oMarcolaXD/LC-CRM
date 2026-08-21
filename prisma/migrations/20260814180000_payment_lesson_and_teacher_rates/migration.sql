-- Duas lacunas estruturais achadas pela auditoria em Relatórios › Qualidade.
--
-- 1. payments.lessonId
--    Não existia vínculo entre cobrança e aula. A cobrança de aulão nascia
--    solta, e o único jeito de saber que ela veio de um aulão era o texto da
--    descrição ("Aulão – Matemática (12/08)"). Consequência: toda receita por
--    professor, matéria e modalidade nos relatórios era ESTIMADA.
--    SetNull, e não Cascade: apagar a aula não pode apagar o dinheiro recebido.
--
-- 2. teacher_rates
--    O valor/hora era um campo só, sem histórico. Reajustar um professor
--    reescrevia o custo de todos os meses ainda não pagos — o resultado de um
--    mês fechado mudava sozinho depois de um aumento. Agora o custo de uma aula
--    usa a taxa vigente na DATA DELA.
--    O backfill abaixo cria uma linha por professor com vigência em 1970, para
--    que todo o histórico já existente tenha uma taxa aplicável desde sempre.

-- ── 1. Vínculo cobrança ↔ aula ───────────────────────────────────────────────
ALTER TABLE "payments" ADD COLUMN "lessonId" TEXT;

CREATE INDEX "payments_lessonId_idx" ON "payments"("lessonId");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "lessons"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Recupera o vínculo das cobranças de aulão/aula em grupo já existentes.
-- A ligação usada pelo código antigo era o par (aluno, dueDate = scheduledAt),
-- e só vale quando resolve para exatamente uma aula — na dúvida, deixa nulo.
UPDATE "payments" p
SET "lessonId" = c.lesson_id
FROM (
  SELECT pay.id AS payment_id, MIN(l.id) AS lesson_id
  FROM "payments" pay
  JOIN "lesson_participants" lp ON lp."studentId" = pay."studentId"
  JOIN "lessons" l
    ON l.id = lp."lessonId"
   AND l."scheduledAt" = pay."dueDate"
   AND l."lessonType" IN ('AULAO', 'GROUP')
  WHERE pay."packageId" IS NULL
    AND pay."courseId"  IS NULL
    AND pay."lessonId"  IS NULL
  GROUP BY pay.id
  HAVING COUNT(DISTINCT l.id) = 1
) c
WHERE p.id = c.payment_id;

-- ── 2. Histórico de valor/hora ───────────────────────────────────────────────
CREATE TABLE "teacher_rates" (
    "id"            TEXT          NOT NULL,
    "teacherId"     TEXT          NOT NULL,
    "hourlyRate"    DECIMAL(10,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3)  NOT NULL,
    "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teacher_rates_teacherId_effectiveFrom_key"
  ON "teacher_rates"("teacherId", "effectiveFrom");
CREATE INDEX "teacher_rates_teacherId_effectiveFrom_idx"
  ON "teacher_rates"("teacherId", "effectiveFrom");

ALTER TABLE "teacher_rates"
  ADD CONSTRAINT "teacher_rates_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "teachers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: o valor atual de cada professor passa a valer "desde sempre", para
-- que nenhuma aula do histórico fique sem taxa aplicável.
INSERT INTO "teacher_rates" ("id", "teacherId", "hourlyRate", "effectiveFrom")
SELECT
  'seed_' || t.id,
  t.id,
  t."hourlyRate",
  TIMESTAMP '1970-01-01 00:00:00'
FROM "teachers" t;

-- Fecha a tabela nova para a API pública do Supabase, igual às demais.
-- Ver migration 20260804170000_enable_rls_public_tables.
ALTER TABLE "teacher_rates" ENABLE ROW LEVEL SECURITY;
