import { notFound }      from "next/navigation"
import { prisma }        from "@/lib/prisma"
import { PageHeader }    from "@/components/shared/page-header"
import { UserForm }      from "../user-form"
import { updateUserAction } from "../actions"
import type { Role }     from "@prisma/client"

interface EditUserPageProps {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function EditUserPage({ params, searchParams }: EditUserPageProps) {
  const { id }    = await params
  const { error } = await searchParams

  const user = await prisma.user.findUnique({
    where:   { id },
    include: { student: true, teacher: true },
  })
  if (!user) notFound()

  const action = updateUserAction.bind(null, id)

  return (
    <div>
      <PageHeader
        title="EDITAR USUÁRIO"
        description={`Editando: ${user.name}`}
        backHref="/admin/usuarios"
      />
      <UserForm
        action={action}
        error={error}
        isEdit
        defaultValues={{
          name:       user.name,
          email:      user.email,
          phone:      user.phone ?? "",
          role:       user.role as Role,
          grade:      user.student?.grade,
          school:     user.student?.school ?? "",
          hourlyRate: user.teacher?.hourlyRate ? Number(user.teacher.hourlyRate) : undefined,
          bio:        user.teacher?.bio ?? "",
        }}
      />
    </div>
  )
}
