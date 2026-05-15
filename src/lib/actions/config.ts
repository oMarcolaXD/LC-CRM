"use server"

import { auth }           from "@/lib/auth"
import { setConfigValue, getConfigValue } from "@/lib/config"
import { revalidatePath } from "next/cache"
import { redirect }       from "next/navigation"
import { z }              from "zod"

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")
}

const roomCountSchema = z.coerce.number().int().min(1).max(20)

export async function setRoomCountAction(formData: FormData) {
  await requireAdmin()
  const raw    = formData.get("room_count")
  const parsed = roomCountSchema.safeParse(raw)
  if (!parsed.success) {
    redirect(`/admin/config?error=${encodeURIComponent("Número de salas inválido (1-20)")}`)
  }
  await setConfigValue("room_count", String(parsed.data))
  revalidatePath("/admin/config")
  redirect("/admin/config?success=Número+de+salas+atualizado+com+sucesso")
}

export async function getRoomCountAction(): Promise<number> {
  const val = await getConfigValue("room_count", "3")
  return Math.max(1, parseInt(val, 10) || 3)
}
