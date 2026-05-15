import { auth }         from "@/lib/auth"
import { redirect }     from "next/navigation"
import { prisma }       from "@/lib/prisma"
import { PageHeader }   from "@/components/shared/page-header"
import { ProfileForm }  from "@/components/shared/profile-form"

export default async function AdminPerfilPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, avatar: true, role: true, createdAt: true },
  })
  if (!user) redirect("/login")

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="MEU PERFIL"
        description="Gerencie suas informações pessoais e senha"
      />
      <ProfileForm user={user} />
    </div>
  )
}
