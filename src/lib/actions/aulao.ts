"use server"

import type { Prisma }    from "@prisma/client"
import { prisma }         from "@/lib/prisma"
import { auth }           from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { format }         from "date-fns"
import { ptBR }           from "date-fns/locale"
import { comResultado }   from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-result"
import { parseBrazilDateTime, formatBR } from "@/lib/datetime"
import {
  assertTeacherFree, assertRoomFree, occupiesRoom,
  findSeriesConflicts, seriesConflictMessage,
} from "@/lib/scheduling"
import { daysBetween, shiftDay } from "@/lib/recurrence"

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

function revalidateAulao(lessonId: string) {
  for (const path of REVALIDATE_PATHS) revalidatePath(path)
  revalidatePath("/professor/agenda")
  revalidatePath(`/colaborador/auloes/${lessonId}`)
}

/** Texto da cobrança de um aulão — mesma frase na criação, edição e reativação. */
function descricaoCobranca(a: {
  lessonType:  string
  subjectName: string | null
  title:       string | null
  scheduledAt: Date
}): string {
  const tipo  = a.lessonType === "AULAO" ? "Aulão" : "Aula em grupo"
  const nome  = a.title?.trim()
  const quando = formatBR(a.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  return [tipo, a.subjectName ?? "–", nome].filter(Boolean).join(" – ") + ` (${quando})`
}

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

// ─── Editar aulão ─────────────────────────────────────────────────────────────
//
// Um aulão é uma Lesson como outra qualquer, então editar é mexer nos mesmos
// campos que `criarAulao` grava — com uma diferença: as cobranças dos inscritos
// já existem e precisam acompanhar a mudança de data e de valor.
//
// O vínculo entre Payment e aulão hoje é indireto (studentId + dueDate = data da
// aula), convenção herdada de `criarAulao`/`cancelAulaoAction`. Enquanto Payment
// não tiver `lessonId`, é o que dá para amarrar sem inventar um segundo padrão.

export interface UpdateAulaoInput {
  lessonId:         string
  title:            string
  teacherId:        string
  subjectId:        string
  /** "yyyy-MM-dd" no relógio de Brasília. */
  date:             string
  /** "HH:mm" no relógio de Brasília. */
  time:             string
  duration:         number
  modality:         "PRESENCIAL" | "ONLINE"
  teacherOnsite?:   boolean
  capacity?:        number | null
  isFree:           boolean
  pricePerStudent?: number
  /**
   * `SERIES` aplica a edição a esta e às próximas ocorrências pendentes da
   * recorrência — remarcar um aulão semanal não deveria custar 20 edições.
   * Ocorrências já realizadas ou canceladas ficam como estão.
   */
  scope?:           "ONE" | "SERIES"
}

export interface UpdateAulaoResult {
  /** Quantas ocorrências foram alteradas. */
  updated: number
}

export async function updateAulaoAction(input: UpdateAulaoInput): Promise<ActionResult<UpdateAulaoResult>> {
  return comResultado(() => editarAulao(input))
}

async function editarAulao(input: UpdateAulaoInput): Promise<UpdateAulaoResult> {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: input.lessonId },
    include: { participants: true },
  })
  if (!lesson) throw new Error("Aulão não encontrado")
  if (!["AULAO", "GROUP"].includes(lesson.lessonType)) throw new Error("Esta aula não é um aulão")
  // Ver enrollStudentInAulaoAction: encontro de turma se edita pela turma.
  if (lesson.courseId)                 throw new Error("Este é um encontro de turma — edite pela turma, em /colaborador/turmas")
  if (lesson.status === "COMPLETED")   throw new Error("Aulão já realizado não pode ser editado")
  if (lesson.status === "CANCELLED")   throw new Error("Aulão cancelado — reative antes de editar")

  const title = input.title.trim()
  if (!title) throw new Error("Informe um título para o aulão")

  const duration = Math.round(input.duration)
  if (!Number.isFinite(duration) || duration < 15 || duration > 480) {
    throw new Error("Duração inválida — informe entre 15 e 480 minutos")
  }

  const price = input.isFree ? 0 : (input.pricePerStudent ?? 0)
  if (!input.isFree && (!Number.isFinite(price) || price <= 0)) {
    throw new Error("Informe um valor válido por aluno")
  }

  const capacity = input.capacity == null ? null : Math.round(input.capacity)
  if (capacity !== null && (!Number.isFinite(capacity) || capacity < 1)) {
    throw new Error("Capacidade inválida — deixe em branco para não ter limite")
  }

  const [teacher, subject] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: input.teacherId }, include: { user: true } }),
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
  ])
  if (!teacher) throw new Error("Professor não encontrado")
  if (!subject) throw new Error("Matéria não encontrada")

  // Mesma regra de `criarAulao`: presencial implica professor na sede, e quem só
  // atende remoto nunca ocupa sala.
  const teacherOnsite =
    input.modality === "PRESENCIAL"          ? true
  : teacher.teachingMode === "ONLINE_ONLY"   ? false
  :                                            (input.teacherOnsite ?? false)

  const scheduledAt = parseBrazilDateTime(input.date, input.time)
  if (isNaN(scheduledAt.getTime())) throw new Error("Data ou horário inválido")

  const agora = new Date()

  // ── Ocorrências alcançadas pela edição ───────────────────────────────────────
  // "Só esta" mexe em uma; "toda a série" leva junto as próximas pendentes,
  // deslocadas pelo mesmo número de dias — assim a recorrência não se desmancha.
  const emSerie = input.scope === "SERIES" && !!lesson.recurrenceGroupId

  const ocorrencias = emSerie
    ? await prisma.lesson.findMany({
        where: {
          recurrenceGroupId: lesson.recurrenceGroupId!,
          status:            { in: ["SCHEDULED", "CONFIRMED"] },
          OR: [{ id: lesson.id }, { scheduledAt: { gte: agora } }],
        },
        include: { participants: true },
        orderBy: { scheduledAt: "asc" },
      })
    : [lesson]

  const deltaDias = emSerie
    ? daysBetween(formatBR(lesson.scheduledAt, "yyyy-MM-dd"), input.date)
    : 0

  const alvos = ocorrencias.map((o) => ({
    id:           o.id,
    lessonType:   o.lessonType,
    antes:        o.scheduledAt,
    precoAntes:   o.priceOverride ? o.priceOverride.toNumber() : 0,
    participants: o.participants.map(p => p.studentId),
    scheduledAt:  o.id === lesson.id
      ? scheduledAt
      : parseBrazilDateTime(shiftDay(formatBR(o.scheduledAt, "yyyy-MM-dd"), deltaDias), input.time),
    duration,
  }))

  const lotado = alvos.find(a => capacity !== null && capacity < a.participants.length)
  if (lotado) {
    throw new Error(
      `A capacidade não pode ser menor que os ${lotado.participants.length} aluno(s) já inscrito(s)`
      + (emSerie ? ` em ${formatBR(lotado.antes, "dd/MM")}` : "")
    )
  }

  // Agenda só é validada para o futuro — corrigir os dados de um aulão que já
  // aconteceu não pode esbarrar na agenda de então.
  const futuros = alvos.filter(a => a.scheduledAt >= agora)

  if (emSerie) {
    const conflitos = await findSeriesConflicts({
      teacherId:   input.teacherId,
      teacherName: teacher.user.name,
      needsRoom:   occupiesRoom(input.modality, teacherOnsite),
      slots:       futuros,
    })
    if (conflitos.length > 0) throw new Error(seriesConflictMessage(conflitos))
  } else if (futuros.length > 0) {
    await assertTeacherFree(
      { teacherId: input.teacherId, scheduledAt, duration, excludeLessonId: lesson.id },
      teacher.user.name,
    )
    if (occupiesRoom(input.modality, teacherOnsite)) {
      await assertRoomFree({ scheduledAt, duration, excludeLessonId: lesson.id })
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const alvo of alvos) {
      await tx.lesson.update({
        where: { id: alvo.id },
        data: {
          teacherId:     input.teacherId,
          subjectId:     input.subjectId,
          title,
          scheduledAt:   alvo.scheduledAt,
          duration,
          modality:      input.modality,
          teacherOnsite,
          capacity,
          priceOverride: price,
        },
      })

      // Nada mudou na cobrança desta ocorrência (nem data, nem valor): não vale
      // gastar consultas dentro da transação — uma série longa somaria dezenas.
      const cobrancaIntacta =
        alvo.precoAntes === price && alvo.antes.getTime() === alvo.scheduledAt.getTime()
      if (cobrancaIntacta) continue

      await sincronizarCobrancas(tx, {
        studentIds:  alvo.participants,
        dueDateAtual: alvo.antes,
        scheduledAt: alvo.scheduledAt,
        price,
        description: descricaoCobranca({
          lessonType:  alvo.lessonType,
          subjectName: subject.name,
          title,
          scheduledAt: alvo.scheduledAt,
        }),
      })
    }
  }, { timeout: 20_000, maxWait: 10_000 })

  revalidateAulao(lesson.id)
  for (const alvo of alvos) revalidatePath(`/colaborador/auloes/${alvo.id}`)

  return { updated: alvos.length }
}

