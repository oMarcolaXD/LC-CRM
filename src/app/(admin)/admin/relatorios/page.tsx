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

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }

async function getReportData() {
  const now    = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM/yy", { locale: ptBR }) }
  })

  const [lessons, payments, students, teachers, subjects] = await Promise.all([
    prisma.lesson.findMany({
      include: { teacher: { include: { user: true } }, subject: true, student: { include: { user: true } } },
    }),
    prisma.payment.findMany(),
    prisma.student.findMany({ include: { user: true, lessons: true } }),
    prisma.teacher.findMany({
      include: { user: true, lessons: { where: { status: "COMPLETED" } } },
    }),
    prisma.subject.findMany({ include: { lessons: true } }),
  ])

  // ─── Financeiro ──────────────────────────────────────────────────────────────
  const receitaMeses = months.map(({ start, end, label }) => ({
    label,
    value: payments
      .filter((p) => p.status === "PAID" && p.paidAt && p.paidAt >= start && p.paidAt <= end)
      .reduce((s, p) => s + Number(p.amount), 0),
  }))

  const receitaTotal  = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0)
  const aReceber      = payments.filter((p) => p.status === "PENDING").reduce((s, p) => s + Number(p.amount), 0)
  const inadimplencia = payments.filter((p) => p.status === "OVERDUE").reduce((s, p) => s + Number(p.amount), 0)
  const taxaAdimplencia = payments.length > 0
    ? Math.round(payments.filter((p) => p.status === "PAID").length / payments.length * 100)
    : 0

  // ─── Aulas ──────────────────────────────────────────────────────────────────
  const aulasMeses = months.map(({ start, end, label }) => ({
    label,
    value: lessons.filter((l) => l.scheduledAt >= start && l.scheduledAt <= end).length,
  }))

  const aulasRealizadas = lessons.filter((l) => l.status === "COMPLETED").length
  const aulasCanceladas = lessons.filter((l) => l.status === "CANCELLED").length
  const aulasFaltou     = lessons.filter((l) => l.status === "MISSED").length
  const taxaConclusao   = lessons.length > 0 ? Math.round(aulasRealizadas / lessons.length * 100) : 0

  const statusAulas = [
    { label: "Realizadas",  value: aulasRealizadas,                                          color: "#FB8500" },
    { label: "Confirmadas", value: lessons.filter((l) => l.status === "CONFIRMED").length,  color: "#219EBC" },
    { label: "Agendadas",   value: lessons.filter((l) => l.status === "SCHEDULED").length,  color: "#8b5cf6" },
    { label: "Canceladas",  value: aulasCanceladas,                                          color: "#ef4444" },
    { label: "Faltou",      value: aulasFaltou,                                              color: "#f97316" },
  ].filter((d) => d.value > 0)

  // ─── Por matéria ─────────────────────────────────────────────────────────────
  const COLORS = ["#FB8500","#219EBC","#8b5cf6","#ef4444","#f97316","#10b981","#3b82f6","#ec4899"]
  const materiaData = subjects
    .map((s, i) => ({
      label: s.name,
      value: s.lessons.filter((l) => l.status === "COMPLETED").length,
      color: COLORS[i % COLORS.length],
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  // ─── Top professores ─────────────────────────────────────────────────────────
  const topProfessores = teachers
    .map((t) => ({
      label: t.user.name.split(" ")[0],
      value: t.lessons.length,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  // ─── Avaliações ──────────────────────────────────────────────────────────────
  const avaliadas   = lessons.filter((l) => l.studentRating)
  const avgRating   = avaliadas.length > 0
    ? (avaliadas.reduce((s, l) => s + (l.studentRating ?? 0), 0) / avaliadas.length).toFixed(1)
    : "–"
  const ratingDist  = [1,2,3,4,5].map((star) => ({
    label: `${star}★`,
    value: avaliadas.filter((l) => l.studentRating === star).length,
    color: star >= 4 ? "#FB8500" : star === 3 ? "#f97316" : "#ef4444",
  }))

  // ─── Top alunos (mais aulas) ──────────────────────────────────────────────────
  const topAlunos = students
    .map((s) => ({
      name:  s.user.name,
      aulas: s.lessons.filter((l) => l.status === "COMPLETED").length,
    }))
    .sort((a, b) => b.aulas - a.aulas)
    .slice(0, 5)

  return {
    receitaMeses, receitaTotal, aReceber, inadimplencia, taxaAdimplencia,
    aulasMeses, aulasRealizadas, aulasCanceladas, aulasFaltou, taxaConclusao, statusAulas,
    materiaData, topProfessores, avgRating, ratingDist, topAlunos,
    totalLessons: lessons.length, totalStudents: students.length, totalTeachers: teachers.length,
  }
}

export default async function RelatoriosPage() {
  const d = await getReportData()

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
                    <div key={a.name} className="flex items-center gap-3">
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
    <div className="h-[180px] flex flex-col items-center justify-center text-center gap-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/60">Os dados aparecerão conforme o sistema for utilizado</p>
    </div>
  )
}
