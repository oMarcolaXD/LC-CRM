// Exportação em CSV do recorte atual.
//
// Reaproveita exatamente os mesmos módulos de src/lib/reports/ que as telas
// usam — se a planilha e a tela divergirem, é bug, não arredondamento.
//
// Guard próprio: route handlers NÃO passam pelo (admin)/layout.tsx, então a
// verificação de role do layout não protege esta rota.

import { auth } from "@/lib/auth"
import { nowBrazil } from "@/lib/datetime"
import { getPeriodBounds, parsePeriodo, type Periodo } from "@/lib/reports/period"
import { buildCsv, csvFilename, csvResponse, type CsvSection } from "@/lib/reports/csv"
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expenses"

import {
  getRevenueSummary, getRevenueByOrigin, getRevenueByMethod,
  getTopStudentsByRevenue, getDeferredRevenue, ORIGIN_LABEL,
} from "@/lib/reports/revenue"
import { getTeacherCosts, getExpenses } from "@/lib/reports/costs"
import { getDRE } from "@/lib/reports/dre"
import { getCashFlow, getProjection } from "@/lib/reports/cashflow"
import { getAging, getDebtors, getReceivables, getRecovery } from "@/lib/reports/receivables"
import { getStudentBase, getChurn, getStudentValue, getCreditBalances } from "@/lib/reports/students"
import { getTeacherPerformance } from "@/lib/reports/teachers"
import { getLessonStats } from "@/lib/reports/operations"
import { getQualityReport } from "@/lib/reports/quality"

import { format } from "date-fns"

export const dynamic = "force-dynamic"

const REPORTS = [
  "resumo", "receita", "dre", "caixa", "cobranca", "alunos", "professores", "qualidade",
] as const
type ReportName = typeof REPORTS[number]

export async function GET(req: Request) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    return new Response("Sem permissão", { status: 403 })
  }

  const url    = new URL(req.url)
  const report = (REPORTS as readonly string[]).includes(url.searchParams.get("report") ?? "")
    ? (url.searchParams.get("report") as ReportName)
    : "resumo"

  const periodo: Periodo = parsePeriodo({
    periodo: url.searchParams.get("periodo") ?? undefined,
    de:      url.searchParams.get("de") ?? undefined,
    ate:     url.searchParams.get("ate") ?? undefined,
  })

  const now = nowBrazil()
  const b   = getPeriodBounds(periodo, now, {
    de:  url.searchParams.get("de"),
    ate: url.searchParams.get("ate"),
  })

  const header: CsvSection = {
    title:   "Lição de Casa — relatório",
    headers: ["Relatório", "Período", "De", "Até", "Gerado em"],
    rows: [[
      report,
      b.periodLabel,
      format(b.start, "dd/MM/yyyy"),
      format(b.end, "dd/MM/yyyy"),
      format(now, "dd/MM/yyyy HH:mm"),
    ]],
  }

  const sections = [header, ...(await buildSections(report, b, now))]
  return csvResponse(buildCsv(sections), csvFilename(report, b.periodLabel))
}

type Bounds = ReturnType<typeof getPeriodBounds>

