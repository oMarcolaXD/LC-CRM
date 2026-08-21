-- R.A. (Registro do Aluno): código de 6 dígitos, único por aluno.
-- Passo 1: coluna nullable para permitir o backfill dos alunos já cadastrados.
ALTER TABLE "students" ADD COLUMN "ra" TEXT;

-- Passo 2: gera um R.A. aleatório e único para cada aluno existente.
DO $$
DECLARE
  aluno   RECORD;
  novo_ra TEXT;
BEGIN
  FOR aluno IN SELECT "id" FROM "students" WHERE "ra" IS NULL LOOP
    LOOP
      -- 100000–999999: sempre 6 dígitos, nunca começa com zero
      novo_ra := (floor(random() * 900000) + 100000)::bigint::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "students" WHERE "ra" = novo_ra);
    END LOOP;
    UPDATE "students" SET "ra" = novo_ra WHERE "id" = aluno."id";
  END LOOP;
END $$;

-- Passo 3: trava a coluna como obrigatória e única.
ALTER TABLE "students" ALTER COLUMN "ra" SET NOT NULL;
CREATE UNIQUE INDEX "students_ra_key" ON "students"("ra");
