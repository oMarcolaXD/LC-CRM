"use server"

/**
 * Turmas de acompanhamento.
 *
 * Diferente do pacote de aulas, a turma é um CONTRATO por período: o aluno paga
 * um valor fechado (parcelado) e as aulas acontecem numa grade fixa enquanto o
 * contrato estiver ativo. As aulas da turma não consomem saldo de pacote —
 * nenhum fluxo daqui mexe em `remainingLessons`.
 */

import { prisma }         from "@/lib/prisma"
import type { Prisma }    from "@prisma/client"
import { auth }           from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { randomUUID }     from "crypto"
import { addMonths }      from "date-fns"
import { parseBrazilDateTime, formatBR } from "@/lib/datetime"
import { getRoomCount }   from "@/lib/config"
import {
  loadTeacherAgendaFor, loadRoomAgendaFor,
  findConflictIn, countOverlapsIn, describeLesson, occupiesRoom,
} from "@/lib/scheduling"
import { gerarEncontros, dividirParcelas } from "@/lib/course"
import { comResultado, type ActionResult } from "@/lib/action-result"

async function requireCollaboratorOrAdmin() {
  const session = await auth()
  const role = session?.user?.role
  if (role !== "ADMIN" && role !== "COLLABORATOR") throw new Error("Sem permissão")
  return session!
}

function revalidateTurmas(courseId?: string) {
  revalidatePath("/colaborador/turmas")
  if (courseId) revalidatePath(`/colaborador/turmas/${courseId}`)
  revalidatePath("/colaborador/alunos")
  revalidatePath("/colaborador/agenda")
  revalidatePath("/colaborador/financeiro")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
}

// ─── Criar turma ──────────────────────────────────────────────────────────────

export interface CreateCourseInput {
  name:             string
  description?:     string
  teacherId:        string
  subjectId?:       string
  modality:         "PRESENCIAL" | "ONLINE"
  teacherOnsite?:   boolean
  weekday:          number  // 0 = domingo … 6 = sábado
  startTime:        string  // "HH:mm"
  duration?:        number
  startDate:        string  // "YYYY-MM-DD"
  endDate:          string  // "YYYY-MM-DD"
  studentIds:       string[]
  capacity?:        number  // lotação máxima; vazio = sem limite
  pricePerStudent?: number
  installments?:    number
  firstDueDate?:    string  // "YYYY-MM-DD" — vencimento da 1ª parcela
  generateLessons?: boolean
}

export async function createCourseAction(
  data: CreateCourseInput,
): Promise<ActionResult<{ id: string; aulas: number; cobrancas: number }>> {
  return comResultado(() => criarTurma(data))
}

