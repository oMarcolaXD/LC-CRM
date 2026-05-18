"use server"

import { prisma }        from "@/lib/prisma"
import { auth }          from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { Availability } from "@/lib/availability"

export async function saveAvailabilityAction(availability: Availability) {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")

  const teacher = await prisma.teacher.findFirst({
    where: { userId: session.user.id },
  })
  if (!teacher) throw new Error("Perfil de professor não encontrado")

  await prisma.teacher.update({
    where: { id: teacher.id },
    data:  { availability: availability as object },
  })
  revalidatePath("/professor/disponibilidade")
}
