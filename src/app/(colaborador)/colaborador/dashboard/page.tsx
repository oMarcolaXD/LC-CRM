import { auth }   from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }  from "@/components/ui/badge"
import { LinkButton } from "@/components/shared/link-button"
import { RequestCard } from "@/components/shared/request-card"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { GraduationCap, CalendarCheck, Clock, Users, ArrowRight, AlertCircle } from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

export default async function ColaboradorDashboard() {
  const session = await auth()
  const now     = new Date()

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM", { locale: ptBR }) }
  })

  const [totalAlunos, totalProfessores, requests, allLessons] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.lessonRequest.findMany({
      where:   { status: "PENDING" },
      include: {
        student: { include: { user: true } },
        teacher: { include: { user: true } },
        subject: true,
      },
      orderBy: { requestedAt: "asc" },
      take:    5,
    }),
    prisma.lesson.findMany({
      select: { status: true, scheduledAt: true },
      take:   200,
    }),
  ])

  const aulasMes = months.map(({ start, end, label }) => ({
    label,
    value: allLessons.filter((l) => l.scheduledAt >= start && l.scheduledAt <= end).length,
  }))

  const aulasHoje = allLessons.filter((l) => {
    const d = l.scheduledAt
    return d >= startOfMonth(now) && d <= endOfMonth(now) && ["SCHEDULED","CONFIRMED"].includes(l.status)
  }).length

  const hora     = new Date().getHours()
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl">{saudacao}, {session?.user?.name?.split(" ")[0]}!</h1>
          <p className="text-muted-foreground text-sm mt-1">{format(now, "EEEE, dd/MM/yyyy", { locale: ptBR })}</p>
        </div>
        {requests.length > 0 && (
          <LinkButton href="/colaborador/agendamentos" variant="outline" size="sm">
            <AlertCircle className="w-4 h-4 mr-2 text-orange-500" />
            {requests.length} pendente{requests.length > 1 ? "s" : ""}
            <ArrowRight className="w-3 h-3 ml-1" />
          </LinkButton>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Alunos Ativos",   value: totalAlunos,    icon: GraduationCap, color: "text-primary",    bg: "bg-primary/10"   },
          { title: "Professores",     value: totalProfessores,icon: Users,         color: "text-secondary",  bg: "bg-secondary/10" },
          { title: "Aulas este mês",  value: aulasHoje,      icon: CalendarCheck, color: "text-green-600",  bg: "bg-green-50"     },
          { title: "Ag. Pendentes",   value: requests.length,icon: Clock,         color: "text-orange-500", bg: "bg-orange-50",   alert: requests.length > 0 },
        ].map(({ title, value, icon: Icon, color, bg, alert }: { title: string; value: number; icon: React.ElementType; color: string; bg: string; alert?: boolean }, i: number) => (
          <Card key={title} className="card-lift animate-fade-up"
            style={{ "--delay": `${i * 60}ms` } as React.CSSProperties}>
            <CardContent className="p-5 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
                <p className="text-xl font-bold mt-1">{value}</p>
              </div>
              <div className={`${bg} p-2.5 rounded-xl shrink-0`}><Icon className={`w-5 h-5 ${color}`} /></div>
            </CardContent>
            {alert && <div className="px-5 pb-3"><Badge variant="destructive" className="text-xs">Requer atenção</Badge></div>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico de aulas */}
        <Card className="animate-scale-in" style={{ "--delay": "120ms" } as React.CSSProperties}>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-primary" /> Aulas — Últimos 6 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aulasMes.some((r) => r.value > 0)
              ? <SimpleBarChart data={aulasMes} color="#219EBC" height={200} />
              : <p className="text-sm text-muted-foreground text-center py-16">Nenhuma aula registrada ainda</p>
            }
          </CardContent>
        </Card>

        {/* Solicitações pendentes */}
        <Card className="animate-scale-in" style={{ "--delay": "180ms" } as React.CSSProperties}>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" /> Pendentes para Aprovação
              </span>
              {requests.length > 0 && (
                <LinkButton href="/colaborador/agendamentos" variant="ghost" size="sm">
                  Ver todas <ArrowRight className="w-3 h-3 ml-1" />
                </LinkButton>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarCheck className="w-8 h-8 text-green-500/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma pendência</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {requests.map((r) => (
                  <RequestCard
                    key={r.id} id={r.id}
                    studentName={r.student.user.name}
                    teacherName={r.teacher.user.name}
                    subjectName={r.subject?.name ?? "–"}
                    preferredAt={r.preferredAt}
                    notes={r.reason}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