async function buildSections(
  report: ReportName, b: Bounds, now: Date,
): Promise<CsvSection[]> {
  switch (report) {
    case "receita": {
      const [summary, byOrigin, byMethod, top, deferred] = await Promise.all([
        getRevenueSummary(b.start, b.end),
        getRevenueByOrigin(b.start, b.end),
        getRevenueByMethod(b.start, b.end),
        getTopStudentsByRevenue(b.start, b.end, 50),
        getDeferredRevenue(),
      ])
      return [
        {
          title: "Resumo",
          headers: ["Receita bruta", "Taxas", "Receita líquida", "Cobranças", "Ticket médio", "Alunos pagantes", "Passivo de aulas"],
          rows: [[summary.gross, summary.fees, summary.net, summary.count, summary.ticket, summary.payers, deferred.total]],
        },
        {
          title: "Por origem",
          headers: ["Origem", "Cobranças", "Valor"],
          rows: byOrigin.map((o) => [ORIGIN_LABEL[o.origin] ?? o.origin, o.count, o.total]),
        },
        {
          title: "Por forma de pagamento",
          headers: ["Forma", "Cobranças", "Recebido", "Taxa", "Taxa efetiva %"],
          rows: byMethod.map((m) => [m.method, m.count, m.total, m.fees, m.effectivePct]),
        },
        {
          title: "Alunos por receita",
          headers: ["RA", "Aluno", "Cobranças", "Valor"],
          rows: top.map((s) => [s.ra, s.name, s.count, s.total]),
        },
      ]
    }

    case "dre": {
      const dre = await getDRE(b.start, b.end, b.periodMonths)
      const cols = dre.months.map((m) => m.label)
      const line = (label: string, pick: (i: number) => number, total: number) =>
        [label, ...dre.months.map((_, i) => pick(i)), total]

      return [
        {
          title: "Demonstrativo de resultado",
          headers: ["Linha", ...cols, "Total"],
          rows: [
            line("Receita bruta recebida", (i) => dre.months[i].grossRevenue, dre.total.grossRevenue),
            line("(-) Taxas", (i) => -dre.months[i].fees, -dre.total.fees),
            line("= Receita líquida", (i) => dre.months[i].netRevenue, dre.total.netRevenue),
            line("(-) Custo com professores", (i) => -dre.months[i].teacherCost, -dre.total.teacherCost),
            line("= Margem de contribuição", (i) => dre.months[i].contribution, dre.total.contribution),
            line("Margem de contribuição %", (i) => dre.months[i].contributionPct, dre.total.contributionPct),
            ...dre.expenseRows.map((r) =>
              line(`(-) ${EXPENSE_CATEGORY_LABEL[r.category]}`,
                (i) => -(r.byMonth.get(dre.months[i].key) ?? 0), -r.total)),
            line("(-) Total de despesas", (i) => -dre.months[i].expenses, -dre.total.expenses),
            line("= Resultado operacional", (i) => dre.months[i].profit, dre.total.profit),
            line("Margem líquida %", (i) => dre.months[i].profitPct, dre.total.profitPct),
          ],
        },
        {
          title: "Unidade econômica",
          headers: ["Indicador", "Valor"],
          rows: [
            ["Aulas realizadas", dre.lessonCount],
            ["Horas entregues", dre.lessonHours],
            ["Margem de contribuição por hora", dre.contributionPerHour],
            ["Despesa fixa mensal", dre.monthlyExpenses],
            ["Ponto de equilíbrio (horas/mês)", dre.breakEvenHours ?? null],
          ],
        },
      ]
    }

    case "caixa": {
      const [flow, projection] = await Promise.all([
        getCashFlow(b.periodMonths),
        getProjection(now, 90),
      ])
      return [
        {
          title: "Caixa realizado",
          headers: ["Mês", "Entradas", "Repasses pagos", "Despesas pagas", "Resultado", "Acumulado"],
          rows: flow.months.map((m) => [
            m.label, m.inflow, m.teacherOutflow, m.expenseOutflow, m.net, m.running,
          ]),
        },
        {
          title: "Projeção 90 dias",
          headers: ["Semana de", "A receber", "A pagar", "Saldo", "Acumulado", "Inclui vencido"],
          rows: projection.weeks.map((w) => [
            format(w.start, "dd/MM/yyyy"), w.inflow, w.outflow, w.net, w.running,
            w.overdueIncluded ? "sim" : "não",
          ]),
        },
      ]
    }

    case "cobranca": {
      const [receivables, aging, debtors, recovery] = await Promise.all([
        getReceivables(now),
        getAging(now),
        getDebtors(now, 200),
        getRecovery(b.start, b.end),
      ])
      return [
        {
          title: "Situação",
          headers: ["Em aberto", "A vencer", "Vencido", "Cobranças vencidas", "Alunos em atraso"],
          rows: [[
            receivables.openTotal, receivables.pendingTotal, receivables.overdueTotal,
            receivables.overdueCount, receivables.overdueStudents,
          ]],
        },
        {
          title: "Envelhecimento",
          headers: ["Faixa", "Cobranças", "Valor"],
          rows: aging.map((a) => [a.label, a.count, a.total]),
        },
        {
          title: "Recuperação no período",
          headers: ["Pago em dia (valor)", "Pago com atraso (valor)", "% com atraso", "Atraso médio (dias)"],
          rows: [[recovery.onTimeTotal, recovery.lateTotal, recovery.latePct, recovery.avgDelayDays]],
        },
        {
          title: "Devedores",
          headers: ["RA", "Aluno", "Responsável", "Contato", "Cobranças", "Dias de atraso", "Valor"],
          rows: debtors.map((d) => [
            d.ra, d.name, d.guardianName ?? "", d.phone ?? d.email ?? "",
            d.count, d.oldestDays, d.total,
          ]),
        },
      ]
    }

    case "alunos": {
      const base = await getStudentBase(now)
      const [revenue, churn, credits] = await Promise.all([
        getRevenueSummary(b.start, b.end),
        getChurn(b.start, b.end, now, base.active),
        getCreditBalances(200),
      ])
      const value = await getStudentValue(revenue.gross, base.active)

      return [
        {
          title: "Base",
          headers: ["Cadastrados", "Ativos", "Inativos", "Com crédito", "Nunca tiveram aula"],
          rows: [[base.total, base.active, base.inactive, base.withCredits, base.never]],
        },
        {
          title: "Movimento",
          headers: ["Entraram", "Pararam", "Saldo", "Churn %"],
          rows: [[churn.joined, churn.lost, churn.net, churn.churnPct]],
        },
        {
          title: "Valor por aluno",
          headers: ["ARPU", "LTV médio", "Recompra %", "Dias entre pacotes", "Vida média (meses)"],
          rows: [[value.arpu, value.ltv, value.repeatPct, value.daysBetweenPackages, value.lifespanMonths]],
        },
        {
          title: "Saldos de crédito",
          headers: ["RA", "Aluno", "Aulas restantes", "Valor"],
          rows: credits.map((c) => [c.ra, c.name, c.lessons, c.value]),
        },
      ]
    }

    case "professores": {
      const [report, stats] = await Promise.all([
        getTeacherPerformance(b.start, b.end),
        getLessonStats(b.start, b.end),
      ])
      return [
        {
          title: "Rentabilidade por professor",
          headers: [
            "Professor", "Valor/hora", "Aulas", "Horas", "Alunos", "Custo",
            "Receita atribuída", "Resultado", "Margem %", "Canceladas", "Faltas", "Nota média",
          ],
          rows: report.rows.map((r) => [
            r.name, r.hourlyRate, r.lessons, r.hours, r.students, r.cost,
            r.revenue, r.result, r.marginPct, r.cancelled, r.missed, r.avgRating ?? null,
          ]),
        },
        {
          title: "Execução",
          headers: ["Realizadas", "Canceladas", "Faltas", "Conclusão %", "Cancelamento %", "Nota média"],
          rows: [[
            stats.completed, stats.cancelled, stats.missed,
            stats.completionPct, stats.cancelPct, stats.avgRating ?? null,
          ]],
        },
      ]
    }

    case "qualidade": {
      // Auditoria varre a base inteira, então ignora o período — igual à tela.
      const q = await getQualityReport(now)
      return [
        {
          title: "Resumo da auditoria",
          headers: ["Críticos", "Atenção", "Valor envolvido", "Verificações limpas"],
          rows: [[q.critical, q.warning, q.atRisk, q.clean]],
        },
        {
          title: "Verificações",
          headers: ["Severidade", "Verificação", "Ocorrências", "Valor envolvido", "Por que importa"],
          rows: q.checks.map((c) => [c.severity, c.title, c.count, c.amount ?? null, c.why]),
        },
        {
          title: "Ocorrências (amostra por verificação)",
          headers: ["Verificação", "Item", "Detalhe", "Valor"],
          rows: q.checks.flatMap((c) =>
            c.items.map((i) => [c.title, i.label, i.detail, i.amount ?? null])),
        },
      ]
    }

    default: { // "resumo"
      const [revenue, costs, expenses, dre, receivables, deferred] = await Promise.all([
        getRevenueSummary(b.start, b.end),
        getTeacherCosts(b.start, b.end),
        getExpenses(b.start, b.end),
        getDRE(b.start, b.end, b.periodMonths),
        getReceivables(now),
        getDeferredRevenue(),
      ])
      const profit = revenue.net - costs.total - expenses.total

      return [
        {
          title: "Resumo do período",
          headers: ["Indicador", "Valor"],
          rows: [
            ["Receita bruta", revenue.gross],
            ["Taxas de cartão e boleto", revenue.fees],
            ["Receita líquida", revenue.net],
            ["Custo com professores", costs.total],
            ["Despesas da empresa", expenses.total],
            ["Lucro", profit],
            ["Margem %", dre.total.profitPct],
            ["A receber", receivables.pendingTotal],
            ["Vencido", receivables.overdueTotal],
            ["Passivo de aulas", deferred.total],
            ["Aulas realizadas", dre.lessonCount],
            ["Horas entregues", dre.lessonHours],
          ],
        },
        {
          title: "Mês a mês",
          headers: ["Mês", "Receita líquida", "Professores", "Despesas", "Lucro", "Margem %"],
          rows: dre.months.map((m) => [
            m.label, m.netRevenue, m.teacherCost, m.expenses, m.profit, m.profitPct,
          ]),
        },
      ]
    }
  }
}