/**
 * Faz as cobranças dos inscritos acompanharem a edição do aulão.
 *
 * O vínculo entre Payment e aulão é indireto (studentId + dueDate = data da
 * aula), então mover a data exige reescrever o dueDate — senão a cobrança perde
 * o aulão de vista. Ver o comentário do bloco "Editar aulão".
 */
async function sincronizarCobrancas(
  tx: Prisma.TransactionClient,
  opts: {
    studentIds:   string[]
    /** Data da aula ANTES da edição — é por ela que as cobranças são achadas. */
    dueDateAtual: Date
    scheduledAt:  Date
    price:        number
    description:  string
  },
) {
  if (opts.studentIds.length === 0) return

  const existentes = await tx.payment.findMany({
    where: { studentId: { in: opts.studentIds }, dueDate: opts.dueDateAtual },
  })

  if (opts.price === 0) {
    // Virou gratuito: some com o que ainda não foi pago. O que já foi pago
    // fica de pé — o dinheiro entrou, quem estorna é o financeiro.
    const aRemover = existentes.filter(p => p.status !== "PAID").map(p => p.id)
    if (aRemover.length > 0) await tx.payment.deleteMany({ where: { id: { in: aRemover } } })
    return
  }

  const emAberto = existentes.filter(p => p.status !== "PAID")
  if (emAberto.length > 0) {
    await tx.payment.updateMany({
      where: { id: { in: emAberto.map(p => p.id) } },
      data:  { amount: opts.price, dueDate: opts.scheduledAt, description: opts.description },
    })
  }

  // Cobrança quitada acompanha a data nova para não perder o vínculo com o
  // aulão (o vínculo é o dueDate), mas o valor pago não se reescreve.
  const pagos = existentes.filter(p => p.status === "PAID")
  if (pagos.length > 0) {
    await tx.payment.updateMany({
      where: { id: { in: pagos.map(p => p.id) } },
      data:  { dueDate: opts.scheduledAt },
    })
  }

  // Era gratuito e virou pago: quem não tinha cobrança ganha uma.
  const jaCobrados  = new Set(existentes.map(p => p.studentId))
  const semCobranca = opts.studentIds.filter(id => !jaCobrados.has(id))
  if (semCobranca.length > 0) {
    await tx.payment.createMany({
      data: semCobranca.map(studentId => ({
        studentId,
        amount:  opts.price,
        dueDate: opts.scheduledAt,
        description: opts.description,
        status:  "PENDING" as const,
      })),
    })
  }
}

