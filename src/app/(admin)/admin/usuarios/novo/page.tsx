import { prisma }         from "@/lib/prisma"
import { PageHeader }    from "@/components/shared/page-header"
import { UserForm }      from "../user-form"
import { createUserAction } from "../actions"

interface NovoUsuarioPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function NovoUsuarioPage({ searchParams }: NovoUsuarioPageProps) {
  const { error } = await searchParams

  const guardians = await prisma.guardian.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  })

  return (
    <div>
      <PageHeader
        title="NOVO USUÁRIO"
        description="Preencha os dados para criar um novo usuário"
        backHref="/admin/usuarios"
      />
      <UserForm
        action={createUserAction}
        error={error}
        guardians={guardians.map((g) => ({ id: g.id, name: g.user.name }))}
      />
    </div>
  )
}
