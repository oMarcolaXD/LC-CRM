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

async function requireAdminOrCollaborator() {
  const session = await auth()
  const role = session?.user?.role
  if (role !== "ADMIN" && role !== "COLLABORATOR") throw new Error("Sem permissão")
  return session
}

async function guardAdminAccount(targetId: string, sessionUserId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } })
  if (target?.role === "ADMIN" && targetId !== sessionUserId) {
    redirect(`/admin/usuarios?error=${encodeURIComponent("Contas de administrador não podem ser editadas por outros usuários")}`)
  }
}

// ─── Criar usuário ────────────────────────────────────────────────────────────

export type UserFormState = { error: string } | null

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const session    = await requireAdminOrCollaborator()
  const callerRole = session!.user.role

  const raw    = Object.fromEntries(formData)
  const parsed = createUserSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const {
    name, email, password: rawPassword, phone, role,
    grade, educationLevel, school, hourlyRate, bio, teachingMode,
    guardianId, relationship,
    guardianMode, newGuardian_name, newGuardian_email, newGuardian_phone, newGuardian_relationship,
  } = parsed.data

  if (callerRole === "COLLABORATOR" && role === "ADMIN") {
    return { error: "Colaboradores não podem criar administradores" }
  }

  const emailNorm = email && email.trim() ? email.trim() : undefined
  const phoneNorm = phone ? phone.replace(/\D/g, "") : undefined

  if (emailNorm) {
    const exists = await prisma.user.findUnique({ where: { email: emailNorm } })
    if (exists) return { error: "E-mail já cadastrado" }
  }
  if (phoneNorm) {
    const existsPhone = await prisma.user.findFirst({ where: { phone: phoneNorm } })
    if (existsPhone) return { error: "Telefone já cadastrado" }
  }

  let generatedPassword: string | undefined
  let passwordToHash = rawPassword
  if (role === "STUDENT" && !rawPassword) {
    generatedPassword = generateStudentPassword()
    passwordToHash    = generatedPassword
  }
  if (!passwordToHash) return { error: "Senha obrigatória para este perfil" }

  const hashed = await bcrypt.hash(passwordToHash, 12)

  const userRole: Role = (role === "STUDENT" && guardianMode === "self") ? "GUARDIAN" : role as Role

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email: emailNorm, password: hashed, phone: phoneNorm, role: userRole },
    })

    if (role === "STUDENT") {
      let resolvedGuardianId: string | undefined

      if (guardianMode === "new" && newGuardian_name && newGuardian_name.trim()) {
        const gEmailNorm  = newGuardian_email && newGuardian_email.trim() ? newGuardian_email.trim() : undefined
        const gPhoneNorm  = newGuardian_phone ? newGuardian_phone.replace(/\D/g, "") : undefined
        const gPassword   = await bcrypt.hash(generateStudentPassword(), 12)
        const guardianUser = await tx.user.create({
          data: {
            name:     newGuardian_name.trim(),
            email:    gEmailNorm,
            phone:    gPhoneNorm,
            password: gPassword,
            role:     "GUARDIAN",
          },
        })
        const guardian = await tx.guardian.create({
          data: { userId: guardianUser.id, relationship: newGuardian_relationship || null },
        })
        resolvedGuardianId = guardian.id

      } else if (guardianMode === "existing") {
        resolvedGuardianId = guardianId && guardianId.trim() ? guardianId.trim() : undefined

      } else if (guardianMode === "self") {
        await tx.student.create({
          data: { userId: user.id, name, grade: grade ?? "Não informado", school, educationLevel: educationLevel as EducationLevel | undefined },
        })
        const selfG = await tx.guardian.create({ data: { userId: user.id, relationship: "Próprio" } })
        await tx.student.update({ where: { userId: user.id }, data: { guardianId: selfG.id } })
        return
      }

      await tx.student.create({
        data: {
          userId:         user.id,
          name,
          grade:          grade ?? "Não informado",
          school,
          educationLevel: educationLevel as EducationLevel | undefined,
          guardianId:     resolvedGuardianId,
        },
      })
    }

    if (role === "TEACHER") {
      await tx.teacher.create({
        data: { userId: user.id, hourlyRate: hourlyRate ?? 0, bio, teachingMode: (teachingMode ?? "HYBRID") as TeacherMode },
      })
    }
    if (role === "GUARDIAN") {
      const guardian = await tx.guardian.create({
        data: { userId: user.id, relationship: relationship || null },
      })
      const studentIds = formData.getAll("studentIds").map(String).filter(Boolean)
      if (studentIds.length > 0) {
        await tx.student.updateMany({
          where: { id: { in: studentIds } },
          data:  { guardianId: guardian.id },
        })
      }
    }
  })

  if (role === "STUDENT" && emailNorm && generatedPassword) {
    try { await sendWelcomeEmail(emailNorm, name, generatedPassword) } catch { /* não bloqueia */ }
  }

  revalidatePath("/admin/usuarios")

  if (callerRole === "COLLABORATOR") {
    redirect("/colaborador/alunos?success=Usuário+criado+com+sucesso")
  }

  if (role === "STUDENT") {
    redirect("/colaborador/alunos?success=Aluno+criado+com+sucesso")
  }
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
      const guardian = await tx.guardian.upsert({
        where:  { userId: id },
        update: { relationship: relationship || null },
        create: { userId: id, relationship: relationship || null },
      })
      const studentIds = formData.getAll("studentIds").map(String).filter(Boolean)
      // Desvincular alunos que foram desmarcados
      await tx.student.updateMany({
        where: { guardianId: guardian.id, id: { notIn: studentIds } },
        data:  { guardianId: null },
      })
      // Vincular alunos selecionados
      if (studentIds.length > 0) {
        await tx.student.updateMany({
          where: { id: { in: studentIds } },
          data:  { guardianId: guardian.id },
        })
      }
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

