# Lição de Casa — CRM

Sistema de gestão de aulas particulares para a empresa **Lição de Casa**. Atende alunos do 6º EF ao Superior com aulas presenciais e online, individuais ou em grupo.

## Stack

- **Next.js 15** (App Router, Turbopack) + TypeScript
- **PostgreSQL** via **Prisma ORM** hospedado no **Supabase**
- **Auth.js v5** com 4 roles: ADMIN, COLLABORATOR, TEACHER, STUDENT (+GUARDIAN)
- **Tailwind CSS v4** + **shadcn/ui**
- **Upstash Redis** — rate limiting distribuído (proteção brute force no login)
- **Resend** (email) + **Mercado Pago** (pagamentos)

## Pré-requisitos

- Node.js 20+
- Conta no [Supabase](https://supabase.com) (banco PostgreSQL)
- Conta no [Upstash](https://upstash.com) (Redis — obrigatório em produção)
- Conta no [Resend](https://resend.com) (opcional — emails)

## Setup local

### 1. Clone e instale

```bash
git clone https://github.com/oMarcolaXD/LC-CRM
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com suas credenciais. Campos obrigatórios:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL do Supabase com PgBouncer (porta 6543) |
| `DIRECT_URL` | URL direta do Supabase (porta 5432) |
| `AUTH_SECRET` | Gere com `openssl rand -base64 32` |
| `CRON_SECRET` | Gere com `openssl rand -base64 32` |
| `UPSTASH_REDIS_REST_URL` | URL REST do banco Redis no Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST do banco Redis no Upstash |
| `SEED_ADMIN_PASSWORD` | Senha do admin criada pelo `seed-admin.ts` |

### 3. Banco de dados

```bash
npx prisma migrate dev   # cria as tabelas
npx prisma db seed       # popula dados de exemplo
```

### 4. Inicie o servidor

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

Credenciais do seed de desenvolvimento:
- **Admin:** `admin@licaodecasa.com.br` / `Admin@123`
- **Professor:** `prof@licaodecasa.com.br` / `Prof@123`
- **Aluno:** `aluno@licaodecasa.com.br` / `Aluno@123`

> As senhas devem ter no mínimo 8 caracteres, letra maiúscula, número e caractere especial.

## Comandos úteis

```bash
npm run dev              # Servidor de desenvolvimento (Turbopack)
npm run build            # Build de produção
npm run lint             # ESLint
npm run db:studio        # Interface visual do banco
npm run db:migrate       # Rodar migrations
npm run db:seed          # Popular banco com dados de exemplo
```

## Deploy (Vercel + Supabase)

1. Conecte o repositório ao Vercel
2. Configure todas as variáveis de ambiente no painel do Vercel (Production + Preview)
3. O Vercel executa automaticamente os cron jobs definidos em `vercel.json`

Variáveis obrigatórias na Vercel além das do `.env.example`: `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.

## Estrutura de pastas

```
src/
├── app/
│   ├── (admin)/       → Rotas do administrador
│   ├── (colaborador)/ → Rotas do colaborador
│   ├── (professor)/   → Rotas do professor
│   ├── (aluno)/       → Rotas do aluno/responsável
│   ├── (auth)/        → Login
│   └── api/           → Endpoints de API e cron jobs
├── components/
│   ├── shared/        → Componentes compartilhados (sidebar, header…)
│   └── ui/            → Componentes shadcn/ui
└── lib/
    ├── actions/       → Server Actions
    ├── notifications/ → Email, WhatsApp, in-app
    └── validations/   → Schemas Zod
```
