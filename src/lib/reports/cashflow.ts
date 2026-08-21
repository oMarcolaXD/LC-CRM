// Fluxo de caixa: entradas e saídas pela data em que o dinheiro se move.
//
// Diferente do DRE, aqui nada é por competência — o que importa é quando entra e
// quando sai. Uma despesa de março paga em abril pesa no resultado de março (DRE)
// e no caixa de abril (aqui). É por isso que uma empresa pode ser lucrativa e
// ficar sem dinheiro no meio do mês.
//
// Saídas de caixa consideradas:
//   • repasses de professor efetivamente pagos (TeacherPayout com paidAt)
//   • despesas com paidAt preenchido
// Taxa de cartão não entra como saída separada: ela já vem descontada do valor
// que o adquirente deposita, e somá-la de novo contaria duas vezes.

import { prisma } from "@/lib/prisma"
import { addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { monthKey, monthKeyFromDb, type ChartPoint } from "./period"

// ─── Realizado ────────────────────────────────────────────────────────────────

export interface CashMonth {
  key:      string
  label:    string
  inflow:   number
  teacherOutflow: number
  expenseOutflow: number
  outflow:  number
  net:      number
  /** Saldo acumulado ao longo da série (não é o saldo bancário real). */
  running:  number
}

export interface CashFlow {
  months: CashMonth[]
  totalIn:  number
  totalOut: number
  net:      number
}

export async function getCashFlow(points: ChartPoint[]): Promise<CashFlow> {
  const start = points[0].start
  const end   = points[points.length - 1].end

  const [inflow, teacherOut, expenseOut] = await Promise.all([
    prisma.$queryRaw<{ month: Date; total: number }[]>`
      SELECT DATE_TRUNC('month', "paidAt")   AS month,
             COALESCE(SUM(amount), 0)::float8 AS total
      FROM payments
      WHERE status = 'PAID' AND "paidAt" IS NOT NULL
        AND "paidAt" >= ${start} AND "paidAt" <= ${end}
      GROUP BY DATE_TRUNC('month', "paidAt")
    `,
    prisma.$queryRaw<{ month: Date; total: number }[]>`
      SELECT DATE_TRUNC('month', "paidAt")        AS month,
             COALESCE(SUM("totalAmount"), 0)::float8 AS total
      FROM teacher_payouts
      WHERE status = 'PAID' AND "paidAt" IS NOT NULL
        AND "paidAt" >= ${start} AND "paidAt" <= ${end}
      GROUP BY DATE_TRUNC('month', "paidAt")
    `,
    prisma.$queryRaw<{ month: Date; total: number }[]>`
      SELECT DATE_TRUNC('month', "paidAt")   AS month,
             COALESCE(SUM(amount), 0)::float8 AS total
      FROM expenses
      WHERE "paidAt" IS NOT NULL
        AND "paidAt" >= ${start} AND "paidAt" <= ${end}
      GROUP BY DATE_TRUNC('month', "paidAt")
    `,
  ])

  const toMap = (rows: { month: Date; total: number }[]) =>
    new Map(rows.map((r) => [monthKeyFromDb(r.month), r.total]))

  const inMap  = toMap(inflow)
  const tOut   = toMap(teacherOut)
  const eOut   = toMap(expenseOut)

  let running = 0
  const months: CashMonth[] = points.map((p) => {
    const i  = inMap.get(p.key) ?? 0
    const to = tOut.get(p.key) ?? 0
    const eo = eOut.get(p.key) ?? 0
    const out = to + eo
    running += i - out
    return {
      key: p.key, label: p.label,
      inflow: i, teacherOutflow: to, expenseOutflow: eo,
      outflow: out, net: i - out, running,
    }
  })

  return {
    months,
    totalIn:  months.reduce((s, m) => s + m.inflow, 0),
    totalOut: months.reduce((s, m) => s + m.outflow, 0),
    net:      months.reduce((s, m) => s + m.net, 0),
  }
}

// ─── Projeção ─────────────────────────────────────────────────────────────────

export interface ProjectionWeek {
  label:    string
  start:    Date
  end:      Date
  inflow:   number
  outflow:  number
  net:      number
  running:  number
  /** Cobranças já vencidas caem na primeira semana — só entram se forem cobradas. */
  overdueIncluded: boolean
}

export interface Projection {
  weeks:      ProjectionWeek[]
  totalIn:    number
  totalOut:   number
  net:        number
  /** Valor vencido embutido na projeção — é a parte incerta dela. */
  overdue:    number
  /** Primeira semana em que o acumulado fica negativo, se houver. */
  firstNegative: ProjectionWeek | null
}

/**
 * Projeção semanal dos próximos N dias.
 *
 * Entradas = cobranças em aberto, pela data de vencimento. O que já venceu é
 * empurrado para a primeira semana (é o dinheiro que a dona precisa correr atrás
 * hoje) e destacado, porque é a parcela menos confiável da previsão.
 *
 * Saídas = despesas ainda não pagas, pela competência, mais uma estimativa de
 * repasse de professor: a média do que foi pago nos últimos 3 meses, distribuída
 * uma vez por mês. O repasse futuro não existe como registro até o admin pagar,
 * então estimar é a única alternativa a mostrar zero.
 */
export async function getProjection(now: Date, days = 90): Promise<Projection> {
  const today = startOfDay(now)
  const limit = endOfDay(addDays(today, days))

  const [receivables, expensesDue, payoutHistory] = await Promise.all([
    prisma.payment.findMany({
      where:  { status: { not: "PAID" }, dueDate: { lte: limit } },
      select: { amount: true, dueDate: true },
    }),
    prisma.expense.findMany({
      where:  { paidAt: null, competencia: { lte: limit } },
      select: { amount: true, competencia: true },
    }),
    prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(m.total)::float8 AS avg
      FROM (
        SELECT DATE_TRUNC('month', "paidAt") AS month, SUM("totalAmount") AS total
        FROM teacher_payouts
        WHERE status = 'PAID' AND "paidAt" IS NOT NULL
          AND "paidAt" >= ${addDays(today, -120)}
        GROUP BY DATE_TRUNC('month', "paidAt")
      ) m
    `,
  ])

  const monthlyPayout = payoutHistory[0]?.avg ?? 0

  // Semanas de segunda a domingo, cobrindo a janela inteira.
  const weeks: ProjectionWeek[] = []
  let cursor = startOfWeek(today, { weekStartsOn: 1 })
  while (cursor <= limit) {
    const wStart = cursor
    const wEnd   = endOfWeek(cursor, { weekStartsOn: 1 })
    weeks.push({
      label: format(wStart, "dd/MM", { locale: ptBR }),
      start: wStart, end: wEnd,
      inflow: 0, outflow: 0, net: 0, running: 0,
      overdueIncluded: false,
    })
    cursor = addDays(wEnd, 1)
  }
  if (weeks.length === 0) {
    return { weeks: [], totalIn: 0, totalOut: 0, net: 0, overdue: 0, firstNegative: null }
  }

  const indexOf = (d: Date) => {
    if (d < weeks[0].start) return 0
    const i = weeks.findIndex((w) => d >= w.start && d <= w.end)
    return i === -1 ? -1 : i
  }

  let overdue = 0
  for (const r of receivables) {
    const i = indexOf(r.dueDate)
    if (i === -1) continue
    const v = Number(r.amount)
    weeks[i].inflow += v
    if (r.dueDate < today) {
      overdue += v
      weeks[i].overdueIncluded = true
    }
  }

  for (const e of expensesDue) {
    // Despesa sem data de pagamento: assume-se que sai na competência dela.
    const i = indexOf(e.competencia)
    if (i === -1) continue
    weeks[i].outflow += Number(e.amount)
  }

  // Repasse estimado: uma vez por mês, na primeira semana de cada mês da janela.
  if (monthlyPayout > 0) {
    const seen = new Set<string>()
    for (const w of weeks) {
      const k = monthKey(w.start)
      if (seen.has(k)) continue
      seen.add(k)
      w.outflow += monthlyPayout
    }
  }

  let running = 0
  for (const w of weeks) {
    w.net = w.inflow - w.outflow
    running += w.net
    w.running = running
  }

  return {
    weeks,
    totalIn:  weeks.reduce((s, w) => s + w.inflow, 0),
    totalOut: weeks.reduce((s, w) => s + w.outflow, 0),
    net:      running,
    overdue,
    firstNegative: weeks.find((w) => w.running < 0) ?? null,
  }
}

// ─── Próximos vencimentos ─────────────────────────────────────────────────────

export interface UpcomingItem {
  id:     string
  kind:   "entrada" | "saida"
  label:  string
  detail: string
  amount: number
  date:   Date
  late:   boolean
}

/** Agenda financeira dos próximos dias — o que entra e o que sai, em ordem. */
export async function getUpcoming(now: Date, days = 45, take = 40): Promise<UpcomingItem[]> {
  const today = startOfDay(now)
  const limit = endOfDay(addDays(today, days))

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where:   { status: { not: "PAID" }, dueDate: { lte: limit } },
      select:  { id: true, amount: true, dueDate: true, description: true, student: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take,
    }),
    prisma.expense.findMany({
      where:   { paidAt: null, competencia: { lte: limit } },
      select:  { id: true, amount: true, competencia: true, description: true, category: true },
      orderBy: { competencia: "asc" },
      take,
    }),
  ])

  const items: UpcomingItem[] = [
    ...payments.map((p) => ({
      id:     p.id,
      kind:   "entrada" as const,
      label:  p.student.name,
      detail: p.description ?? "Cobrança",
      amount: Number(p.amount),
      date:   p.dueDate,
      late:   p.dueDate < today,
    })),
    ...expenses.map((e) => ({
      id:     e.id,
      kind:   "saida" as const,
      label:  e.description,
      detail: "Despesa",
      amount: Number(e.amount),
      date:   e.competencia,
      late:   e.competencia < today,
    })),
  ]

  return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, take)
}
