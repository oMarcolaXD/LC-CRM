import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { computePayout, getPayoutAlerts } from "@/lib/actions/financeiro"
import { PayoutRow }   from "./payout-row"
import { Wallet, AlertTriangle } from "lucide-react"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
function fmtLessons(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",") }

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

interface Props {
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function RepassesPage({ searchParams }: Props) {
  const sp   = await searchParams
  const now  = new Date()
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1
  const year  = sp.year  ? Number(sp.year)  : now.getFullYear()

  const [teachers, existingPayouts, alerts] = await Promise.all([
    prisma.teacher.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.teacherPayout.findMany({ where: { month, year } }),
    getPayoutAlerts(),
  ])

  const payoutByTeacher = new Map(existingPayouts.map((p) => [p.teacherId, p]))

  // Calcula o repasse de cada professor sob demanda (não persiste até "Marcar Pago").
  const rows = await Promise.all(
    teachers.map(async (t) => {
      const computed = await computePayout(t.id, month, year)
      const persisted = payoutByTeacher.get(t.id)
      return {
        teacherId:   t.id,
        name:        t.user.name,
        hourlyRate:  Number(t.hourlyRate),
        payDayStart: t.payDayStart ?? null,
        payDayEnd:   t.payDayEnd ?? null,
        totalLessons: computed.totalLessons,
        totalAmount:  computed.totalAmount,
        status:      persisted?.status === "PAID" ? "PAID" as const : "PENDING" as const,
        paidAt:      persisted?.paidAt ? new Date(persisted.paidAt).toLocaleDateString("pt-BR") : null,
      }
    }),
  )

  const totalMes = rows.reduce((s, r) => s + r.totalAmount, 0)
  const totalPago = rows.filter((r) => r.status === "PAID").reduce((s, r) => s + r.totalAmount, 0)
  const totalPendente = totalMes - totalPago

  const years = [now.getFullYear(), now.getFullYear() - 1]

  return (
    <div className="space-y-6">
      <PageHeader
        title="REPASSES DE PROFESSORES"
        description="Cálculo automático — aulas realizadas × valor/aula"
        backHref="/admin/financeiro"
      />

      {/* Avisos de repasse próximo */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.teacherId}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm border ${
                a.overdue
                  ? "bg-destructive/10 border-destructive/20 text-destructive"
                  : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300"
              }`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Repasse de <strong>{a.name}</strong> {a.overdue ? "venceu" : "a vencer"} entre dia{" "}
                {a.payDayStart}{a.payDayEnd !== a.payDayStart ? ` e ${a.payDayEnd}` : ""} — <strong>{brl(a.totalAmount)}</strong>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Seletor de período */}
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Mês</label>
          <select name="month" defaultValue={month}
            className="flex h-9 rounded-lg border border-input bg-background px-3 text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Ano</label>
          <select name="year" defaultValue={year}
            className="flex h-9 rounded-lg border border-input bg-background px-3 text-sm">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="submit"
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Ver
        </button>
      </form>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: "Total do Mês", value: brl(totalMes) },
          { title: "Pago",         value: brl(totalPago) },
          { title: "Pendente",     value: brl(totalPendente) },
        ].map((k) => (
          <Card key={k.title}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{k.title}</p>
              <p className="text-lg font-bold font-sub mt-1">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista de professores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> {MONTHS[month - 1]}/{year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum professor cadastrado</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <PayoutRow
                  key={r.teacherId}
                  row={{ ...r, month, year, totalLessonsLabel: fmtLessons(r.totalLessons), totalAmountLabel: brl(r.totalAmount) }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
