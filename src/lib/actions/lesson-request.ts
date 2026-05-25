"use server"

import { prisma }              from "@/lib/prisma"
import { auth }                from "@/lib/auth"
import { revalidatePath }      from "next/cache"
import { notify, notifyLessonConfirmed, notifyLowBalance } from "@/lib/notifications"
import { getRoomCount, getOperationalConfig, isOperational } from "@/lib/config"
import { startOfDay, endOfDay, addWeeks, addMonths, parseISO, isAfter } from "date-fns"
import { format }              from "date-fns"
import { ptBR }                from "date-fns/locale"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lessonCost(durationMinutes: number): number {
  return durationMinutes / 60
}

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
          guardian: { include: { user: true } },
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

  const pkgRemaining = Number(pkg.remainingLessons)
  if (pkgRemaining < 1) {
    throw new Error(`Saldo insuficiente para uma aula completa. O aluno tem ${pkgRemaining.toFixed(1).replace(".", ",")} aulas restantes.`)
  }

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

  // ── Verificação de horário de funcionamento ───────────────────────────────────
  if (!isHistorical) {
    const opConfig = await getOperationalConfig()
    if (!isOperational(request.preferredAt, opConfig)) {
      const days  = opConfig.days
      const start = `${String(Math.floor(opConfig.startMin / 60)).padStart(2, "0")}:${String(opConfig.startMin % 60).padStart(2, "0")}`
      const end   = `${String(Math.floor(opConfig.endMin   / 60)).padStart(2, "0")}:${String(opConfig.endMin   % 60).padStart(2, "0")}`
      const dowNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
      const diasStr  = days.map(d => dowNames[d]).join(", ")
      throw new Error(
        `Fora do horário de funcionamento (${diasStr}, ${start}–${end}). ` +
        `Verifique as configurações ou escolha outro horário.`
      )
    }
  }

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
        teacherId:    request.teacherId,
        subjectId:    request.subjectId ?? "",
        scheduledAt:  request.preferredAt,
        modality:     finalModality,
        status:       isHistorical ? "COMPLETED" : "CONFIRMED",
        teacherOnsite,
        participants: { create: { studentId: request.studentId } },
      },
    }),
    prisma.lessonPackage.update({
      where: { id: pkg.id },
      data:  { remainingLessons: { decrement: 1 }, status: pkgRemaining <= 1 ? "EXHAUSTED" : "ACTIVE" },
    }),
    prisma.lessonRequest.update({
      where: { id: requestId },
      data:  { status: "APPROVED", approvedBy: session.user.id },
    }),
  ])

  if (!isHistorical) {
    // Destinatário: aluno (se tiver login próprio) ou o responsável
    const recipientId    = request.student.userId ?? request.student.guardian?.userId
    const recipientEmail = request.student.user?.email ?? request.student.guardian?.user?.email ?? null
    const recipientPhone = request.student.user?.phone ?? request.student.guardian?.user?.phone ?? null

    if (recipientId) {
      const scheduledAtFmt = format(request.preferredAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      await notifyLessonConfirmed({
        studentUserId: recipientId,
        studentEmail:  recipientEmail,
        studentPhone:  recipientPhone,
        teacherName:   request.teacher.user.name,
        subject:       request.subject?.name ?? "–",
        scheduledAt:   scheduledAtFmt,
        modality:      finalModality === "PRESENCIAL" ? "Presencial" : "Online",
      })

      const remaining = pkgRemaining - 1
      if (remaining <= 2 && remaining > 0) {
        await notifyLowBalance({
          studentUserId: recipientId,
          studentEmail:  recipientEmail,
          studentPhone:  recipientPhone,
          remaining,
        })
      }
    }
  }

  revalidatePath("/colaborador/dashboard")
  revalidatePath("/colaborador/agendamentos")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}

// ─── Rejeitar solicitação de aula ─────────────────────────────────────────────

