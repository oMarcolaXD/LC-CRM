import { prisma }       from "@/lib/prisma"
import { PageHeader }   from "@/components/shared/page-header"
import { AgendaGrid }   from "./agenda-grid"
import type { TeacherCol, LessonSlot } from "./agenda-grid"
import { getRoomCount } from "@/lib/config"
import { format, startOfDay, endOfDay, parseISO, isValid } from "date-fns"
import { ptBR } from "date-fns/locale"

interface AgendaPageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function ColaboradorAgendaPage({ searchParams }: AgendaPageProps) {
  const { date: rawDate } = await searchParams

  // Resolve a data: usa ?date ou hoje
  const parsed  = rawDate ? parseISO(rawDate) : new Date()
  const dateObj = isValid(parsed) ? parsed : new Date()
  const dateStr = format(dateObj, "yyyy-MM-dd")
  const dayStart = startOfDay(dateObj)
  const dayEnd   = endOfDay(dateObj)

  const [teachers, lessons, roomCount] = await Promise.all([
    prisma.teacher.findMany({
      where:   { user: { active: true } },
      include: { user: true },
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
  ])

  // Serializa para o client component (evita problemas com Date objects)
  const teacherCols: TeacherCol[] = teachers.map(t => ({
    id:   t.id,
    name: t.user.name,
  }))

  const lessonSlots: LessonSlot[] = lessons.map(l => {
    const d   = l.scheduledAt
    const min = d.getHours() * 60 + d.getMinutes()
    return {
      id:           l.id,
      teacherId:    l.teacherId,
      startMin:     min,
      duration:     l.duration ?? 60,
      status:       l.status as LessonSlot["status"],
      modality:     l.modality as LessonSlot["modality"],
      time:         format(d, "HH:mm"),
      studentName:  l.student.user.name,
      subjectName:  l.subject.name,
      guardianName: l.student.guardian?.user.name ?? null,
    }
  })

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
      />
    </div>
  )
}
