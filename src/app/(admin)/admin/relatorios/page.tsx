import { nowBrazil } from "@/lib/datetime"
import {
  getPeriodBounds, parsePeriodo, type ReportSearchParams,
} from "@/lib/reports/period"
import { brl, brlRound, pct, num, delta, deltaPP, margin } from "@/lib/reports/format"
import {
  getRevenueSummary, getRevenueByMonth, getDeferredRevenue,
} from "@/lib/reports/revenue"
import { getTeacherCosts, getExpenses, seriesFrom } from "@/lib/reports/costs"
import { getDRE } from "@/lib/reports/dre"
import { getReceivables } from "@/lib/reports/receivables"
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expenses"
import { ComboChart } from "@/components/charts/combo-chart"
import { WaterfallChart } from "@/components/charts/waterfall-chart"
import { Panel, StatGrid, Stat, Empty, Note, Bar } from "./ui"
import Link from "next/link"
import { AlertTriangle, TrendingDown, Info, CheckCircle2 } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>
}) {
  const sp      = await searchParams
  const periodo = parsePeriodo(sp)
  const now     = nowBrazil()
  const b       = getPeriodBounds(periodo, now, { de: sp.de, ate: sp.ate })

  const [
    revenue, prevRevenue,
    costs, prevCosts,
    expenses, prevExpenses,
    dre, revenueByMonth, deferred, receivables,
  ] = await Promise.all([
    getRevenueSummary(b.start, b.end),
    getRevenueSummary(b.prevStart, b.prevEnd),
    getTeacherCosts(b.start, b.end),
    getTeacherCosts(b.prevStart, b.prevEnd),
    getExpenses(b.start, b.end),
    getExpenses(b.prevStart, b.prevEnd),
    getDRE(b.start, b.end, b.chartPoints),
    getRevenueByMonth(b.chartPoints[0].start, b.chartPoints[b.chartPoints.length - 1].end),
    getDeferredRevenue(),
    getReceivables(now),
  ])

  // ── Resultado do período ───────────────────────────────────────────────────
  const netRevenue   = revenue.net
  const totalCost    = costs.total + expenses.total
  const profit       = netRevenue - totalCost
  const profitPct    = margin(profit, netRevenue)

  const prevNet    = prevRevenue.net
  const prevProfit = prevNet - prevCosts.total - prevExpenses.total
  const prevPct    = margin(prevProfit, prevNet)

  // ── Séries dos sparklines (cobrem os meses do gráfico, não só o recorte) ────
  const seriesRevenue = b.chartPoints.map((p) => {
    const r = revenueByMonth.get(p.key)
    return (r?.gross ?? 0) - (r?.fees ?? 0)
  })
  const seriesTeacher = seriesFrom(b.chartPoints, costs.byMonth)
  const seriesExpense = seriesFrom(b.chartPoints, expenses.byMonth)
  const seriesProfit  = seriesRevenue.map((v, i) => v - seriesTeacher[i] - seriesExpense[i])

  const comboData = dre.months.map((m) => ({
    label:   m.label,
    receita: m.netRevenue,
    custo:   m.teacherCost + m.expenses,
    lucro:   m.profit,
    margem:  m.profitPct,
  }))

  const waterfall = [
    { label: "Receita bruta", value: revenue.gross,  kind: "total"     as const },
    { label: "Taxas",         value: revenue.fees,   kind: "deduction" as const },
    { label: "Professores",   value: costs.total,    kind: "deduction" as const },
    { label: "Despesas",      value: expenses.total, kind: "deduction" as const },
    { label: "Lucro",         value: 0,              kind: "total"     as const },
  ]

  const alerts = buildAlerts({
    profit, profitPct, prevPct,
    overdue: receivables.overdueTotal,
    overdueStudents: receivables.overdueStudents,
    grossRevenue: revenue.gross,
    deferred: deferred.total,
    expensesMissing: expenses.total === 0,
    negativeTeachers: [],
  })

  const hasData = revenue.gross > 0 || costs.total > 0 || expenses.total > 0

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[11.5px] text-muted-foreground print:block">
        Período: <strong className="font-medium text-[var(--text)]">{b.periodLabel}</strong>
        {" · "}comparado com o período anterior de mesma duração
      </p>

      {/* ── Resultado ─────────────────────────────────────────────────────── */}
      <StatGrid cols={4}>
        <Stat
          label="Receita líquida"
          value={brlRound(netRevenue)}
          delta={delta(netRevenue, prevNet)}
          sub={`${brl(revenue.gross)} bruto − ${brl(revenue.fees)} de taxas`}
          spark={seriesRevenue}
          sparkColor="var(--primary)"
        />
        <Stat
          label="Custo total"
          value={brlRound(totalCost)}
          delta={delta(totalCost, prevCosts.total + prevExpenses.total, false)}
          sub={`${brl(costs.total)} professores + ${brl(expenses.total)} despesas`}
          spark={seriesTeacher.map((v, i) => v + seriesExpense[i])}
          sparkColor="var(--subtle)"
        />
        <Stat
          label="Lucro"
          value={brlRound(profit)}
          delta={delta(profit, prevProfit)}
          sub={profit >= 0 ? "sobrou depois de tudo" : "prejuízo no período"}
          spark={seriesProfit}
          sparkColor={profit >= 0 ? "var(--success)" : "var(--danger)"}
          tone={profit >= 0 ? "positive" : "negative"}
        />
        <Stat
          label="Margem"
          value={pct(profitPct)}
          delta={deltaPP(profitPct, prevPct)}
          sub={`de cada ${brl(100)} recebidos, sobram ${brl(profitPct)}`}
          tone={profitPct >= 0 ? "positive" : "negative"}
        />
      </StatGrid>

      <StatGrid cols={4}>
        <Stat
          label="A receber"
          value={brlRound(receivables.pendingTotal)}
          sub={`${num(receivables.pendingCount)} cobrança${receivables.pendingCount !== 1 ? "s" : ""} em aberto`}
        />
        <Stat
          label="Vencido"
          value={brlRound(receivables.overdueTotal)}
          delta={
            receivables.overdueTotal > 0
              ? { value: null, label: `${receivables.overdueStudents} aluno${receivables.overdueStudents !== 1 ? "s" : ""}`, variant: "danger" }
              : { value: null, label: "em dia", variant: "success" }
          }
          sub="cobranças com vencimento no passado e não pagas"
        />
        <Stat
          label="Passivo de aulas"
          value={brlRound(deferred.total)}
          sub={`${num(Math.round(deferred.lessons))} aulas já pagas e não usadas por ${deferred.students} aluno${deferred.students !== 1 ? "s" : ""}`}
        />
        <Stat
          label="Aulas realizadas"
          value={num(dre.lessonCount)}
          sub={`${num(Math.round(dre.lessonHours))} h · custo médio ${brl(dre.lessonHours > 0 ? costs.total / dre.lessonHours : 0)}/h`}
        />
      </StatGrid>

      {/* ── Alertas ───────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-[3px]">
          {alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-[6px] px-3 py-[9px]"
              style={{ background: a.bg, borderLeft: `2px solid ${a.border}` }}
            >
              <a.icon className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: a.border }} />
              <span className="flex-1 text-[12.5px] leading-[1.35]" style={{ color: "var(--text)" }}>
                {a.text}
              </span>
              {a.href && (
                <Link
                  href={a.href}
                  className="shrink-0 whitespace-nowrap text-[11px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: a.border }}
                >
                  {a.action} →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Gráficos ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Receita, custo e margem"
          subtitle="Barras em reais (eixo esquerdo) · linha de margem em % (eixo direito)"
        >
          {hasData
            ? <ComboChart data={comboData} />
            : <Empty label="Sem movimento financeiro no período" />}
        </Panel>

        <Panel
          title="Para onde foi o dinheiro"
          subtitle={`Do que entrou em ${b.periodLabel.toLowerCase()} até o que sobrou`}
        >
          {revenue.gross > 0
            ? <>
                <WaterfallChart steps={waterfall} />
                <Note>
                  Taxas e repasses saem do que foi recebido; despesas entram pelo mês de
                  competência, mesmo que ainda não tenham sido pagas.
                </Note>
              </>
            : <Empty label="Nenhum pagamento recebido no período" />}
        </Panel>
      </div>

      {/* ── Composição dos custos ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Custo com professores"
          subtitle={`${brl(costs.paid)} já repassado · ${brl(costs.pending)} a repassar`}
          action={
            <Link href="/admin/relatorios/professores" className="text-[11px] text-muted-foreground hover:text-[var(--text)]">
              Ver detalhe →
            </Link>
          }
        >
          {costs.byTeacher.length === 0 ? (
            <Empty label="Nenhuma aula realizada no período" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {costs.byTeacher.slice(0, 6).map((t) => (
                <li key={t.teacherId} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-medium">{t.name}</span>
                    <span className="shrink-0 font-mono text-[12px]" style={{ fontFeatureSettings: '"tnum"' }}>
                      {brl(t.cost)}
                    </span>
                  </div>
                  <Bar ratio={costs.total > 0 ? t.cost / costs.total : 0} color="#94a3b8" />
                  <span className="text-[10.5px] text-muted-foreground">
                    {t.hours.toFixed(1).replace(".", ",")} h · {brl(t.hourlyRate)}/h
                    {t.snapshot && " · valor do repasse já registrado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Despesas da empresa"
          subtitle={
            expenses.total > 0
              ? `${brl(expenses.paid)} pago · ${brl(expenses.pending)} em aberto`
              : "Nada lançado neste período"
          }
          action={
            <Link href="/admin/financeiro/despesas" className="text-[11px] text-muted-foreground hover:text-[var(--text)]">
              Lançar →
            </Link>
          }
        >
          {expenses.byCategory.length === 0 ? (
            <Empty
              label="Nenhuma despesa lançada"
              hint="Sem aluguel, marketing e impostos no sistema, o número acima é margem depois dos professores — não o lucro real da empresa."
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {expenses.byCategory.slice(0, 6).map((c) => (
                <li key={c.category} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-medium">
                      {EXPENSE_CATEGORY_LABEL[c.category]}
                    </span>
                    <span className="shrink-0 font-mono text-[12px]" style={{ fontFeatureSettings: '"tnum"' }}>
                      {brl(c.total)}
                    </span>
                  </div>
                  <Bar ratio={expenses.total > 0 ? c.total / expenses.total : 0} color="#f87171" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Ponto de equilíbrio ───────────────────────────────────────────── */}
      <Panel
        title="Ponto de equilíbrio"
        subtitle="Quanta aula por mês só para pagar a estrutura"
      >
        {dre.breakEvenHours == null ? (
          <Empty
            label={
              dre.contributionPerHour <= 0
                ? "A margem por hora está zerada ou negativa — não existe ponto de equilíbrio"
                : "Sem despesas lançadas, não há estrutura a cobrir"
            }
            hint={
              dre.contributionPerHour <= 0
                ? "Cada aula a mais aumenta o prejuízo. Reveja preço por aula ou valor/hora dos professores."
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <BreakEvenCell
              label="Margem por hora de aula"
              value={brl(dre.contributionPerHour)}
              hint="receita líquida menos professor, por hora entregue"
            />
            <BreakEvenCell
              label="Despesa fixa mensal"
              value={brl(dre.monthlyExpenses)}
              hint="média das despesas no período"
            />
            <BreakEvenCell
              label="Equilíbrio"
              value={`${Math.ceil(dre.breakEvenHours)} h/mês`}
              hint={`≈ ${Math.ceil(dre.breakEvenHours)} aulas de 1 h. Acima disso, lucro.`}
              highlight
            />
          </div>
        )}
      </Panel>
    </div>
  )
}