export async function rejectRequestAction(requestId: string, reason?: string) {
  const session = await requireCollaboratorOrAdmin()

  const request = await prisma.lessonRequest.findUnique({
    where:   { id: requestId },
    include: { student: { include: { user: true, guardian: { include: { user: true } } } }, subject: true },
  })
  if (!request) throw new Error("Solicitação não encontrada")

  await prisma.lessonRequest.update({
    where: { id: requestId },
    data:  { status: "REJECTED", reason, approvedBy: session.user.id },
  })

  const recipientId    = request.student.userId ?? request.student.guardian?.userId
  const recipientEmail = request.student.user?.email ?? request.student.guardian?.user?.email ?? undefined
  const recipientPhone = request.student.user?.phone ?? request.student.guardian?.user?.phone ?? undefined

  if (recipientId) {
    await notify({
      userId:  recipientId,
      type:    "LESSON_CANCELLED",
      title:   "Solicitação de aula recusada",
      message: `Sua solicitação de aula de ${request.subject?.name ?? "–"} não pôde ser aprovada.${reason ? ` Motivo: ${reason}` : ""}`,
      email:   recipientEmail,
      phone:   recipientPhone,
    })
  }

  revalidatePath("/colaborador/dashboard")
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
  if (!["ADMIN", "COLLABORATOR"].includes(session.user.role)) throw new Error("Sem permissão")

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: {
      participants: { include: { student: { include: { user: true, guardian: { include: { user: true } } } } } },
      teacher: { include: { user: true } },
      subject: true,
    },
  })
  if (!lesson) throw new Error("Aula não encontrada")

  if (["CANCELLED", "COMPLETED", "MISSED"].includes(lesson.status)) {
    throw new Error("Esta aula já foi finalizada e não pode ser alterada")
  }

  const isGroup = lesson.participants.length > 1

  // Aula em grupo cancelada: cancela esta aula (já contém todos os alunos)
  if (status === "CANCELLED" && isGroup) {
    await prisma.lesson.update({ where: { id: lessonId }, data: { status: "CANCELLED", topicsCovered, teacherNotes } })
    for (const p of lesson.participants) {
      const rid   = p.student.userId ?? p.student.guardian?.userId
      const email = p.student.user?.email ?? p.student.guardian?.user?.email ?? undefined
      const phone = p.student.user?.phone ?? p.student.guardian?.user?.phone ?? undefined
      if (!rid) continue
      await notify({
        userId:  rid,
        type:    "LESSON_CANCELLED",
        title:   "Aula em grupo cancelada",
        message: `Sua aula em grupo de ${lesson.subject?.name ?? "–"} foi cancelada.`,
        email,
        phone,
      })
    }
    revalidatePath("/professor/agenda")
    revalidatePath("/admin/agenda")
    revalidatePath("/colaborador/agenda")
    return
  }

  // Cancelamento de aula individual: devolve a aula ao pacote do aluno
  if (status === "CANCELLED" && !isGroup) {
    const studentId = lesson.participants[0]?.studentId
    const activePkg = studentId
      ? await prisma.lessonPackage.findFirst({
          where:   { studentId, status: { in: ["ACTIVE", "EXHAUSTED"] } },
          orderBy: { purchaseDate: "desc" },
        })
      : null
    if (activePkg) {
      const refundCost = lessonCost(lesson.duration)
      await prisma.$transaction([
        prisma.lesson.update({ where: { id: lessonId }, data: { status, topicsCovered, teacherNotes } }),
        prisma.lessonPackage.update({
          where: { id: activePkg.id },
          data:  { remainingLessons: { increment: refundCost }, status: "ACTIVE" },
        }),
      ])
    } else {
      await prisma.lesson.update({ where: { id: lessonId }, data: { status, topicsCovered, teacherNotes } })
    }
  } else {
    await prisma.lesson.update({ where: { id: lessonId }, data: { status, topicsCovered, teacherNotes } })
  }

  const cancelMsg = isGroup
    ? `Sua aula em grupo de ${lesson.subject?.name ?? "–"} foi cancelada.`
    : `Sua aula de ${lesson.subject?.name ?? "–"} foi cancelada. O saldo foi devolvido ao seu pacote.`

  const messages: Record<string, { title: string; message: string }> = {
    COMPLETED: {
      title:   "Aula realizada!",
      message: `Sua aula de ${lesson.subject?.name ?? "–"} foi concluída.${topicsCovered ? ` Conteúdo: ${topicsCovered}` : ""}`,
    },
    CANCELLED: {
      title:   "Aula cancelada",
      message: cancelMsg,
    },
    MISSED: {
      title:   "Falta registrada",
      message: `Você não compareceu à aula de ${lesson.subject?.name ?? "–"}. Entre em contato para remarcar.`,
    },
  }
  const msg = messages[status]
  if (msg) {
    for (const p of lesson.participants) {
      const rid   = p.student.userId ?? p.student.guardian?.userId
      const email = p.student.user?.email ?? p.student.guardian?.user?.email ?? undefined
      const phone = p.student.user?.phone ?? p.student.guardian?.user?.phone ?? undefined
      if (!rid) continue
      await notify({
        userId:  rid,
        type:    status === "COMPLETED" ? "LESSON_COMPLETED" : status === "CANCELLED" ? "LESSON_CANCELLED" : "LESSON_MISSED",
        title:   msg.title,
        message: msg.message,
        email,
        phone,
      })
    }
  }

  revalidatePath("/professor/agenda")
  revalidatePath("/admin/agenda")
}

