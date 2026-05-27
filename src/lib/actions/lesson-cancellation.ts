"use server"

import { prisma }         from "@/lib/prisma"
import { auth }           from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { notify }         from "@/lib/notifications"
import { format }         from "date-fns"
import { ptBR }           from "date-fns/locale"

function lessonCost(durationMinutes: number): number {
  return durationMinutes / 60
}

// ─── Cancelar aula diretamente (COLLABORATOR) ────────────────────────────────

export async function cancelLessonDirectAction(
  lessonId: string,
  reason?: string,
): Promise<void> {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")
  if (session.user.role !== "COLLABORATOR") throw new Error("Apenas colaboradores podem cancelar aulas")

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: {
      subject:      true,
      participants: { select: { studentId: true } },
    },
  })
  if (!lesson) throw new Error("Aula não encontrada")
  if (!["SCHEDULED", "CONFIRMED", "COMPLETED"].includes(lesson.status)) {
    throw new Error("Esta aula não pode ser cancelada")
  }

  const studentId = lesson.participants[0]?.studentId ?? null

  const activePkg = studentId
    ? await prisma.lessonPackage.findFirst({
        where:   { studentId, status: { in: ["ACTIVE", "EXHAUSTED"] } },
        orderBy: { purchaseDate: "desc" },
      })
    : null

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

  const scheduledAt   = format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const subjectName   = lesson.subject?.name ?? "–"
  const requesterName = session.user.name ?? "Colaborador"

  const admins = await prisma.user.findMany({
    where:  { role: "ADMIN", active: true },
    select: { id: true, email: true, phone: true },
  })

  await Promise.allSettled(
    admins.map(admin =>
      notify({
        userId:  admin.id,
        type:    "CANCELLATION_REQUEST",
        title:   "Aula cancelada pelo colaborador",
        message: `${requesterName} cancelou a aula de ${subjectName} (${scheduledAt}).${reason ? ` Motivo: "${reason}"` : ""}${activePkg ? " O saldo foi devolvido ao pacote." : ""}`,
        email:   admin.email ?? undefined,
        phone:   admin.phone ?? undefined,
      })
    )
  )

  revalidatePath("/admin/dashboard")
  revalidatePath("/admin/agenda")
  if (studentId) revalidatePath(`/colaborador/alunos/${studentId}`)
  revalidatePath("/colaborador/agenda")
}

// ─── Aprovar cancelamento (ADMIN) ─────────────────────────────────────────────

export async function approveLessonCancellationAction(requestId: string): Promise<void> {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")

  const request = await prisma.lessonCancellationRequest.findUnique({
    where:   { id: requestId },
    include: {
      lesson: {
        include: {
          subject:      true,
          participants: { select: { studentId: true } },
        },
      },
      requestedBy: true,
    },
  })
  if (!request) throw new Error("Solicitação não encontrada")
  if (request.status !== "PENDING") throw new Error("Esta solicitação já foi processada")

  const { lesson } = request
  const studentId  = lesson.participants[0]?.studentId ?? null

  const activePkg = studentId
    ? await prisma.lessonPackage.findFirst({
        where:   { studentId, status: { in: ["ACTIVE", "EXHAUSTED"] } },
        orderBy: { purchaseDate: "desc" },
      })
    : null

  const refundCost = lessonCost(lesson.duration)

  await prisma.$transaction([
    prisma.lesson.update({
      where: { id: lesson.id },
      data:  { status: "CANCELLED" },
    }),
    ...(activePkg
      ? [prisma.lessonPackage.update({
          where: { id: activePkg.id },
          data:  { remainingLessons: { increment: refundCost }, status: "ACTIVE" },
        })]
      : []
    ),
    prisma.lessonCancellationRequest.update({
      where: { id: requestId },
      data:  { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
    }),
  ])

  const scheduledAt = format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const subjectName = lesson.subject?.name ?? "–"

  await notify({
    userId:  request.requestedById,
    type:    "CANCELLATION_REVIEWED",
    title:   "Cancelamento aprovado ✓",
    message: `Seu pedido de cancelamento da aula de ${subjectName} (${scheduledAt}) foi aprovado.${activePkg ? " O saldo foi devolvido ao pacote." : ""}`,
    email:   request.requestedBy.email ?? undefined,
    phone:   request.requestedBy.phone ?? undefined,
  })

  revalidatePath("/admin/dashboard")
  revalidatePath("/admin/agenda")
  if (studentId) revalidatePath(`/colaborador/alunos/${studentId}`)
  revalidatePath("/colaborador/agenda")
}

// ─── Rejeitar cancelamento (ADMIN) ────────────────────────────────────────────

export async function rejectLessonCancellationAction(
  requestId: string,
  adminNote?: string,
): Promise<void> {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")

  const request = await prisma.lessonCancellationRequest.findUnique({
    where:   { id: requestId },
    include: {
      lesson: { include: { subject: true, participants: { select: { studentId: true } } } },
      requestedBy: true,
    },
  })
  if (!request) throw new Error("Solicitação não encontrada")
  if (request.status !== "PENDING") throw new Error("Esta solicitação já foi processada")

  await prisma.lessonCancellationRequest.update({
    where: { id: requestId },
    data:  { status: "REJECTED", reviewedById: session.user.id, reviewedAt: new Date() },
  })

  const scheduledAt = format(request.lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const subjectName = request.lesson.subject?.name ?? "–"

  await notify({
    userId:  request.requestedById,
    type:    "CANCELLATION_REVIEWED",
    title:   "Cancelamento recusado",
    message: `Seu pedido de cancelamento da aula de ${subjectName} (${scheduledAt}) não foi aprovado.${adminNote ? ` Motivo: "${adminNote}"` : ""}`,
    email:   request.requestedBy.email ?? undefined,
    phone:   request.requestedBy.phone ?? undefined,
  })

  const studentId = request.lesson.participants[0]?.studentId ?? null
  revalidatePath("/admin/dashboard")
  if (studentId) revalidatePath(`/colaborador/alunos/${studentId}`)
}
