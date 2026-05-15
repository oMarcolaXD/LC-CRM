"use server"

import { prisma }         from "@/lib/prisma"
import { auth }           from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { z }              from "zod"
import bcrypt             from "bcryptjs"

const updateProfileSchema = z.object({
  name:            z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  phone:           z.string().optional(),
  avatar:          z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(6, "Nova senha deve ter no mínimo 6 caracteres").optional().or(z.literal("")),
})

const ROLE_PATH: Record<string, string> = {
  ADMIN:        "/admin/perfil",
  COLLABORATOR: "/colaborador/perfil",
  TEACHER:      "/professor/perfil",
  STUDENT:      "/aluno/perfil",
  GUARDIAN:     "/aluno/perfil",
}

export async function updateProfileAction(
  formData: FormData
): Promise<{ success?: string; error?: string }> {
  const session = await auth()
  if (!session?.user) return { error: "Sem permissão" }

  const raw    = Object.fromEntries(formData)
  const parsed = updateProfileSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const { name, phone, avatar, currentPassword, newPassword } = parsed.data

  if (newPassword) {
    if (!currentPassword) return { error: "Informe a senha atual para alterá-la" }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return { error: "Usuário não encontrado" }
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return { error: "Senha atual incorreta" }
  }

  const data: Record<string, unknown> = {
    name,
    phone: phone || null,
  }
  if (avatar) data.avatar = avatar
  if (newPassword) data.password = await bcrypt.hash(newPassword, 12)

  await prisma.user.update({ where: { id: session.user.id }, data })

  const path = ROLE_PATH[session.user.role]
  if (path) revalidatePath(path)

  return { success: "Perfil atualizado com sucesso!" }
}
