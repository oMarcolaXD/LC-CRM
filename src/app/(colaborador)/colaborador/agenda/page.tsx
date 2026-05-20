import { prisma }        from "@/lib/prisma"
import { PageHeader }    from "@/components/shared/page-header"
import { AgendaGrid }    from "./agenda-grid"
import type {
  TeacherCol, LessonSlot, AvailSlot, StudentOption,
  WeekLessonSlot, ViewMode, PendingRequestSlot,
} from "./agenda-grid"

import { getRoomCount }  from "@/lib/config"
import type { Availability } from "@/lib/availability"
import {
  format, startOfDay, endOfDay, parseISO, isValid, getDay,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
} from "date-fns"
import { ptBR } from "date-fns/locale"

interface AgendaPageProps {
  searchParams: Promise<{ date?: string; view?: string }>
}

function parseAvailSlots(availability: unknown, dow: number): AvailSlot[] {
  if (!availability || typeof availability !== "object") return []
  const avail    = availability as Availability
  const daySlots = avail[String(dow)] ?? []
  return daySlots.map(s => {
    const [sh, sm] = s.start.split(":").map(Number)
    const [eh, em] = s.end.split(":").map(Number)
    return { start: sh * 60 + sm, end: eh * 60 + em }
  })
}

function mapToLessonSlot(
  l: {
    id: string
    teacherId: string
    scheduledAt: Date
    duration: number | null
    status: string
    modality: string
    teacherOnsite: boolean
    participants: {
      studentId: string
      student: {
        user: { name: string } | null
        guardian: { user: { name: string } } | null
      }
    }[]
    subject: { name: string }
  },
): LessonSlot {
  const d           = l.scheduledAt
  const min         = d.getHours() * 60 + d.getMinutes()
  const first       = l.participants[0]
  const studentName = first?.student.user?.name ?? "Aluno"
  const isGroup     = l.participants.length > 1
  return {
    id:            l.id,
    teacherId:     l.teacherId,
    startMin:      min,
    duration:      l.duration ?? 60,
    status:        l.status as LessonSlot["status"],
    modality:      l.modality as LessonSlot["modality"],
    teacherOnsite: l.teacherOnsite,
    time:          format(d, "HH:mm"),
    studentName,
    subjectName:   l.subject.name,
    guardianName:  first?.student.guardian?.user.name ?? null,
    isGroupLesson: isGroup,
    groupSize:     isGroup ? l.participants.length : null,
    groupMates:    l.participants.slice(1).map(p => p.student.user?.name ?? "Aluno"),
  }
}

