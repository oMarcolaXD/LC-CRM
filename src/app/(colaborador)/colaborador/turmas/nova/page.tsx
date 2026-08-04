import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/shared/page-header"
import { NovaTurmaForm } from "./_components/nova-turma-form"

export const dynamic = "force-dynamic"

export default async function NovaTurmaPage() {
  const [teachersRaw, subjects, studentsRaw] = await Promise.all([
    prisma.teacher.findMany({
      where:   { user: { active: true } },
      include: { user: { select: { name: true } }, subjects: { include: { subject: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.subject.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.student.findMany({
      where:   { OR: [{ userId: null }, { user: { active: true } }] },
      select:  { id: true, name: true, ra: true, grade: true },
      orderBy: { name: "asc" },
    }),
  ])

  const teachers = teachersRaw.map(t => ({
    id:           t.id,
    name:         t.user.name,
    teachingMode: t.teachingMode as "ONLINE_ONLY" | "PRESENCIAL" | "HYBRID",
    subjects:     t.subjects.map(ts => ({ id: ts.subject.id, name: ts.subject.name })),
  }))

  return (
    <div>
      <PageHeader
        title="NOVA TURMA"
        description="Acompanhamento por período com grade fixa e valor fechado"
        backHref="/colaborador/turmas"
      />
      <NovaTurmaForm teachers={teachers} subjects={subjects} students={studentsRaw} />
    </div>
  )
}