async function criarTurma(data: CreateCourseInput) {
  await requireCollaboratorOrAdmin()

  if (!data.name.trim())          throw new Error("Dê um nome à turma")
  if (data.studentIds.length === 0) throw new Error("Matricule ao menos um aluno na turma")
  if (data.weekday < 0 || data.weekday > 6) throw new Error("Dia da semana inválido")

  const duration = data.duration ?? 60
  const parcelas = Math.max(1, data.installments ?? 1)
  const preco    = data.pricePerStudent ?? 0

  const teacher = await prisma.teacher.findUnique({
    where: { id: data.teacherId }, include: { user: true },
  })
  if (!teacher) throw new Error("Professor não encontrado")

  const alunos = await prisma.student.findMany({ where: { id: { in: data.studentIds } } })
  if (alunos.length !== data.studentIds.length) throw new Error("Algum aluno selecionado não existe mais")

  // Mesma regra do aulão: presencial sempre ocupa a sede; online só ocupa se o
  // professor vier dar a aula daqui.
  const teacherOnsite = data.modality === "PRESENCIAL" ? true
    : teacher.teachingMode === "ONLINE_ONLY" ? false
    : (data.teacherOnsite ?? false)

  const datas = data.generateLessons === false
    ? []
    : gerarEncontros(data.startDate, data.endDate, data.weekday, data.startTime)

  if (data.generateLessons !== false && datas.length === 0) {
    throw new Error("O período informado não contém nenhum encontro nesse dia da semana")
  }

  // ── Conflitos de agenda: valida a série inteira antes de criar nada ────────
  if (datas.length > 0) {
    const agora     = new Date()
    const futuros   = datas.filter(d => d >= agora).map(d => ({ scheduledAt: d, duration }))
    const precisaSala = occupiesRoom(data.modality, teacherOnsite)

    const [agendaProf, agendaSalas, totalSalas] = await Promise.all([
      loadTeacherAgendaFor(data.teacherId, futuros),
      precisaSala ? loadRoomAgendaFor(futuros) : Promise.resolve([]),
      precisaSala ? getRoomCount() : Promise.resolve(0),
    ])

    const conflitos: string[] = []
    for (const slot of futuros) {
      const quando = formatBR(slot.scheduledAt, "dd/MM 'às' HH:mm")
      if (precisaSala && countOverlapsIn(slot, agendaSalas) >= totalSalas) {
        conflitos.push(`${quando} — todas as ${totalSalas} sala${totalSalas !== 1 ? "s" : ""} estão ocupadas`)
        continue
      }
      const clash = findConflictIn(slot, agendaProf)
      if (clash) conflitos.push(`${quando} — ${describeLesson(clash)}`)
    }

    if (conflitos.length > 0) {
      const mostra = conflitos.slice(0, 5).join("; ")
      const resto  = conflitos.length > 5 ? ` (e mais ${conflitos.length - 5})` : ""
      throw new Error(
        `Conflito de horário em ${conflitos.length} encontro${conflitos.length !== 1 ? "s" : ""}: ${mostra}${resto}. ` +
        `A turma não foi criada.`,
      )
    }
  }

  const valores      = preco > 0 ? dividirParcelas(preco, parcelas) : []
  const primeiroVenc = data.firstDueDate
    ? parseBrazilDateTime(data.firstDueDate, "12:00")
    : parseBrazilDateTime(data.startDate, "12:00")

  let cobrancas = 0

  const course = await prisma.$transaction(async (tx) => {
    const criada = await tx.course.create({
      data: {
        name:            data.name.trim(),
        description:     data.description?.trim() || null,
        teacherId:       data.teacherId,
        subjectId:       data.subjectId || null,
        modality:        data.modality,
        teacherOnsite,
        weekday:         data.weekday,
        startTime:       data.startTime,
        duration,
        capacity:        data.capacity ?? null,
        startDate:       parseBrazilDateTime(data.startDate, data.startTime),
        endDate:         parseBrazilDateTime(data.endDate, "23:59"),
        pricePerStudent: preco > 0 ? preco : null,
        installments:    parcelas,
        status:          "ACTIVE",
        enrollments:     { create: data.studentIds.map(studentId => ({ studentId })) },
      },
    })

    // ── Encontros da grade ───────────────────────────────────────────────────
    // priceOverride 0: a aula não gera cobrança avulsa, o contrato já cobre.
    for (const date of datas) {
      await tx.lesson.create({
        data: {
          courseId:      criada.id,
          teacherId:     data.teacherId,
          subjectId:     data.subjectId || null,
          scheduledAt:   date,
          duration,
          modality:      data.modality,
          status:        date < new Date() ? "COMPLETED" : "SCHEDULED",
          lessonType:    "GROUP",
          title:         criada.name,
          capacity:      data.capacity ?? null,
          teacherOnsite,
          priceOverride: 0,
          participants:  { create: data.studentIds.map(studentId => ({ studentId })) },
        },
      })
    }

    // ── Parcelas do contrato, por aluno ──────────────────────────────────────
    for (const aluno of alunos) {
      if (valores.length === 0) break
      const groupId = randomUUID()
      for (const [i, valor] of valores.entries()) {
        await tx.payment.create({
          data: {
            studentId:   aluno.id,
            courseId:    criada.id,
            amount:      valor,
            dueDate:     addMonths(primeiroVenc, i),
            status:      "PENDING",
            description: `${criada.name} — parcela ${i + 1}/${valores.length}`,
            ...(valores.length > 1 ? {
              installmentNumber:  i + 1,
              installmentTotal:   valores.length,
              installmentGroupId: groupId,
            } : {}),
          },
        })
        cobrancas++
      }
    }

    return criada
  })

  revalidateTurmas(course.id)
  return { id: course.id, aulas: datas.length, cobrancas }
}

// ─── Editar dados da turma ────────────────────────────────────────────────────

export interface UpdateCourseInput {
  courseId:     string
  name:         string
  description?: string
  subjectId?:   string
  endDate?:     string
}

export async function updateCourseAction(
  data: UpdateCourseInput,
): Promise<ActionResult<undefined>> {
  return comResultado(async () => {
    await requireCollaboratorOrAdmin()
    if (!data.name.trim()) throw new Error("Dê um nome à turma")

    await prisma.course.update({
      where: { id: data.courseId },
      data: {
        name:        data.name.trim(),
        description: data.description?.trim() || null,
        subjectId:   data.subjectId || null,
        ...(data.endDate ? { endDate: parseBrazilDateTime(data.endDate, "23:59") } : {}),
      },
    })

    revalidateTurmas(data.courseId)
    return undefined
  })
}

// ─── Matrícula ────────────────────────────────────────────────────────────────

