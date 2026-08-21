-- Fecha a API pública do Supabase (PostgREST) para todas as tabelas do schema public.
--
-- Contexto: o Supabase publica automaticamente o schema public via REST usando a
-- anon key, que é pública por natureza. Sem RLS, qualquer um com a URL do projeto
-- lia/escrevia em "users" (hash de senha), "students", "payments", etc.
--
-- Este app fala com o banco apenas via Prisma, com o papel dono das tabelas, e o
-- dono ignora RLS por padrão (não usamos FORCE ROW LEVEL SECURITY). Por isso não
-- é preciso criar nenhuma policy: RLS ligada sem policies = nega tudo pela API,
-- e o Prisma continua funcionando normalmente.

-- Passo 1: liga RLS em todas as tabelas do schema public.
DO $$
DECLARE
  tabela RECORD;
BEGIN
  FOR tabela IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela.relname);
  END LOOP;
END $$;

-- Passo 2: remove os GRANTs que o Supabase dá por padrão aos papéis expostos pela
-- API. Defesa em profundidade — mesmo que uma tabela nova escape do passo 1, ela
-- não fica legível, e o ALTER DEFAULT PRIVILEGES cobre as tabelas futuras.
DO $$
DECLARE
  papel TEXT;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', papel);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', papel);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', papel);
      EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', papel);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', papel);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', papel);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', papel);
    END IF;
  END LOOP;
END $$;