// ─── Excluir múltiplos usuários ───────────────────────────────────────────────
export async function deleteManyUsersAction(ids: string[]) {
  const session = await requireAdmin()
  if (!ids.length) return { deleted: 0 }

  const targets = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id:      true,
      role:    true,
      student: { select: { id: true } },
      teacher: { select: { id: true } },
    },
  })

  const deletable   = targets.filter((u) => u.role !== "ADMIN" && u.id !== session.user.id)
  if (!deletable.length) return { deleted: 0 }

  const deletableIds = deletable.map((u) => u.id)
  const studentIds   = deletable.flatMap((u) => u.student ? [u.student.id] : [])
  const teacherIds   = deletable.flatMap((u) => u.teacher ? [u.teacher.id] : [])

  await prisma.$transaction(async (tx) => {
    // Aulas dos professores que serão deletados
    const lessonIds = teacherIds.length
      ? (await tx.lesson.findMany({ where: { teacherId: { in: teacherIds } }, select: { id: true } })).map((l) => l.id)
      : []

    // Dependentes de Lesson (sem cascade)
    if (lessonIds.length) {
      await tx.homework.deleteMany({ where: { lessonId: { in: lessonIds } } })
    }

    // Dependentes de Teacher (sem cascade)
    if (teacherIds.length) {
      await tx.lessonRequest.deleteMany({ where: { teacherId: { in: teacherIds } } })
      await tx.material.deleteMany({ where: { teacherId: { in: teacherIds } } }) // cascateia MaterialStudent
      await tx.lesson.deleteMany({ where: { teacherId: { in: teacherIds } } })   // cascateia LessonParticipant
      await tx.teacherPayout.deleteMany({ where: { teacherId: { in: teacherIds } } })
    }

    // Dependentes de Student (sem cascade)
    if (studentIds.length) {
      await tx.lessonPackage.deleteMany({ where: { studentId: { in: studentIds } } })
      await tx.lessonRequest.deleteMany({ where: { studentId: { in: studentIds } } })
      await tx.payment.deleteMany({ where: { studentId: { in: studentIds } } })
    }

    // Dependentes de User (sem cascade)
    await tx.activityLog.deleteMany({ where: { userId: { in: deletableIds } } })
    await tx.studentNote.deleteMany({ where: { authorId: { in: deletableIds } } })

    // Deleta usuários — cascateia Student, Guardian, Teacher, Notification
    await tx.user.deleteMany({ where: { id: { in: deletableIds } } })
  })

  revalidatePath("/admin/usuarios")
  return { deleted: deletable.length }
}
