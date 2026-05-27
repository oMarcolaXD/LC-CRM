import { prisma }       from "@/lib/prisma"
import { PageHeader }   from "@/components/shared/page-header"
import type { AulaoItem, TeacherOption, StudentOption } from "./_components/auloes-list-client"
import { AuloesListClient } from "./_components/auloes-list-client"

export const dynamic = "force-dynamic"

export default async function AuloesPage() {
  const [lessonsRaw, teachersRaw, studentsRaw] = await Promise.all([
    prisma.lesson.findMany({
      where:   { lessonType: { in: ["AULAO", "GROUP"] } },
      include: {
        participants: { include: { student: true } },
        teacher:      { include: { user: true } },
        subject:      true,
      },
      orderBy: { scheduledAt: "desc" },
    }),
    prisma.teacher.findMany({
      where:   { user: { active: true } },
      include: {
        user:     true,
        subjects: { include: { subject: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.student.findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const auloes: AulaoItem[] = lessonsRaw.map(l => ({
    id:                l.id,
    lessonType:        l.lessonType as "AULAO" | "GROUP",
    title:             l.title,
    teacherName:       l.teacher.user.name,
    teacherId:         l.teacherId,
    subjectName:       l.subject?.name ?? "–",
    scheduledAt:       l.scheduledAt.toISOString(),
    duration:          l.duration ?? 90,
    modality:          l.modality as "PRESENCIAL" | "ONLINE",
    status:            l.status,
    enrolled:          l.participants.length,
    capacity:          l.capacity,
    isFree:            !l.priceOverride || l.priceOverride.toNumber() === 0,
    recurrenceGroupId: l.recurrenceGroupId ?? null,
  }))

  const teachers: TeacherOption[] = teachersRaw.map(t => ({
    id:           t.id,
    name:         t.user.name,
    teachingMode: t.teachingMode as "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID",
    subjects:     t.subjects.map(ts => ({ id: ts.subject.id, name: ts.subject.name })),
  }))

  const students: StudentOption[] = studentsRaw.map(s => ({ id: s.id, name: s.name }))

  const proximosCount = auloes.filter(a => ["SCHEDULED", "CONFIRMED"].includes(a.status)).length

  return (
    <div>
      <PageHeader
        title="AULÕES E GRUPOS"
        description={`${proximosCount > 0 ? `${proximosCount} próximo${proximosCount !== 1 ? "s" : ""}` : "Nenhum agendado"} · eventos abertos com múltiplos alunos`}
      />
      <AuloesListClient
        auloes={auloes}
        teachers={teachers}
        students={students}
      />
    </div>
  )
}
