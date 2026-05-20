"use server"

import { prisma }           from "@/lib/prisma"
import { auth }             from "@/lib/auth"
import { createUserSchema, updateUserSchema } from "@/lib/validations/user"
import { revalidatePath }   from "next/cache"
import { redirect }         from "next/navigation"
import bcrypt               from "bcryptjs"
import { sendWelcomeEmail } from "@/lib/email"
import type { Role, EducationLevel, TeacherMode } from "@prisma/client"

function generateStudentPassword(): string {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower   = "abcdefghjkmnpqrstuvwxyz"
  const digits  = "23456789"
  const special = "@#$%!"
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)]
  const body = Array.from({ length: 4 }, () => rand(lower)).join("")
  return rand(upper) + body + rand(digits) + rand(digits) + rand(special)
}

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")
  return session
}

async function guardAdminAccount(targetId: string, sessionUserId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } })
  if (target?.role === "ADMIN" && targetId !== sessionUserId) {
    redirect(`/admin/usuarios?error=${encodeURIComponent("Contas de administrador não podem ser editadas por outros usuários")}`)
  }
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

  const { name, email, password: rawPassword, phone, role, grade, educationLevel, school, hourlyRate, bio, teachingMode, guardianId, relationship, selfGuardian } = parsed.data

  const emailNorm = email && email.trim() ? email.trim() : undefined
  const phoneNorm = phone ? phone.replace(/\D/g, "") : undefined

  if (emailNorm) {
    const exists = await prisma.user.findUnique({ where: { email: emailNorm } })
    if (exists) redirect("/admin/usuarios/novo?error=E-mail+já+cadastrado")
  }
  if (phoneNorm) {
    const existsPhone = await prisma.user.findUnique({ where: { phone: phoneNorm } })
    if (existsPhone) redirect("/admin/usuarios/novo?error=Telefone+já+cadastrado")
  }

  // Alunos: gerar senha automática se não foi fornecida
  let generatedPassword: string | undefined
  let passwordToHash = rawPassword
  if (role === "STUDENT" && !rawPassword) {
    generatedPassword = generateStudentPassword()
    passwordToHash    = generatedPassword
  }
  if (!passwordToHash) redirect("/admin/usuarios/novo?error=Senha+obrigatória+para+este+perfil")

  const hashed = await bcrypt.hash(passwordToHash, 12)

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email: emailNorm, password: hashed, phone: phoneNorm, role: role as Role },
    })

    if (role === "STUDENT") {
      const gId = guardianId && guardianId.trim() ? guardianId.trim() : undefined
      await tx.student.create({
        data: {
          userId:        user.id,
          name:          name,
          grade:         grade ?? "Não informado",
          school,
          educationLevel: educationLevel as EducationLevel | undefined,
          guardianId:    gId,
        },
      })
      // Aluno adulto que é seu próprio responsável
      if (selfGuardian === "on") {
        await tx.guardian.create({
          data: {
            userId:       user.id,
            relationship: "Próprio",
          },
        })
        // Atualiza guardianId do student para o guardian recém-criado
        const newGuardian = await tx.guardian.findUnique({ where: { userId: user.id } })
        if (newGuardian) {
          await tx.student.updateMany({
            where: { userId: user.id },
            data:  { guardianId: newGuardian.id },
          })
        }
      }
    }
    if (role === "TEACHER") {
      await tx.teacher.create({
        data: { userId: user.id, hourlyRate: hourlyRate ?? 0, bio, teachingMode: (teachingMode ?? "HYBRID") as TeacherMode },
      })
    }
    if (role === "GUARDIAN") {
      await tx.guardian.create({
        data: { userId: user.id, relationship: relationship || null },
      })
    }
  })

  // Enviar e-mail de boas-vindas para alunos com e-mail cadastrado
  if (role === "STUDENT" && emailNorm && generatedPassword) {
    try {
      await sendWelcomeEmail(emailNorm, name, generatedPassword)
    } catch {
      // Falha no e-mail não bloqueia o cadastro
    }
  }

  revalidatePath("/admin/usuarios")
  redirect("/admin/usuarios?success=Usuário+criado+com+sucesso")
}

// ─── Atualizar usuário ────────────────────────────────────────────────────────
export async function updateUserAction(id: string, formData: FormData) {
  const session = await requireAdmin()
  await guardAdminAccount(id, session.user.id)

  const raw = Object.fromEntries(formData)
  const parsed = updateUserSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos"
    redirect(`/admin/usuarios/${id}?error=${encodeURIComponent(msg)}`)
  }

  const { name, email, password, phone, role, grade, educationLevel, school, hourlyRate, bio, teachingMode, guardianId, relationship } = parsed.data

  const emailNorm = email && email.trim() ? email.trim() : null
  const phoneNorm = phone ? phone.replace(/\D/g, "") : null

  const updateData: Record<string, unknown> = { name, email: emailNorm, phone: phoneNorm, role }
  if (password) updateData.password = await bcrypt.hash(password, 12)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: updateData })

    if (role === "STUDENT") {
      const gId = guardianId && guardianId.trim() ? guardianId.trim() : undefined
      await tx.student.upsert({
        where:  { userId: id },
        update: { name: name ?? "Aluno", grade: grade ?? "Não informado", school, educationLevel: educationLevel as EducationLevel | undefined, guardianId: gId ?? null },
        create: { userId: id, name: name ?? "Aluno", grade: grade ?? "Não informado", school, educationLevel: educationLevel as EducationLevel | undefined, guardianId: gId },
      })
    }
    if (role === "TEACHER") {
      await tx.teacher.upsert({
        where:  { userId: id },
        update: { hourlyRate: hourlyRate ?? 0, bio, teachingMode: (teachingMode ?? "HYBRID") as TeacherMode },
        create: { userId: id, hourlyRate: hourlyRate ?? 0, bio, teachingMode: (teachingMode ?? "HYBRID") as TeacherMode },
      })
    }
    if (role === "GUARDIAN") {
      await tx.guardian.upsert({
        where:  { userId: id },
        update: { relationship: relationship || null },
        create: { userId: id, relationship: relationship || null },
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

// ─── Excluir usuário ──────────────────────────────────────────────────────────
export async function deleteUserAction(id: string) {
  const session = await requireAdmin()

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (target?.role === "ADMIN") {
    return { error: "Contas de administrador não podem ser excluídas" }
  }
  if (id === session.user.id) {
    return { error: "Você não pode excluir sua própria conta" }
  }

  await prisma.user.delete({ where: { id } })
  revalidatePath("/admin/usuarios")
  return { success: true }
}
