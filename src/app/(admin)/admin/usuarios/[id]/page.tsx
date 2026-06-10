import { notFound }      from "next/navigation"
import { prisma }        from "@/lib/prisma"
import { auth }          from "@/lib/auth"
import { PageHeader }    from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserForm }      from "../user-form"
import { updateUserAction } from "../actions"
import { ImpersonateButton } from "./impersonate-button"
import { TeacherSubjectsForm } from "@/components/shared/teacher-subjects-form"
import type { Role, TeacherMode, EducationLevel } from "@prisma/client"

interface EditUserPageProps {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function EditUserPage({ params, searchParams }: EditUserPageProps) {
  const { id }               = await params
  const { error, success }   = await searchParams

  const [user, guardians] = await Promise.all([
    prisma.user.findUnique({
      where:   { id },
      include: {
        student:  { include: { guardian: true } },
        guardian: { include: { students: { select: { id: true, name: true, grade: true } } } },
        teacher:  { include: { subjects: true } },
      },
    }),
    prisma.guardian.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ])
  if (!user) notFound()

  const session       = await auth()
  const canImpersonate = user.role !== "ADMIN" && user.active && user.id !== session?.user?.id

  const action = updateUserAction.bind(null, id)

  const allSubjects = user.role === "TEACHER"
    ? await prisma.subject.findMany({ orderBy: { name: "asc" } })
    : []

  // Para guardiões: buscar alunos vinculados + alunos sem responsável
  let guardianStudents: { id: string; name: string; grade: string; linked: boolean }[] = []
  if (user.role === "GUARDIAN" && user.guardian) {
    const linkedIds = new Set(user.guardian.students.map((s) => s.id))
    const unlinked  = await prisma.student.findMany({
      where:   { guardianId: null },
      select:  { id: true, name: true, grade: true },
      orderBy: { name: "asc" },
    })
    guardianStudents = [
      ...user.guardian.students.map((s) => ({ ...s, linked: true })),
      ...unlinked.filter((s) => !linkedIds.has(s.id)).map((s) => ({ ...s, linked: false })),
    ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="EDITAR USUÁRIO"
        description={`Editando: ${user.name}`}
        backHref="/admin/usuarios"
      />

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {decodeURIComponent(success)}
        </div>
      )}

      {canImpersonate && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Ver como este usuário</p>
              <p className="text-sm text-muted-foreground">
                Entra no sistema com a visão e os dados deste perfil. Você pode voltar a
                qualquer momento pelo banner no topo. A ação fica registrada.
              </p>
            </div>
            <ImpersonateButton id={user.id} name={user.name} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <UserForm
            action={action}
            error={error}
            isEdit
            guardians={guardians.map((g) => ({ id: g.id, name: g.user.name }))}
            students={guardianStudents}
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
