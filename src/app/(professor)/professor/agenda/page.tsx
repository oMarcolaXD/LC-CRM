import { headers }      from "next/headers"
import { auth }         from "@/lib/auth"
import { prisma }       from "@/lib/prisma"
import { PageHeader }   from "@/components/shared/page-header"
import { generateCalendarToken } from "@/lib/calendar-token"
import { teacherWhereForSession } from "@/lib/teacher-session"
import { TeacherAgendaView }    from "@/components/professor/teacher-agenda-view"
import { AlertTriangle }        from "lucide-react"

export default async function ProfessorAgendaPage() {
  const session = await auth()

  const teacher = await prisma.teacher.findFirst({
    where: teacherWhereForSession(session),
  })

  // Próximas aulas (agendadas/confirmadas) + histórico recente.
  // IMPORTANTE: buscar em duas queries — ordenar tudo por scheduledAt asc com
  // take limitado fazia as aulas futuras ficarem de fora quando o professor
  // tinha muitos registros históricos, resultando em "nenhuma aula agendada".
  const [upcomingLessons, pastLessons] = teacher
    ? await Promise.all([
        prisma.lesson.findMany({
          where:   { teacherId: teacher.id, status: { in: ["SCHEDULED", "CONFIRMED"] } },
          include: { participants: { include: { student: { include: { user: true } } } }, subject: true },
          orderBy: { scheduledAt: "asc" },
        }),
        prisma.lesson.findMany({
          where:   { teacherId: teacher.id, status: { in: ["COMPLETED", "CANCELLED", "MISSED"] } },
          include: { participants: { include: { student: { include: { user: true } } } }, subject: true },
          orderBy: { scheduledAt: "desc" },
          take:    30,
        }),
      ])
    : [[], []]

  const lessons = [...upcomingLessons, ...pastLessons]

  // Serialise lessons for client component (Date → ISO string)
  const serialisedLessons = lessons.map((l) => ({
    id:          l.id,
    scheduledAt: l.scheduledAt.toISOString(),
    duration:    l.duration,
    status:      l.status as string,
    modality:    l.modality as string,
    meetingLink: l.meetingLink ?? null,
    location:    l.location   ?? null,
    student:     { user: { name: l.participants[0]?.student.name ?? "Aluno" } },
    subject:     { name: l.subject?.name ?? "–" },
    lessonType:  l.lessonType as string,
    title:       l.title ?? null,
    blocksAgenda: l.blocksAgenda,
  }))

  // Derive base URL for ICS link
  const hdrs    = await headers()
  const host    = hdrs.get("host") ?? "localhost:3000"
  const proto   = host.startsWith("localhost") ? "http" : "https"
  const baseUrl = `${proto}://${host}`

  const calendarToken = teacher ? generateCalendarToken(teacher.id) : ""

  return (
    <div className="space-y-6">
      <PageHeader title="MINHA AGENDA" description="Aulas agendadas" />

      {/* Agenda vazia por falta de vínculo não pode passar por "não tenho aulas" */}
      {!teacher && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Seu login não está vinculado a um cadastro de professor, então nenhuma aula aparece aqui.
            Avise a secretaria — não é preciso reagendar nada, as aulas continuam registradas.
          </span>
        </div>
      )}

      {/* Interactive agenda (list + calendar views + sync) */}
      <TeacherAgendaView
        lessons={serialisedLessons}
        calendarToken={calendarToken}
        baseUrl={baseUrl}
      />
    </div>
  )
}
