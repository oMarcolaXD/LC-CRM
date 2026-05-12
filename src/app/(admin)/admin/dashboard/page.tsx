import { auth }   from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }  from "@/components/ui/badge"
import { LinkButton } from "@/components/shared/link-button"
import { SimpleAreaChart } from "@/components/charts/area-chart"
import { SimpleBarChart }  from "@/components/charts/bar-chart"
import { DonutChart }      from "@/components/charts/donut-chart"
import {
  Users, GraduationCap, CalendarCheck, DollarSign,
  TrendingUp, Clock, CheckCircle2, AlertCircle, ArrowRight,
} from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

async function getDashboardData() {
  const now  = new Date()

  // Últimos 6 meses para gráficos
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM", { locale: ptBR }) }
  })

  const [
    totalAlunos, totalProfessores, totalColaboradores,
    aulasHoje, pendentes,
    allLessons, payments,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.user.count({ where: { role: "COLLABORATOR" } }),
    prisma.lesson.count({
      where: { scheduledAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
    }),
    prisma.lessonRequest.count({ where: { status: "PENDING" } }),
    prisma.lesson.findMany({ select: { status: true, scheduledAt: true }, take: 500 }),
    prisma.payment.findMany({ select: { amount: true, status: true, paidAt: true } }),
  ])

  // Receita por mês
  const receitaMes = months.map(({ start, end, label }) => ({
    label,
    value: payments
      .filter((p) => p.status === "PAID" && p.paidAt && p.paidAt >= start && p.paidAt <= end)
      .reduce((s, p) => s + Number(p.amount), 0),
  }))

  // Aulas por mês
  const aulasMes = months.map(({ start, end, label }) => ({
    label,
    value: allLessons.filter((l) => l.scheduledAt >= start && l.scheduledAt <= end).length,
  }))

  // Status das aulas (mês atual)
  const mesLessons = allLessons.filter((l) =>
    l.scheduledAt >= startOfMonth(now) && l.scheduledAt <= endOfMonth(now)
  )
  const lessonStatus = [
    { label: "Confirmada", value: mesLessons.filter((l) => l.status === "CONFIRMED").length,  color: "#FB8500" },
    { label: "Realizada",  value: mesLessons.filter((l) => l.status === "COMPLETED").length,  color: "#219EBC" },
    { label: "Cancelada",  value: mesLessons.filter((l) => l.status === "CANCELLED").length,  color: "#ef4444" },
    { label: "Faltou",     value: mesLessons.filter((l) => l.status === "MISSED").length,     color: "#f97316" },
    { label: "Agendada",   value: mesLessons.filter((l) => l.status === "SCHEDULED").length,  color: "#8b5cf6" },
  ].filter((d) => d.value > 0)

  const receitaTotal = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0)
  const aReceber     = payments.filter((p) => p.status === "PENDING").reduce((s, p) => s + Number(p.amount), 0)

  return {
    totalAlunos, totalProfessores, totalColaboradores,
    aulasHoje, pendentes, receitaMes, aulasMes, lessonStatus,
    receitaTotal, aReceber,
  }
}

export default async function AdminDashboard() {
  const session = await auth()
  const d       = await getDashboardData()
  const hora    = new Date().getHours()
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"

  const kpis = [
    { title: "Alunos",         value: d.totalAlunos,      icon: GraduationCap, color: "text-primary",     bg: "bg-primary/10"   },
    { title: "Professores",    value: d.totalProfessores, icon: Users,         color: "text-secondary",   bg: "bg-secondary/10" },
    { title: "Aulas este mês", value: d.aulasHoje,        icon: CalendarCheck, color: "text-green-600",   bg: "bg-green-50"     },
    { title: "Ag. Pendentes",  value: d.pendentes,        icon: Clock,         color: "text-orange-500",  bg: "bg-orange-50",   alert: d.pendentes > 0 },
    { title: "Receita Total",  value: brl(d.receitaTotal),icon: TrendingUp,    color: "text-green-600",   bg: "bg-green-50"     },
    { title: "A Receber",      value: brl(d.aReceber),    icon: DollarSign,    color: "text-primary",     bg: "bg-primary/10"   },
  ]

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="animate-fade-up flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl text-foreground">
            {saudacao}, {session?.user?.name?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        {d.pendentes > 0 && (
          <LinkButton href="/admin/agenda" variant="outline" size="sm">
            <AlertCircle className="w-4 h-4 mr-2 text-orange-500" />
            {d.pendentes} pendente{d.pendentes > 1 ? "s" : ""}
            <ArrowRight className="w-3 h-3 ml-1" />
          </LinkButton>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(({ title, value, icon: Icon, color, bg, alert }, i) => (
          <Card key={title} className="card-lift animate-fade-up"
            style={{ "--delay": `${i * 60}ms` } as React.CSSProperties}>
            <CardContent className="p-5 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{title}</p>
                <p className="text-xl font-bold font-sub mt-1">{value}</p>
              </div>
              <div className={`${bg} p-2.5 rounded-xl shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </CardContent>
            {alert && <div className="px-5 pb-3"><Badge variant="destructive" className="text-xs">Requer atenção</Badge></div>}
          </Card>
        ))}
      </div>

      {/* Gráficos principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="animate-scale-in" style={{ "--delay": "120ms" } as React.CSSProperties}>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> Receita — Últimos 6 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.receitaMes.some((r) => r.value > 0)
              ? <SimpleAreaChart data={d.receitaMes} valuePrefix="R$ " height={200} />
              : <EmptyChart label="Nenhum pagamento registrado ainda" />
            }
          </CardContent>
        </Card>

        <Card className="animate-scale-in" style={{ "--delay": "180ms" } as React.CSSProperties}>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-primary" /> Aulas — Últimos 6 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.aulasMes.some((r) => r.value > 0)
              ? <SimpleBarChart data={d.aulasMes} color="#219EBC" height={200} />
              : <EmptyChart label="Nenhuma aula registrada ainda" />
            }
          </CardContent>
        </Card>
      </div>

      {/* Status das aulas + distribuição de usuários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="animate-scale-in" style={{ "--delay": "240ms" } as React.CSSProperties}>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Status das Aulas (Mês Atual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.lessonStatus.length > 0
              ? <DonutChart data={d.lessonStatus} height={220} />
              : <EmptyChart label="Nenhuma aula agendada este mês" />
            }
          </CardContent>
        </Card>

        <Card className="animate-scale-in" style={{ "--delay": "300ms" } as React.CSSProperties}>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Distribuição de Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              height={220}
              data={[
                { label: "Alunos",       value: d.totalAlunos,        color: "#FB8500" },
                { label: "Professores",  value: d.totalProfessores,   color: "#219EBC" },
                { label: "Colaboradores",value: d.totalColaboradores, color: "#8b5cf6" },
              ].filter((d) => d.value > 0)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-center gap-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/60">Os gráficos aparecerão conforme os dados forem cadastrados</p>
    </div>
  )
}
