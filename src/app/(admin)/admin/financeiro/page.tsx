import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/shared/page-header"
import { LinkButton }  from "@/components/shared/link-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }       from "@/components/ui/badge"
import {
  DollarSign, TrendingUp, AlertCircle, Users,
  BookOpen, ArrowRight, Wallet,
} from "lucide-react"
import { format }      from "date-fns"
import { ptBR }        from "date-fns/locale"

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default async function FinanceiroPage() {
  const now   = new Date()
  const month = now.getMonth()
  const year  = now.getFullYear()
  const start = new Date(year, month, 1)
  const end   = new Date(year, month + 1, 0, 23, 59, 59)

  const [pagamentos, repasses, aulasCompletadas, pacotesAtivos] = await Promise.all([
    prisma.payment.findMany({ orderBy: { dueDate: "asc" }, take: 100 }),
    prisma.teacherPayout.findMany({
      where:   { month: month + 1, year },
      include: { teacher: { include: { user: true } } },
    }),
    prisma.lesson.count({ where: { status: "COMPLETED", scheduledAt: { gte: start, lte: end } } }),
    prisma.lessonPackage.count({ where: { status: "ACTIVE" } }),
  ])

  const receitaMes     = pagamentos.filter((p) => p.status === "PAID" && p.paidAt && p.paidAt >= start).reduce((s, p) => s + Number(p.amount), 0)
  const aReceber       = pagamentos.filter((p) => p.status === "PENDING").reduce((s, p) => s + Number(p.amount), 0)
  const inadimplente   = pagamentos.filter((p) => p.status === "OVERDUE").reduce((s, p) => s + Number(p.amount), 0)
  const totalRepasses  = repasses.reduce((s, r) => s + Number(r.totalAmount), 0)

  const kpis = [
    { title: "Receita do Mês",    value: brl(receitaMes),   icon: TrendingUp,  color: "text-green-600",  bg: "bg-green-50"    },
    { title: "A Receber",         value: brl(aReceber),     icon: DollarSign,  color: "text-primary",    bg: "bg-primary/10"  },
    { title: "Inadimplência",     value: brl(inadimplente), icon: AlertCircle, color: "text-destructive",bg: "bg-destructive/10"},
    { title: "Repasses do Mês",   value: brl(totalRepasses),icon: Wallet,      color: "text-secondary",  bg: "bg-secondary/10"},
    { title: "Aulas Realizadas",  value: aulasCompletadas,  icon: BookOpen,    color: "text-blue-600",   bg: "bg-blue-50"     },
    { title: "Pacotes Ativos",    value: pacotesAtivos,     icon: Users,       color: "text-purple-600", bg: "bg-purple-50"   },
  ]

  const vencimentos = pagamentos
    .filter((p) => p.status === "PENDING")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="FINANCEIRO" description={`Resumo de ${format(now, "MMMM yyyy", { locale: ptBR })}`} />
        <div className="flex gap-2 flex-wrap">
          <LinkButton href="/admin/financeiro/pacotes"    variant="outline" size="sm">Pacotes</LinkButton>
          <LinkButton href="/admin/financeiro/pagamentos" variant="outline" size="sm">Cobranças</LinkButton>
          <LinkButton href="/admin/financeiro/professores"variant="outline" size="sm">Professores</LinkButton>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(({ title, value, icon: Icon, color, bg }) => (
          <Card key={title}>
            <CardContent className="p-5 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{title}</p>
                <p className="text-xl font-bold font-sub mt-1">{value}</p>
              </div>
              <div className={`${bg} p-2.5 rounded-xl shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Próximos vencimentos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" /> Próximos Vencimentos
              </span>
              <LinkButton href="/admin/financeiro/pagamentos" variant="ghost" size="sm">
                Ver todos <ArrowRight className="w-3 h-3 ml-1" />
              </LinkButton>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vencimentos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cobrança pendente</p>
            ) : (
              <div className="space-y-2">
                {vencimentos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{p.description ?? "Cobrança"}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {format(p.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-primary">{brl(Number(p.amount))}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Repasses do mês */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" /> Repasses — {format(now, "MMM/yyyy", { locale: ptBR })}
              </span>
              <LinkButton href="/admin/financeiro/professores" variant="ghost" size="sm">
                Gerenciar <ArrowRight className="w-3 h-3 ml-1" />
              </LinkButton>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {repasses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum repasse calculado</p>
            ) : (
              <div className="space-y-2">
                {repasses.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{r.teacher.user.name}</p>
                      <p className="text-xs text-muted-foreground">{r.totalLessons} aulas</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{brl(Number(r.totalAmount))}</p>
                      <Badge variant={r.status === "PAID" ? "default" : "secondary"}>
                        {r.status === "PAID" ? "Pago" : "Pendente"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
