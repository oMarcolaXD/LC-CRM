import { prisma }        from "@/lib/prisma"
import { PageHeader }    from "@/components/shared/page-header"
import { AgendaGrid }    from "@/app/(colaborador)/colaborador/agenda/agenda-grid"
import type { TeacherCol, LessonSlot, AvailSlot, StudentOption } from "@/app/(colaborador)/colaborador/agenda/agenda-grid"
import { getRoomCount }  from "@/lib/config"
import type { Availability } from "@/lib/availability"
import { format, startOfDay, endOfDay, parseISO, isValid, getDay } from "date-fns"
import { ptBR } from "date-fns/locale"

interface AgendaPageProps {
  searchParams: Promise<{ date?: string }>
}

function parseAvailSlots(availability: unknown, dow: number): AvailSlot[] {
  if (!availability || typeof availability !== "object") return []
  const avail = availability as Availability
  const daySlots = avail[String(dow)] ?? []
  return daySlots.map(s => {
    const [sh, sm] = s.start.split(":").map(Number)
    const [eh, em] = s.end.split(":").map(Number)
    return { start: sh * 60 + sm, end: eh * 60 + em }
  })
}

export default async function AdminAgendaPage({ searchParams }: AgendaPageProps) {
  const { date: rawDate } = await searchParams

  const parsed   = rawDate ? parseISO(rawDate) : new Date()
  const dateObj  = isValid(parsed) ? parsed : new Date()
  const dateStr  = format(dateObj, "yyyy-MM-dd")
  const dayStart = startOfDay(dateObj)
  const dayEnd   = endOfDay(dateObj)
  const dow      = getDay(dateObj)

  const [teachers, lessons, roomCount, studentsRaw] = await Promise.all([
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
      include: {
        student: {
          include: {
            user:     true,
            guardian: { include: { user: true } },
          },
        },
        teacher: { include: { user: true } },
        subject: true,
      },
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
  ])

  const teacherCols: TeacherCol[] = teachers.map(t => ({
    id:              t.id,
    name:            t.user.name,
    slots:           parseAvailSlots(t.availability, dow),
    rawAvailability: (t.availability ?? {}) as Record<string, { start: string; end: string }[]>,
    subjects:        t.subjects.map(ts => ({ id: ts.subject.id, name: ts.subject.name })),
  }))

  const lessonSlots: LessonSlot[] = lessons.map(l => {
    const d   = l.scheduledAt
    const min = d.getHours() * 60 + d.getMinutes()
    return {
      id:           l.id,
      teacherId:    l.teacherId,
      startMin:     min,
      duration:     l.duration ?? 60,
      status:        l.status as LessonSlot["status"],
      modality:      l.modality as LessonSlot["modality"],
      teacherOnsite: l.teacherOnsite,
      time:          format(d, "HH:mm"),
      studentName:   l.student.user.name,
      subjectName:   l.subject.name,
      guardianName:  l.student.guardian?.user.name ?? null,
    }
  })

  const students: StudentOption[] = studentsRaw.map(s => ({
    id:               s.id,
    name:             s.user.name,
    remainingLessons: s.packages[0]?.remainingLessons ?? 0,
  }))

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
      />
    </div>
  )
}
