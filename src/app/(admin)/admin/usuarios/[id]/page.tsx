import { notFound }      from "next/navigation"
import { prisma }        from "@/lib/prisma"
import { PageHeader }    from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserForm }      from "../user-form"
import { updateUserAction } from "../actions"
import { TeacherSubjectsForm } from "@/components/shared/teacher-subjects-form"
import type { Role, TeacherMode, EducationLevel } from "@prisma/client"

interface EditUserPageProps {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function EditUserPage({ params, searchParams }: EditUserPageProps) {
  const { id }    = await params
  const { error } = await searchParams

  const [user, guardians] = await Promise.all([
    prisma.user.findUnique({
      where:   { id },
      include: {
        student:  { include: { guardian: true } },
        guardian: true,
        teacher:  { include: { subjects: true } },
      },
    }),
    prisma.guardian.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ])
  if (!user) notFound()

  const action = updateUserAction.bind(null, id)

  const allSubjects = user.role === "TEACHER"
    ? await prisma.subject.findMany({ orderBy: { name: "asc" } })
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="EDITAR USUÁRIO"
        description={`Editando: ${user.name}`}
        backHref="/admin/usuarios"
      />

      <Card>
        <CardContent className="pt-6">
          <UserForm
            action={action}
            error={error}
            isEdit
            guardians={guardians.map((g) => ({ id: g.id, name: g.user.name }))}
            defaultValues={{
              name:          user.name,
              email:         user.email ?? "",
              phone:         user.phone ?? "",
              role:          user.role as Role,
              grade:         user.student?.grade,
              school:        user.student?.school ?? "",
              hourlyRate:    user.teacher?.hourlyRate ? Number(user.teacher.hourlyRate) : undefined,
              bio:           user.teacher?.bio ?? "",
              teachingMode:  user.teacher?.teachingMode as TeacherMode ?? undefined,
              guardianId:    user.student?.guardianId ?? "",
              relationship:  user.guardian?.relationship ?? "",
            }}
          />
        </CardContent>
      </Card>

      {user.role === "TEACHER" && user.teacher && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matérias e Níveis de Ensino</CardTitle>
            <p className="text-sm text-muted-foreground">
              Marque as matérias e os níveis que este professor está habilitado a lecionar.
            </p>
          </CardHeader>
          <CardContent>
            <TeacherSubjectsForm
              teacherId={user.teacher.id}
              allSubjects={allSubjects}
              currentSubjects={user.teacher.subjects.map((ts) => ({
                subjectId: ts.subjectId,
                levels:    ts.levels as EducationLevel[],
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
