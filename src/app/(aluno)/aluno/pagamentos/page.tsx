import { auth }             from "@/lib/auth"
import { prisma }           from "@/lib/prisma"
import { situacao, SITUACAO_LABEL, SITUACAO_VARIANT, type SituacaoCobranca } from "@/lib/payments"
import { nowBrazil }        from "@/lib/datetime"
import { redirect }         from "next/navigation"
import { getActiveStudent } from "@/lib/get-active-student"
import { PageHeader }  from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }       from "@/components/ui/badge"
import { DollarSign, BookOpen, AlertCircle } from "lucide-react"
import { format }      from "date-fns"
import { ptBR }        from "date-fns/locale"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

// Rótulo e cor vêm da situação real (derivada da data), não do status gravado —
// o aluno via "pendente" numa cobrança vencida há meses. Ver src/lib/payments.ts.

export default async function AlunoPagamentosPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { student: activeStudent } = await getActiveStudent(session.user.id)
  if (!activeStudent) redirect("/aluno/sem-aluno")

  const student = await prisma.student.findUnique({
    where:   { id: activeStudent.id },
    include: { packages: { orderBy: { purchaseDate: "desc" } } },
  })

  const payments = await prisma.payment.findMany({
    where:   { studentId: activeStudent.id },
    orderBy: { dueDate:  "asc" },
  })

  const now  = nowBrazil()
  const soma = (sit: SituacaoCobranca) =>
    payments.filter((p) => situacao(p, now) === sit).reduce((s, p) => s + Number(p.amount), 0)
  const totalPago = soma("PAID")
  const pendente  = soma("PENDING")
  const vencido   = soma("OVERDUE")
  const saldoAulas   = student?.packages.filter((p) => p.status === "ACTIVE").reduce((s, p) => s + Number(p.remainingLessons), 0) ?? 0

  return (
    <div className="space-y-6">
      <PageHeader title="MEUS PAGAMENTOS" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Pago",    value: brl(totalPago),  icon: DollarSign,  color: "text-green-600",   bg: "bg-green-50"    },
          { label: "Pendente",      value: brl(pendente),   icon: AlertCircle, color: "text-primary",     bg: "bg-primary/10"  },
          { label: "Vencido",       value: brl(vencido),    icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Saldo de Aulas",value: saldoAulas,      icon: BookOpen,    color: "text-secondary",   bg: "bg-secondary/10"},
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase">{label}</p>
                <p className="text-lg font-bold mt-1">{value}</p>
              </div>
              <div className={`${bg} p-2 rounded-xl shrink-0`}><Icon className={`w-4 h-4 ${color}`} /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base">Histórico de Cobranças</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma cobrança registrada</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium">{p.description ?? "Cobrança"}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence {format(p.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                      {p.method && ` · ${p.method}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-bold">{brl(Number(p.amount))}</p>
                    <Badge variant={SITUACAO_VARIANT[situacao(p, now)]}>{SITUACAO_LABEL[situacao(p, now)]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pacotes */}
      {student?.packages && student.packages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base">Meus Pacotes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {student.packages.map((pkg) => {
              const pct = Math.round((Number(pkg.remainingLessons) / Number(pkg.totalLessons)) * 100)
              return (
                <div key={pkg.id} className="p-4 rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{Number(pkg.totalLessons)} aulas</p>
                      <p className="text-xs text-muted-foreground">{brl(Number(pkg.pricePerLesson))}/aula</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{Number(pkg.remainingLessons)}</p>
                      <p className="text-xs text-muted-foreground">restantes</p>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  {pkg.expiresAt && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Expira: {format(pkg.expiresAt, "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
