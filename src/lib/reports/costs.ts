// Custos: repasse de professores e despesas da empresa.
//
// ── Definição canônica do custo com professores ───────────────────────────────
// Um único conceito, usado pelo DRE, pela visão geral e pela aba de professores,
// para que as três telas nunca discordem:
//
//   custo(professor, mês) = TeacherPayout.totalAmount   se o repasse já existe
//                         = Σ horas × taxa vigente na data da aula   caso contrário
//
// Duas proteções contra reajuste retroativo: o TeacherPayout congela o que
// realmente saiu do caixa, e `teacher_rates` guarda desde quando cada valor/hora
// vale — a aula de março custa a taxa de março, não a de hoje.
//
// COMPROMISSO entra no custo de propósito: `computePayout` (a fonte de verdade
// do que é pago ao professor) não filtra por tipo de aula, então excluí-lo aqui
// faria o relatório mostrar um custo menor que o repasse real.

import { prisma } from "@/lib/prisma"
import { monthKey, monthKeyFromDb, type ChartPoint } from "./period"
import type { ExpenseCategory } from "@prisma/client"

export interface TeacherCostRow {
  teacherId:  string
  name:       string
  hourlyRate: number
  hours:      number
  lessons:    number
  cost:       number
  /** true = veio de um TeacherPayout já registrado (valor histórico congelado) */
  snapshot:   boolean
}

export interface TeacherCosts {
  total:     number
  byMonth:   Map<string, number>
  byTeacher: TeacherCostRow[]
  /** Quanto do custo do período já foi efetivamente pago ao professor. */
  paid:      number
  pending:   number
}

/**
 * Custo com professores no intervalo, por mês e por professor.
 *
 * Uma query agregada em vez de um `computePayout` por professor (o padrão N+1
 * de `getPayoutAlerts`): com 20 professores × 12 meses seriam 240 idas ao banco.
 */
export async function getTeacherCosts(start: Date, end: Date): Promise<TeacherCosts> {
  const [rows, payouts, teachers] = await Promise.all([
    // As horas vêm agregadas por professor e mês, mas o custo NÃO sai daqui:
    // cada aula vale a taxa vigente na data dela (teacher_rates), então o valor
    // é resolvido em JS logo abaixo. Sem isso, um reajuste reescreveria o custo
    // de meses já trabalhados.
    prisma.$queryRaw<{
      teacherId: string; month: Date; hours: number; lessons: number; cost: number
    }[]>`
      SELECT l."teacherId"                              AS "teacherId",
             DATE_TRUNC('month', l."scheduledAt")       AS month,
             (SUM(l.duration)::float8 / 60)             AS hours,
             COUNT(*)::int                              AS lessons,
             COALESCE(SUM(
               (l.duration::numeric / 60) * COALESCE(
                 (SELECT tr."hourlyRate" FROM teacher_rates tr
                   WHERE tr."teacherId" = l."teacherId"
                     AND tr."effectiveFrom" <= l."scheduledAt"
                   ORDER BY tr."effectiveFrom" DESC LIMIT 1),
                 t."hourlyRate"
               )
             ), 0)::float8                              AS cost
      FROM lessons l
      JOIN teachers t ON t.id = l."teacherId"
      WHERE l.status = 'COMPLETED'
        AND l."scheduledAt" >= ${start} AND l."scheduledAt" <= ${end}
      GROUP BY l."teacherId", DATE_TRUNC('month', l."scheduledAt"), t."hourlyRate"
    `,
    prisma.teacherPayout.findMany({
      select: { teacherId: true, month: true, year: true, totalAmount: true, status: true },
    }),
    prisma.teacher.findMany({
      select: { id: true, hourlyRate: true, user: { select: { name: true } } },
    }),
  ])

  const rateOf = new Map(teachers.map((t) => [t.id, Number(t.hourlyRate)]))
  const nameOf = new Map(teachers.map((t) => [t.id, t.user.name]))
  const payoutOf = new Map(
    payouts.map((p) => [`${p.teacherId}|${p.year}-${p.month}`, p]),
  )

  const byMonth   = new Map<string, number>()
  const byTeacher = new Map<string, TeacherCostRow>()
  let total = 0, paid = 0, pending = 0

  for (const r of rows) {
    const key  = monthKeyFromDb(r.month)
    const rate = rateOf.get(r.teacherId) ?? 0

    const snap    = payoutOf.get(`${r.teacherId}|${key}`)
    const cost    = snap ? Number(snap.totalAmount) : r.cost
    const isSnap  = !!snap

    total += cost
    if (snap?.status === "PAID") paid += cost
    else                         pending += cost

    byMonth.set(key, (byMonth.get(key) ?? 0) + cost)

    const cur = byTeacher.get(r.teacherId)
    byTeacher.set(r.teacherId, {
      teacherId:  r.teacherId,
      name:       nameOf.get(r.teacherId) ?? "Professor",
      hourlyRate: rate,
      hours:      (cur?.hours   ?? 0) + r.hours,
      lessons:    (cur?.lessons ?? 0) + r.lessons,
      cost:       (cur?.cost    ?? 0) + cost,
      snapshot:   (cur?.snapshot ?? false) || isSnap,
    })
  }

  return {
    total,
    byMonth,
    paid,
    pending,
    byTeacher: [...byTeacher.values()].sort((a, b) => b.cost - a.cost),
  }
}

// ─── Despesas ─────────────────────────────────────────────────────────────────

export interface ExpenseTotals {
  total:       number
  /** Agrupado por mês de COMPETÊNCIA (é o que pesa no lucro do mês). */
  byMonth:     Map<string, number>
  byCategory:  { category: ExpenseCategory; total: number }[]
  /** Detalhe categoria × mês, para as linhas do DRE. */
  byCategoryMonth: Map<string, Map<string, number>>
  paid:        number
  pending:     number
}

/**
 * Despesas do intervalo, agrupadas por competência.
 *
 * Competência ≠ pagamento: uma despesa de março quitada em abril pesa no
 * resultado de março (aqui) e no caixa de abril (ver cashflow.ts).
 */
export async function getExpenses(start: Date, end: Date): Promise<ExpenseTotals> {
  const rows = await prisma.expense.findMany({
    where:  { competencia: { gte: start, lte: end } },
    select: { category: true, amount: true, competencia: true, paidAt: true },
  })

  const byMonth         = new Map<string, number>()
  const byCategory      = new Map<ExpenseCategory, number>()
  const byCategoryMonth = new Map<string, Map<string, number>>()
  let total = 0, paid = 0, pending = 0

  for (const e of rows) {
    const v   = Number(e.amount)
    const key = monthKey(e.competencia)

    total += v
    if (e.paidAt) paid += v
    else          pending += v

    byMonth.set(key, (byMonth.get(key) ?? 0) + v)
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + v)

    const perMonth = byCategoryMonth.get(e.category) ?? new Map<string, number>()
    perMonth.set(key, (perMonth.get(key) ?? 0) + v)
    byCategoryMonth.set(e.category, perMonth)
  }

  return {
    total,
    byMonth,
    byCategoryMonth,
    paid,
    pending,
    byCategory: [...byCategory.entries()]
      .map(([category, t]) => ({ category, total: t }))
      .sort((a, b) => b.total - a.total),
  }
}

/** Preenche uma série mensal a partir de um Map indexado por monthKey. */
export function seriesFrom(points: ChartPoint[], byMonth: Map<string, number>): number[] {
  return points.map((p) => byMonth.get(p.key) ?? 0)
}
