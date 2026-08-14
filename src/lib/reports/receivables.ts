// Contas a receber e inadimplência.
//
// ── Por que "vencido" aqui não é o status OVERDUE ─────────────────────────────
// Nada no sistema muda o status de uma cobrança para OVERDUE sozinho — só o
// admin, clicando. Na prática, contar apenas `status = 'OVERDUE'` subestima a
// inadimplência: uma cobrança PENDING que venceu há 40 dias não aparecia em
// lugar nenhum.
//
// Aqui, atrasado é o que a realidade diz: qualquer cobrança não paga cuja data
// de vencimento já passou, independente do status gravado. Isso faz o número
// desta tela ser MAIOR que o de /admin/financeiro — e o correto é este.

import { prisma } from "@/lib/prisma"
import { startOfDay } from "date-fns"
import { monthKeyFromDb } from "./period"

export interface Receivables {
  /** Não pago, com vencimento ainda no futuro. */
  pendingTotal:    number
  pendingCount:    number
  /** Não pago, com vencimento já passado. */
  overdueTotal:    number
  overdueCount:    number
  overdueStudents: number
  /** Soma dos dois — tudo que está em aberto. */
  openTotal:       number
}

export async function getReceivables(now: Date): Promise<Receivables> {
  const today = startOfDay(now)

  const [row] = await prisma.$queryRaw<{
    pending_total: number; pending_count: number
    overdue_total: number; overdue_count: number; overdue_students: number
  }[]>`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE "dueDate" >= ${today}), 0)::float8 AS pending_total,
      COUNT(*) FILTER (WHERE "dueDate" >= ${today})::int                    AS pending_count,
      COALESCE(SUM(amount) FILTER (WHERE "dueDate" <  ${today}), 0)::float8 AS overdue_total,
      COUNT(*) FILTER (WHERE "dueDate" <  ${today})::int                    AS overdue_count,
      COUNT(DISTINCT "studentId") FILTER (WHERE "dueDate" < ${today})::int  AS overdue_students
    FROM payments
    WHERE status <> 'PAID'
  `

  const pendingTotal = row?.pending_total ?? 0
  const overdueTotal = row?.overdue_total ?? 0

  return {
    pendingTotal,
    pendingCount:    row?.pending_count ?? 0,
    overdueTotal,
    overdueCount:    row?.overdue_count ?? 0,
    overdueStudents: row?.overdue_students ?? 0,
    openTotal:       pendingTotal + overdueTotal,
  }
}

// ─── Aging ────────────────────────────────────────────────────────────────────

export interface AgingBucket {
  id:      string
  label:   string
  total:   number
  count:   number
  /** Cor da faixa: quanto mais velho, mais vermelho. */
  color:   string
}

/**
 * Envelhecimento dos recebíveis. As faixas seguem a régua usual de cobrança:
 * até 15 dias ainda é esquecimento, acima de 60 já é perda provável.
 */
export async function getAging(now: Date): Promise<AgingBucket[]> {
  const today = startOfDay(now)

  const [row] = await prisma.$queryRaw<Record<string, number>[]>`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE "dueDate" >= ${today}), 0)::float8 AS t_futuro,
      COUNT(*)             FILTER (WHERE "dueDate" >= ${today})::int        AS c_futuro,
      COALESCE(SUM(amount) FILTER (WHERE ${today}::timestamp - "dueDate" >  INTERVAL '0 day'  AND ${today}::timestamp - "dueDate" <= INTERVAL '15 day'), 0)::float8 AS t_15,
      COUNT(*)             FILTER (WHERE ${today}::timestamp - "dueDate" >  INTERVAL '0 day'  AND ${today}::timestamp - "dueDate" <= INTERVAL '15 day')::int        AS c_15,
      COALESCE(SUM(amount) FILTER (WHERE ${today}::timestamp - "dueDate" > INTERVAL '15 day' AND ${today}::timestamp - "dueDate" <= INTERVAL '30 day'), 0)::float8 AS t_30,
      COUNT(*)             FILTER (WHERE ${today}::timestamp - "dueDate" > INTERVAL '15 day' AND ${today}::timestamp - "dueDate" <= INTERVAL '30 day')::int        AS c_30,
      COALESCE(SUM(amount) FILTER (WHERE ${today}::timestamp - "dueDate" > INTERVAL '30 day' AND ${today}::timestamp - "dueDate" <= INTERVAL '60 day'), 0)::float8 AS t_60,
      COUNT(*)             FILTER (WHERE ${today}::timestamp - "dueDate" > INTERVAL '30 day' AND ${today}::timestamp - "dueDate" <= INTERVAL '60 day')::int        AS c_60,
      COALESCE(SUM(amount) FILTER (WHERE ${today}::timestamp - "dueDate" > INTERVAL '60 day'), 0)::float8 AS t_mais,
      COUNT(*)             FILTER (WHERE ${today}::timestamp - "dueDate" > INTERVAL '60 day')::int        AS c_mais
    FROM payments
    WHERE status <> 'PAID'
  `

  const g = (k: string) => Number(row?.[k] ?? 0)

  return [
    { id: "futuro", label: "A vencer",       total: g("t_futuro"), count: g("c_futuro"), color: "#94a3b8" },
    { id: "d15",    label: "1–15 dias",      total: g("t_15"),     count: g("c_15"),     color: "#fbbf24" },
    { id: "d30",    label: "16–30 dias",     total: g("t_30"),     count: g("c_30"),     color: "#fb923c" },
    { id: "d60",    label: "31–60 dias",     total: g("t_60"),     count: g("c_60"),     color: "#f87171" },
    { id: "d60p",   label: "mais de 60 dias", total: g("t_mais"),  count: g("c_mais"),   color: "#dc2626" },
  ]
}

