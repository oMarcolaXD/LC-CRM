"use server"

import { prisma }              from "@/lib/prisma"
import { auth }                from "@/lib/auth"
import { revalidatePath }      from "next/cache"
import { notify, notifyLessonConfirmed, notifyLowBalance } from "@/lib/notifications"
import { getRoomCount }        from "@/lib/config"
import { startOfDay, endOfDay } from "date-fns"
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

export async function approveRequestAction(
  requestId: string,
  modalityOverride?: "PRESENCIAL" | "ONLINE",
) {
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

  // Professor fisicamente na sede: sempre se for PRESENCIAL, ou se for HYBRID e a aula for presencial
  const teacherOnsite =
    request?.teacher.teachingMode === "PRESENCIAL" ||
    (request?.teacher.teachingMode === "HYBRID" && (modalityOverride ?? request?.modality) === "PRESENCIAL")
  if (!request) throw new Error("Solicitação não encontrada")

  const pkg = request.student.packages[0]
  if (!pkg) throw new Error("Aluno sem saldo de aulas")

  // Modalidade final: override do colaborador > modality do request > PRESENCIAL
  const finalModality = modalityOverride ?? request.modality ?? "PRESENCIAL"

  // ── Verificação de salas (apenas aulas presenciais) ─────────────────────────
  if (finalModality === "PRESENCIAL") {
    const roomCount  = await getRoomCount()
    const reqStart   = request.preferredAt.getTime()
    const reqEnd     = reqStart + 60 * 60_000 // assume 60 min se não definido
    const dayStart   = startOfDay(request.preferredAt)
    const dayEnd     = endOfDay(request.preferredAt)

    const presencialLessons = await prisma.lesson.findMany({
      where: {
        modality:    "PRESENCIAL",
        status:      { in: ["CONFIRMED", "SCHEDULED"] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, duration: true },
    })

    const conflicts = presencialLessons.filter((l) => {
      const lStart = l.scheduledAt.getTime()
      const lEnd   = lStart + (l.duration ?? 60) * 60_000
      return lStart < reqEnd && lEnd > reqStart
    })

    if (conflicts.length >= roomCount) {
      throw new Error(
        `Todas as ${roomCount} sala${roomCount !== 1 ? "s" : ""} estão ocupadas neste horário. ` +
        `Altere para ONLINE para aprovar mesmo assim.`
      )
    }
  }

  await prisma.$transaction([
    prisma.lesson.create({
      data: {
        studentId:    request.studentId,
        teacherId:    request.teacherId,
        subjectId:    request.subjectId ?? "",
        scheduledAt:  request.preferredAt,
        modality:     finalModality,
        status:       "CONFIRMED",
        teacherOnsite,
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

// ─── Criar aula diretamente (sem solicitação) ─────────────────────────────────

export async function createLessonDirectAction(data: {
  teacherId:  string
  studentId:  string
  subjectId:  string
  date:       string  // "YYYY-MM-DD"
  time:       string  // "HH:mm"
  modality:   "PRESENCIAL" | "ONLINE"
  duration?:  number
}) {
  await requireCollaboratorOrAdmin()

  const duration    = data.duration ?? 60
  const scheduledAt = new Date(`${data.date}T${data.time}:00`)

  const student = await prisma.student.findUnique({
    where:   { id: data.studentId },
    include: {
      user:     true,
      packages: {
        where:   { status: "ACTIVE", remainingLessons: { gt: 0 } },
        orderBy: { purchaseDate: "desc" },
        take:    1,
      },
    },
  })
  if (!student) throw new Error("Aluno não encontrado")

  const pkg = student.packages[0]
  if (!pkg) throw new Error("Aluno sem saldo de aulas disponível")

  const dayStart = startOfDay(scheduledAt)
  const dayEnd   = endOfDay(scheduledAt)

  // Verificação de salas presenciais
  if (data.modality === "PRESENCIAL") {
    const roomCount = await getRoomCount()
    const reqStart  = scheduledAt.getTime()
    const reqEnd    = reqStart + duration * 60_000

    const presencialLessons = await prisma.lesson.findMany({
      where:  {
        modality:    "PRESENCIAL",
        status:      { in: ["CONFIRMED", "SCHEDULED"] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, duration: true },
    })

    const conflicts = presencialLessons.filter(l => {
      const lStart = l.scheduledAt.getTime()
      const lEnd   = lStart + (l.duration ?? 60) * 60_000
      return lStart < reqEnd && lEnd > reqStart
    })

    if (conflicts.length >= roomCount) {
      throw new Error(
        `Todas as ${roomCount} sala${roomCount !== 1 ? "s" : ""} estão ocupadas neste horário. ` +
        `Altere para ONLINE para agendar mesmo assim.`
      )
    }
  }

  // Verificação de conflito do professor
  const teacherLessons = await prisma.lesson.findMany({
    where:  {
      teacherId:   data.teacherId,
      status:      { in: ["CONFIRMED", "SCHEDULED"] },
      scheduledAt: { gte: dayStart, lte: dayEnd },
    },
    select: { scheduledAt: true, duration: true },
  })

  const reqStart = scheduledAt.getTime()
  const reqEnd   = reqStart + duration * 60_000
  const hasConflict = teacherLessons.some(l => {
    const lStart = l.scheduledAt.getTime()
    const lEnd   = lStart + (l.duration ?? 60) * 60_000
    return lStart < reqEnd && lEnd > reqStart
  })
  if (hasConflict) throw new Error("Professor já tem uma aula neste horário")

  const [teacher, subject] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: data.teacherId }, include: { user: true } }),
    prisma.subject.findUnique({ where: { id: data.subjectId } }),
  ])

  const teacherOnsiteDirect =
    teacher?.teachingMode === "PRESENCIAL" ||
    (teacher?.teachingMode === "HYBRID" && data.modality === "PRESENCIAL")

  await prisma.$transaction([
    prisma.lesson.create({
      data: {
        studentId:    data.studentId,
        teacherId:    data.teacherId,
        subjectId:    data.subjectId,
        scheduledAt,
        duration,
        modality:     data.modality,
        status:       "CONFIRMED",
        teacherOnsite: teacherOnsiteDirect,
      },
    }),
    prisma.lessonPackage.update({
      where: { id: pkg.id },
      data:  {
        remainingLessons: { decrement: 1 },
        status: pkg.remainingLessons <= 1 ? "EXHAUSTED" : "ACTIVE",
      },
    }),
  ])

  const scheduledAtFormatted = format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  await notifyLessonConfirmed({
    studentUserId: student.userId,
    studentEmail:  student.user.email,
    studentPhone:  student.user.phone,
    teacherName:   teacher?.user.name ?? "–",
    subject:       subject?.name ?? "–",
    scheduledAt:   scheduledAtFormatted,
    modality:      data.modality === "PRESENCIAL" ? "Presencial" : "Online",
  })

  const remaining = pkg.remainingLessons - 1
  if (remaining <= 2 && remaining > 0) {
    await notifyLowBalance({
      studentUserId: student.userId,
      studentEmail:  student.user.email,
      studentPhone:  student.user.phone,
      remaining,
    })
  }

  revalidatePath("/colaborador/agenda")
  revalidatePath("/colaborador/agendamentos")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}
