import { redirect }        from "next/navigation"
import { auth }            from "@/lib/auth"
import { prisma }          from "@/lib/prisma"
import { AppLayout }       from "@/components/shared/app-layout"
import { ChangelogModal }  from "@/components/shared/changelog-modal"
import { CURRENT_VERSION } from "@/data/changelog"

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user)                                          redirect("/login")
  if (!["ADMIN", "TEACHER"].includes(session.user.role)) redirect("/login")

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
