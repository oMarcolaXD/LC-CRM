"use server"

import { prisma }         from "@/lib/prisma"
import { auth }           from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { notify }         from "@/lib/notifications"
import { getBookingPolicy, getOperationalConfig, isOperational } from "@/lib/config"
import { isWithinAvailability, hasConflict } from "@/lib/availability"
import type { Availability } from "@/lib/availability"
import { format }         from "date-fns"
import { ptBR }           from "date-fns/locale"

function lessonCost(durationMinutes: number): number {
  return durationMinutes / 60
}

/**
 * Confirma que o usuário logado é o responsável dono do aluno participante
 * da aula e devolve a aula + o studentId pertencente a ele.
 */
async function loadOwnedLesson(userId: string, lessonId: string) {
  const guardian = await prisma.guardian.findFirst({
    where:   { userId },
    include: { students: { select: { id: true } } },
  })
  if (!guardian) throw new Error("Responsável não encontrado")

  const ownedIds = new Set(guardian.students.map((s) => s.id))

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: {
      subject:      true,
      teacher:      { include: { user: true } },
      participants: { select: { studentId: true } },
    },
  })
  if (!lesson) throw new Error("Aula não encontrada")

  if (lesson.participants.length > 1) {
    throw new Error("Aulas em grupo só podem ser alteradas pela escola")
  }

  const studentId = lesson.participants.find((p) => ownedIds.has(p.studentId))?.studentId
  if (!studentId) throw new Error("Você não tem permissão para alterar esta aula")

  return { lesson, studentId }
}

/** Notifica administradores e colaboradores sobre a ação do responsável. */
async function notifyStaff(
  type: "LESSON_CANCELLED" | "LESSON_RESCHEDULED",
  title: string,
  message: string,
) {
  const staff = await prisma.user.findMany({
    where:  { role: { in: ["ADMIN", "COLLABORATOR"] }, active: true },
    select: { id: true, email: true, phone: true },
  })
  await Promise.allSettled(
    staff.map((u) =>
      notify({
        userId:  u.id,
        type,
        title,
        message,
        email:   u.email ?? undefined,
        phone:   u.phone ?? undefined,
      })
    )
  )
}

// ─── Cancelamento pelo responsável ────────────────────────────────────────────

export async function guardianCancelLessonAction(
  lessonId: string,
  reason?: string,
): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")

  const { lesson, studentId } = await loadOwnedLesson(session.user.id, lessonId)

  if (!["SCHEDULED", "CONFIRMED"].includes(lesson.status)) {
    throw new Error("Esta aula não pode ser cancelada")
  }

  const now    = new Date()
  const policy = await getBookingPolicy()

  if (lesson.scheduledAt.getTime() <= now.getTime()) {
    throw new Error("Esta aula já passou e não pode ser cancelada")
  }
  if (policy.cancelMinHours > 0) {
    const minMs = policy.cancelMinHours * 60 * 60 * 1000
    if (lesson.scheduledAt.getTime() - now.getTime() < minMs) {
      throw new Error(`Cancelamento permitido apenas até ${policy.cancelMinHours}h antes da aula. Entre em contato com a escola.`)
    }
  }

  const activePkg = await prisma.lessonPackage.findFirst({
    where:   { studentId, status: { in: ["ACTIVE", "EXHAUSTED"] } },
    orderBy: { purchaseDate: "desc" },
  })
  const refundCost = lessonCost(lesson.duration)

  await prisma.$transaction([
    prisma.lesson.update({
      where: { id: lessonId },
      data:  { status: "CANCELLED" },
    }),
    ...(activePkg
      ? [prisma.lessonPackage.update({
          where: { id: activePkg.id },
          data:  { remainingLessons: { increment: refundCost }, status: "ACTIVE" },
        })]
      : []
    ),
  ])

  const scheduledAt = format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const subjectName = lesson.subject?.name ?? "–"
  const byName      = session.user.name ?? "Responsável"

  await notifyStaff(
    "LESSON_CANCELLED",
    "Aula cancelada pelo responsável",
    `${byName} cancelou a aula de ${subjectName} (${scheduledAt}).${reason ? ` Motivo: "${reason}"` : ""}${activePkg ? " O saldo foi devolvido ao pacote." : ""}`,
  )

  revalidatePath("/aluno/aulas")
  revalidatePath("/colaborador/agenda")
  revalidatePath("/admin/agenda")
  revalidatePath(`/colaborador/alunos/${studentId}`)
}