export default async function ColaboradorAgendaPage({ searchParams }: AgendaPageProps) {
  const { date: rawDate, view: rawView } = await searchParams

  const parsed   = rawDate ? parseISO(rawDate) : new Date()
  const dateObj  = isValid(parsed) ? parsed : new Date()
  const dateStr  = format(dateObj, "yyyy-MM-dd")
  const dayStart = startOfDay(dateObj)
  const dayEnd   = endOfDay(dateObj)
  const dow      = getDay(dateObj)
  const viewMode: ViewMode =
    rawView === "week"  ? "week"  :
    rawView === "month" ? "month" : "day"

  const lessonInclude = {
    participants: {
      include: {
        student: {
          include: {
            user:     true,
            guardian: { include: { user: true } },
          },
        },
      },
    },
    teacher: { include: { user: true } },
    subject: true,
  } as const

  const [teachers, lessons, roomCount, studentsRaw, pendingRaw, allStudentsRaw] = await Promise.all([
    prisma.teacher.findMany({
      where:   { user: { active: true } },
      include: {
        user:     true,
        subjects: { include: { subject: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.lesson.findMany({
      where:   { scheduledAt: { gte: dayStart, lte: dayEnd } },
      include: lessonInclude,
      orderBy: { scheduledAt: "asc" },
    }),
    getRoomCount(),
    prisma.student.findMany({
      where: {
        user:     { active: true },
        packages: { some: { status: "ACTIVE", remainingLessons: { gt: 0 } } },
      },
      include: {
        user:     true,
        packages: {
          where:   { status: "ACTIVE", remainingLessons: { gt: 0 } },
          orderBy: { purchaseDate: "desc" },
          take:    1,
        },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.lessonRequest.findMany({
      where: { status: "PENDING", preferredAt: { gte: dayStart, lte: endOfDay(dateObj) } },
      include: {
        student: { include: { user: true } },
        teacher: { include: { user: true } },
        subject: true,
      },
      orderBy: { preferredAt: "asc" },
    }),
    // Todos os alunos ativos (para o diálogo de aula em grupo)
    prisma.student.findMany({
      where:   { user: { active: true } },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ])

  const pendingInclude = {
    student: { include: { user: true } },
    teacher: { include: { user: true } },
    subject: true,
  } as const

  // Fetch semana inteira apenas quando necessário
  const weekStart = startOfDay(startOfWeek(dateObj, { weekStartsOn: 1 }))
  const weekEnd   = endOfDay(endOfWeek(dateObj,     { weekStartsOn: 1 }))
  const monthCalStart = startOfDay(startOfWeek(startOfMonth(dateObj), { weekStartsOn: 1 }))
  const monthCalEnd   = endOfDay(endOfWeek(endOfMonth(dateObj),       { weekStartsOn: 1 }))

  const [weekLessonsRaw, monthLessonsRaw, extPendingRaw] = await Promise.all([
    viewMode === "week"
      ? prisma.lesson.findMany({
          where: { scheduledAt: { gte: weekStart, lte: weekEnd } },
          include: lessonInclude,
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([]),
    viewMode === "month"
      ? prisma.lesson.findMany({
          where: { scheduledAt: { gte: monthCalStart, lte: monthCalEnd } },
          include: lessonInclude,
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([]),
    viewMode === "week"
      ? prisma.lessonRequest.findMany({
          where: { status: "PENDING", preferredAt: { gte: weekStart, lte: weekEnd } },
          include: pendingInclude,
          orderBy: { preferredAt: "asc" },
        })
      : viewMode === "month"
      ? prisma.lessonRequest.findMany({
          where: { status: "PENDING", preferredAt: { gte: monthCalStart, lte: monthCalEnd } },
          include: pendingInclude,
          orderBy: { preferredAt: "asc" },
        })
      : Promise.resolve([]),
  ])

  const teacherCols: TeacherCol[] = teachers.map(t => ({
    id:              t.id,
    name:            t.user.name,
    teachingMode:    t.teachingMode as "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID",
    slots:           parseAvailSlots(t.availability, dow),
    rawAvailability: (t.availability ?? {}) as Record<string, { start: string; end: string }[]>,
    subjects:        t.subjects.map(ts => ({ id: ts.subject.id, name: ts.subject.name })),
  }))

  const lessonSlots: LessonSlot[] = lessons.map(l => mapToLessonSlot(l))

  const weekLessons: WeekLessonSlot[] = weekLessonsRaw.map(l => ({
    ...mapToLessonSlot(l),
    date: format(l.scheduledAt, "yyyy-MM-dd"),
  }))

  const monthLessons: WeekLessonSlot[] = monthLessonsRaw.map(l => ({
    ...mapToLessonSlot(l),
    date: format(l.scheduledAt, "yyyy-MM-dd"),
  }))

  function mapPending(r: typeof pendingRaw[0]): PendingRequestSlot {
    return {
      id:          r.id,
      teacherId:   r.teacherId,
      startMin:    r.preferredAt.getHours() * 60 + r.preferredAt.getMinutes(),
      time:        format(r.preferredAt, "HH:mm"),
      date:        format(r.preferredAt, "yyyy-MM-dd"),
      studentName: r.student.user?.name ?? "Aluno",
      subjectName: r.subject?.name ?? "–",
      modality:    r.modality as "PRESENCIAL" | "ONLINE",
      teacherMode: r.teacher.teachingMode as "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID",
      notes:       r.reason ?? null,
    }
  }

  const pendingRequests:     PendingRequestSlot[] = pendingRaw.map(mapPending)
  const weekPendingRequests: PendingRequestSlot[] = extPendingRaw.map(mapPending)

  const students: StudentOption[] = studentsRaw.map(s => ({
    id:               s.id,
    name:             s.user?.name ?? "Aluno",
    remainingLessons: s.packages[0]?.remainingLessons ?? 0,
  }))

  const allStudents = allStudentsRaw.map(s => ({ id: s.id, name: s.user?.name ?? "Aluno" }))

  const weekday = format(dateObj, "EEEE", { locale: ptBR })

  return (
    <div className="space-y-4">
      <PageHeader
        title="AGENDA"
        description={`${weekday.charAt(0).toUpperCase() + weekday.slice(1)} · ${format(dateObj, "dd/MM/yyyy")}`}
      />
      <AgendaGrid
        date={dateStr}
        teachers={teacherCols}
        lessons={lessonSlots}
        roomCount={roomCount}
        students={students}
        allStudents={allStudents}
        weekLessons={weekLessons}
        monthLessons={monthLessons}
        initialView={viewMode}
        pendingRequests={pendingRequests}
        weekPendingRequests={weekPendingRequests}
      />
    </div>
  )
}
