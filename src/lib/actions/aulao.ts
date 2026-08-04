"use server"

import { prisma }         from "@/lib/prisma"
import { auth }           from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { format }         from "date-fns"
import { ptBR }           from "date-fns/locale"

async function requireCollaboratorOrAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")
  if (!["ADMIN", "COLLABORATOR"].includes(session.user.role)) throw new Error("Sem permissão")
  return session
}

const REVALIDATE_PATHS = [
  "/colaborador/auloes",
  "/colaborador/agenda",
  "/admin/agenda",
]

// ─── Inscrever aluno em aulão existente ───────────────────────────────────────

export async function enrollStudentInAulaoAction(lessonId: string, studentId: string) {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: { participants: true, subject: true },
  })
  if (!lesson) throw new Error("Aulão não encontrado")
  if (!["AULAO", "GROUP"].includes(lesson.lessonType)) throw new Error("Esta aula não é um aulão")
  // Encontro de turma se gerencia pela matrícula, em /colaborador/turmas —
  // inscrever por aqui geraria uma cobrança avulsa em cima do contrato.
  if (lesson.courseId) throw new Error("Este é um encontro de turma — use a matrícula da turma")
  if (["COMPLETED", "CANCELLED"].includes(lesson.status)) throw new Error("Não é possível inscrever em aulão já encerrado")

  const alreadyEnrolled = lesson.participants.some(p => p.studentId === studentId)
  if (alreadyEnrolled) throw new Error("Aluno já está inscrito neste aulão")

  if (lesson.capacity && lesson.participants.length >= lesson.capacity) {
    throw new Error(`Aulão atingiu a capacidade máxima de ${lesson.capacity} alunos`)
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) throw new Error("Aluno não encontrado")

  const price   = lesson.priceOverride ? lesson.priceOverride.toNumber() : 0
  const isPaid  = price > 0

  const scheduledAtFmt = format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  await prisma.$transaction([
    prisma.lessonParticipant.create({ data: { lessonId, studentId } }),
    ...(isPaid
      ? [
          prisma.payment.create({
            data: {
              studentId,
              amount:      lesson.priceOverride!,
              dueDate:     lesson.scheduledAt,
              description: `${lesson.lessonType === "AULAO" ? "Aulão" : "Aula em grupo"} – ${lesson.subject?.name ?? "–"} (${scheduledAtFmt})`,
              status:      "PENDING",
            },
          }),
        ]
      : []),
  ])

  for (const path of REVALIDATE_PATHS) revalidatePath(path)
}

// ─── Desinscrever aluno de aulão ──────────────────────────────────────────────

export async function unenrollStudentFromAulaoAction(lessonId: string, studentId: string) {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: { participants: true },
  })
  if (!lesson) throw new Error("Aulão não encontrado")
  if (lesson.status === "COMPLETED") throw new Error("Não é possível desinscrever de aulão já realizado")
  // Ver enrollStudentInAulaoAction: quem manda na turma é a matrícula.
  if (lesson.courseId) throw new Error("Este é um encontro de turma — remova o aluno pela turma")

  const participant = lesson.participants.find(p => p.studentId === studentId)
  if (!participant) throw new Error("Aluno não está inscrito neste aulão")

  const price  = lesson.priceOverride ? lesson.priceOverride.toNumber() : 0
  const isPaid = price > 0

  await prisma.$transaction(async (tx) => {
    await tx.lessonParticipant.delete({
      where: { lessonId_studentId: { lessonId, studentId } },
    })

    if (isPaid) {
      // Remove pagamento pendente vinculado a este aluno nesta data
      await tx.payment.deleteMany({
        where: {
          studentId,
          status:  "PENDING",
          dueDate: lesson.scheduledAt,
        },
      })
    }
  })

  for (const path of REVALIDATE_PATHS) revalidatePath(path)
}

// ─── Cancelar aulão inteiro ───────────────────────────────────────────────────

