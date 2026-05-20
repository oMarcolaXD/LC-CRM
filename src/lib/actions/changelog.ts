"use server"

import { auth }             from "@/lib/auth"
import { prisma }           from "@/lib/prisma"
import { CURRENT_VERSION }  from "@/data/changelog"
import { revalidatePath }   from "next/cache"

export async function markChangelogSeen() {
  const session = await auth()
  if (!session?.user?.id) return

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { lastSeenVersion: CURRENT_VERSION },
  })

  const rolePaths: Record<string, string> = {
    ADMIN:        "/admin/dashboard",
    COLLABORATOR: "/colaborador/dashboard",
    TEACHER:      "/professor/dashboard",
  }
  const path = rolePaths[session.user.role]
  if (path) revalidatePath(path)
}
