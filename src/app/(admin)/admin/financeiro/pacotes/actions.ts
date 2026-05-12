"use server"

import { prisma }        from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function togglePackageAction(id: string, active: boolean) {
  await prisma.lessonPackage.update({
    where: { id },
    data:  { status: active ? "ACTIVE" : "EXPIRED" },
  })
  revalidatePath("/admin/financeiro/pacotes")
}
