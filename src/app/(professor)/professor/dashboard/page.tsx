import { auth }   from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }  from "@/components/ui/badge"
import { LinkButton } from "@/components/shared/link-button"
import { SimpleBarChart }  from "@/components/charts/bar-chart"
import { DonutChart }      from "@/components/charts/donut-chart"
import { CalendarCheck, GraduationCap, Wallet, Star, Clock, ArrowRight } from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

export default async function ProfessorDashboard() {
  const session = await auth()
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session?.user?.email ?? "" } },
  })

  if (!teacher) return <div className="p-8 text-muted-foreground">Perfil de professor não encontrado.</div>

  const now    = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM", { locale: ptBR }) }
  })

  const [lessons, requests, payout] = await Promise.all([
    prisma.lesson.findMany({
      where:   { teacherId: teacher.id },
      include: { participants: { include: { student: { include: { user: true } } } }, subject: true },
      orderBy: { scheduledAt: "desc" },
      take:    100,
    }),
    prisma.lessonRequest.count({ where: { teacherId: teacher.id, status: "PENDING" } }),
    prisma.teacherPayout.findMany({
      where:   { teacherId: teacher.id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take:    1,
    }),
  ])

  const rate          = Number(teacher.hourlyRate)
  const aulasDoMes    = lessons.filter((l) => l.scheduledAt >= startOfMonth(now) && l.status === "COMPLETED").length
  const allStudentIds = lessons.flatMap((l) => l.participants.map((p) => p.studentId))
  const totalAlunos   = new Set(allStudentIds).size
  const projecaoMes   = aulasDoMes * rate
  const avgRating     = lessons.filter((l) => l.studentRating).length > 0
    ? (lessons.filter((l) => l.studentRating).reduce((s, l) => s + (l.studentRating ?? 0), 0) / lessons.filter((l) => l.studentRating).length).toFixed(1)
    : "–"

  // Aulas por mês
  const aulasMes = months.map(({ start, end, label }) => ({
    label,
    value: lessons.filter((l) => l.status === "COMPLETED" && l.scheduledAt >= start && l.scheduledAt <= end).length,
  }))

  // Status das aulas
  const lessonStatus = [
    { label: "Realizadas",  value: lessons.filter((l) => l.status === "COMPLETED").length,  color: "#FB8500" },
    { label: "Confirmadas", value: lessons.filter((l) => l.status === "CONFIRMED").length,  color: "#219EBC" },
    { label: "Canceladas",  value: lessons.filter((l) => l.status === "CANCELLED").length,  color: "#ef4444" },
    { label: "Faltou",      value: lessons.filter((l) => l.status === "MISSED").length,     color: "#f97316" },
  ].filter((d) => d.value > 0)

  // Próximas aulas
  const proximas = lessons.filter((l) => ["SCHEDULED","CONFIRMED"].includes(l.status) && l.scheduledAt >= now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, 4)

  const hora     = new Date().getHours()
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl">{saudacao}, {session?.user?.name?.split(" ")[0]}!</h1>
          <p className="text-muted-foreground text-sm mt-1">{format(new Date(), "EEEE, dd/MM/yyyy", { locale: ptBR })}</p>
        </div>
        {requests > 0 && (
          <LinkButton href="/professor/agenda" variant="outline" size="sm">
            <Clock className="w-4 h-4 mr-2 text-orange-500" />
            {requests} solicitação{requests > 1 ? "ões" : ""} pendente{requests > 1 ? "s" : ""}
            <ArrowRight className="w-3 h-3 ml-1" />
          </LinkButton>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Aulas Realizadas (Mês)", value: aulasDoMes,         icon: CalendarCheck, color: "text-primary",    bg: "bg-primary/10"   },
          { title: "Meus Alunos",            value: totalAlunos,        icon: GraduationCap, color: "text-secondary",  bg: "bg-secondary/10" },
          { title: "Projeção do Mês",        value: brl(projecaoMes),   icon: Wallet,        color: "text-green-600",  bg: "bg-green-50"     },
          { title: "Avaliação Média",        value: `${avgRating}★`,    icon: Star,          color: "text-yellow-500", bg: "bg-yellow-50"    },
        ].map(({ title, value, icon: Icon, color, bg }, i) => (
          <Card key={title} className="card-lift animate-fade-up"
            style={{ "--delay": `${i * 60}ms` } as React.CSSProperties}>
            <CardContent className="p-5 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
                <p className="text-xl font-bold mt-1">{value}</p>
              </div>
              <div className={`${bg} p-2.5 rounded-xl shrink-0`}><Icon className={`w-5 h-5 ${color}`} /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aulas por mês */}
        <Card className="animate-scale-in" style={{ "--delay": "120ms" } as React.CSSProperties}>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-primary" /> Aulas Realizadas — 6 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aulasMes.some((r) => r.value > 0)
              ? <SimpleBarChart data={aulasMes} color="#FB8500" height={200} />
              : <p className="text-sm text-muted-foreground text-center py-16">Nenhuma aula realizada ainda</p>
            }
          </CardContent>
        </Card>

        {/* Status geral */}
        <Card className="animate-scale-in" style={{ "--delay": "180ms" } as React.CSSProperties}>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" /> Status das Aulas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lessonStatus.length > 0
              ? <DonutChart data={lessonStatus} height={220} />
              : <p className="text-sm text-muted-foreground text-center py-16">Nenhuma aula registrada ainda</p>
            }
          </CardContent>
        </Card>
      </div>

      {/* Próximas aulas */}
      {proximas.length > 0 && (
        <Card className="animate-fade-up" style={{ "--delay": "240ms" } as React.CSSProperties}>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-primary" /> Próximas Aulas
              </span>
              <LinkButton href="/professor/agenda" variant="ghost" size="sm">Ver todas <ArrowRight className="w-3 h-3 ml-1" /></LinkButton>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proximas.map((l, i) => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border border-border
                transition-colors duration-150 hover:bg-muted/40"
                style={{ animationDelay: `${260 + i * 40}ms` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-12 text-center">
                    <p className="text-base font-bold text-primary">{format(l.scheduledAt, "dd")}</p>
                    <p className="text-xs text-muted-foreground">{format(l.scheduledAt, "HH:mm")}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.participants[0]?.student.user?.name ?? "Aluno"}</p>
                    <p className="text-xs text-muted-foreground">{l.subject.name}</p>
                  </div>
                </div>
                <Badge variant={l.status === "CONFIRMED" ? "default" : "secondary"}>
                  {l.status === "CONFIRMED" ? "Confirmada" : "Agendada"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
