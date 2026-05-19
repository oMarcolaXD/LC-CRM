"use server"

import { prisma }         from "@/lib/prisma"
import { auth }           from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { notify }         from "@/lib/notifications"

async function requireTeacherOrAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")
  if (!["ADMIN", "TEACHER"].includes(session.user.role)) throw new Error("Sem permissão")
  return session
}

async function requireStudent() {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")
  if (!["GUARDIAN", "ADMIN"].includes(session.user.role)) throw new Error("Sem permissão")
  return session
}

export async function assignHomeworkAction(
  lessonId:     string,
  title:        string,
  description?: string,
  dueDate?:     string,
) {
  const session = await requireTeacherOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: { student: { include: { user: true } } },
  })
  if (!lesson) throw new Error("Aula não encontrada")

  // Professor só pode atribuir lição às suas próprias aulas
  if (session.user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { user: { email: session.user.email ?? "" } },
    })
    if (!teacher || lesson.teacherId !== teacher.id) {
      throw new Error("Sem permissão para esta aula")
    }
  }

  await prisma.homework.create({
    data: {
      lessonId,
      title,
      description: description || null,
      dueDate:     dueDate ? new Date(dueDate) : null,
    },
  })

  if (lesson.student.user?.id) {
    await notify({
      userId:  lesson.student.user?.id,
      type:    "HOMEWORK_ASSIGNED",
      title:   "Nova lição de casa!",
      message: `Você recebeu uma nova lição de casa: "${title}".${dueDate ? ` Prazo: ${new Date(dueDate).toLocaleDateString("pt-BR")}.` : ""}`,
      email:   lesson.student.user?.email ?? undefined,
      phone:   lesson.student.user?.phone ?? undefined,
    })
  }

  revalidatePath("/aluno/licoes")
  revalidatePath(`/professor/agenda/${lessonId}`)
}

export async function completeHomeworkAction(homeworkId: string) {
  const session = await requireStudent()

  const homework = await prisma.homework.findUnique({
    where:   { id: homeworkId },
    include: { lesson: { select: { studentId: true } } },
  })
  if (!homework) throw new Error("Lição não encontrada")

  if (session.user.role === "GUARDIAN") {
    const guardian = await prisma.guardian.findFirst({
      where:   { userId: session.user.id },
      include: { students: { select: { id: true } } },
    })
    const owns = guardian?.students.some((s) => s.id === homework.lesson.studentId)
    if (!owns) throw new Error("Sem permissão para esta lição")
  }

  await prisma.homework.update({
    where: { id: homeworkId },
    data:  { status: "COMPLETED", completedAt: new Date() },
  })

  revalidatePath("/aluno/licoes")
}
