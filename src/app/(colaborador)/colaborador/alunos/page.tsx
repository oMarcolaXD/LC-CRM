import { prisma }        from "@/lib/prisma"
import { PageHeader }    from "@/components/shared/page-header"
import { StudentsBoard } from "./_components/students-board"
import type { StudentRow } from "./_components/student-board-card"

interface AlunosPageProps {
  searchParams: Promise<{ success?: string; status?: string }>
}

export default async function ColaboradorAlunosPage({ searchParams }: AlunosPageProps) {
  const { success, status = "ativos" } = await searchParams

  // Filter by user.active based on status tab
  // Students with userId=null (no account) are treated as active by default
  const whereClause =
    status === "inativos" ? { user: { active: false } }
    : status === "todos"  ? undefined
    : { OR: [{ userId: null }, { user: { active: true } }] } // "ativos": no account OR active=true

  const students = await prisma.student.findMany({
    where: whereClause,
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

  // Counts for tabs — students with no userId count as active
  const [totalAtivos, totalInativos] = await Promise.all([
    prisma.student.count({ where: { OR: [{ userId: null }, { user: { active: true } }] } }),
    prisma.student.count({ where: { user: { active: false } } }),
  ])

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

  // Serialize Prisma Decimal fields to plain numbers (required for Server→Client boundary)
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
        description={`${students.length} aluno${students.length !== 1 ? "s" : ""} ${
          status === "inativos" ? "ex-aluno" + (students.length !== 1 ? "s" : "")
          : status === "todos"  ? "no total"
          : "ativo" + (students.length !== 1 ? "s" : "")
        }`}
      />

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {decodeURIComponent(success)}
        </div>
      )}

      <StudentsBoard
        students={serialized}
        grades={grades}
        newStudentHref="/colaborador/alunos/novo"
        importHref="/colaborador/alunos/importar"
        detailBasePath="/colaborador/alunos"
        activeTab={status === "inativos" ? "inativos" : status === "todos" ? "todos" : "ativos"}
        totalAtivos={totalAtivos}
        totalInativos={totalInativos}
      />
    </div>
  )
}
