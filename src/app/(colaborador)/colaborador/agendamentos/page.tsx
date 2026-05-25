import { prisma }       from "@/lib/prisma"
import { PageHeader }   from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }        from "@/components/ui/badge"
import { ClipboardList, CheckCircle2 } from "lucide-react"
import { startOfWeek, startOfDay, endOfDay, isToday, isTomorrow } from "date-fns"
import { format }       from "date-fns"
import { ptBR }         from "date-fns/locale"
import { RequestsStats } from "./_components/requests-stats"
import { FilterBar }     from "./_components/filter-bar"
import { RequestsClient, type RequestGroup } from "./_components/requests-client"
import { HistoryTabs, type HistoryItem }     from "./_components/history-tabs"

interface PageProps {
  searchParams: Promise<{
    teacher?:  string
    subject?:  string
    dateFrom?: string
    dateTo?:   string
  }>
}

export default async function AgendamentosPage({ searchParams }: PageProps) {
  const { teacher, subject, dateFrom, dateTo } = await searchParams

  const now       = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 0 })

  // ── Filtro de pendentes ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingWhere: any = { status: "PENDING" }
  if (teacher)  pendingWhere.teacherId = teacher
  if (subject)  pendingWhere.subjectId = subject
  if (dateFrom || dateTo) {
    pendingWhere.preferredAt = {}
    if (dateFrom) pendingWhere.preferredAt.gte = startOfDay(new Date(dateFrom))
    if (dateTo)   pendingWhere.preferredAt.lte = endOfDay(new Date(dateTo))
  }

  // ── Queries paralelas ───────────────────────────────────────────────────────
  const [
    pending, recent,
    pendingCount, approvedThisWeek, rejectedThisWeek,
    teachers, subjects,
  ] = await Promise.all([
    prisma.lessonRequest.findMany({
      where:   pendingWhere,
      include: {
        student: {
          include: {
            user:     true,
            guardian: { include: { user: true } },
            packages: {
              where:   { status: "ACTIVE" },
              orderBy: { purchaseDate: "desc" },
              take:    1,
            },
          },
        },
        teacher: { include: { user: true } },
        subject: true,
      },
      orderBy: { preferredAt: "asc" },
    }),
    prisma.lessonRequest.findMany({
      where:   { status: { in: ["APPROVED", "REJECTED"] } },
      include: {
        student: { include: { user: true, guardian: { include: { user: true } } } },
        teacher: { include: { user: true } },
        subject: true,
      },
      orderBy: { requestedAt: "desc" },
      take:    60,
    }),
    prisma.lessonRequest.count({ where: { status: "PENDING" } }),
    prisma.lessonRequest.count({ where: { status: "APPROVED", requestedAt: { gte: weekStart } } }),
    prisma.lessonRequest.count({ where: { status: "REJECTED", requestedAt: { gte: weekStart } } }),
    prisma.teacher.findMany({
      select:  { id: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.subject.findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  // ── Detecção de conflitos (server-side) ────────────────────────────────────
  let teacherLessons: { teacherId: string; scheduledAt: Date; duration: number }[] = []

  if (pending.length > 0) {
    const allTeacherIds = [...new Set(pending.map((r) => r.teacherId))]
    const dates         = pending.map((r) => r.preferredAt)
    const minDate       = dates.reduce((a, b) => (a < b ? a : b))
    const maxDate       = dates.reduce((a, b) => (a > b ? a : b))

    teacherLessons = await prisma.lesson.findMany({
      where: {
        teacherId:   { in: allTeacherIds },
        scheduledAt: { gte: startOfDay(minDate), lte: endOfDay(maxDate) },
        status:      { in: ["CONFIRMED", "SCHEDULED"] },
      },
      select: { teacherId: true, scheduledAt: true, duration: true },
    })
  }

  // ── Enriquecer solicitações ─────────────────────────────────────────────────
  const requestsWithMeta = pending.map((r) => {
    const reqStart   = r.preferredAt.getTime()
    const reqEnd     = reqStart + 60 * 60_000

    const hasConflict = teacherLessons.some((l) => {
      if (l.teacherId !== r.teacherId) return false
      const lStart = l.scheduledAt.getTime()
      const lEnd   = lStart + (l.duration ?? 60) * 60_000
      return lStart < reqEnd && lEnd > reqStart
    })

    const pkg             = r.student.packages[0]
    const remainingLessons = pkg ? Number(pkg.remainingLessons) : null
    const packageExpired  = !pkg

    return {
      id:              r.id,
      studentId:       r.studentId,
      studentName:     r.student.name ?? "Aluno",
      teacherName:     r.teacher.user.name,
      subjectName:     r.subject?.name ?? "–",
      preferredAt:     r.preferredAt,
      notes:           r.reason,
      teacherMode:     r.teacher.teachingMode as "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID",
      requestModality: r.modality as "PRESENCIAL" | "ONLINE",
      isGroupRequest:  r.isGroupRequest,
      groupNote:       r.groupNote,
      remainingLessons,
      packageExpired,
      hasConflict,
      outOfSchedule:   false,
    }
  })

  // ── Agrupar por data de preferredAt ────────────────────────────────────────
  const groupMap = new Map<string, typeof requestsWithMeta>()
  for (const r of requestsWithMeta) {
    const dateKey = format(r.preferredAt, "yyyy-MM-dd")
    if (!groupMap.has(dateKey)) groupMap.set(dateKey, [])
    groupMap.get(dateKey)!.push(r)
  }

  const groups: RequestGroup[] = Array.from(groupMap.entries()).map(([dateKey, requests]) => {
    // Usar meio-dia para evitar problemas de fuso
    const date = new Date(`${dateKey}T12:00:00`)
    let label: string
    if (isToday(date))          label = `Hoje, ${format(date, "EEEE, dd/MM", { locale: ptBR })}`
    else if (isTomorrow(date))  label = `Amanhã, ${format(date, "EEEE, dd/MM", { locale: ptBR })}`
    else                        label = format(date, "EEEE, dd/MM/yyyy", { locale: ptBR })
    label = label.charAt(0).toUpperCase() + label.slice(1)
    return { label, dateKey, requests }
  })

  // ── Histórico ───────────────────────────────────────────────────────────────
  const historyItems: HistoryItem[] = recent.map((r) => ({
    id:          r.id,
    studentId:   r.studentId,
    studentName: r.student.name ?? "Aluno",
    guardianName: r.student.guardian?.user.name ?? null,
    subjectName: r.subject?.name ?? "–",
    teacherName: r.teacher.user.name,
    preferredAt: r.preferredAt,
    status:      r.status as "APPROVED" | "REJECTED",
    reason:      r.reason,
  }))

  const teacherOptions = teachers.map((t) => ({ id: t.id, name: t.user.name ?? "Professor" }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="AGENDAMENTOS"
        description="Gerencie as solicitações de aulas"
      />

      {/* Métricas */}
      <RequestsStats
        pending={pendingCount}
        approvedThisWeek={approvedThisWeek}
        rejectedThisWeek={rejectedThisWeek}
      />

      {/* Filtros */}
      <FilterBar teachers={teacherOptions} subjects={subjects} />

      {/* Solicitações pendentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-sub text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Solicitações Pendentes
            {pendingCount > 0 && (
              <Badge variant="destructive">{pendingCount}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requestsWithMeta.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
            </div>
          ) : (
            <RequestsClient groups={groups} />
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoryTabs items={historyItems} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