export async function cancelAulaoAction(lessonId: string) {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: { participants: true },
  })
  if (!lesson) throw new Error("Aulão não encontrado")
  if (!["AULAO", "GROUP"].includes(lesson.lessonType)) throw new Error("Esta aula não é um aulão")
  if (lesson.status === "CANCELLED") throw new Error("Aulão já cancelado")
  if (lesson.status === "COMPLETED") throw new Error("Não é possível cancelar aulão já realizado")

  const price      = lesson.priceOverride ? lesson.priceOverride.toNumber() : 0
  const isPaid     = price > 0
  const studentIds = lesson.participants.map(p => p.studentId)

  await prisma.$transaction([
    prisma.lesson.update({ where: { id: lessonId }, data: { status: "CANCELLED" } }),
    ...(isPaid && studentIds.length > 0
      ? [
          prisma.payment.deleteMany({
            where: {
              studentId: { in: studentIds },
              status:    "PENDING",
              dueDate:   lesson.scheduledAt,
            },
          }),
        ]
      : []),
  ])

  for (const path of REVALIDATE_PATHS) revalidatePath(path)
}

// ─── Cancelar série de aulões recorrentes ─────────────────────────────────────

export async function cancelAulaoSeriesAction(recurrenceGroupId: string) {
  await requireCollaboratorOrAdmin()

  const lessons = await prisma.lesson.findMany({
    where: {
      recurrenceGroupId,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    select: {
      id:            true,
      scheduledAt:   true,
      priceOverride: true,
      participants:  { select: { studentId: true } },
    },
  })

  if (lessons.length === 0) throw new Error("Nenhum aulão pendente nesta série")

  const lessonIds  = lessons.map(l => l.id)
  const studentIds = [...new Set(lessons.flatMap(l => l.participants.map(p => p.studentId)))]
  const datesArr   = lessons.map(l => l.scheduledAt)
  const isPaid     = lessons[0]?.priceOverride ? lessons[0].priceOverride.toNumber() > 0 : false

  await prisma.$transaction([
    prisma.lesson.updateMany({
      where: { id: { in: lessonIds } },
      data:  { status: "CANCELLED" },
    }),
    ...(isPaid && studentIds.length > 0
      ? [
          prisma.payment.deleteMany({
            where: {
              studentId: { in: studentIds },
              status:    "PENDING",
              dueDate:   { in: datesArr },
            },
          }),
        ]
      : []),
  ])

  for (const path of REVALIDATE_PATHS) revalidatePath(path)
}

// ─── Renomear aulão ────────────────────────────────────────────────────────────

export async function renameAulaoAction(lessonId: string, title: string) {
  await requireCollaboratorOrAdmin()

  const trimmed = title.trim()
  if (!trimmed) throw new Error("O nome não pode ficar vazio")

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } })
  if (!lesson) throw new Error("Aulão não encontrado")
  if (!["AULAO", "GROUP"].includes(lesson.lessonType)) throw new Error("Esta aula não é um aulão")

  await prisma.lesson.update({ where: { id: lessonId }, data: { title: trimmed } })

  for (const path of REVALIDATE_PATHS) revalidatePath(path)
  revalidatePath(`/colaborador/auloes/${lessonId}`)
}

// ─── Marcar aulão como realizado ──────────────────────────────────────────────

export async function completeAulaoAction(lessonId: string) {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } })
  if (!lesson) throw new Error("Aulão não encontrado")
  if (!["AULAO", "GROUP"].includes(lesson.lessonType)) throw new Error("Esta aula não é um aulão")
  if (lesson.status === "COMPLETED") throw new Error("Aulão já marcado como realizado")
  if (lesson.status === "CANCELLED") throw new Error("Não é possível realizar um aulão cancelado")

  await prisma.lesson.update({ where: { id: lessonId }, data: { status: "COMPLETED" } })

  for (const path of REVALIDATE_PATHS) revalidatePath(path)
}
