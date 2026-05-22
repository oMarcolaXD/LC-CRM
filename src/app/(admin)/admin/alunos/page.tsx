import { prisma }        from "@/lib/prisma"
import { PageHeader }    from "@/components/shared/page-header"
import { StudentsBoard } from "@/app/(colaborador)/colaborador/alunos/_components/students-board"

export default async function AdminAlunosPage() {
  const [students, subjectRows] = await Promise.all([
    prisma.student.findMany({
      include: {
        user: true,
        guardian: { include: { user: true } },
        packages: {
          where:   { status: { in: ["ACTIVE", "EXHAUSTED"] } },
          orderBy: { purchaseDate: "desc" },
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
      },
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
  ])

  const grades   = [...new Set(students.map(s => s.grade).filter(Boolean))].sort() as string[]
  const subjects = subjectRows.map(s => s.name)

  return (
    <div className="space-y-6">
      <PageHeader
        title="ALUNOS"
        description={`${students.length} aluno${students.length !== 1 ? "s" : ""} cadastrado${students.length !== 1 ? "s" : ""}`}
      />

      <StudentsBoard
        students={students}
        grades={grades}
        subjects={subjects}
        newStudentHref="/admin/usuarios/novo"
        importHref="/colaborador/alunos/importar"
        detailBasePath="/colaborador/alunos"
      />
    </div>
  )
}
