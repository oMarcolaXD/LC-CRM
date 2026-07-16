import { prisma }      from "@/lib/prisma"
import { PageHeader }  from "@/components/shared/page-header"
import { TeachersDirectory } from "@/components/shared/teachers-directory"
import type { TeacherDirItem } from "@/components/shared/teachers-directory"

export default async function AdminProfessoresPage() {
  const teachers = await prisma.teacher.findMany({
    where:   { user: { active: true } },
    include: {
      user:     true,
      subjects: { include: { subject: true } },
    },
    orderBy: { user: { name: "asc" } },
  })

  const items: TeacherDirItem[] = teachers.map((t) => ({
    id:           t.id,
    name:         t.user.name,
    email:        t.user.email,
    avatar:       t.user.avatar ?? null,
    bio:          t.bio ?? null,
    teachingMode: t.teachingMode as TeacherDirItem["teachingMode"],
    subjects:     t.subjects.map((ts) => ({
      subjectId: ts.subjectId,
      name:      ts.subject.name,
      levels:    ts.levels as string[],
    })),
  }))

  return (
    <div>
      <PageHeader
        title="PROFESSORES"
        description={`${teachers.length} professor${teachers.length !== 1 ? "es" : ""} ativo${teachers.length !== 1 ? "s" : ""}`}
      />
      <TeachersDirectory teachers={items} basePath="/admin/professores" />
    </div>
  )
}
