import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }       from "@/components/ui/badge"
import { LessonActions } from "./lesson-actions"
import { CalendarDays, BookOpen, UserRound } from "lucide-react"
import { format }      from "date-fns"
import { ptBR }        from "date-fns/locale"

const STATUS_CFG = {
  SCHEDULED:  { label: "Agendada",   variant: "secondary"   as const },
  CONFIRMED:  { label: "Confirmada", variant: "default"     as const },
  COMPLETED:  { label: "Realizada",  variant: "outline"     as const },
  CANCELLED:  { label: "Cancelada",  variant: "destructive" as const },
  MISSED:     { label: "Faltou",     variant: "destructive" as const },
}

function BalanceBadge({ remaining }: { remaining: number }) {
  const color =
    remaining > 4 ? "bg-green-100 text-green-700 border-green-200" :
    remaining > 1 ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                    "bg-red-100 text-red-700 border-red-200"
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${color}`}>
      <BookOpen className="w-3 h-3" />
      {remaining} aula{remaining !== 1 ? "s" : ""}
    </span>
  )
}

export default async function ColaboradorAgendaPage() {
  const lessons = await prisma.lesson.findMany({
    where:   { scheduledAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    include: {
      student: {
        include: {
          user:     true,
          guardian: { include: { user: true } },
          packages: {
            where:   { status: { in: ["ACTIVE", "EXHAUSTED"] } },
            orderBy: { purchaseDate: "desc" },
            take:    1,
          },
        },
      },
      teacher: { include: { user: true } },
      subject: true,
    },
    orderBy: { scheduledAt: "asc" },
    take:    100,
  })

  const upcoming = lessons.filter((l) => l.scheduledAt >= new Date())
  const past     = lessons.filter((l) => l.scheduledAt <  new Date())

  function LessonRow({ lesson }: { lesson: typeof lessons[number] }) {
    const pkg       = lesson.student.packages[0]
    const remaining = pkg ? pkg.remainingLessons : 0
    const cfg       = STATUS_CFG[lesson.status]
    const guardian  = lesson.student.guardian

    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border">
        <div className="flex gap-3 min-w-0 flex-1">
          <div className="shrink-0 text-center w-12">
            <p className="text-base font-bold text-primary leading-tight">
              {format(lesson.scheduledAt, "dd/MM")}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(lesson.scheduledAt, "HH:mm")}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{lesson.student.user.name}</p>
              <BalanceBadge remaining={remaining} />
            </div>
            {guardian && (
              <div className="flex items-center gap-1">
                <UserRound className="w-3 h-3 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">Resp.: {guardian.user.name}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground truncate">
              {lesson.subject.name} · Prof. {lesson.teacher.user.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:flex-col sm:items-end">
          <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
          <LessonActions lessonId={lesson.id} status={lesson.status} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AGENDA"
        description="Gerencie aulas e envie confirmações"
      />

      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Próximas Aulas
              <Badge variant="secondary">{upcoming.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((l) => <LessonRow key={l.id} lesson={l} />)}
          </CardContent>
        </Card>
      )}

      {past.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              Últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {past.map((l) => <LessonRow key={l.id} lesson={l} />)}
          </CardContent>
        </Card>
      )}

      {lessons.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma aula no período</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
