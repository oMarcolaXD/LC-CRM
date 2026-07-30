"use server"

import { prisma }              from "@/lib/prisma"
import { auth }                from "@/lib/auth"
import { revalidatePath }      from "next/cache"
import {
  notify, notifyLessonScheduled, notifyLessonConfirmedToTeacher, notifyLowBalance,
} from "@/lib/notifications"
import {
  assertTeacherFree,
  assertRoomFree,
  assertWithinOperationalHours,
  countOverlapsIn,
  describeLesson,
  findConflictIn,
  loadRoomAgendaFor,
  loadTeacherAgendaFor,
  occupiesRoom,
  overlaps,
  DEFAULT_DURATION,
} from "@/lib/scheduling"
import { getRoomCount } from "@/lib/config"
import {
  sortSlots, isCreatable, isConflict, MAX_OCCURRENCES,
  type SlotRef, type SlotVerdict, type RecurringPreview,
} from "@/lib/recurrence"
import { comResultado, type ActionResult } from "@/lib/action-result"
import { mensagemDeErro }       from "@/lib/error-message"
import { addWeeks, addMonths, parseISO, isAfter } from "date-fns"
import { format }              from "date-fns"
import { ptBR }                from "date-fns/locale"
import { parseBrazilDateTime, formatBR } from "@/lib/datetime"

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

/**
 * Implementação: lança em caso de regra violada. Os invólucros exportados
 * traduzem isso em `ActionResult` para a mensagem sobreviver à produção; os
 * chamadores internos (aprovação em lote, reagendar) usam esta direto.
 */