// ─── Reativar aulão cancelado ─────────────────────────────────────────────────

export async function reactivateAulaoAction(lessonId: string): Promise<ActionResult<undefined>> {
  return comResultado(async () => { await reativarAulao(lessonId); return undefined })
}

async function reativarAulao(lessonId: string) {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: { participants: true, subject: true, teacher: { include: { user: true } } },
  })
  if (!lesson) throw new Error("Aulão não encontrado")
  if (!["AULAO", "GROUP"].includes(lesson.lessonType)) throw new Error("Esta aula não é um aulão")
  if (lesson.status !== "CANCELLED") throw new Error("Este aulão não está cancelado")

  const duration = lesson.duration ?? 90

  // O horário pode ter sido ocupado por outra aula depois do cancelamento.
  if (lesson.scheduledAt >= new Date()) {
    await assertTeacherFree(
      { teacherId: lesson.teacherId, scheduledAt: lesson.scheduledAt, duration, excludeLessonId: lesson.id },
      lesson.teacher.user.name,
    )
    if (occupiesRoom(lesson.modality, lesson.teacherOnsite)) {
      await assertRoomFree({ scheduledAt: lesson.scheduledAt, duration, excludeLessonId: lesson.id })
    }
  }

  const price      = lesson.priceOverride ? lesson.priceOverride.toNumber() : 0
  const studentIds = lesson.participants.map(p => p.studentId)

  await prisma.$transaction(async (tx) => {
    await tx.lesson.update({ where: { id: lesson.id }, data: { status: "SCHEDULED" } })

    // Cancelar apagou as cobranças pendentes — reativar precisa devolvê-las,
    // senão o aulão volta e o dinheiro não.
    if (price > 0 && studentIds.length > 0) {
      const existentes = await tx.payment.findMany({
        where:  { studentId: { in: studentIds }, dueDate: lesson.scheduledAt },
        select: { studentId: true },
      })
      const jaCobrados  = new Set(existentes.map(p => p.studentId))
      const semCobranca = studentIds.filter(id => !jaCobrados.has(id))

      if (semCobranca.length > 0) {
        const description = descricaoCobranca({
          lessonType:  lesson.lessonType,
          subjectName: lesson.subject?.name ?? null,
          title:       lesson.title,
          scheduledAt: lesson.scheduledAt,
        })
        await tx.payment.createMany({
          data: semCobranca.map(studentId => ({
            studentId,
            amount:  price,
            dueDate: lesson.scheduledAt,
            description,
            status:  "PENDING" as const,
          })),
        })
      }
    }
  })

  revalidateAulao(lesson.id)
}

