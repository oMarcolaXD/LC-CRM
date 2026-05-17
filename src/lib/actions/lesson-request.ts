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
  teacherOnsiteOverride?: boolean,
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
  if (!request) throw new Error("Solicitação não encontrada")

  const pkg = request.student.packages[0]
  if (!pkg) throw new Error("Aluno sem saldo de aulas")

  // Modalidade final: override do colaborador > modality do request > PRESENCIAL
  const finalModality = modalityOverride ?? request.modality ?? "PRESENCIAL"

  // Localização do professor:
  // - Presencial → sempre na sede
  // - Online + ONLINE_ONLY → sempre em casa
  // - Online + PRESENCIAL/HYBRID → usa override do colaborador (padrão: em casa)
  let teacherOnsite: boolean
  if (finalModality === "PRESENCIAL") {
    teacherOnsite = true
  } else if (request.teacher.teachingMode === "ONLINE_ONLY") {
    teacherOnsite = false
  } else {
    teacherOnsite = teacherOnsiteOverride ?? false
  }

  const isHistorical = request.preferredAt < new Date()

  // ── Verificação de salas: presencial OU online com professor na sede ─────────
  const occupiesRoom = finalModality === "PRESENCIAL" || (finalModality === "ONLINE" && teacherOnsite)
  if (!isHistorical && occupiesRoom) {
    const roomCount  = await getRoomCount()
    const reqStart   = request.preferredAt.getTime()
    const reqEnd     = reqStart + 60 * 60_000
    const dayStart   = startOfDay(request.preferredAt)
    const dayEnd     = endOfDay(request.preferredAt)

    const roomLessons = await prisma.lesson.findMany({
      where: {
        OR: [
          { modality: "PRESENCIAL" },
          { modality: "ONLINE", teacherOnsite: true },
        ],
        status:      { in: ["CONFIRMED", "SCHEDULED"] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, duration: true },
    })

    const conflicts = roomLessons.filter((l) => {
      const lStart = l.scheduledAt.getTime()
      const lEnd   = lStart + (l.duration ?? 60) * 60_000
      return lStart < reqEnd && lEnd > reqStart
    })

    if (conflicts.length >= roomCount) {
      throw new Error(
        `Todas as ${roomCount} sala${roomCount !== 1 ? "s" : ""} estão ocupadas neste horário. ` +
        `Altere para ONLINE (em casa) para aprovar mesmo assim.`
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
        status:       isHistorical ? "COMPLETED" : "CONFIRMED",
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

  if (!isHistorical) {
    const scheduledAtFmt = format(request.preferredAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    await notifyLessonConfirmed({
      studentUserId: request.student.userId,
      studentEmail:  request.student.user.email,
      studentPhone:  request.student.user.phone,
      teacherName:   request.teacher.user.name,
      subject:       request.subject?.name ?? "–",
      scheduledAt:   scheduledAtFmt,
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

    // Aula em grupo: cancelar todas as aulas vinculadas pelo groupId
  if (status === "CANCELLED" && lesson.isGroupLesson && lesson.groupId) {
    const groupLessons = await prisma.lesson.findMany({
      where:   { groupId: lesson.groupId, status: { in: ["CONFIRMED", "SCHEDULED"] } },
      include: { student: { include: { user: true } }, subject: true },
    })
    await prisma.$transaction(
      groupLessons.map((gl) =>
        prisma.lesson.update({ where: { id: gl.id }, data: { status: "CANCELLED", topicsCovered, teacherNotes } })
      )
    )
    for (const gl of groupLessons) {
      await notify({
        userId:  gl.student.userId,
        type:    "LESSON_CANCELLED",
        title:   "Aula em grupo cancelada",
        message: `Sua aula em grupo de ${gl.subject.name} foi cancelada.`,
        email:   gl.student.user.email,
        phone:   gl.student.user.phone ?? undefined,
      })
    }
    revalidatePath("/professor/agenda")
    revalidatePath("/admin/agenda")
    revalidatePath("/colaborador/agenda")
    return
  }

  // Cancelamento de aula individual: devolve a aula ao pacote do aluno
  if (status === "CANCELLED" && !lesson.isGroupLesson) {
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

  const cancelMsg = lesson.isGroupLesson
    ? `Sua aula em grupo de ${lesson.subject.name} foi cancelada.`
    : `Sua aula de ${lesson.subject.name} foi cancelada. O saldo foi devolvido ao seu pacote.`

  const messages: Record<string, { title: string; message: string }> = {
    COMPLETED: {
      title:   "Aula realizada!",
      message: `Sua aula de ${lesson.subject.name} foi concluída.${topicsCovered ? ` Conteúdo: ${topicsCovered}` : ""}`,
    },
    CANCELLED: {
      title:   "Aula cancelada",
      message: cancelMsg,
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
  teacherId:     string
  studentId:     string
  subjectId:     string
  date:          string  // "YYYY-MM-DD"
  time:          string  // "HH:mm"
  modality:      "PRESENCIAL" | "ONLINE"
  duration?:     number
  teacherOnsite?: boolean  // override explícito para aulas online
}) {
  await requireCollaboratorOrAdmin()

  const duration    = data.duration ?? 60
  const scheduledAt = new Date(`${data.date}T${data.time}:00`)
  const isHistorical = scheduledAt < new Date()

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

  if (!isHistorical) {
    // Verificação de salas: presencial OU online com professor na sede
    const occupiesRoom = data.modality === "PRESENCIAL" || (data.modality === "ONLINE" && data.teacherOnsite === true)
    if (occupiesRoom) {
      const roomCount = await getRoomCount()
      const reqStart  = scheduledAt.getTime()
      const reqEnd    = reqStart + duration * 60_000

      const roomLessons = await prisma.lesson.findMany({
        where:  {
          OR: [
            { modality: "PRESENCIAL" },
            { modality: "ONLINE", teacherOnsite: true },
          ],
          status:      { in: ["CONFIRMED", "SCHEDULED"] },
          scheduledAt: { gte: dayStart, lte: dayEnd },
        },
        select: { scheduledAt: true, duration: true },
      })

      const conflicts = roomLessons.filter(l => {
        const lStart = l.scheduledAt.getTime()
        const lEnd   = lStart + (l.duration ?? 60) * 60_000
        return lStart < reqEnd && lEnd > reqStart
      })

      if (conflicts.length >= roomCount) {
        throw new Error(
          `Todas as ${roomCount} sala${roomCount !== 1 ? "s" : ""} estão ocupadas neste horário. ` +
          `Altere para ONLINE (em casa) para agendar mesmo assim.`
        )
      }
    }

    // Verificação de conflito do professor (apenas para aulas futuras)
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
  }

  const [teacher, subject] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: data.teacherId }, include: { user: true } }),
    prisma.subject.findUnique({ where: { id: data.subjectId } }),
  ])

  let teacherOnsiteDirect: boolean
  if (data.modality === "PRESENCIAL") {
    teacherOnsiteDirect = true
  } else if (teacher?.teachingMode === "ONLINE_ONLY") {
    teacherOnsiteDirect = false
  } else {
    teacherOnsiteDirect = data.teacherOnsite ?? false
  }

  await prisma.$transaction([
    prisma.lesson.create({
      data: {
        studentId:    data.studentId,
        teacherId:    data.teacherId,
        subjectId:    data.subjectId,
        scheduledAt,
        duration,
        modality:     data.modality,
        status:        isHistorical ? "COMPLETED" : "CONFIRMED",
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

  if (!isHistorical) {
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
  }

  revalidatePath("/colaborador/agenda")
  revalidatePath("/colaborador/agendamentos")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}

// ─── Criar aula em grupo ──────────────────────────────────────────────────────

export async function createGroupLessonAction(data: {
  teacherId:       string
  subjectId:       string
  studentIds:      string[]      // 2–4 alunos
  date:            string        // "YYYY-MM-DD"
  time:            string        // "HH:mm"
  modality:        "PRESENCIAL" | "ONLINE"
  pricePerStudent: number        // valor avulso cobrado de cada aluno
  duration?:       number
  teacherOnsite?:  boolean
}) {
  await requireCollaboratorOrAdmin()

  if (data.studentIds.length < 2 || data.studentIds.length > 4) {
    throw new Error("Uma aula em grupo deve ter entre 2 e 4 alunos")
  }

  const duration    = data.duration ?? 60
  const scheduledAt = new Date(`${data.date}T${data.time}:00`)
  const isHistorical = scheduledAt < new Date()
  const groupSize   = data.studentIds.length

  const [teacher, subject] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: data.teacherId }, include: { user: true } }),
    prisma.subject.findUnique({ where: { id: data.subjectId } }),
  ])
  if (!teacher) throw new Error("Professor não encontrado")
  if (!subject) throw new Error("Matéria não encontrada")

  let teacherOnsite: boolean
  if (data.modality === "PRESENCIAL") {
    teacherOnsite = true
  } else if (teacher.teachingMode === "ONLINE_ONLY") {
    teacherOnsite = false
  } else {
    teacherOnsite = data.teacherOnsite ?? false
  }

  const dayStart = startOfDay(scheduledAt)
  const dayEnd   = endOfDay(scheduledAt)

  if (!isHistorical) {
    const occupiesRoom = data.modality === "PRESENCIAL" || (data.modality === "ONLINE" && teacherOnsite)
    if (occupiesRoom) {
      const roomCount = await getRoomCount()
      const reqStart  = scheduledAt.getTime()
      const reqEnd    = reqStart + duration * 60_000

      const roomLessons = await prisma.lesson.findMany({
        where: {
          OR: [
            { modality: "PRESENCIAL" },
            { modality: "ONLINE", teacherOnsite: true },
          ],
          status:      { in: ["CONFIRMED", "SCHEDULED"] },
          scheduledAt: { gte: dayStart, lte: dayEnd },
        },
        select: { scheduledAt: true, duration: true },
      })

      const conflicts = roomLessons.filter((l) => {
        const lStart = l.scheduledAt.getTime()
        const lEnd   = lStart + (l.duration ?? 60) * 60_000
        return lStart < reqEnd && lEnd > reqStart
      })

      if (conflicts.length >= roomCount) {
        throw new Error(
          `Todas as ${roomCount} sala${roomCount !== 1 ? "s" : ""} estão ocupadas neste horário.`
        )
      }
    }

    const teacherLessons = await prisma.lesson.findMany({
      where: {
        teacherId:   data.teacherId,
        status:      { in: ["CONFIRMED", "SCHEDULED"] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, duration: true },
    })

    const reqStart  = scheduledAt.getTime()
    const reqEnd    = reqStart + duration * 60_000
    const hasConflict = teacherLessons.some((l) => {
      const lStart = l.scheduledAt.getTime()
      const lEnd   = lStart + (l.duration ?? 60) * 60_000
      return lStart < reqEnd && lEnd > reqStart
    })
    if (hasConflict) throw new Error("Professor já tem uma aula neste horário")
  }

  // Buscar todos os alunos
  const students = await prisma.student.findMany({
    where:   { id: { in: data.studentIds } },
    include: { user: true },
  })
  if (students.length !== groupSize) throw new Error("Um ou mais alunos não encontrados")

  const groupId = crypto.randomUUID()
  const scheduledAtFmt = format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  await prisma.$transaction([
    // Criar uma aula por aluno, todas vinculadas pelo groupId
    ...students.map((student) =>
      prisma.lesson.create({
        data: {
          studentId:     student.id,
          teacherId:     data.teacherId,
          subjectId:     data.subjectId,
          scheduledAt,
          duration,
          modality:      data.modality,
          status:        isHistorical ? "COMPLETED" : "CONFIRMED",
          teacherOnsite,
          isGroupLesson: true,
          groupId,
          groupSize,
          priceOverride: data.pricePerStudent,
        },
      })
    ),
    // Criar um pagamento por aluno (evento avulso, fora do pacote)
    ...students.map((student) =>
      prisma.payment.create({
        data: {
          studentId:   student.id,
          amount:      data.pricePerStudent,
          dueDate:     scheduledAt,
          description: `Aula em grupo – ${subject.name} (${scheduledAtFmt})`,
          status:      "PENDING",
        },
      })
    ),
  ])

  if (!isHistorical) {
    for (const student of students) {
      await notifyLessonConfirmed({
        studentUserId: student.userId,
        studentEmail:  student.user.email,
        studentPhone:  student.user.phone,
        teacherName:   teacher.user.name,
        subject:       subject.name,
        scheduledAt:   scheduledAtFmt,
        modality:      data.modality === "PRESENCIAL" ? "Presencial" : "Online",
      })
    }
  }

  revalidatePath("/colaborador/agenda")
  revalidatePath("/colaborador/agendamentos")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}
