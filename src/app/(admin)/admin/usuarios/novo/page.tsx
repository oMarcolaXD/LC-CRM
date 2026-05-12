import { PageHeader }    from "@/components/shared/page-header"
import { UserForm }      from "../user-form"
import { createUserAction } from "../actions"

interface NovoUsuarioPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function NovoUsuarioPage({ searchParams }: NovoUsuarioPageProps) {
  const { error } = await searchParams

  return (
    <div>
      <PageHeader
        title="NOVO USUÁRIO"
        description="Preencha os dados para criar um novo usuário"
        backHref="/admin/usuarios"
      />
      <UserForm action={createUserAction} error={error} />
    </div>
  )
}