/**
 * Matricula um aluno numa turma em andamento. Ele entra nos encontros que ainda
 * não aconteceram e recebe as parcelas que ainda vão vencer — quem entra no meio
 * do semestre não paga o que já passou.
 */
export async function enrollStudentAction(
  courseId: string, studentId: string,
): Promise<ActionResult<{ aulas: number; cobrancas: number }>> {
  return comResultado(async () => {
    await requireCollaboratorOrAdmin()

    const course = await prisma.course.findUnique({
      where:   { id: courseId },
      include: { enrollments: true },
    })
    if (!course) throw new Error("Turma não encontrada")
    if (course.status !== "ACTIVE") throw new Error("Esta turma não está ativa")
    if (course.enrollments.some(e => e.studentId === studentId)) {
      throw new Error("Este aluno já está matriculado na turma")
    }
    if (course.capacity != null && course.enrollments.length >= course.capacity) {
      throw new Error(`A turma já está com a lotação cheia (${course.capacity} alunos)`)
    }

    const agora = new Date()
    const futuras = await prisma.lesson.findMany({
      where:  { courseId, scheduledAt: { gte: agora }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      select: { id: true },
    })

    // As parcelas que ainda vão vencer, tiradas do calendário já montado para os
    // colegas de turma — uma por data de vencimento.
    const preco = Number(course.pricePerStudent ?? 0)
    const restante: { dueDate: Date; amount: Prisma.Decimal; numero: number | null; total: number | null }[] = []
    if (preco > 0) {
      const existentes = await prisma.payment.findMany({
        where:   { courseId, dueDate: { gte: agora } },
        select:  { dueDate: true, amount: true, installmentNumber: true, installmentTotal: true },
        orderBy: { dueDate: "asc" },
      })
      const vistos = new Set<number>()
      for (const p of existentes) {
        const chave = p.dueDate.getTime()
        if (vistos.has(chave)) continue
        vistos.add(chave)
        restante.push({
          dueDate: p.dueDate, amount: p.amount,
          numero:  p.installmentNumber, total: p.installmentTotal,
        })
      }
    }

    let cobrancas = 0
    await prisma.$transaction(async (tx) => {
      await tx.courseEnrollment.create({ data: { courseId, studentId } })

      if (futuras.length > 0) {
        await tx.lessonParticipant.createMany({
          data: futuras.map(l => ({ lessonId: l.id, studentId })),
          skipDuplicates: true,
        })
      }

      const groupId = randomUUID()
      for (const parcela of restante) {
        await tx.payment.create({
          data: {
            studentId,
            courseId,
            amount:      parcela.amount,
            dueDate:     parcela.dueDate,
            status:      "PENDING",
            description: `${course.name} — parcela ${parcela.numero ?? 1}/${parcela.total ?? 1}`,
            ...(restante.length > 1 ? {
              installmentNumber:  parcela.numero,
              installmentTotal:   parcela.total,
              installmentGroupId: groupId,
            } : {}),
          },
        })
        cobrancas++
      }
    })

    revalidateTurmas(courseId)
    return { aulas: futuras.length, cobrancas }
  })
}

/**
 * Tira o aluno da turma: sai dos encontros futuros e as cobranças da turma que
 * ainda não foram pagas são apagadas. O histórico de aulas já dadas fica.
 */
export async function unenrollStudentAction(
  courseId: string, studentId: string,
): Promise<ActionResult<undefined>> {
  return comResultado(async () => {
    await requireCollaboratorOrAdmin()

    const agora = new Date()
    const futuras = await prisma.lesson.findMany({
      where:  { courseId, scheduledAt: { gte: agora } },
      select: { id: true },
    })

    await prisma.$transaction([
      prisma.lessonParticipant.deleteMany({
        where: { studentId, lessonId: { in: futuras.map(l => l.id) } },
      }),
      prisma.payment.deleteMany({
        where: { courseId, studentId, status: { not: "PAID" } },
      }),
      prisma.courseEnrollment.delete({
        where: { courseId_studentId: { courseId, studentId } },
      }),
    ])

    revalidateTurmas(courseId)
    return undefined
  })
}

// ─── Encerrar / cancelar ──────────────────────────────────────────────────────

/** Encerra a turma. Os encontros que ainda não aconteceram são cancelados. */
export async function finishCourseAction(courseId: string): Promise<ActionResult<undefined>> {
  return comResultado(async () => {
    await requireCollaboratorOrAdmin()

    await prisma.$transaction([
      prisma.lesson.updateMany({
        where: { courseId, scheduledAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
        data:  { status: "CANCELLED" },
      }),
      prisma.course.update({ where: { id: courseId }, data: { status: "FINISHED" } }),
    ])

    revalidateTurmas(courseId)
    return undefined
  })
}

/**
 * Cancela a turma: além de cancelar os encontros futuros, apaga as cobranças
 * ainda não pagas. Use quando o contrato não chegou a valer.
 */
export async function cancelCourseAction(courseId: string): Promise<ActionResult<undefined>> {
  return comResultado(async () => {
    await requireCollaboratorOrAdmin()

    await prisma.$transaction([
      prisma.lesson.updateMany({
        where: { courseId, scheduledAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
        data:  { status: "CANCELLED" },
      }),
      prisma.payment.deleteMany({ where: { courseId, status: { not: "PAID" } } }),
      prisma.course.update({ where: { id: courseId }, data: { status: "CANCELLED" } }),
    ])

    revalidateTurmas(courseId)
    return undefined
  })
}

/**
 * Exclui a turma inteira. As cobranças somem junto (FK em cascata) e os
 * encontros ficam desvinculados, virando aulas em grupo comuns no histórico.
 */
export async function deleteCourseAction(courseId: string): Promise<ActionResult<undefined>> {
  return comResultado(async () => {
    const session = await requireCollaboratorOrAdmin()
    if (session.user.role !== "ADMIN") throw new Error("Apenas administradores podem excluir uma turma")

    const pagas = await prisma.payment.count({ where: { courseId, status: "PAID" } })
    if (pagas > 0) {
      throw new Error(
        `Esta turma tem ${pagas} cobrança${pagas !== 1 ? "s" : ""} já paga${pagas !== 1 ? "s" : ""}. ` +
        `Encerre a turma em vez de excluir, para não perder o histórico financeiro.`,
      )
    }

    await prisma.$transaction([
      prisma.lesson.updateMany({
        where: { courseId, scheduledAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
        data:  { status: "CANCELLED" },
      }),
      prisma.course.delete({ where: { id: courseId } }),
    ])

    revalidateTurmas()
    return undefined
  })
}

// ─── Encontro avulso ──────────────────────────────────────────────────────────

/** Adiciona um encontro extra à turma (reposição, aula de revisão, etc.). */
export async function addCourseLessonAction(input: {
  courseId: string
  date:     string
  time:     string
}): Promise<ActionResult<undefined>> {
  return comResultado(async () => {
    await requireCollaboratorOrAdmin()

    const course = await prisma.course.findUnique({
      where:   { id: input.courseId },
      include: { enrollments: true },
    })
    if (!course)            throw new Error("Turma não encontrada")
    if (!course.teacherId)  throw new Error("Esta turma não tem professor definido")

    const scheduledAt = parseBrazilDateTime(input.date, input.time)
    const slot        = { scheduledAt, duration: course.duration }

    if (scheduledAt > new Date()) {
      const precisaSala = occupiesRoom(course.modality, course.teacherOnsite)
      const [agendaProf, agendaSalas, totalSalas] = await Promise.all([
        loadTeacherAgendaFor(course.teacherId, [slot]),
        precisaSala ? loadRoomAgendaFor([slot]) : Promise.resolve([]),
        precisaSala ? getRoomCount() : Promise.resolve(0),
      ])

      if (precisaSala && countOverlapsIn(slot, agendaSalas) >= totalSalas) {
        throw new Error(`Todas as ${totalSalas} sala${totalSalas !== 1 ? "s" : ""} estão ocupadas nesse horário`)
      }
      const clash = findConflictIn(slot, agendaProf)
      if (clash) {
        throw new Error(`O professor já tem ${describeLesson(clash)} nesse horário`)
      }
    }

    await prisma.lesson.create({
      data: {
        courseId:      course.id,
        teacherId:     course.teacherId,
        subjectId:     course.subjectId,
        scheduledAt,
        duration:      course.duration,
        modality:      course.modality,
        status:        scheduledAt < new Date() ? "COMPLETED" : "SCHEDULED",
        lessonType:    "GROUP",
        title:         course.name,
        capacity:      course.capacity,
        teacherOnsite: course.teacherOnsite,
        priceOverride: 0,
        participants:  { create: course.enrollments.map(e => ({ studentId: e.studentId })) },
      },
    })

    revalidateTurmas(course.id)
    return undefined
  })
}

// ─── Consultas ────────────────────────────────────────────────────────────────

/** Turmas ativas de um aluno — usado na ficha do aluno. */
export async function getActiveCoursesForStudent(studentId: string) {
  return prisma.course.findMany({
    where: {
      status:      "ACTIVE",
      enrollments: { some: { studentId } },
    },
    include: { teacher: { include: { user: true } }, subject: true },
    orderBy: { startDate: "asc" },
  })
}
