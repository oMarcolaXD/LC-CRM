import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { DonutChart }     from "@/components/charts/donut-chart"
import { ExpenseManager } from "./expense-manager"
import { YearNav }        from "./year-nav"
import { EXPENSE_CATEGORY_LABEL, EXPENSE_CATEGORY_COLOR } from "@/lib/expenses"
import { brl, brlRound }  from "@/lib/reports/format"
import { nowBrazil }      from "@/lib/datetime"
import { Wallet, CalendarClock, CheckCircle2, PieChart } from "lucide-react"
import { format, startOfYear, endOfYear } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { ExpenseCategory } from "@prisma/client"

export const dynamic = "force-dynamic"

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>
}) {
  const { ano } = await searchParams
  const now  = nowBrazil()
  const year = Number(ano) || now.getFullYear()

  const rows = await prisma.expense.findMany({
    where:   { competencia: { gte: startOfYear(new Date(year, 0, 1)), lte: endOfYear(new Date(year, 0, 1)) } },
    orderBy: [{ competencia: "desc" }, { createdAt: "desc" }],
  })

  // Decimal → number antes de cruzar para os client components.
  const expenses = rows.map((e) => ({
    id:                e.id,
    description:       e.description,
    category:          e.category,
    amount:            Number(e.amount),
    competencia:       e.competencia.toISOString(),
    paidAt:            e.paidAt?.toISOString() ?? null,
    recurrence:        e.recurrence,
    recurrenceGroupId: e.recurrenceGroupId,
    notes:             e.notes,
  }))

  const total     = expenses.reduce((s, e) => s + e.amount, 0)
  const pago      = expenses.filter((e) => e.paidAt).reduce((s, e) => s + e.amount, 0)
  const emAberto  = total - pago
  const mesesComGasto = new Set(expenses.map((e) => e.competencia.slice(0, 7))).size
  const media     = mesesComGasto > 0 ? total / mesesComGasto : 0

  // Série mensal do ano inteiro (meses vazios entram com zero para o eixo não pular).
  const porMes = Array.from({ length: 12 }, (_, m) => {
    const d = new Date(year, m, 1)
    return {
      label: format(d, "MMM", { locale: ptBR }),
      value: expenses
        .filter((e) => new Date(e.competencia).getMonth() === m)
        .reduce((s, e) => s + e.amount, 0),
    }
  })

  const porCategoriaMap = new Map<ExpenseCategory, number>()
  for (const e of expenses) {
    porCategoriaMap.set(e.category, (porCategoriaMap.get(e.category) ?? 0) + e.amount)
  }
  const porCategoria = [...porCategoriaMap.entries()]
    .map(([cat, value]) => ({
      label: EXPENSE_CATEGORY_LABEL[cat],
      value: Math.round(value),
      color: EXPENSE_CATEGORY_COLOR[cat],
    }))
    .sort((a, b) => b.value - a.value)

  const kpis = [
    { title: `Total ${year}`,   value: brl(total),     icon: Wallet,        cls: "text-primary"       },
    { title: "Média mensal",    value: brl(media),     icon: PieChart,      cls: "text-secondary"     },
    { title: "Já pago",         value: brl(pago),      icon: CheckCircle2,  cls: "text-green-600"     },
    { title: "Em aberto",       value: brl(emAberto),  icon: CalendarClock, cls: "text-amber-600"     },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="DESPESAS"
        description="Custos da empresa — é o que falta para o relatório mostrar o lucro real"
        backHref="/admin/financeiro"
      />

      <YearNav year={year} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ title, value, icon: Icon, cls }) => (
          <Card key={title}>
            <CardContent className="flex items-start justify-between gap-2 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
                <p className="mt-1 font-sub text-lg font-bold">{value}</p>
              </div>
              <Icon className={`h-5 w-5 shrink-0 ${cls}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {expenses.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-sub text-sm">Despesas por mês ({year})</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={porMes} color="#ef4444" valuePrefix="R$ " height={220} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-sub text-sm">Composição por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart data={porCategoria} height={220} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base">
            Lançamentos de {year}
            {expenses.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {expenses.length} lançamento{expenses.length !== 1 ? "s" : ""} · {brlRound(total)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseManager expenses={expenses} defaultYear={year} />
        </CardContent>
      </Card>
    </div>
  )
}
