"use server"

import { prisma }              from "@/lib/prisma"
import { auth }                from "@/lib/auth"
import { revalidatePath }      from "next/cache"
import { notify, notifyLessonConfirmed, notifyLowBalance } from "@/lib/notifications"
import { format }              from "date-fns"
import { ptBR }                from "date-fns/locale"

// ─── Helpers de autorização ───────────────────────────────────────────────────

async function requireCollaboratorOrAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")
  if (!["ADMIN", "COLLABORATOR"].includes(session.user.role)) throw new Error("Sem permissão")
  return session
}

// ─── Aprovar solicitação de aula ──────────────────────────────────────────────

export async function approveRequestAction(requestId: string) {
  const session = await requireCollaboratorOrAdmin()

  const request = await prisma.lessonRequest.findUnique({
    where:   { id: requestId },
    include: {
      student: {
        include: {
          user:     true,
          packages: { where: { status: "ACTIVE", remainingLessons: { gt: 0 } } },
        },
      },
      teacher: { include: { user: true } },
      subject: true,
    },
  })
  if (!request) throw new Error("Solicitação não encontrada")

  const pkg = request.student.packages[0]
  if (!pkg) throw new Error("Aluno sem saldo de aulas")

  await prisma.$transaction([
    prisma.lesson.create({
      data: {
        studentId:   request.studentId,
        teacherId:   request.teacherId,
        subjectId:   request.subjectId ?? "",
        scheduledAt: request.preferredAt,
        modality:    "PRESENCIAL",
        status:      "CONFIRMED",
      },
    }),
    prisma.lessonPackage.update({
      where: { id: pkg.id },
      data:  { remainingLessons: { decrement: 1 }, status: pkg.remainingLessons <= 1 ? "EXHAUSTED" : "ACTIVE" },
    }),
    prisma.lessonRequest.update({
      where: { id: requestId },
      data:  { status: "APPROVED", approvedBy: session.user.id },
    }),
  ])

  const scheduledAt = format(request.preferredAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  await notifyLessonConfirmed({
    studentUserId: request.student.userId,
    studentEmail:  request.student.user.email,
    studentPhone:  request.student.user.phone,
    teacherName:   request.teacher.user.name,
    subject:       request.subject?.name ?? "–",
    scheduledAt,
    modality:      "Presencial",
  })

  const remaining = pkg.remainingLessons - 1
  if (remaining <= 2 && remaining > 0) {
    await notifyLowBalance({
      studentUserId: request.student.userId,
      studentEmail:  request.student.user.email,
      studentPhone:  request.student.user.phone,
      remaining,
    })
  }

  revalidatePath("/colaborador/agendamentos")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}

// ─── Rejeitar solicitação de aula ─────────────────────────────────────────────

export async function rejectRequestAction(requestId: string, reason?: string) {
  const session = await requireCollaboratorOrAdmin()

  const request = await prisma.lessonRequest.findUnique({
    where:   { id: requestId },
    include: { student: { include: { user: true } }, subject: true },
  })
  if (!request) throw new Error("Solicitação não encontrada")

  await prisma.lessonRequest.update({
    where: { id: requestId },
    data:  { status: "REJECTED", reason, approvedBy: session.user.id },
  })

  await notify({
    userId:  request.student.userId,
    type:    "LESSON_CANCELLED",
    title:   "Solicitação de aula recusada",
    message: `Sua solicitação de aula de ${request.subject?.name ?? "–"} não pôde ser aprovada.${reason ? ` Motivo: ${reason}` : ""}`,
    email:   request.student.user.email,
    phone:   request.student.user.phone ?? undefined,
  })

  revalidatePath("/colaborador/agendamentos")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}

// ─── Atualizar status da aula ─────────────────────────────────────────────────

export async function updateLessonStatusAction(
  lessonId:      string,
  status:        "COMPLETED" | "CANCELLED" | "MISSED",
  topicsCovered?: string,
  teacherNotes?:  string,
) {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")
  if (!["ADMIN", "COLLABORATOR", "TEACHER"].includes(session.user.role)) throw new Error("Sem permissão")

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: {
      student: { include: { user: true } },
      teacher: { include: { user: true } },
      subject: true,
    },
  })
  if (!lesson) throw new Error("Aula não encontrada")

  // Professor só pode alterar suas próprias aulas
  if (session.user.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { user: { email: session.user.email ?? "" } },
    })
    if (!teacher || lesson.teacherId !== teacher.id) {
      throw new Error("Sem permissão para alterar esta aula")
    }
  }

  // Cancelamento devolve a aula ao pacote do aluno
  if (status === "CANCELLED") {
    const activePkg = await prisma.lessonPackage.findFirst({
      where:   { studentId: lesson.studentId, status: { in: ["ACTIVE", "EXHAUSTED"] } },
      orderBy: { purchaseDate: "desc" },
    })
    if (activePkg) {
      await prisma.$transaction([
        prisma.lesson.update({ where: { id: lessonId }, data: { status, topicsCovered, teacherNotes } }),
        prisma.lessonPackage.update({
          where: { id: activePkg.id },
          data:  { remainingLessons: { increment: 1 }, status: "ACTIVE" },
        }),
      ])
    } else {
      await prisma.lesson.update({ where: { id: lessonId }, data: { status, topicsCovered, teacherNotes } })
    }
  } else {
    await prisma.lesson.update({ where: { id: lessonId }, data: { status, topicsCovered, teacherNotes } })
  }

  const messages: Record<string, { title: string; message: string }> = {
    COMPLETED: {
      title:   "Aula realizada!",
      message: `Sua aula de ${lesson.subject.name} foi concluída.${topicsCovered ? ` Conteúdo: ${topicsCovered}` : ""}`,
    },
    CANCELLED: {
      title:   "Aula cancelada",
      message: `Sua aula de ${lesson.subject.name} foi cancelada. O saldo foi devolvido ao seu pacote.`,
    },
    MISSED: {
      title:   "Falta registrada",
      message: `Você não compareceu à aula de ${lesson.subject.name}. Entre em contato para remarcar.`,
    },
  }
  const msg = messages[status]
  if (msg) {
    await notify({
      userId:  lesson.student.userId,
      type:    status === "COMPLETED" ? "LESSON_COMPLETED" : status === "CANCELLED" ? "LESSON_CANCELLED" : "LESSON_MISSED",
      title:   msg.title,
      message: msg.message,
      email:   lesson.student.user.email,
      phone:   lesson.student.user.phone ?? undefined,
    })
  }

  revalidatePath("/professor/agenda")
  revalidatePath("/admin/agenda")
}
