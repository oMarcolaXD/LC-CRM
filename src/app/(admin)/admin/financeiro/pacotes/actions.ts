"use server"

import { prisma }        from "@/lib/prisma"
import { auth }          from "@/lib/auth"
import { revalidatePath } from "next/cache"

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")
}

export async function togglePackageAction(id: string, active: boolean) {
  await requireAdmin()
  await prisma.lessonPackage.update({
    where: { id },
    data:  { status: active ? "ACTIVE" : "EXPIRED" },
  })
  revalidatePath("/admin/financeiro/pacotes")
}