// ─── Excluir aulão ────────────────────────────────────────────────────────────

export async function deleteAulaoAction(lessonId: string): Promise<ActionResult<undefined>> {
  return comResultado(async () => { await excluirAulao(lessonId); return undefined })
}

async function excluirAulao(lessonId: string) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Só um administrador pode excluir um aulão")

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: { participants: true, _count: { select: { homework: true } } },
  })
  if (!lesson) throw new Error("Aulão não encontrado")
  if (!["AULAO", "GROUP"].includes(lesson.lessonType)) throw new Error("Esta aula não é um aulão")
  if (lesson.courseId) throw new Error("Este é um encontro de turma — exclua pela turma, em /colaborador/turmas")
  if (lesson._count.homework > 0) {
    throw new Error("Este aulão tem lições de casa vinculadas — remova as lições antes de excluir")
  }

  const studentIds = lesson.participants.map(p => p.studentId)

  await prisma.$transaction(async (tx) => {
    // Cobrança quitada não some junto: o pagamento aconteceu e continua no caixa.
    if (studentIds.length > 0) {
      await tx.payment.deleteMany({
        where: {
          studentId: { in: studentIds },
          dueDate:   lesson.scheduledAt,
          status:    { in: ["PENDING", "OVERDUE"] },
        },
      })
    }
    // participants e cancellationRequests caem por cascade (ver schema.prisma).
    await tx.lesson.delete({ where: { id: lesson.id } })
  })

  for (const path of REVALIDATE_PATHS) revalidatePath(path)
  for (const studentId of studentIds) revalidatePath(`/colaborador/alunos/${studentId}`)
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
