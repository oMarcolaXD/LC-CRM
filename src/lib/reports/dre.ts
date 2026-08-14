// DRE — Demonstrativo de Resultado.
//
// Junta as três fontes num único quadro mês a mês:
//
//   Receita bruta recebida            payments PAID, por paidAt
//   (−) Taxas de cartão/boleto        payments.feeAmount
//   = Receita líquida
//   (−) Custo com professores         TeacherPayout ou horas × hourlyRate
//   = Margem de contribuição          o que sobra para pagar a estrutura
//   (−) Despesas da empresa           expenses, por competência
//   = Resultado operacional           o lucro de verdade
//
// Não há dupla contagem: taxa vive só em Payment.feeAmount, repasse só em
// TeacherPayout, e a tabela `expenses` proíbe (por convenção documentada no
// schema) lançar professor ou taxa como despesa.

import { getRevenueByMonth, type RevenueBasis } from "./revenue"
import { getTeacherCosts, getExpenses } from "./costs"
import { margin } from "./format"
import type { ChartPoint } from "./period"
import type { ExpenseCategory } from "@prisma/client"

export interface DreMonth {
  key:            string
  label:          string
  grossRevenue:   number
  fees:           number
  netRevenue:     number
  teacherCost:    number
  contribution:   number
  contributionPct: number
  expenses:       number
  profit:         number
  profitPct:      number
}

export interface DreResult {
  months: DreMonth[]
  total:  Omit<DreMonth, "key" | "label">
  /** Linhas de despesa por categoria × mês, para o detalhamento do quadro. */
  expenseRows: { category: ExpenseCategory; total: number; byMonth: Map<string, number> }[]
  /** Nº de aulas realizadas no período — base do custo/receita por aula. */
  lessonHours: number
  lessonCount: number
  /**
   * Ponto de equilíbrio: quantas horas de aula por mês são necessárias só para
   * cobrir as despesas fixas, dada a margem de contribuição por hora atual.
   * null quando a margem por hora é zero ou negativa (aí não existe equilíbrio:
   * cada aula a mais aumenta o prejuízo).
   */
  breakEvenHours: number | null
  contributionPerHour: number
  monthlyExpenses: number
}

export async function getDRE(
  start: Date,
  end: Date,
  points: ChartPoint[],
  basis: RevenueBasis = "caixa",
): Promise<DreResult> {
  const [revenue, costs, expenses] = await Promise.all([
    getRevenueByMonth(start, end, basis),
    getTeacherCosts(start, end),
    getExpenses(start, end),
  ])

  const months: DreMonth[] = points.map((p) => {
    const grossRevenue = revenue.get(p.key)?.gross ?? 0
    const fees         = revenue.get(p.key)?.fees ?? 0
    const netRevenue   = grossRevenue - fees
    const teacherCost  = costs.byMonth.get(p.key) ?? 0
    const contribution = netRevenue - teacherCost
    const exp          = expenses.byMonth.get(p.key) ?? 0
    const profit       = contribution - exp

    return {
      key:   p.key,
      label: p.label,
      grossRevenue,
      fees,
      netRevenue,
      teacherCost,
      contribution,
      contributionPct: margin(contribution, netRevenue),
      expenses: exp,
      profit,
      profitPct: margin(profit, netRevenue),
    }
  })

  // O total soma as colunas exibidas — assim o rodapé sempre fecha com o quadro,
  // mesmo quando o recorte personalizado corta meses pela metade.
  const sum = (f: (m: DreMonth) => number) => months.reduce((s, m) => s + f(m), 0)
  const grossRevenue = sum((m) => m.grossRevenue)
  const fees         = sum((m) => m.fees)
  const netRevenue   = grossRevenue - fees
  const teacherCost  = sum((m) => m.teacherCost)
  const contribution = netRevenue - teacherCost
  const exp          = sum((m) => m.expenses)
  const profit       = contribution - exp

  const lessonHours = costs.byTeacher.reduce((s, t) => s + t.hours, 0)
  const lessonCount = costs.byTeacher.reduce((s, t) => s + t.lessons, 0)

  const nMonths            = Math.max(1, months.length)
  const monthlyExpenses    = exp / nMonths
  const contributionPerHour = lessonHours > 0 ? contribution / lessonHours : 0
  const breakEvenHours     = contributionPerHour > 0
    ? monthlyExpenses / contributionPerHour
    : null

  return {
    months,
    total: {
      grossRevenue, fees, netRevenue, teacherCost, contribution,
      contributionPct: margin(contribution, netRevenue),
      expenses: exp,
      profit,
      profitPct: margin(profit, netRevenue),
    },
    expenseRows: expenses.byCategory.map((c) => ({
      category: c.category,
      total:    c.total,
      byMonth:  expenses.byCategoryMonth.get(c.category) ?? new Map(),
    })),
    lessonHours,
    lessonCount,
    breakEvenHours,
    contributionPerHour,
    monthlyExpenses,
  }
}