function BreakEvenCell({
  label, value, hint, highlight,
}: {
  label: string; value: string; hint: string; highlight?: boolean
}) {
  return (
    <div
      className="rounded-[8px] border border-border p-3"
      style={highlight ? { borderColor: "var(--primary)", background: "color-mix(in oklab, var(--primary) 6%, transparent)" } : undefined}
    >
      <p className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-[19px] font-semibold" style={{ fontFeatureSettings: '"tnum"' }}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  )
}

// ─── Alertas ──────────────────────────────────────────────────────────────────

interface Alert {
  text:   string
  icon:   typeof AlertTriangle
  bg:     string
  border: string
  action?: string
  href?:  string
}

function buildAlerts(x: {
  profit: number
  profitPct: number
  prevPct: number
  overdue: number
  overdueStudents: number
  grossRevenue: number
  deferred: number
  expensesMissing: boolean
  negativeTeachers: string[]
}): Alert[] {
  const danger  = { bg: "var(--danger-soft)",  border: "var(--danger)"  }
  const warn    = { bg: "var(--warn-soft)",    border: "var(--warn)"    }
  const info    = { bg: "var(--info-soft)",    border: "var(--info)"    }
  const success = { bg: "var(--success-soft)", border: "var(--success)" }

  const out: Alert[] = []

  if (x.profit < 0) {
    out.push({
      ...danger, icon: TrendingDown,
      text: "O período fechou no prejuízo: o que entrou não cobriu professores e despesas.",
      action: "Ver DRE", href: "/admin/relatorios/dre",
    })
  } else if (x.prevPct > 0 && x.profitPct < x.prevPct - 5) {
    out.push({
      ...warn, icon: TrendingDown,
      text: `A margem caiu ${(x.prevPct - x.profitPct).toFixed(1).replace(".", ",")} pontos em relação ao período anterior.`,
      action: "Ver DRE", href: "/admin/relatorios/dre",
    })
  }

  if (x.overdue > 0) {
    const share = x.grossRevenue > 0 ? (x.overdue / x.grossRevenue) * 100 : 0
    out.push({
      ...(share > 15 ? danger : warn), icon: AlertTriangle,
      text: `${brl(x.overdue)} vencidos de ${x.overdueStudents} aluno${x.overdueStudents !== 1 ? "s" : ""}` +
            (share > 0 ? ` — equivale a ${pct(share, 0)} do que foi recebido no período.` : "."),
      action: "Cobrar", href: "/admin/relatorios/cobranca",
    })
  }

  if (x.expensesMissing) {
    out.push({
      ...info, icon: Info,
      text: "Nenhuma despesa lançada neste período — o lucro acima ainda não desconta aluguel, marketing e impostos.",
      action: "Lançar despesas", href: "/admin/financeiro/despesas",
    })
  }

  if (x.deferred > 0 && x.grossRevenue > 0 && x.deferred > x.grossRevenue) {
    out.push({
      ...info, icon: Info,
      text: `${brl(x.deferred)} em créditos vendidos e ainda não usados — mais do que a receita do período inteiro. É caixa hoje, mas aula (e custo de professor) amanhã.`,
    })
  }

  if (out.length === 0) {
    out.push({
      ...success, icon: CheckCircle2,
      text: "Nada pedindo atenção: margem estável, sem inadimplência e despesas lançadas.",
    })
  }

  return out
}