async function aprovarSolicitacao(
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

  // ── Validação da agenda (aulas passadas são registro histórico) ──────────────
  // A aula é criada sem `duration`, portanto vale o padrão do schema.
  const slot = { scheduledAt: request.preferredAt, duration: DEFAULT_DURATION }

  if (!isHistorical) {
    await assertWithinOperationalHours(request.preferredAt)
    if (occupiesRoom(finalModality, teacherOnsite)) await assertRoomFree(slot)
    await assertTeacherFree({ ...slot, teacherId: request.teacherId }, request.teacher.user.name)
  }

  await prisma.$transaction([
    prisma.lesson.create({
      data: {
        teacherId:    request.teacherId,
        subjectId:    request.subjectId ?? "",
        scheduledAt:  request.preferredAt,
        modality:     finalModality,
        // Aprovar a solicitação agenda a aula; a confirmação é ação manual do
        // atendente (confirmLessonAction), que dispara as notificações.
        status:       isHistorical ? "COMPLETED" : "SCHEDULED",
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
      const scheduledAtFmt = formatBR(request.preferredAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      await notifyLessonScheduled({
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

export async function approveRequestAction(
  requestId: string,
  modalityOverride?: "PRESENCIAL" | "ONLINE",
  teacherOnsiteOverride?: boolean,
): Promise<ActionResult> {
  return comResultado(async () => {
    await aprovarSolicitacao(requestId, modalityOverride, teacherOnsiteOverride)
    return undefined
  })
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

export interface CreateLessonDirectInput {
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
  packageId?:     string   // pacote específico a debitar (senão usa o ativo mais recente)
  /**
   * O atendente já acertou o horário com o responsável (tipicamente na conversa
   * do WhatsApp em que a aula foi pedida). Nasce Confirmada e o aviso vai só para
   * o professor — quem de fato ainda não sabe. Evita disparar uma mensagem
   * automática para quem acabou de combinar por escrito.
   */
  alreadyAgreed?: boolean
}

export async function createLessonDirectAction(
  data: CreateLessonDirectInput,
): Promise<ActionResult> {
  return comResultado(async () => { await criarAulaDireta(data); return undefined })
}

async function criarAulaDireta(data: CreateLessonDirectInput) {
  await requireCollaboratorOrAdmin()

  const duration    = data.duration ?? 60
  const scheduledAt = parseBrazilDateTime(data.date, data.time)
  const isHistorical = scheduledAt < new Date()

  const student = await prisma.student.findUnique({
    where:   { id: data.studentId },
    include: {
      user:     true,
      // Se um pacote foi escolhido, usa exatamente ele; senão, o ativo mais recente com saldo
      packages: data.packageId
        ? { where: { id: data.packageId } }
        : {
            where:   { status: "ACTIVE", remainingLessons: { gt: 0 } },
            orderBy: { purchaseDate: "desc" },
            take:    1,
          },
    },
  })
  if (!student) throw new Error("Aluno não encontrado")

  const pkg = student.packages[0]
  if (!pkg) throw new Error(data.packageId ? "Pacote não encontrado" : "Aluno sem saldo de aulas disponível")

  const cost         = lessonCost(duration)
  const pkgRemaining = Number(pkg.remainingLessons)
  if (pkgRemaining < cost) {
    throw new Error(`Saldo insuficiente. O aluno tem ${pkgRemaining.toFixed(1).replace(".", ",")} aulas restantes e esta aula custa ${cost.toFixed(1).replace(".", ",")} aula.`)
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

  // ── Validação da agenda (aulas passadas são registro histórico) ──────────────
  if (!isHistorical) {
    const slot = { scheduledAt, duration }
    if (occupiesRoom(data.modality, teacherOnsiteDirect)) await assertRoomFree(slot)
    await assertTeacherFree({ ...slot, teacherId: data.teacherId }, teacher?.user.name)
  }

  await prisma.$transaction([
    prisma.lesson.create({
      data: {
        teacherId:    data.teacherId,
        subjectId:    data.subjectId,
        scheduledAt,
        duration,
        modality:     data.modality,
        status:        isHistorical ? (data.statusOverride ?? "COMPLETED")
                     : data.alreadyAgreed ? "CONFIRMED" : "SCHEDULED",
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
    const scheduledAtFormatted = formatBR(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    const modalityLabel        = data.modality === "PRESENCIAL" ? "Presencial" : "Online"

    if (data.alreadyAgreed) {
      // Responsável já foi acertado à mão; avisa apenas o professor.
      if (teacher) {
        await notifyLessonConfirmedToTeacher({
          teacherUserId: teacher.userId,
          teacherEmail:  teacher.user.email,
          teacherPhone:  teacher.user.phone,
          subject:       subject?.name ?? "–",
          scheduledAt:   scheduledAtFormatted,
          modality:      modalityLabel,
        })
      }
    } else {
      await notifyLessonScheduled({
        studentUserId: student.userId ?? "",
        studentEmail:  student.user?.email ?? null,
        studentPhone:  student.user?.phone ?? null,
        teacherName:   teacher?.user.name ?? "–",
        subject:       subject?.name ?? "–",
        scheduledAt:   scheduledAtFormatted,
        modality:      modalityLabel,
      })
    }

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

// ─── Série recorrente: avaliação, pré-visualização e criação ──────────────────
// Uma aula por ocorrência. Serve tanto para AGENDAR (futuras → CONFIRMED) quanto
// para REGISTRAR (passadas → COMPLETED).
//
// A secretaria não deve descobrir na 47ª aula que houve choque: a avaliação
// abaixo é a MESMA usada pela pré-visualização (`previewRecurringLessonsAction`,
// que alimenta o modal de exceções) e pela criação — assim o que o modal mostra
// é exatamente o que será criado.

interface EvaluatedSlot {
  date:    string
  time:    string
  at:      Date
  label:   string
  verdict: SlotVerdict
  reason:  string
}

/**
 * Avalia cada ocorrência na ordem, consumindo o saldo do pacote conforme decide
 * criar. As consultas são sequenciais de propósito: as aulas da série ainda não
 * estão no banco, então cada ocorrência precisa ser comparada também contra as
 * anteriores já aceitas — senão duas exceções editadas para o mesmo horário
 * passariam as duas e a série colidiria consigo mesma.
 */
async function evaluateRecurringSlots(opts: {
  slots:            SlotRef[]
  teacherId:        string
  teacherFirstName: string
  duration:         number
  needsRoom:        boolean
  balance:          number
}): Promise<EvaluatedSlot[]> {
  const cost      = lessonCost(opts.duration)
  const now       = new Date()
  const ordered   = sortSlots(opts.slots)
  const candidates = ordered.map((s) => ({
    scheduledAt: parseBrazilDateTime(s.date, s.time),
    duration:    opts.duration,
  }))

  // Agenda carregada de uma vez para toda a série (2 consultas, não 2 por aula)
  const [teacherAgenda, roomAgenda, roomCount] = await Promise.all([
    loadTeacherAgendaFor(opts.teacherId, candidates),
    opts.needsRoom ? loadRoomAgendaFor(candidates) : Promise.resolve([]),
    opts.needsRoom ? getRoomCount() : Promise.resolve(0),
  ])

  let   remaining = opts.balance
  const result: EvaluatedSlot[] = []
  const accepted: { scheduledAt: Date; duration: number }[] = []

  for (const [i, { date, time }] of ordered.entries()) {
    const at    = candidates[i].scheduledAt
    const label = formatBR(at, "EEE, dd/MM 'às' HH:mm", { locale: ptBR })
    const slot  = candidates[i]
    const push  = (verdict: SlotVerdict, reason = "") =>
      result.push({ date, time, at, label, verdict, reason })

    if (remaining < cost) {
      push("NO_BALANCE", "saldo do pacote esgotado")
      continue
    }

    // Choque com outra ocorrência da própria série (o banco ainda não as tem)
    if (accepted.some((a) => overlaps(slot, a))) {
      push("TEACHER_CONFLICT", "choca com outra ocorrência desta mesma série")
      continue
    }

    // Conflitos com o banco só valem para aulas futuras (passadas são registro
    // histórico), mas a colisão interna da série acima vale sempre.
    if (at < now) {
      push("PAST", "data já passou — será registrada como realizada")
      accepted.push(slot)
      remaining -= cost
      continue
    }

    if (opts.needsRoom && countOverlapsIn(slot, roomAgenda) >= roomCount) {
      push("ROOM_CONFLICT", `todas as ${roomCount} sala${roomCount !== 1 ? "s" : ""} estão ocupadas`)
      continue
    }

    const clash = findConflictIn(slot, teacherAgenda)
    if (clash) {
      push("TEACHER_CONFLICT", `${opts.teacherFirstName} já tem ${describeLesson(clash)}`)
      continue
    }

    push("OK")
    accepted.push(slot)
    remaining -= cost
  }

  return result
}

/** Carrega pacote + professor e resolve a ocupação de sala da série. */
async function loadRecurringContext(data: {
  teacherId:      string
  studentId:      string
  modality:       "PRESENCIAL" | "ONLINE"
  teacherOnsite?: boolean
  packageId?:     string
}) {
  const student = await prisma.student.findUnique({
    where:   { id: data.studentId },
    include: {
      user:     true,
      packages: data.packageId
        ? { where: { id: data.packageId } }
        : {
            where:   { status: "ACTIVE", remainingLessons: { gt: 0 } },
            orderBy: { purchaseDate: "desc" },
            take:    1,
          },
    },
  })
  if (!student) throw new Error("Aluno não encontrado")

  const pkg = student.packages[0]
  if (!pkg) throw new Error(data.packageId ? "Pacote não encontrado" : "Aluno sem saldo de aulas disponível")

  const teacher = await prisma.teacher.findUnique({
    where:   { id: data.teacherId },
    include: { user: true },
  })
  if (!teacher) throw new Error("Professor não encontrado")

  let teacherOnsite: boolean
  if (data.modality === "PRESENCIAL")               teacherOnsite = true
  else if (teacher.teachingMode === "ONLINE_ONLY")  teacherOnsite = false
  else                                              teacherOnsite = data.teacherOnsite ?? false

  return { student, pkg, teacher, teacherOnsite, needsRoom: occupiesRoom(data.modality, teacherOnsite) }
}

// ─── Pré-visualização da série (alimenta o modal de exceções) ─────────────────

/**
 * Valida a série SEM gravar nada. Aceita a lista explícita de ocorrências para
 * que o usuário possa reavaliar depois de ajustar só as exceções.
 */
export interface RecurringInput {
  teacherId:      string
  studentId:      string
  slots:          SlotRef[]
  modality:       "PRESENCIAL" | "ONLINE"
  duration?:      number
  teacherOnsite?: boolean
  packageId?:     string
}

export async function previewRecurringLessonsAction(
  data: RecurringInput,
): Promise<ActionResult<RecurringPreview>> {
  return comResultado(() => preverSerie(data))
}

async function preverSerie(data: RecurringInput): Promise<RecurringPreview> {
  await requireCollaboratorOrAdmin()

  if (data.slots.length === 0) throw new Error("Nenhuma ocorrência para verificar")
  if (data.slots.length > MAX_OCCURRENCES) {
    throw new Error(`Uma série pode ter no máximo ${MAX_OCCURRENCES} ocorrências`)
  }

  const duration = data.duration ?? 60
  const cost     = lessonCost(duration)
  const ctx      = await loadRecurringContext(data)
  const balance  = Number(ctx.pkg.remainingLessons)

  const evaluated = await evaluateRecurringSlots({
    slots:            data.slots,
    teacherId:        data.teacherId,
    teacherFirstName: ctx.teacher.user.name.split(" ")[0],
    duration,
    needsRoom:        ctx.needsRoom,
    balance,
  })

  const creatable = evaluated.filter((s) => isCreatable(s.verdict))

  return {
    slots: evaluated.map(({ date, time, label, verdict, reason }) => ({ date, time, label, verdict, reason })),
    creatableCount:   creatable.length,
    blockedCount:     evaluated.length - creatable.length,
    costPerLesson:    cost,
    balanceRemaining: balance,
    balanceAfter:     balance - creatable.length * cost,
  }
}

// ─── Criar a série a partir das ocorrências já revisadas ──────────────────────

export interface CreateRecurringResult {
  created:          number
  conflicts:        { date: string; reason: string }[]
  skippedNoBalance: number
}

export async function createRecurringLessonsAction(
  data: RecurringInput & { subjectId: string },
): Promise<ActionResult<CreateRecurringResult>> {
  return comResultado(() => criarSerie(data))
}

async function criarSerie(
  data: RecurringInput & { subjectId: string },
): Promise<CreateRecurringResult> {
  await requireCollaboratorOrAdmin()

  if (data.slots.length === 0) throw new Error("Nenhuma ocorrência selecionada")
  if (data.slots.length > MAX_OCCURRENCES) {
    throw new Error(`Uma série pode ter no máximo ${MAX_OCCURRENCES} ocorrências`)
  }

  const duration = data.duration ?? 60
  const cost     = lessonCost(duration)
  const ctx      = await loadRecurringContext(data)
  const { student, pkg, teacher, teacherOnsite } = ctx

  const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } })

  const startBal = Number(pkg.remainingLessons)

  // Revalida na hora de gravar: algo pode ter sido agendado entre a
  // pré-visualização e a confirmação.
  const evaluated = await evaluateRecurringSlots({
    slots:            data.slots,
    teacherId:        data.teacherId,
    teacherFirstName: teacher.user.name.split(" ")[0],
    duration,
    needsRoom:        ctx.needsRoom,
    balance:          startBal,
  })

  const toCreate         = evaluated.filter((s) => isCreatable(s.verdict))
  const conflicts        = evaluated
    .filter((s) => isConflict(s.verdict))
    .map((s) => ({ date: s.label, reason: s.reason }))
  const skippedNoBalance = evaluated.filter((s) => s.verdict === "NO_BALANCE").length

  if (toCreate.length === 0) {
    throw new Error(
      conflicts.length > 0
        ? "Todos os horários da série têm conflito. Nenhuma aula foi criada."
        : "Aluno sem saldo suficiente para agendar a série.",
    )
  }

  const totalCost = toCreate.length * cost

  // Cria o grupo de recorrência primeiro (fora da transação em lote) para que o
  // id possa ser referenciado por todas as aulas. A criação das aulas + baixa no
  // pacote roda numa única transação em lote (array-form) — evita o timeout da
  // transação interativa que ocorria com muitas aulas sobre o pooler do Supabase.
  let recurrenceGroupId: string | null = null
  if (toCreate.length > 1) {
    const group = await prisma.recurrenceGroup.create({
      data: {
        rule:     "WEEKLY",
        startsAt: toCreate[0].at,
        endsAt:   toCreate[toCreate.length - 1].at,
      },
    })
    recurrenceGroupId = group.id
  }

  await prisma.$transaction([
    ...toCreate.map(({ at, verdict }) =>
      prisma.lesson.create({
        data: {
          teacherId:    data.teacherId,
          subjectId:    data.subjectId,
          scheduledAt:  at,
          duration,
          modality:     data.modality,
          status:       verdict === "PAST" ? "COMPLETED" : "SCHEDULED",
          teacherOnsite,
          recurrenceGroupId,
          participants: { create: { studentId: data.studentId } },
        },
      }),
    ),
    prisma.lessonPackage.update({
      where: { id: pkg.id },
      data:  {
        remainingLessons: { decrement: totalCost },
        status: startBal - totalCost <= 0 ? "EXHAUSTED" : "ACTIVE",
      },
    }),
  ])

  // Notifica o aluno de cada aula futura agendada (uma por ocorrência).
  // Aulas passadas (registro histórico) não geram notificação.
  for (const { at, verdict } of toCreate) {
    if (verdict === "PAST") continue
    try {
      await notifyLessonScheduled({
        studentUserId: student.userId ?? "",
        studentEmail:  student.user?.email ?? null,
        studentPhone:  student.user?.phone ?? null,
        teacherName:   teacher.user.name ?? "–",
        subject:       subject?.name ?? "–",
        scheduledAt:   formatBR(at, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
        modality:      data.modality === "PRESENCIAL" ? "Presencial" : "Online",
      })
    } catch {
      // Notificação falha silenciosamente — as aulas já foram criadas
    }
  }

  revalidatePath("/colaborador/agenda")
  revalidatePath("/colaborador/agendamentos")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
  revalidatePath(`/colaborador/alunos/${data.studentId}`)

  return { created: toCreate.length, conflicts, skippedNoBalance }
}

// ─── Criar aula em grupo ──────────────────────────────────────────────────────

export interface CreateGroupLessonInput {
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
}

export async function createGroupLessonAction(
  data: CreateGroupLessonInput,
): Promise<ActionResult> {
  return comResultado(async () => { await criarAulaEmGrupo(data); return undefined })
}

async function criarAulaEmGrupo(data: CreateGroupLessonInput) {
  await requireCollaboratorOrAdmin()

  if (data.studentIds.length < 2 || data.studentIds.length > 4) {
    throw new Error("Uma aula em grupo deve ter entre 2 e 4 alunos")
  }

  const duration    = data.duration ?? 60
  const scheduledAt = parseBrazilDateTime(data.date, data.time)
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

  // ── Validação da agenda (aulas passadas são registro histórico) ──────────────
  if (!isHistorical) {
    const slot = { scheduledAt, duration }
    if (occupiesRoom(data.modality, teacherOnsite)) {
      await assertRoomFree(slot, { suggestOnline: false })
    }
    await assertTeacherFree({ ...slot, teacherId: data.teacherId }, teacher.user.name)
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
        status:        isHistorical ? (data.statusOverride ?? "COMPLETED") : "SCHEDULED",
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
      await notifyLessonScheduled({
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

// ─── Criar aula em dupla/grupo debitando o pacote de cada aluno ───────────────
// Diferente de createGroupLessonAction (que cobra valor avulso), aqui cada aluno
// tem 1 aula descontada do seu próprio pacote — como uma aula individual.

export interface CreateDuoLessonInput {
  teacherId:      string
  subjectId:      string
  studentIds:     string[]      // 2–4 alunos
  date:           string        // "YYYY-MM-DD"
  time:           string        // "HH:mm"
  modality:       "PRESENCIAL" | "ONLINE"
  duration?:      number
  teacherOnsite?: boolean
}

export async function createDuoLessonAction(
  data: CreateDuoLessonInput,
): Promise<ActionResult> {
  return comResultado(async () => { await criarAulaEmDupla(data); return undefined })
}

async function criarAulaEmDupla(data: CreateDuoLessonInput) {
  await requireCollaboratorOrAdmin()

  const uniqueIds = [...new Set(data.studentIds)]
  if (uniqueIds.length !== data.studentIds.length) {
    throw new Error("Há alunos duplicados na seleção")
  }
  if (uniqueIds.length < 2 || uniqueIds.length > 4) {
    throw new Error("Uma aula em dupla deve ter entre 2 e 4 alunos")
  }

  const duration     = data.duration ?? 60
  const cost         = lessonCost(duration)
  const scheduledAt  = parseBrazilDateTime(data.date, data.time)
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

  // ── Validação da agenda (aulas passadas são registro histórico) ──────────────
  // Os alunos entram como participantes de UMA aula, então há um único slot a
  // validar — é justamente a sobreposição autorizada para o professor.
  if (!isHistorical) {
    const slot = { scheduledAt, duration }
    if (occupiesRoom(data.modality, teacherOnsite)) await assertRoomFree(slot)
    await assertTeacherFree({ ...slot, teacherId: data.teacherId }, teacher.user.name)
  }

  // Buscar alunos com o pacote ativo mais recente que tenha saldo
  const students = await prisma.student.findMany({
    where:   { id: { in: uniqueIds } },
    include: {
      user:     true,
      packages: {
        where:   { status: "ACTIVE", remainingLessons: { gt: 0 } },
        orderBy: { purchaseDate: "desc" },
        take:    1,
      },
    },
  })
  if (students.length !== uniqueIds.length) throw new Error("Um ou mais alunos não encontrados")

  // Valida saldo de cada aluno antes de criar qualquer coisa
  const withPkg = students.map((s) => {
    const pkg = s.packages[0]
    if (!pkg) throw new Error(`${s.name} está sem saldo de aulas disponível`)
    const remaining = Number(pkg.remainingLessons)
    if (remaining < cost) {
      throw new Error(`${s.name} tem apenas ${remaining.toFixed(1).replace(".", ",")} aula(s) restante(s) e esta aula custa ${cost.toFixed(1).replace(".", ",")}.`)
    }
    return { student: s, pkg, remaining }
  })

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
        status:        isHistorical ? "COMPLETED" : "SCHEDULED",
        lessonType:    "GROUP",
        teacherOnsite,
        participants:  { create: withPkg.map((w) => ({ studentId: w.student.id })) },
      },
    }),
    // Debita 1 aula do pacote de cada aluno
    ...withPkg.map((w) =>
      prisma.lessonPackage.update({
        where: { id: w.pkg.id },
        data:  {
          remainingLessons: { decrement: cost },
          status: w.remaining <= cost ? "EXHAUSTED" : "ACTIVE",
        },
      })
    ),
  ])

  if (!isHistorical) {
    for (const { student } of withPkg) {
      await notifyLessonScheduled({
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
  // partnerId: 2º aluno (dupla) daquela aula específica — desconta também do pacote dele
  lessons:   { date: string; time: string; status: "COMPLETED" | "MISSED"; teacherId: string; subjectId: string; duration: number; partnerId?: string }[]
}) {
  await requireCollaboratorOrAdmin()
  if (!data.lessons.length) return

  const pkg = await prisma.lessonPackage.findUnique({ where: { id: data.packageId } })
  if (!pkg) throw new Error("Pacote não encontrado")

  const totalCost    = data.lessons.reduce((sum, l) => sum + lessonCost(l.duration), 0)
  const pkgRemaining = Number(pkg.remainingLessons)
  const newRemaining = Math.max(0, pkgRemaining - totalCost)
  const newStatus    = newRemaining <= 0 ? "EXHAUSTED" : "ACTIVE"

  // ── Parceiros de dupla: soma o custo por aluno parceiro ───────────────────
  const partnerCost = new Map<string, number>()
  for (const l of data.lessons) {
    if (l.partnerId && l.partnerId !== data.studentId) {
      partnerCost.set(l.partnerId, (partnerCost.get(l.partnerId) ?? 0) + lessonCost(l.duration))
    }
  }

  // Pacote mais recente (ativo ou esgotado) de cada parceiro, para debitar
  const partnerPkg = new Map<string, { id: string; remaining: number }>()
  if (partnerCost.size > 0) {
    const pkgs = await prisma.lessonPackage.findMany({
      where:   { studentId: { in: [...partnerCost.keys()] }, status: { in: ["ACTIVE", "EXHAUSTED"] } },
      orderBy: { purchaseDate: "desc" },
    })
    for (const p of pkgs) {
      if (!partnerPkg.has(p.studentId)) {
        partnerPkg.set(p.studentId, { id: p.id, remaining: Number(p.remainingLessons) })
      }
    }
  }

  await prisma.$transaction([
    ...data.lessons.map(({ date, time, status, teacherId, subjectId, duration, partnerId }) => {
      const scheduledAt = parseBrazilDateTime(date, time)
      const isDuo = !!partnerId && partnerId !== data.studentId
      return prisma.lesson.create({
        data: {
          teacherId,
          subjectId,
          scheduledAt,
          duration,
          modality:     data.modality,
          teacherOnsite: data.modality === "PRESENCIAL",
          status,
          lessonType:   isDuo ? "GROUP" : undefined,
          participants: {
            create: isDuo
              ? [{ studentId: data.studentId }, { studentId: partnerId! }]
              : { studentId: data.studentId },
          },
        },
      })
    }),
    prisma.lessonPackage.update({
      where: { id: data.packageId },
      data:  { remainingLessons: newRemaining, status: newStatus },
    }),
    // Debita o pacote de cada parceiro (clampado em 0, como o do aluno principal)
    ...[...partnerCost.entries()].flatMap(([sid, cost]) => {
      const pp = partnerPkg.get(sid)
      if (!pp) return []
      const nr = Math.max(0, pp.remaining - cost)
      return [prisma.lessonPackage.update({
        where: { id: pp.id },
        data:  { remainingLessons: nr, status: nr <= 0 ? "EXHAUSTED" : "ACTIVE" },
      })]
    }),
  ])

  revalidatePath(`/colaborador/alunos/${data.studentId}`)
  revalidatePath(`/admin/usuarios/${data.studentId}`)
  revalidatePath("/colaborador/agenda")
  revalidatePath("/admin/agenda")
}

// ─── Editar Aula (admin e colaborador) ───────────────────────────────────────

export interface UpdateLessonDirectInput {
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
}

export async function updateLessonDirectAction(
  data: UpdateLessonDirectInput,
): Promise<ActionResult> {
  return comResultado(async () => { await editarAula(data); return undefined })
}

async function editarAula(data: UpdateLessonDirectInput) {
  const session = await auth()
  if (!["ADMIN", "COLLABORATOR"].includes(session?.user?.role ?? "")) throw new Error("Sem permissão")

  const scheduledAt  = parseBrazilDateTime(data.date, data.time)
  const teacherOnsite = data.modality === "PRESENCIAL"

  // ── Confirmar não é uma edição de campo ──────────────────────────────────────
  // A transição para CONFIRMED passa só pelo botão Confirmar (confirmLessonAction),
  // que envia as notificações ao professor e ao responsável/aluno. Aqui, a aula só
  // pode permanecer confirmada — nunca virar confirmada.
  if (data.status === "CONFIRMED") {
    const atual = await prisma.lesson.findUnique({
      where:  { id: data.lessonId },
      select: { status: true },
    })
    if (!atual) throw new Error("Aula não encontrada")
    if (atual.status !== "CONFIRMED") {
      throw new Error(
        "Use o botão Confirmar para confirmar a aula — assim o professor e o responsável são notificados."
      )
    }
  }

  // ── Validação da agenda ──────────────────────────────────────────────────────
  // Só vale para a aula que continua ocupando a agenda no futuro: editar um
  // registro histórico (COMPLETED/MISSED) ou cancelar não disputa horário.
  // `excludeLessonId` evita que a aula conflite consigo mesma.
  const stillOccupiesAgenda = data.status === "CONFIRMED" || data.status === "SCHEDULED"
  if (stillOccupiesAgenda && scheduledAt > new Date()) {
    const teacher = await prisma.teacher.findUnique({
      where:  { id: data.teacherId },
      select: { user: { select: { name: true } } },
    })
    const slot = { scheduledAt, duration: data.duration, excludeLessonId: data.lessonId }
    if (occupiesRoom(data.modality, teacherOnsite)) await assertRoomFree(slot)
    await assertTeacherFree({ ...slot, teacherId: data.teacherId }, teacher?.user.name)
  }

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

export interface CreateAulaoInput {
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
}

export async function createAulaoAction(
  data: CreateAulaoInput,
): Promise<ActionResult<{ id: string | undefined }>> {
  return comResultado(() => criarAulao(data))
}

async function criarAulao(data: CreateAulaoInput) {
  await requireCollaboratorOrAdmin()

  const duration     = data.duration ?? 90
  const scheduledAt  = parseBrazilDateTime(data.date, data.time)
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

  // ── Validação da agenda: TODAS as datas da série ─────────────────────────────
  // A série é criada em bloco, então validamos tudo antes — nenhum aulão é
  // criado se alguma ocorrência conflitar. A agenda é carregada de uma vez.
  const needsRoom  = occupiesRoom(data.modality, teacherOnsite)
  const serieClash: string[] = []
  const now        = new Date()
  const futuros    = dates.filter((d) => d >= now).map((d) => ({ scheduledAt: d, duration }))

  const [teacherAgenda, roomAgenda, roomCount] = await Promise.all([
    loadTeacherAgendaFor(data.teacherId, futuros),
    needsRoom ? loadRoomAgendaFor(futuros) : Promise.resolve([]),
    needsRoom ? getRoomCount() : Promise.resolve(0),
  ])

  for (const slot of futuros) {
    const quando = formatBR(slot.scheduledAt, "dd/MM 'às' HH:mm")

    if (needsRoom && countOverlapsIn(slot, roomAgenda) >= roomCount) {
      serieClash.push(`${quando} — todas as ${roomCount} sala${roomCount !== 1 ? "s" : ""} estão ocupadas`)
      continue
    }

    const clash = findConflictIn(slot, teacherAgenda)
    if (clash) serieClash.push(`${quando} — ${describeLesson(clash)}`)
  }

  if (serieClash.length > 0) {
    const shown = serieClash.slice(0, 5).join("; ")
    const rest  = serieClash.length > 5 ? ` (e mais ${serieClash.length - 5})` : ""
    throw new Error(
      `Conflito de horário em ${serieClash.length} ocorrência${serieClash.length !== 1 ? "s" : ""}: ${shown}${rest}. ` +
      `Nenhum aulão foi criado.`
    )
  }

  const baseLessonId = await prisma.$transaction(async (tx) => {
    let recurrenceGroupId: string | undefined
    let firstLessonId: string | undefined

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

      const created = await tx.lesson.create({
        data: {
          teacherId:         data.teacherId,
          subjectId:         data.subjectId,
          scheduledAt:       date,
          duration,
          modality:          data.modality,
          status:            isPast ? "COMPLETED" : "SCHEDULED",
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
      firstLessonId ??= created.id

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

    return firstLessonId
  })

  revalidatePath("/colaborador/agenda")
  revalidatePath("/colaborador/agendamentos")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
  revalidatePath("/colaborador/auloes")

  return { id: baseLessonId }
}

// ─── Aprovar em lote ─────────────────────────────────────────────────────────

export async function bulkApproveRequestsAction(ids: string[]) {
  await requireCollaboratorOrAdmin()
  const results = { approved: 0, failed: [] as { id: string; reason: string }[] }
  for (const id of ids) {
    try {
      // Usa a implementação: os motivos voltam como DADO (`failed`), então o
      // texto sobrevive à produção sem precisar do invólucro de resultado.
      await aprovarSolicitacao(id)
      results.approved++
    } catch (e) {
      results.failed.push({ id, reason: mensagemDeErro(e, "Não foi possível aprovar") })
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
): Promise<ActionResult> {
  return comResultado(async () => {
    await requireCollaboratorOrAdmin()

    await prisma.lessonRequest.update({
      where: { id: requestId },
      data:  { preferredAt: parseBrazilDateTime(newDate, newTime) },
    })

    await aprovarSolicitacao(requestId, modality, teacherOnsite)
    return undefined
  })
}

// ─── Criar Compromisso do Professor ──────────────────────────────────────────

export async function createTeacherCommitmentAction(data: {
  teacherId: string
  title:     string
  date:      string
  time:      string
  duration?: number
}): Promise<ActionResult> {
  return comResultado(async () => { await criarCompromisso(data); return undefined })
}

async function criarCompromisso(data: {
  teacherId: string
  title:     string
  date:      string
  time:      string
  duration?: number
}) {
  await requireCollaboratorOrAdmin()

  const duration    = data.duration ?? 60
  const scheduledAt = parseBrazilDateTime(data.date, data.time)

  const teacher = await prisma.teacher.findUnique({
    where:  { id: data.teacherId },
    select: { user: { select: { name: true } } },
  })
  if (!teacher) throw new Error("Professor não encontrado")

  await assertTeacherFree({ scheduledAt, duration, teacherId: data.teacherId }, teacher.user.name)

  await prisma.lesson.create({
    data: {
      teacherId:  data.teacherId,
      subjectId:  null,
      scheduledAt,
      duration,
      modality:   "PRESENCIAL",
      // Compromisso nasce CONFIRMED de propósito: é um bloqueio interno da agenda
      // do professor, sem aluno nem responsável para confirmar. Se ficasse
      // SCHEDULED, apareceria eternamente como "aguardando confirmação".
      status:     "CONFIRMED",
      lessonType: "COMPROMISSO",
      title:      data.title,
    },
  })

  revalidatePath("/colaborador/agenda")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}