// ─── Remarcação pelo responsável ──────────────────────────────────────────────

export async function guardianRescheduleLessonAction(
  lessonId: string,
  date: string,   // "yyyy-MM-dd"
  time: string,   // "HH:mm"
): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")

  const { lesson, studentId } = await loadOwnedLesson(session.user.id, lessonId)

  if (!["SCHEDULED", "CONFIRMED"].includes(lesson.status)) {
    throw new Error("Esta aula não pode ser remarcada")
  }

  const now    = new Date()
  const policy = await getBookingPolicy()

  // Prazo mínimo em relação ao horário ORIGINAL
  if (lesson.scheduledAt.getTime() <= now.getTime()) {
    throw new Error("Esta aula já passou e não pode ser remarcada")
  }
  if (policy.rescheduleMinHours > 0) {
    const minMs = policy.rescheduleMinHours * 60 * 60 * 1000
    if (lesson.scheduledAt.getTime() - now.getTime() < minMs) {
      throw new Error(`Remarcação permitida apenas até ${policy.rescheduleMinHours}h antes da aula. Entre em contato com a escola.`)
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Data ou horário inválidos")
  }
  const newDate = new Date(`${date}T${time}:00`)
  if (isNaN(newDate.getTime())) throw new Error("Data ou horário inválidos")

  // Novo horário respeita os limites de agendamento
  if (newDate.getTime() <= now.getTime()) {
    throw new Error("Escolha um horário futuro")
  }
  if (policy.minHoursAhead > 0) {
    const minMs = policy.minHoursAhead * 60 * 60 * 1000
    if (newDate.getTime() - now.getTime() < minMs) {
      throw new Error(`O novo horário precisa ter pelo menos ${policy.minHoursAhead}h de antecedência`)
    }
  }
  const horizon = new Date(now)
  horizon.setHours(23, 59, 59, 999)
  horizon.setDate(horizon.getDate() + policy.maxDaysAhead)
  if (newDate.getTime() > horizon.getTime()) {
    throw new Error(`Só é possível remarcar até ${policy.maxDaysAhead} dias à frente`)
  }

  // Funcionamento da escola
  const opConfig = await getOperationalConfig()
  if (!isOperational(newDate, opConfig)) {
    throw new Error("A escola não atende neste dia/horário")
  }

  // Disponibilidade do professor + conflito de horário
  const teacher = await prisma.teacher.findUnique({
    where:   { id: lesson.teacherId },
    include: {
      lessons: {
        where:  { status: { in: ["SCHEDULED", "CONFIRMED"] }, id: { not: lessonId } },
        select: { scheduledAt: true },
      },
    },
  })
  if (!teacher) throw new Error("Professor não encontrado")

  const availability = (teacher.availability ?? {}) as unknown as Availability
  if (!isWithinAvailability(newDate, availability)) {
    throw new Error("O professor não está disponível neste horário")
  }
  if (hasConflict(newDate, teacher.lessons.map((l) => l.scheduledAt))) {
    throw new Error("Este horário já está ocupado")
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data:  { scheduledAt: newDate, status: "SCHEDULED" },
  })

  const oldAt   = format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const newAt   = format(newDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const subject = lesson.subject?.name ?? "–"
  const byName  = session.user.name ?? "Responsável"

  await notifyStaff(
    "LESSON_RESCHEDULED",
    "Aula remarcada pelo responsável",
    `${byName} remarcou a aula de ${subject}: de ${oldAt} para ${newAt}.`,
  )

  revalidatePath("/aluno/aulas")
  revalidatePath("/colaborador/agenda")
  revalidatePath("/admin/agenda")
  revalidatePath(`/colaborador/alunos/${studentId}`)
}
