import { prisma }        from "@/lib/prisma"
import { situacao, whereSituacao, SITUACAO_LABEL, SITUACAO_VARIANT, type SituacaoCobranca } from "@/lib/payments"
import { nowBrazil }     from "@/lib/datetime"
import { wherePacoteUtilizavel } from "@/lib/packages"
import { PageHeader }    from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }         from "@/components/ui/badge"
import { PaymentActions }    from "./payment-actions"
import { EditPaymentDialog } from "./edit-payment-dialog"
import { DollarSign, BookOpen, AlertCircle } from "lucide-react"
import { format }        from "date-fns"
import { ptBR }          from "date-fns/locale"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

// Situação derivada da data, não do status gravado. Ver src/lib/payments.ts.

interface FinanceiroPageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function ColaboradorFinanceiroPage({ searchParams }: FinanceiroPageProps) {
  const { filter } = await searchParams
  const now = nowBrazil()
  const aba = (["PENDING", "PAID", "OVERDUE"] as const).includes(filter as SituacaoCobranca)
    ? (filter as SituacaoCobranca)
    : null

  const [payments, packages, totalRows] = await Promise.all([
    prisma.payment.findMany({
      where:   aba ? whereSituacao(aba, now) : undefined,
      include: { student: { include: { user: true } } },
      orderBy: { dueDate: "asc" },
      take:    100,
    }),
    prisma.lessonPackage.findMany({
      where:   wherePacoteUtilizavel(now),
      include: { student: { include: { user: true } } },
      orderBy: { remainingLessons: "asc" },
    }),
    // Totais sobre a base inteira: antes somavam só as 100 linhas exibidas e
    // mudavam conforme a aba selecionada.
    prisma.payment.findMany({ select: { amount: true, status: true, dueDate: true } }),
  ])

  const totals: Record<SituacaoCobranca, number> = { PENDING: 0, PAID: 0, OVERDUE: 0 }
  totalRows.forEach((p) => { totals[situacao(p, now)] += Number(p.amount) })

  const FILTER_TABS = [
    { v: "",        l: "Todas"    },
    { v: "PENDING", l: "A vencer" },
    { v: "OVERDUE", l: "Vencidas" },
    { v: "PAID",    l: "Pagas"    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="FINANCEIRO"
        description="Verificação de pagamentos e emissão de recibos"
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        {(["PENDING", "PAID", "OVERDUE"] as const).map((s) => (
          <Card key={s} className={s === "OVERDUE" && totals.OVERDUE > 0 ? "border-destructive/40" : ""}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{SITUACAO_LABEL[s]}</p>
              <p className="text-lg font-bold mt-1">{brl(totals[s])}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista de pagamentos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Cobranças
            </span>
            <div className="flex gap-1">
              {FILTER_TABS.map(({ v, l }) => (
                <a key={v} href={`?filter=${v}`}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    filter === v || (v === "" && !filter)
                      ? "bg-primary text-white"
                      : "hover:bg-muted text-muted-foreground"
                  }`}>
                  {l}
                </a>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma cobrança</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                    situacao(p, now) === "OVERDUE" ? "border-destructive/30 bg-destructive/5" : "border-border"
                  }`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{p.student.name ?? "Aluno"}</p>
                      {situacao(p, now) === "OVERDUE" && (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.description ?? "Cobrança"} ·{" "}
                      {p.status === "PAID" && p.paidAt
                        ? `Pago em ${format(p.paidAt, "dd/MM/yyyy", { locale: ptBR })}`
                        : `Vence ${format(p.dueDate, "dd/MM/yyyy", { locale: ptBR })}`
                      }
                      {p.method && ` · ${p.method}`}
                      {p.installmentTotal && p.installmentTotal > 1 &&
                        ` · Parcela ${p.installmentNumber}/${p.installmentTotal}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-bold">{brl(Number(p.amount))}</p>
                    <Badge variant={SITUACAO_VARIANT[situacao(p, now)]}>{SITUACAO_LABEL[situacao(p, now)]}</Badge>
                    <PaymentActions id={p.id} status={p.status} method={p.method} />
                    <EditPaymentDialog
                      studentName={p.student.name ?? "Aluno"}
                      payment={{
                        id:          p.id,
                        amount:      Number(p.amount),
                        dueDate:     format(p.dueDate, "yyyy-MM-dd"),
                        paidAt:      p.paidAt ? format(p.paidAt, "yyyy-MM-dd") : null,
                        description: p.description ?? null,
                        method:      p.method      ?? null,
                        status:      p.status,
                        installmentNumber:  p.installmentNumber,
                        installmentTotal:   p.installmentTotal,
                        installmentGroupId: p.installmentGroupId,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pacotes ativos */}
      {packages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Pacotes Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {packages.map((pkg) => {
                const pct = Math.round((Number(pkg.remainingLessons) / Number(pkg.totalLessons)) * 100)
                return (
                  <div key={pkg.id} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{pkg.student.name ?? "Aluno"}</p>
                      <p className="text-xs text-muted-foreground">
                        {brl(Number(pkg.pricePerLesson))}/aula
                        {pkg.expiresAt && ` · vence ${format(pkg.expiresAt, "dd/MM/yyyy", { locale: ptBR })}`}
                      </p>
                      {/* Barra de progresso */}
                      <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct > 40 ? "bg-green-500" :
                            pct > 15 ? "bg-yellow-500" : "bg-red-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-bold ${
                        Number(pkg.remainingLessons) <= 1 ? "text-destructive" :
                        Number(pkg.remainingLessons) <= 2 ? "text-orange-600" : "text-foreground"
                      }`}>
                        {Number(pkg.remainingLessons)}
                      </p>
                      <p className="text-xs text-muted-foreground">de {Number(pkg.totalLessons)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
