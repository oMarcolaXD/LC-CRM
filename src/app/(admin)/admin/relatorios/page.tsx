import { prisma }         from "@/lib/prisma"
import { PageHeader }     from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SimpleAreaChart } from "@/components/charts/area-chart"
import { SimpleBarChart }  from "@/components/charts/bar-chart"
import { DonutChart }      from "@/components/charts/donut-chart"
import {
  TrendingUp, BookOpen, Users, GraduationCap,
  Star, DollarSign, AlertCircle, CheckCircle2,
} from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

export const dynamic = "force-dynamic"

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

async function getReportData() {
  const now    = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM/yy", { locale: ptBR }) }
  })

  const COLORS = ["#FB8500","#219EBC","#8b5cf6","#ef4444","#f97316","#10b981","#3b82f6","#ec4899"]

  // Batch 1: groupBy reduz 11 queries individuais para 2 + demais lookups
  const [
    paymentGroups,
    lessonGroups,
    totalStudents, totalTeachers,
    subjects, teachers, topAlunosRaw, ratingData,
  ] = await Promise.all([
    prisma.payment.groupBy({ by: ["status"], _sum: { amount: true }, _count: { _all: true } }),
    prisma.lesson.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.subject.findMany({
      select: { name: true, _count: { select: { lessons: { where: { status: "COMPLETED" } } } } },
    }),
    prisma.teacher.findMany({
      select: {
        user:   { select: { name: true } },
        _count: { select: { lessons: { where: { status: "COMPLETED" } } } },
      },
      orderBy: { lessons: { _count: "desc" } },
      take: 6,
    }),
    prisma.student.findMany({
      select: {
        name:   true,
        _count: { select: { participations: { where: { lesson: { status: "COMPLETED" } } } } },
      },
      orderBy: { participations: { _count: "desc" } },
      take: 5,
    }),
    prisma.lesson.aggregate({
      where: { studentRating: { not: null } },
      _avg:  { studentRating: true },
    }),
  ])

  // Extrai stats de pagamento do groupBy
  const receitaTotal    = Number(paymentGroups.find(g => g.status === "PAID")?._sum.amount ?? 0)
  const aReceber        = Number(paymentGroups.find(g => g.status === "PENDING")?._sum.amount ?? 0)
  const inadimplencia   = Number(paymentGroups.find(g => g.status === "OVERDUE")?._sum.amount ?? 0)
  const totalPagamentos = paymentGroups.reduce((acc, g) => acc + g._count._all, 0)
  const totalPagos      = paymentGroups.find(g => g.status === "PAID")?._count._all ?? 0

  // Extrai counts de aulas do groupBy
  const aulasRealizadas  = lessonGroups.find(g => g.status === "COMPLETED")?._count._all ?? 0
  const aulasCanceladas  = lessonGroups.find(g => g.status === "CANCELLED")?._count._all ?? 0
  const aulasFaltou      = lessonGroups.find(g => g.status === "MISSED")?._count._all    ?? 0
  const aulasConfirmadas = lessonGroups.find(g => g.status === "CONFIRMED")?._count._all ?? 0
  const aulasAgendadas   = lessonGroups.find(g => g.status === "SCHEDULED")?._count._all ?? 0
  const totalLessons     = lessonGroups.reduce((acc, g) => acc + g._count._all, 0)

  // Batch 2: dados mensais — 2 queries SQL em vez de 24 (12 meses × 2 tabelas)
  const startDate = months[0].start
  const endDate   = months[11].end

  const [paymentMonthly, lessonMonthly] = await Promise.all([
    prisma.$queryRaw<{ month: Date; total: number }[]>`
      SELECT DATE_TRUNC('month', "paidAt") AS month,
             COALESCE(SUM(amount), 0)::float8 AS total
      FROM payments
      WHERE status = 'PAID'
        AND "paidAt" >= ${startDate} AND "paidAt" <= ${endDate}
      GROUP BY DATE_TRUNC('month', "paidAt")
    `,
    prisma.$queryRaw<{ month: Date; total: bigint }[]>`
      SELECT DATE_TRUNC('month', "scheduledAt") AS month,
             COUNT(*)::bigint AS total
      FROM lessons
      WHERE "scheduledAt" >= ${startDate} AND "scheduledAt" <= ${endDate}
      GROUP BY DATE_TRUNC('month', "scheduledAt")
    `,
  ])

  const receitaMeses = months.map(({ start, label }) => ({
    label,
    value: paymentMonthly.find(r => {
      const d = new Date(r.month)
      return d.getFullYear() === start.getFullYear() && d.getMonth() === start.getMonth()
    })?.total ?? 0,
  }))

  const aulasMeses = months.map(({ start, label }) => ({
    label,
    value: Number(lessonMonthly.find(r => {
      const d = new Date(r.month)
      return d.getFullYear() === start.getFullYear() && d.getMonth() === start.getMonth()
    })?.total ?? 0),
  }))

  // Batch 3: distribuição de notas — 1 groupBy em vez de 5 counts
  const ratingGroupsRaw = await prisma.lesson.groupBy({
    by: ["studentRating"],
    _count: { _all: true },
    where: { studentRating: { not: null } },
  })
  const ratingDist = [1, 2, 3, 4, 5].map((star) => ({
    label: `${star}★`,
    value: ratingGroupsRaw.find(g => g.studentRating === star)?._count._all ?? 0,
    color: star >= 4 ? "#FB8500" : star === 3 ? "#f97316" : "#ef4444",
  }))

  const taxaAdimplencia = totalPagamentos > 0 ? Math.round(totalPagos / totalPagamentos * 100) : 0
  const taxaConclusao   = totalLessons > 0 ? Math.round(aulasRealizadas / totalLessons * 100) : 0
  const avgRating       = ratingData._avg.studentRating ? Number(ratingData._avg.studentRating).toFixed(1) : "–"

  const statusAulas = [
    { label: "Realizadas",  value: aulasRealizadas,  color: "#FB8500" },
    { label: "Confirmadas", value: aulasConfirmadas, color: "#219EBC" },
    { label: "Agendadas",   value: aulasAgendadas,   color: "#8b5cf6" },
    { label: "Canceladas",  value: aulasCanceladas,  color: "#ef4444" },
    { label: "Faltou",      value: aulasFaltou,       color: "#f97316" },
  ].filter((d) => d.value > 0)

  const materiaData = subjects
    .map((s, i) => ({ label: s.name, value: s._count.lessons, color: COLORS[i % COLORS.length] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const topProfessores = teachers.map((t) => ({
    label: (t.user.name ?? "Prof").split(" ")[0],
    value: t._count.lessons,
  }))

  const topAlunos = (topAlunosRaw as { name: string; _count: { participations: number } }[]).map((s) => ({
    name:  s.name ?? "Aluno",
    aulas: s._count.participations,
  }))

  return {
    receitaMeses,
    receitaTotal,
    aReceber,
    inadimplencia,
    taxaAdimplencia,
    aulasMeses, aulasRealizadas, aulasCanceladas, aulasFaltou, taxaConclusao, statusAulas,
    materiaData, topProfessores, avgRating, ratingDist, topAlunos,
    totalLessons, totalStudents, totalTeachers,
  }
}

export default async function RelatoriosPage() {
  const d = await getReportData().catch((err) => {
    console.error("[relatorios] getReportData error:", err)
    throw err
  })

  return (
    <div className="space-y-8">
      <PageHeader title="RELATÓRIOS" description="Visão analítica completa do negócio" />

      {/* ─── Resumo Executivo ──────────────────────────────────────────────── */}
      <section className="animate-fade-in" style={{ "--delay": "50ms" } as React.CSSProperties}>
        <h2 className="font-sub font-semibold text-base text-muted-foreground uppercase tracking-wide mb-3">
          Resumo Executivo
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Receita Total",     value: brl(d.receitaTotal),    icon: TrendingUp,    color: "text-green-600",   bg: "bg-green-50"    },
            { title: "A Receber",         value: brl(d.aReceber),        icon: DollarSign,    color: "text-primary",     bg: "bg-primary/10"  },
            { title: "Inadimplência",     value: brl(d.inadimplencia),   icon: AlertCircle,   color: "text-destructive", bg: "bg-destructive/10" },
            { title: "Taxa de Adimplência",value:`${d.taxaAdimplencia}%`,icon: CheckCircle2,  color: "text-green-600",   bg: "bg-green-50"    },
            { title: "Total de Aulas",    value: d.totalLessons,         icon: BookOpen,      color: "text-secondary",   bg: "bg-secondary/10"},
            { title: "Taxa de Conclusão", value: `${d.taxaConclusao}%`,  icon: CheckCircle2,  color: "text-primary",     bg: "bg-primary/10"  },
            { title: "Alunos Cadastrados",value: d.totalStudents,        icon: GraduationCap, color: "text-purple-600",  bg: "bg-purple-50"   },
            { title: "Avaliação Média",   value: `${d.avgRating}★`,      icon: Star,          color: "text-yellow-500",  bg: "bg-yellow-50"   },
          ].map(({ title, value, icon: Icon, color, bg }, i) => (
            <Card key={title} className="card-lift animate-fade-up"
              style={{ "--delay": `${i * 55}ms` } as React.CSSProperties}>
              <CardContent className="p-4 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
                  <p className="text-lg font-bold mt-1">{value}</p>
                </div>
                <div className={`${bg} p-2 rounded-xl shrink-0`}><Icon className={`w-4 h-4 ${color}`} /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── Financeiro ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-sub font-semibold text-base text-muted-foreground uppercase tracking-wide mb-3">
          Financeiro — Últimos 12 Meses
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-sub text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Evolução da Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.receitaMeses.some((r) => r.value > 0)
              ? <SimpleAreaChart data={d.receitaMeses} valuePrefix="R$ " height={220} />
              : <EmptyChart label="Nenhum pagamento registrado" />
            }
          </CardContent>
        </Card>
      </section>

      {/* ─── Aulas ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-sub font-semibold text-base text-muted-foreground uppercase tracking-wide mb-3">
          Aulas — Últimos 12 Meses
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-sub text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Volume de Aulas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.aulasMeses.some((r) => r.value > 0)
                ? <SimpleBarChart data={d.aulasMeses} color="#219EBC" height={220} />
                : <EmptyChart label="Nenhuma aula registrada" />
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-sub text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Status das Aulas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.statusAulas.length > 0
                ? <DonutChart data={d.statusAulas} height={220} />
                : <EmptyChart label="Nenhuma aula registrada" />
              }
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── Matérias e Professores ───────────────────────────────────────── */}
      <section>
        <h2 className="font-sub font-semibold text-base text-muted-foreground uppercase tracking-wide mb-3">
          Matérias e Professores
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-sub text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Aulas por Matéria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.materiaData.length > 0
                ? <DonutChart data={d.materiaData} height={240} />
                : <EmptyChart label="Nenhuma aula realizada" />
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-sub text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Top Professores (aulas realizadas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.topProfessores.some((r) => r.value > 0)
                ? <SimpleBarChart data={d.topProfessores} color="#FB8500" height={240} horizontal />
                : <EmptyChart label="Nenhuma aula realizada" />
              }
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── Avaliações ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-sub font-semibold text-base text-muted-foreground uppercase tracking-wide mb-3">
          Avaliações dos Alunos
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-sub text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" /> Distribuição de Notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.ratingDist.some((r) => r.value > 0)
                ? <SimpleBarChart data={d.ratingDist} height={200} />
                : <EmptyChart label="Nenhuma avaliação registrada" />
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-sub text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" /> Top Alunos (mais aulas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.topAlunos.some((a) => a.aulas > 0) ? (
                <div className="space-y-3">
                  {d.topAlunos.map((a, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium truncate">{a.name}</p>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{a.aulas} aula{a.aulas !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${d.topAlunos[0].aulas > 0 ? Math.round(a.aulas / d.topAlunos[0].aulas * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyChart label="Nenhuma aula realizada ainda" />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-45 flex flex-col items-center justify-center text-center gap-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/60">Os dados aparecerão conforme o sistema for utilizado</p>
    </div>
  )
}
