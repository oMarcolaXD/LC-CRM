-- Despesas da empresa.
--
-- Até aqui o sistema só conhecia dinheiro entrando (payments) e o repasse de
-- professor (teacher_payouts). Faltava o outro lado: aluguel, marketing,
-- software, impostos. Sem isso o relatório só conseguia mostrar margem bruta —
-- nunca o lucro real da operação.
--
-- Duas datas de propósito:
--   competencia → mês a que a despesa pertence (agrupa o DRE)
--   paidAt      → quando o dinheiro saiu (agrupa o fluxo de caixa)
-- Uma despesa de março paga em abril entra no resultado de março e no caixa de
-- abril, que é o comportamento contábil correto.
--
-- Despesa recorrente vira N linhas ligadas por recurrenceGroupId (mesmo padrão
-- do parcelamento em payments), para que cada mês possa ter valor próprio e ser
-- quitado ou excluído isoladamente.

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM (
  'ALUGUEL', 'SALARIOS', 'MARKETING', 'SOFTWARE', 'MATERIAL',
  'IMPOSTOS', 'CONTABILIDADE', 'MANUTENCAO', 'OUTROS'
);

-- CreateEnum
CREATE TYPE "ExpenseRecurrence" AS ENUM ('UNICA', 'MENSAL');

-- CreateTable
CREATE TABLE "expenses" (
    "id"                TEXT              NOT NULL,
    "description"       TEXT              NOT NULL,
    "category"          "ExpenseCategory" NOT NULL,
    "amount"            DECIMAL(10,2)     NOT NULL,
    "competencia"       TIMESTAMP(3)      NOT NULL,
    "paidAt"            TIMESTAMP(3),
    "recurrence"        "ExpenseRecurrence" NOT NULL DEFAULT 'UNICA',
    "recurrenceGroupId" TEXT,
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_competencia_idx"       ON "expenses"("competencia");
CREATE INDEX "expenses_category_idx"          ON "expenses"("category");
CREATE INDEX "expenses_recurrenceGroupId_idx" ON "expenses"("recurrenceGroupId");
CREATE INDEX "expenses_paidAt_idx"            ON "expenses"("paidAt");

-- Fecha a tabela para a API pública do Supabase, igual a todas as outras.
-- RLS ligada sem policies = nega tudo via PostgREST; o Prisma fala com o banco
-- como dono das tabelas e ignora RLS, então continua funcionando normalmente.
-- Ver migration 20260804170000_enable_rls_public_tables.
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
