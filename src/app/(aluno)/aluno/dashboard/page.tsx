import { auth }   from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }  from "@/components/ui/badge"
import { LinkButton } from "@/components/shared/link-button"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { DonutChart }     from "@/components/charts/donut-chart"
import { BookOpen, CalendarDays, PenLine, FolderOpen, Star, TrendingUp, ArrowRight } from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

export default async function AlunoDashboard() {
  const session = await auth()
  const student = await prisma.student.findFirst({
    where:   { user: { email: session?.user?.email ?? "" } },
    include: { packages: { where: { status: "ACTIVE" } } },
  })

  const now    = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM", { locale: ptBR }) }
  })

  const [lessons, homework, materials] = await Promise.all([
    student ? prisma.lesson.findMany({
      where:   { studentId: student.id },
      include: { subject: true },
      orderBy: { scheduledAt: "desc" },
      take:    100,
    }) : [],
    student ? prisma.homework.count({
      where: { lesson: { studentId: student.id }, status: "PENDING" },
    }) : 0,
    student ? prisma.material.count({ where: { studentId: student.id } }) : 0,
  ])

  const saldo      = student?.packages.reduce((s, p) => s + p.remainingLessons, 0) ?? 0
  const realizadas = lessons.filter((l) => l.status === "COMPLETED").length
  const proximas   = lessons.filter((l) => ["SCHEDULED","CONFIRMED"].includes(l.status) && l.scheduledAt >= now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, 3)
  const avgRating  = lessons.filter((l) => l.studentRating).length > 0
    ? (lessons.filter((l) => l.studentRating).reduce((s, l) => s + (l.studentRating ?? 0), 0) / lessons.filter((l) => l.studentRating).length).toFixed(1)
    : null

  // Aulas por mês
  const aulasMes = months.map(({ start, end, label }) => ({
    label,
    value: lessons.filter((l) => l.status === "COMPLETED" && l.scheduledAt >= start && l.scheduledAt <= end).length,
  }))

  // Aulas por matéria
  const subjectMap: Record<string, { name: string; count: number }> = {}
  lessons.filter((l) => l.status === "COMPLETED").forEach((l) => {
    if (!subjectMap[l.subjectId]) subjectMap[l.subjectId] = { name: l.subject.name, count: 0 }
    subjectMap[l.subjectId].count++
  })
  const COLORS = ["#FB8500","#219EBC","#8b5cf6","#ef4444","#f97316","#10b981","#3b82f6"]
  const materias = Object.values(subjectMap)
    .sort((a, b) => b.count - a.count)
    .map((s, i) => ({ label: s.name, value: s.count, color: COLORS[i % COLORS.length] }))

  const hora     = new Date().getHours()
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">{saudacao}, {session?.user?.name?.split(" ")[0]}!</h1>
        <p className="text-muted-foreground text-sm mt-1">{format(now, "EEEE, dd/MM/yyyy", { locale: ptBR })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`card-lift animate-fade-up ${saldo <= 2 && saldo > 0 ? "border-orange-300" : ""}`}
          style={{ "--delay": "0ms" } as React.CSSProperties}>
          <CardContent className="p-5 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo de Aulas</p>
              <p className="text-xl font-bold mt-1">{saldo}</p>
              {saldo === 0 && <Badge variant="destructive" className="text-xs mt-1">Esgotado</Badge>}
              {saldo > 0 && saldo <= 2 && <Badge variant="secondary" className="text-xs mt-1 text-orange-600">Baixo</Badge>}
            </div>
            <div className="bg-primary/10 p-2.5 rounded-xl shrink-0"><BookOpen className="w-5 h-5 text-primary" /></div>
          </CardContent>
        </Card>
        {[
          { title: "Aulas Realizadas", value: realizadas,     icon: TrendingUp,  color: "text-green-600",   bg: "bg-green-50"   },
          { title: "Lições Pendentes", value: homework,       icon: PenLine,     color: "text-orange-500",  bg: "bg-orange-50"  },
          { title: "Materiais",        value: materials,      icon: FolderOpen,  color: "text-secondary",   bg: "bg-secondary/10"},
        ].map(({ title, value, icon: Icon, color, bg }, i) => (
          <Card key={title} className="card-lift animate-fade-up"
            style={{ "--delay": `${(i + 1) * 60}ms` } as React.CSSProperties}>
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
        {/* Frequência */}
        <Card className="animate-scale-in" style={{ "--delay": "120ms" } as React.CSSProperties}>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Frequência — Últimos 6 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aulasMes.some((r) => r.value > 0)
              ? <SimpleBarChart data={aulasMes} color="#FB8500" height={200} />
              : <p className="text-sm text-muted-foreground text-center py-16">Nenhuma aula realizada ainda</p>
            }
          </CardContent>
        </Card>

        {/* Matérias */}
        <Card className="animate-scale-in" style={{ "--delay": "180ms" } as React.CSSProperties}>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> Aulas por Matéria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {materias.length > 0
              ? <DonutChart data={materias} height={220} />
              : <p className="text-sm text-muted-foreground text-center py-16">Nenhuma aula realizada ainda</p>
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
                <CalendarDays className="w-4 h-4 text-primary" /> Próximas Aulas
              </span>
              <LinkButton href="/aluno/aulas" variant="ghost" size="sm">
                Ver todas <ArrowRight className="w-3 h-3 ml-1" />
              </LinkButton>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proximas.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border border-border
                transition-colors duration-150 hover:bg-muted/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 text-center shrink-0">
                    <p className="text-base font-bold text-primary">{format(l.scheduledAt, "dd")}</p>
                    <p className="text-xs text-muted-foreground">{format(l.scheduledAt, "HH:mm")}</p>
                  </div>
                  <p className="text-sm font-medium">{l.subject.name}</p>
                </div>
                <Badge variant={l.status === "CONFIRMED" ? "default" : "secondary"}>
                  {l.status === "CONFIRMED" ? "Confirmada" : "Agendada"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Avaliação média */}
      {avgRating && (
        <Card className="animate-fade-up" style={{ "--delay": "300ms" } as React.CSSProperties}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-yellow-50 flex items-center justify-center shrink-0">
              <Star className="w-7 h-7 text-yellow-500 fill-yellow-400" />
            </div>
            <div>
              <p className="font-sub font-semibold">Sua avaliação média</p>
              <p className="text-3xl font-bold text-yellow-500">{avgRating}<span className="text-base font-normal text-muted-foreground">/5</span></p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