// ─── Devedores ────────────────────────────────────────────────────────────────

export interface Debtor {
  studentId:   string
  name:        string
  ra:          string
  phone:       string | null
  email:       string | null
  total:       number
  count:       number
  oldestDays:  number
  guardianName: string | null
}

/** Ranking de quem deve, do atraso mais antigo para o mais recente. */
export async function getDebtors(now: Date, take = 50): Promise<Debtor[]> {
  const today = startOfDay(now)

  return prisma.$queryRaw<Debtor[]>`
    SELECT s.id                                        AS "studentId",
           s.name                                      AS name,
           s.ra                                        AS ra,
           u.phone                                     AS phone,
           u.email                                     AS email,
           gu.name                                     AS "guardianName",
           COALESCE(SUM(p.amount), 0)::float8          AS total,
           COUNT(*)::int                               AS count,
           MAX(DATE_PART('day', ${today}::timestamp - p."dueDate"))::int AS "oldestDays"
    FROM payments p
    JOIN students s        ON s.id = p."studentId"
    LEFT JOIN users u      ON u.id = s."userId"
    LEFT JOIN guardians g  ON g.id = s."guardianId"
    LEFT JOIN users gu     ON gu.id = g."userId"
    WHERE p.status <> 'PAID' AND p."dueDate" < ${today}
    GROUP BY s.id, s.name, s.ra, u.phone, u.email, gu.name
    ORDER BY "oldestDays" DESC, total DESC
    LIMIT ${take}
  `
}

// ─── Recuperação ──────────────────────────────────────────────────────────────

export interface RecoveryStats {
  /** Cobranças quitadas no período que já estavam vencidas quando foram pagas. */
  lateCount:  number
  lateTotal:  number
  /** Quitadas em dia. */
  onTimeCount: number
  onTimeTotal: number
  /** Atraso médio, em dias, das que foram pagas com atraso. */
  avgDelayDays: number
  /** % do valor recebido no período que veio de cobrança atrasada. */
  latePct:     number
}

/**
 * Quanto do que venceu acabou entrando. Uma inadimplência alta com recuperação
 * alta é problema de processo (lembrete, boleto); com recuperação baixa é
 * problema de crédito (o aluno não vai pagar).
 */
export async function getRecovery(start: Date, end: Date): Promise<RecoveryStats> {
  const [row] = await prisma.$queryRaw<{
    late_count: number; late_total: number
    ontime_count: number; ontime_total: number
    avg_delay: number | null
  }[]>`
    SELECT
      COUNT(*)             FILTER (WHERE "paidAt" > "dueDate")::int        AS late_count,
      COALESCE(SUM(amount) FILTER (WHERE "paidAt" > "dueDate"), 0)::float8 AS late_total,
      COUNT(*)             FILTER (WHERE "paidAt" <= "dueDate")::int        AS ontime_count,
      COALESCE(SUM(amount) FILTER (WHERE "paidAt" <= "dueDate"), 0)::float8 AS ontime_total,
      AVG(DATE_PART('day', "paidAt" - "dueDate")) FILTER (WHERE "paidAt" > "dueDate")::float8 AS avg_delay
    FROM payments
    WHERE status = 'PAID' AND "paidAt" IS NOT NULL
      AND "paidAt" >= ${start} AND "paidAt" <= ${end}
  `

  const lateTotal   = row?.late_total ?? 0
  const onTimeTotal = row?.ontime_total ?? 0
  const all         = lateTotal + onTimeTotal

  return {
    lateCount:    row?.late_count ?? 0,
    lateTotal,
    onTimeCount:  row?.ontime_count ?? 0,
    onTimeTotal,
    avgDelayDays: Math.round(row?.avg_delay ?? 0),
    latePct:      all > 0 ? (lateTotal / all) * 100 : 0,
  }
}

// ─── Evolução ─────────────────────────────────────────────────────────────────

/** Valor em aberto por mês de vencimento — mostra se a bola de neve cresce. */
export async function getOverdueByMonth(start: Date, end: Date): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ month: Date; total: number }[]>`
    SELECT DATE_TRUNC('month', "dueDate")     AS month,
           COALESCE(SUM(amount), 0)::float8   AS total
    FROM payments
    WHERE status <> 'PAID'
      AND "dueDate" >= ${start} AND "dueDate" <= ${end}
    GROUP BY DATE_TRUNC('month', "dueDate")
  `
  return new Map(rows.map((r) => [monthKeyFromDb(r.month), r.total]))
}