// ─── Criar aula diretamente (sem solicitação) ─────────────────────────────────

export async function createLessonDirectAction(data: {
  teacherId:      string
  studentId:      string
  subjectId:      string
  date:           string  // "YYYY-MM-DD"
  time:           string  // "HH:mm"
  modality:       "PRESENCIAL" | "ONLINE"
  duration?:      number
  teacherOnsite?: boolean  // override explícito para aulas online
  statusOverride?: "COMPLETED" | "MISSED"  // forçar status em aulas passadas
  topicsCovered?: string
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

  const cost         = lessonCost(duration)
  const pkgRemaining = Number(pkg.remainingLessons)
  if (pkgRemaining < cost) {
    throw new Error(`Saldo insuficiente. O aluno tem ${pkgRemaining.toFixed(1).replace(".", ",")} aulas restantes e esta aula custa ${cost.toFixed(1).replace(".", ",")} aula.`)
  }

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
        teacherId:    data.teacherId,
        subjectId:    data.subjectId,
        scheduledAt,
        duration,
        modality:     data.modality,
        status:        isHistorical ? (data.statusOverride ?? "COMPLETED") : "CONFIRMED",
        teacherOnsite: teacherOnsiteDirect,
        topicsCovered: data.topicsCovered ?? null,
        participants: { create: { studentId: data.studentId } },
      },
    }),
    prisma.lessonPackage.update({
      where: { id: pkg.id },
      data:  {
        remainingLessons: { decrement: cost },
        status: pkgRemaining <= cost ? "EXHAUSTED" : "ACTIVE",
      },
    }),
  ])

  if (!isHistorical) {
    const scheduledAtFormatted = format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    await notifyLessonConfirmed({
      studentUserId: student.userId ?? "",
      studentEmail:  student.user?.email ?? null,
      studentPhone:  student.user?.phone ?? null,
      teacherName:   teacher?.user.name ?? "–",
      subject:       subject?.name ?? "–",
      scheduledAt:   scheduledAtFormatted,
      modality:      data.modality === "PRESENCIAL" ? "Presencial" : "Online",
    })

    const remaining = pkgRemaining - cost
    if (remaining <= 2 && remaining > 0) {
      await notifyLowBalance({
        studentUserId: student.userId ?? "",
        studentEmail:  student.user?.email ?? null,
        studentPhone:  student.user?.phone ?? null,
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
  teacherId:        string
  subjectId:        string
  studentIds:       string[]      // 2–4 alunos
  date:             string        // "YYYY-MM-DD"
  time:             string        // "HH:mm"
  modality:         "PRESENCIAL" | "ONLINE"
  pricePerStudent?: number        // valor uniforme por aluno (omita se usar studentPrices)
  studentPrices?:   { studentId: string; price: number }[]   // preços individuais — sobrescreve pricePerStudent
  studentPayments?: { studentId: string; paid: boolean }[]   // status de pagamento por aluno
  statusOverride?:  "COMPLETED" | "MISSED"  // para registro de aulas passadas em grupo
  duration?:        number
  teacherOnsite?:   boolean
}) {
  await requireCollaboratorOrAdmin()

  if (data.studentIds.length < 2 || data.studentIds.length > 4) {
    throw new Error("Uma aula em grupo deve ter entre 2 e 4 alunos")
  }

  const duration    = data.duration ?? 60
  const scheduledAt = new Date(`${data.date}T${data.time}:00`)
  const isHistorical = scheduledAt < new Date()

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
  if (students.length !== data.studentIds.length) throw new Error("Um ou mais alunos não encontrados")

  const scheduledAtFmt = format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  await prisma.$transaction([
    // Uma única aula com todos os participantes
    prisma.lesson.create({
      data: {
        teacherId:     data.teacherId,
        subjectId:     data.subjectId,
        scheduledAt,
        duration,
        modality:      data.modality,
        status:        isHistorical ? (data.statusOverride ?? "COMPLETED") : "CONFIRMED",
        lessonType:    "GROUP",
        teacherOnsite,
        priceOverride: data.pricePerStudent ?? null,
        participants: { create: students.map((s) => ({ studentId: s.id })) },
      },
    }),
    // Criar um pagamento por aluno — valor e status individuais
    ...students.map((student) => {
      const payInfo = data.studentPayments?.find(sp => sp.studentId === student.id)
      const isPaid  = payInfo?.paid ?? false
      return prisma.payment.create({
        data: {
          studentId:   student.id,
          amount:      data.studentPrices?.find(sp => sp.studentId === student.id)?.price
                       ?? data.pricePerStudent
                       ?? 0,
          dueDate:     scheduledAt,
          paidAt:      isPaid ? scheduledAt : undefined,
          description: `Aula em grupo – ${subject.name} (${scheduledAtFmt})`,
          status:      isPaid ? "PAID" : "PENDING",
        },
      })
    }),
  ])

  if (!isHistorical) {
    for (const student of students) {
      await notifyLessonConfirmed({
        studentUserId: student.userId ?? "",
        studentEmail:  student.user?.email ?? null,
        studentPhone:  student.user?.phone ?? null,
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

// ─── Registrar aulas passadas em lote (para pacotes retroativos) ─────────────

export async function createBatchPastLessonsAction(data: {
  studentId: string
  packageId: string
  modality:  "PRESENCIAL" | "ONLINE"
  lessons:   { date: string; time: string; status: "COMPLETED" | "MISSED"; teacherId: string; subjectId: string; duration: number }[]
}) {
  await requireCollaboratorOrAdmin()
  if (!data.lessons.length) return

  const pkg = await prisma.lessonPackage.findUnique({ where: { id: data.packageId } })
  if (!pkg) throw new Error("Pacote não encontrado")

  const totalCost    = data.lessons.reduce((sum, l) => sum + lessonCost(l.duration), 0)
  const pkgRemaining = Number(pkg.remainingLessons)
  const newRemaining = Math.max(0, pkgRemaining - totalCost)
  const newStatus    = newRemaining <= 0 ? "EXHAUSTED" : "ACTIVE"

  await prisma.$transaction([
    ...data.lessons.map(({ date, time, status, teacherId, subjectId, duration }) => {
      const scheduledAt = new Date(`${date}T${time}:00`)
      return prisma.lesson.create({
        data: {
          teacherId,
          subjectId,
          scheduledAt,
          duration,
          modality:     data.modality,
          teacherOnsite: data.modality === "PRESENCIAL",
          status,
          participants: { create: { studentId: data.studentId } },
        },
      })
    }),
    prisma.lessonPackage.update({
      where: { id: data.packageId },
      data:  { remainingLessons: newRemaining, status: newStatus },
    }),
  ])

  revalidatePath(`/colaborador/alunos/${data.studentId}`)
  revalidatePath(`/admin/usuarios/${data.studentId}`)
  revalidatePath("/colaborador/agenda")
  revalidatePath("/admin/agenda")
}

// ─── Editar Aula (admin only) ─────────────────────────────────────────────────

export async function updateLessonDirectAction(data: {
  lessonId:       string
  studentId:      string   // para revalidação
  date:           string   // "YYYY-MM-DD"
  time:           string   // "HH:mm"
  teacherId:      string
  subjectId:      string
  modality:       "PRESENCIAL" | "ONLINE"
  duration:       number
  topicsCovered?: string
  teacherNotes?:  string
  status:         "COMPLETED" | "MISSED" | "CONFIRMED" | "CANCELLED" | "SCHEDULED"
}) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")

  const scheduledAt  = new Date(`${data.date}T${data.time}:00`)
  const teacherOnsite = data.modality === "PRESENCIAL"

  await prisma.lesson.update({
    where: { id: data.lessonId },
    data: {
      scheduledAt,
      teacherId:     data.teacherId,
      subjectId:     data.subjectId,
      modality:      data.modality,
      duration:      data.duration,
      teacherOnsite,
      topicsCovered: data.topicsCovered || null,
      teacherNotes:  data.teacherNotes  || null,
      status:        data.status,
    },
  })

  revalidatePath(`/colaborador/alunos/${data.studentId}`)
  revalidatePath(`/admin/usuarios/${data.studentId}`)
  revalidatePath("/colaborador/agenda")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}

// ─── Criar Aulão ──────────────────────────────────────────────────────────────

export async function createAulaoAction(data: {
  teacherId:        string
  subjectId:        string
  title:            string
  date:             string
  time:             string
  duration?:        number
  modality:         "PRESENCIAL" | "ONLINE"
  capacity?:        number
  isFree:           boolean
  pricePerStudent?: number
  studentIds?:      string[]
  teacherOnsite?:   boolean
  recurrence?:      { rule: "WEEKLY" | "BIWEEKLY" | "MONTHLY"; endsAt: string }
}) {
  await requireCollaboratorOrAdmin()

  const duration     = data.duration ?? 90
  const scheduledAt  = new Date(`${data.date}T${data.time}:00`)
  const isHistorical = scheduledAt < new Date()
  const studentIds   = data.studentIds ?? []

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
          OR: [{ modality: "PRESENCIAL" }, { modality: "ONLINE", teacherOnsite: true }],
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
        throw new Error(`Todas as ${roomCount} sala${roomCount !== 1 ? "s" : ""} estão ocupadas neste horário.`)
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
    const reqStart    = scheduledAt.getTime()
    const reqEnd      = reqStart + duration * 60_000
    const hasConflict = teacherLessons.some((l) => {
      const lStart = l.scheduledAt.getTime()
      const lEnd   = lStart + (l.duration ?? 60) * 60_000
      return lStart < reqEnd && lEnd > reqStart
    })
    if (hasConflict) throw new Error("Professor já tem uma aula neste horário")
  }

  const students = studentIds.length > 0
    ? await prisma.student.findMany({ where: { id: { in: studentIds } }, include: { user: true } })
    : []

  // ── Gera datas (recorrência ou data única) ────────────────────────────────
  let dates: Date[]

  if (data.recurrence) {
    const { rule, endsAt } = data.recurrence
    const endsAtDate = parseISO(endsAt)
    dates = [scheduledAt]
    let current = scheduledAt
    for (let i = 0; i < 104; i++) {
      const next = rule === "WEEKLY"    ? addWeeks(current, 1)
                 : rule === "BIWEEKLY" ? addWeeks(current, 2)
                 :                       addMonths(current, 1)
      if (isAfter(next, endsAtDate)) break
      dates.push(next)
      current = next
    }
  } else {
    dates = [scheduledAt]
  }

  await prisma.$transaction(async (tx) => {
    let recurrenceGroupId: string | undefined

    if (data.recurrence) {
      const group = await tx.recurrenceGroup.create({
        data: {
          rule:     data.recurrence.rule,
          startsAt: scheduledAt,
          endsAt:   parseISO(data.recurrence.endsAt),
        },
      })
      recurrenceGroupId = group.id
    }

    for (const date of dates) {
      const scheduledAtFmt = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      const isPast = date < new Date()

      await tx.lesson.create({
        data: {
          teacherId:         data.teacherId,
          subjectId:         data.subjectId,
          scheduledAt:       date,
          duration,
          modality:          data.modality,
          status:            isPast ? "COMPLETED" : "CONFIRMED",
          lessonType:        "AULAO",
          title:             data.title,
          capacity:          data.capacity ?? null,
          teacherOnsite,
          priceOverride:     data.isFree ? 0 : (data.pricePerStudent ?? 0),
          recurrenceGroupId: recurrenceGroupId ?? null,
          participants:      studentIds.length > 0
            ? { create: students.map((s) => ({ studentId: s.id })) }
            : undefined,
        },
      })

      if (!data.isFree && students.length > 0) {
        for (const student of students) {
          await tx.payment.create({
            data: {
              studentId:   student.id,
              amount:      data.pricePerStudent!,
              dueDate:     date,
              description: `Aulão – ${subject.name} – ${data.title} (${scheduledAtFmt})`,
              status:      "PENDING",
            },
          })
        }
      }
    }
  })

  revalidatePath("/colaborador/agenda")
  revalidatePath("/colaborador/agendamentos")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
  revalidatePath("/colaborador/auloes")
}

// ─── Aprovar em lote ─────────────────────────────────────────────────────────

export async function bulkApproveRequestsAction(ids: string[]) {
  await requireCollaboratorOrAdmin()
  const results = { approved: 0, failed: [] as { id: string; reason: string }[] }
  for (const id of ids) {
    try {
      await approveRequestAction(id)
      results.approved++
    } catch (e) {
      results.failed.push({ id, reason: e instanceof Error ? e.message : "Erro" })
    }
  }
  return results
}

// ─── Rejeitar em lote ─────────────────────────────────────────────────────────

export async function bulkRejectRequestsAction(ids: string[]) {
  const session = await requireCollaboratorOrAdmin()

  const requests = await prisma.lessonRequest.findMany({
    where:   { id: { in: ids }, status: "PENDING" },
    include: { student: { include: { user: true, guardian: { include: { user: true } } } }, subject: true },
  })

  await prisma.lessonRequest.updateMany({
    where: { id: { in: ids } },
    data:  { status: "REJECTED", approvedBy: session.user.id },
  })

  await Promise.allSettled(
    requests.map(async (request) => {
      const recipientId    = request.student.userId ?? request.student.guardian?.userId
      const recipientEmail = request.student.user?.email ?? request.student.guardian?.user?.email ?? undefined
      const recipientPhone = request.student.user?.phone ?? request.student.guardian?.user?.phone ?? undefined
      if (!recipientId) return
      await notify({
        userId:  recipientId,
        type:    "LESSON_CANCELLED",
        title:   "Solicitação de aula recusada",
        message: `Sua solicitação de aula de ${request.subject?.name ?? "–"} não pôde ser aprovada.`,
        email:   recipientEmail,
        phone:   recipientPhone,
      })
    })
  )

  revalidatePath("/colaborador/agendamentos")
  revalidatePath("/colaborador/dashboard")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}

// ─── Reagendar e aprovar ──────────────────────────────────────────────────────

export async function rescheduleAndApproveRequestAction(
  requestId:      string,
  newDate:        string,
  newTime:        string,
  modality?:      "PRESENCIAL" | "ONLINE",
  teacherOnsite?: boolean,
) {
  await requireCollaboratorOrAdmin()

  await prisma.lessonRequest.update({
    where: { id: requestId },
    data:  { preferredAt: new Date(`${newDate}T${newTime}:00`) },
  })

  await approveRequestAction(requestId, modality, teacherOnsite)
}

// ─── Criar Compromisso do Professor ──────────────────────────────────────────

export async function createTeacherCommitmentAction(data: {
  teacherId: string
  title:     string
  date:      string
  time:      string
  duration?: number
}) {
  await requireCollaboratorOrAdmin()

  const duration    = data.duration ?? 60
  const scheduledAt = new Date(`${data.date}T${data.time}:00`)
  const dayStart    = startOfDay(scheduledAt)
  const dayEnd      = endOfDay(scheduledAt)

  const teacher = await prisma.teacher.findUnique({ where: { id: data.teacherId } })
  if (!teacher) throw new Error("Professor não encontrado")

  const teacherLessons = await prisma.lesson.findMany({
    where: {
      teacherId:   data.teacherId,
      status:      { in: ["CONFIRMED", "SCHEDULED"] },
      scheduledAt: { gte: dayStart, lte: dayEnd },
    },
    select: { scheduledAt: true, duration: true },
  })
  const reqStart    = scheduledAt.getTime()
  const reqEnd      = reqStart + duration * 60_000
  const hasConflict = teacherLessons.some((l) => {
    const lStart = l.scheduledAt.getTime()
    const lEnd   = lStart + (l.duration ?? 60) * 60_000
    return lStart < reqEnd && lEnd > reqStart
  })
  if (hasConflict) throw new Error("Professor já tem um compromisso neste horário")

  await prisma.lesson.create({
    data: {
      teacherId:  data.teacherId,
      subjectId:  null,
      scheduledAt,
      duration,
      modality:   "PRESENCIAL",
      status:     "CONFIRMED",
      lessonType: "COMPROMISSO",
      title:      data.title,
    },
  })

  revalidatePath("/colaborador/agenda")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}
