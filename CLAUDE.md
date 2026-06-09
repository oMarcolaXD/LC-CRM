# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

**Lição de Casa CRM** — sistema de gestão para empresa de aulas particulares. Alunos do 6º EF ao Superior. Aulas presenciais e online (Google Meet/Zoom), individuais ou em grupo.

## Vault Obsidian (segundo cérebro)

Notas de contexto (decisões, dev logs, roadmap real) ficam em
`G:\Meu Drive\Obsidian\LC-CRM`. Ver `_CLAUDE.md` no vault para convenções.
Ao final de sessões relevantes (feature entregue, decisão tomada), considere
registrar lá em `Dev Logs/`.

## Stack

- **Next.js 15** (App Router, Turbopack) + TypeScript
- **PostgreSQL** via **Prisma ORM** hospedado no **Supabase**
- **Auth.js v5** (next-auth beta) com 4 roles: ADMIN, COLLABORATOR, TEACHER, STUDENT (+GUARDIAN)
- **Tailwind CSS v4** + **shadcn/ui** (todos os componentes em `src/components/ui/`)
- **Zod** para validação + **React Hook Form** + `@hookform/resolvers`
- **date-fns** com locale pt-BR
- **Recharts** para gráficos
- **Resend** (email) + Z-API (WhatsApp)
- **Mercado Pago** para pagamentos

## Comandos

```bash
npm run dev       # Inicia servidor de desenvolvimento (Turbopack) na porta 3000
npm run build     # Build de produção
npm run start     # Inicia servidor de produção
npm run lint      # ESLint
npx prisma migrate dev   # Roda migrations do banco
npx prisma studio        # Interface visual do banco
npx prisma generate      # Gera Prisma Client após mudanças no schema
npx prisma db seed       # Popula dados de exemplo
```

## Identidade Visual (Brandbook)

### Cores
- **Primária (laranja):** `#FB8500` → `oklch(0.72 0.195 55.4)` — botões, CTAs, destaques
- **Secundária (azul):** `#219EBC` → `oklch(0.625 0.108 215.6)` — suporte, ícones, links
- Branco `#FFFFFF`, Preto `#000000`, cinzas neutros para texto secundário e bordas

### Fontes (Google Fonts — configuradas via `next/font`)
| Variável CSS       | Fonte       | Uso                               |
|--------------------|-------------|-----------------------------------|
| `--font-anton`     | Anton       | `h1`, títulos principais, classes `.font-heading` |
| `--font-inter`     | Inter       | `h2/h3`, subtítulos, classes `.font-sub` |
| `--font-montserrat`| Montserrat  | Corpo de texto (padrão), classes `.font-body` |
| `--font-caveat`    | Caveat      | Frases motivacionais, classes `.font-accent` |

### Utilitários CSS disponíveis
- `.bg-brand-gradient` — gradiente laranja→azul
- `.card-brand` — card com sombra suave e border-radius da marca
- `.font-heading` / `.font-sub` / `.font-body` / `.font-accent`

## Arquitetura de Rotas (App Router)

```
src/app/
├── (auth)/          → login, registro (sem sidebar)
├── (admin)/         → dashboard admin, usuários, financeiro, relatórios
├── (colaborador)/   → agenda, alunos, agendamentos
├── (professor)/     → agenda, alunos, pagamentos, materiais
├── (aluno)/         → dashboard, agendar, materiais, lições
└── api/             → rotas de API (auth, webhooks, etc.)
```

Cada grupo de rota terá seu próprio `layout.tsx` com a sidebar/header correspondente ao perfil.

## Roles e Permissões

| Role          | Enum Prisma   | Acesso                                           |
|---------------|---------------|--------------------------------------------------|
| Administrador | `ADMIN`       | Total — tudo                                     |
| Colaborador   | `COLLABORATOR`| Agenda, alunos, confirmar aulas, comunicados     |
| Professor     | `TEACHER`     | Sua agenda, seus alunos, seus pagamentos         |
| Aluno         | `STUDENT`     | Saldo, agendar, materiais, lições de casa        |
| Responsável   | `GUARDIAN`    | Sub-perfil do aluno (ver filho, pagar)           |

Middleware em `src/middleware.ts` verifica role em cada rota protegida.

## Schema Prisma (entidades principais)

Localizado em `prisma/schema.prisma` (ainda a criar na Etapa 2):
`User`, `Student`, `Guardian`, `Teacher`, `Subject`, `LessonPackage`, `Lesson`, `LessonRequest`, `Homework`, `Material`, `Payment`, `TeacherPayout`, `Notification`, `ActivityLog`

## Variáveis de Ambiente

Ver `.env.example` para todas as variáveis necessárias:
- `DATABASE_URL` + `DIRECT_URL` — Supabase PostgreSQL
- `AUTH_SECRET` — Auth.js
- `RESEND_API_KEY` — email
- `ZAPI_*` — WhatsApp
- `MERCADOPAGO_*` — pagamentos

## Progresso das Etapas

- [x] **Etapa 1** — Setup Next.js 15, Tailwind, shadcn/ui, tema da marca, fontes, estrutura de pastas
- [ ] **Etapa 2** — Schema Prisma + migrations
- [ ] **Etapa 3** — Autenticação Auth.js com 4 roles + middleware
- [ ] **Etapa 4** — Layout base (sidebar/header responsivos) por perfil
- [ ] **Etapa 5** — CRUD de usuários
- [ ] **Etapa 6** — Módulo de aulas e agendamento
- [ ] **Etapa 7** — Módulo financeiro
- [ ] **Etapa 8** — Notificações (email + WhatsApp)
- [ ] **Etapa 9** — Dashboards por perfil
- [ ] **Etapa 10** — Relatórios e gráficos (Recharts)
- [ ] **Etapa 11** — PWA (manifest + service worker)
- [ ] **Etapa 12** — Deploy (Vercel + Supabase)
