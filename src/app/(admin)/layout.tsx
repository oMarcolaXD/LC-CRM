import { redirect }        from "next/navigation"
import { auth, ROLE_HOME } from "@/lib/auth"
import { prisma }          from "@/lib/prisma"
import { AppLayout }       from "@/components/shared/app-layout"
import { ChangelogModal }  from "@/components/shared/changelog-modal"
import { CURRENT_VERSION } from "@/data/changelog"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user)                redirect("/api/sair")   // limpa o cookie (conta suspensa); /login daria loop
  // Admin rebaixado cai na área dele (ir para /login daria loop: o cookie
  // ainda diz ADMIN e o middleware o mandaria de volta para cá)
  if (session.user.role !== "ADMIN") redirect(ROLE_HOME[session.user.role] ?? "/login")

  const dbUser = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { lastSeenVersion: true },
  })

  const shouldShowChangelog = dbUser?.lastSeenVersion !== CURRENT_VERSION

  return (
    <AppLayout
      name={session.user.name  ?? ""}
      email={session.user.email ?? ""}
      role={session.user.role}
      image={session.user.image}
      phone={session.user.phone}
      missingEmail={!session.user.email}
    >
      <ChangelogModal
        shouldShow={shouldShowChangelog}
        userRole={session.user.role}
        lastSeenVersion={dbUser?.lastSeenVersion ?? null}
      />
      {children}
    </AppLayout>
  )
}
