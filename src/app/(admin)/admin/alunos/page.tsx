import { prisma }        from "@/lib/prisma"
import { PageHeader }    from "@/components/shared/page-header"
import { StudentsBoard } from "@/app/(colaborador)/colaborador/alunos/_components/students-board"
import type { StudentRow } from "@/app/(colaborador)/colaborador/alunos/_components/student-board-card"

export default async function AdminAlunosPage() {
  const students = await prisma.student.findMany({
    include: {
      user: true,
      guardian: { include: { user: true } },
      packages: {
        where:   { status: { in: ["ACTIVE", "EXHAUSTED"] } },
        orderBy: [
          { status: "asc" },        // ACTIVE sorts before EXHAUSTED in enum definition
          { purchaseDate: "desc" }, // most recent within same status
        ],
        take:    1,
      },
      participations: {
        where:   { lesson: { scheduledAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } } },
        orderBy: { lesson: { scheduledAt: "asc" } },
        take:    1,
        include: { lesson: { include: { subject: true } } },
      },
      payments: {
        orderBy: { dueDate: "desc" },
        take:    1,
      },
      _count: {
        select: {
          packages:       true,
          participations: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  // Data da última aula por aluno (para ordenação "aulas mais recentes")
  const studentIds  = students.map(s => s.id)
  const recentParts = studentIds.length
    ? await prisma.lessonParticipant.findMany({
        where:   { studentId: { in: studentIds } },
        select:  { studentId: true, lesson: { select: { scheduledAt: true } } },
        orderBy: { lesson: { scheduledAt: "desc" } },
      })
    : []
  const lastLessonMap = new Map<string, string>()
  for (const p of recentParts) {
    if (!lastLessonMap.has(p.studentId)) lastLessonMap.set(p.studentId, p.lesson.scheduledAt.toISOString())
  }

  const serialized: StudentRow[] = students.map(s => ({
    ...s,
    lastLessonAt:   lastLessonMap.get(s.id) ?? null,
    packages:       s.packages.map(p => ({ ...p, pricePerLesson: Number(p.pricePerLesson) })),
    payments:       s.payments.map(p => ({ ...p, amount: Number(p.amount) })),
    participations: s.participations.map(part => ({
      ...part,
      lesson: {
        ...part.lesson,
        priceOverride: part.lesson.priceOverride != null ? Number(part.lesson.priceOverride) : null,
      },
    })),
  })) as unknown as StudentRow[]

  const grades = [...new Set(students.map(s => s.grade).filter(Boolean))].sort() as string[]

  return (
    <div className="space-y-6">
      <PageHeader
        title="ALUNOS"
        description={`${students.length} aluno${students.length !== 1 ? "s" : ""} cadastrado${students.length !== 1 ? "s" : ""}`}
      />

      <StudentsBoard
        students={serialized}
        grades={grades}
        newStudentHref="/admin/usuarios/novo"
        importHref="/colaborador/alunos/importar"
        detailBasePath="/colaborador/alunos"
      />
    </div>
  )
}
