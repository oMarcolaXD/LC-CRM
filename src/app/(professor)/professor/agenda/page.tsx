import { headers }      from "next/headers"
import { auth }         from "@/lib/auth"
import { prisma }       from "@/lib/prisma"
import { PageHeader }   from "@/components/shared/page-header"
import { RequestCard }  from "@/components/shared/request-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge }        from "@/components/ui/badge"
import { Clock }        from "lucide-react"
import { hasConflict, isWithinAvailability } from "@/lib/availability"
import type { Availability } from "@/lib/availability"
import { generateCalendarToken } from "@/lib/calendar-token"
import { TeacherAgendaView }    from "@/components/professor/teacher-agenda-view"

export default async function ProfessorAgendaPage() {
  const session = await auth()

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session?.user?.email ?? "" } },
  })

  const [requests, lessons] = await Promise.all([
    teacher ? prisma.lessonRequest.findMany({
      where:   { teacherId: teacher.id, status: "PENDING" },
      include: {
        student: { include: { user: true } },
        teacher: { include: { user: true } },
        subject: true,
      },
      orderBy: { requestedAt: "asc" },
    }) : [],
    teacher ? prisma.lesson.findMany({
      where:   { teacherId: teacher.id },
      include: { participants: { include: { student: { include: { user: true } } } }, subject: true },
      orderBy: { scheduledAt: "asc" },
      take:    60,
    }) : [],
  ])

  const availability   = (teacher?.availability ?? {}) as unknown as Availability
  const confirmedTimes = lessons
    .filter((l) => ["SCHEDULED", "CONFIRMED"].includes(l.status))
    .map((l) => l.scheduledAt)

  // Serialise lessons for client component (Date → ISO string)
  const serialisedLessons = lessons.map((l) => ({
    id:          l.id,
    scheduledAt: l.scheduledAt.toISOString(),
    duration:    l.duration,
    status:      l.status as string,
    modality:    l.modality as string,
    meetingLink: l.meetingLink ?? null,
    location:    l.location   ?? null,
    student:     { user: { name: l.participants[0]?.student.user?.name ?? "Aluno" } },
    subject:     { name: l.subject.name },
  }))

  // Derive base URL for ICS link
  const hdrs    = await headers()
  const host    = hdrs.get("host") ?? "localhost:3000"
  const proto   = host.startsWith("localhost") ? "http" : "https"
  const baseUrl = `${proto}://${host}`

  const calendarToken = teacher ? generateCalendarToken(teacher.id) : ""

  return (
    <div className="space-y-6">
      <PageHeader title="MINHA AGENDA" description="Solicitações e aulas agendadas" />

      {/* Pending requests — server-rendered with approve/reject actions */}
      {requests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-sub text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              Solicitações Pendentes
              <Badge variant="destructive" className="ml-1">{requests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.map((r) => {
              const conflict      = hasConflict(r.preferredAt, confirmedTimes)
              const outOfSchedule = Object.keys(availability).length > 0 &&
                                    !isWithinAvailability(r.preferredAt, availability)
              return (
                <RequestCard
                  key={r.id}
                  id={r.id}
                  studentName={r.student.user?.name ?? "Aluno"}
                  teacherName={r.teacher.user.name}
                  subjectName={r.subject?.name ?? "–"}
                  preferredAt={r.preferredAt}
                  notes={r.reason}
                  hasConflict={conflict}
                  outOfSchedule={outOfSchedule}
                  teacherMode={r.teacher.teachingMode as "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID"}
                  requestModality={r.modality as "PRESENCIAL" | "ONLINE"}
                />
              )
            })}
          </CardContent>
        </Card>
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
