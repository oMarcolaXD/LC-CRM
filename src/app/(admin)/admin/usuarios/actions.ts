"use server"

import { prisma }           from "@/lib/prisma"
import { auth }             from "@/lib/auth"
import { createUserSchema, updateUserSchema } from "@/lib/validations/user"
import { revalidatePath }   from "next/cache"
import { redirect }         from "next/navigation"
import bcrypt               from "bcryptjs"
import type { Role }        from "@prisma/client"

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")
  return session
}

// ─── Criar usuário ────────────────────────────────────────────────────────────
export async function createUserAction(formData: FormData) {
  await requireAdmin()

  const raw = Object.fromEntries(formData)
  const parsed = createUserSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos"
    redirect(`/admin/usuarios/novo?error=${encodeURIComponent(msg)}`)
  }

  const { name, email, password, phone, role, grade, school, hourlyRate, bio } = parsed.data

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) redirect("/admin/usuarios/novo?error=E-mail+já+cadastrado")

  const hashed = await bcrypt.hash(password, 12)

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, password: hashed, phone, role: role as Role },
    })

    if (role === "STUDENT") {
      await tx.student.create({ data: { userId: user.id, grade: grade ?? "Não informado", school } })
    }
    if (role === "TEACHER") {
      await tx.teacher.create({ data: { userId: user.id, hourlyRate: hourlyRate ?? 0, bio } })
    }
    if (role === "GUARDIAN") {
      await tx.guardian.create({ data: { userId: user.id } })
    }
  })

  revalidatePath("/admin/usuarios")
  redirect("/admin/usuarios?success=Usuário+criado+com+sucesso")
}

// ─── Atualizar usuário ────────────────────────────────────────────────────────
export async function updateUserAction(id: string, formData: FormData) {
  await requireAdmin()

  const raw = Object.fromEntries(formData)
  const parsed = updateUserSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos"
    redirect(`/admin/usuarios/${id}?error=${encodeURIComponent(msg)}`)
  }

  const { name, email, password, phone, role, grade, school, hourlyRate, bio } = parsed.data

  const updateData: Record<string, unknown> = { name, email, phone, role }
  if (password) updateData.password = await bcrypt.hash(password, 12)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: updateData })

    if (role === "STUDENT") {
      await tx.student.upsert({
        where:  { userId: id },
        update: { grade: grade ?? "Não informado", school },
        create: { userId: id, grade: grade ?? "Não informado", school },
      })
    }
    if (role === "TEACHER") {
      await tx.teacher.upsert({
        where:  { userId: id },
        update: { hourlyRate: hourlyRate ?? 0, bio },
        create: { userId: id, hourlyRate: hourlyRate ?? 0, bio },
      })
    }
  })

  revalidatePath("/admin/usuarios")
  redirect("/admin/usuarios?success=Usuário+atualizado+com+sucesso")
}

// ─── Alternar status ativo ────────────────────────────────────────────────────
export async function toggleUserActiveAction(id: string, active: boolean) {
  await requireAdmin()
  await prisma.user.update({ where: { id }, data: { active } })
  revalidatePath("/admin/usuarios")
}
