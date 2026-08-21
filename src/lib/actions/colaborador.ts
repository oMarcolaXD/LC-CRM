"use server"

import { prisma }            from "@/lib/prisma"
import type { Prisma }       from "@prisma/client"
import { auth }              from "@/lib/auth"
import { revalidatePath }    from "next/cache"
import { redirect }          from "next/navigation"
import {
  notify, notifyLessonConfirmedToTeacher,
  deliveredChannels, nothingDelivered, countsAsSent, describeDeliveryFailure,
  type DeliveryResult,
} from "@/lib/notifications"
import { sendWelcomeEmail }  from "@/lib/email"
import { ptBR }              from "date-fns/locale"
import { parseBrazilDateTime, formatBR } from "@/lib/datetime"
import bcrypt                from "bcryptjs"
import { z }                 from "zod"
import { randomUUID }        from "crypto"
import { calcFee, type FeeRate } from "@/lib/fees"
import { comResultado, type ActionResult } from "@/lib/action-result"
import { normalizeGrade } from "@/lib/constants/grades"
import { gerarRA }        from "@/lib/ra"
import { temMetodo }      from "@/lib/payments"

/** Carrega as regras de taxa de cartão ativas (para snapshot em Payment.feeAmount). */
async function loadFeeRates(): Promise<FeeRate[]> {
  const rows = await prisma.cardFeeRate.findMany({ where: { active: true } })
  return rows.map((r) => ({
    method:          r.method,
    minInstallments: r.minInstallments,
    maxInstallments: r.maxInstallments,
    percent:         Number(r.percent),
    fixed:           Number(r.fixed),
    active:          r.active,
  }))
}

function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!"
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

// ─── Schemas internos ─────────────────────────────────────────────────────────

const pastLessonSchema = z.object({
  date:      z.string(),
  time:      z.string().default("08:00"),
  teacherId: z.string().min(1),
  subjectId: z.string().min(1),
  duration:  z.string().default("60"),
  modality:  z.enum(["PRESENCIAL", "ONLINE"]).default("PRESENCIAL"),
  topics:    z.string().optional(),
  status:    z.enum(["COMPLETED", "MISSED"]).default("COMPLETED"),
})

const pastPaymentSchema = z.object({
  amount:      z.string().min(1),
  dueDate:     z.string().min(1),
  paidAt:      z.string().optional(),
  status:      z.enum(["PAID", "PENDING", "OVERDUE"]).default("PAID"),
  method:      z.string().optional(),
  description: z.string().optional(),
})

async function requireCollaboratorOrAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")
  if (!["ADMIN", "COLLABORATOR"].includes(session.user.role)) throw new Error("Sem permissão")
  return session
}

// ─── Cadastrar Aluno (com responsável opcional) ────────────────────────────────

const newStudentSchema = z.object({
  name:          z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email:         z.string().email("E-mail inválido").optional().or(z.literal("")),
  password:      z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional().or(z.literal("")),
  grade:         z.string().optional(),
  school:        z.string().optional(),
  guardianName:  z.string().min(3, "Nome do responsável é obrigatório"),
  guardianPhone: z.string().min(1, "WhatsApp do responsável é obrigatório"),
  guardianEmail: z.string().email("E-mail do responsável inválido"),
})

export async function createStudentWithGuardianAction(formData: FormData) {
  await requireCollaboratorOrAdmin()

  const raw    = Object.fromEntries(formData)
  const parsed = newStudentSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos"
    redirect(`/colaborador/alunos/novo?error=${encodeURIComponent(msg)}`)
  }

  const { name, email, grade, school,
          guardianName, guardianPhone, guardianEmail } = parsed.data

  // E-mail do aluno é opcional — normaliza vazio para null (login fica pelo responsável)
  const studentEmail = email && email.trim() ? email.trim() : null

  if (studentEmail) {
    const exists = await prisma.user.findUnique({ where: { email: studentEmail } })
    if (exists) redirect("/colaborador/alunos/novo?error=E-mail+já+cadastrado")
  }

  const skipEmail    = formData.get("skipEmail") === "on"
  const manualPass   = parsed.data.password
  const plainPassword = (skipEmail && manualPass) ? manualPass : generateRandomPassword()

  if (skipEmail && (!manualPass || manualPass.length < 6)) {
    redirect(`/colaborador/alunos/novo?error=${encodeURIComponent("Senha deve ter no mínimo 6 caracteres")}`)
  }

  const hashed  = await bcrypt.hash(plainPassword, 12)
  const inactive = formData.get("inactive") === "on"

  // Pacote inicial
  const packageLessons   = parseInt(formData.get("packageLessons")?.toString() ?? "0") || 0
  const packageRemaining = parseInt(formData.get("packageRemaining")?.toString() ?? String(packageLessons)) || packageLessons
  const packagePriceRaw  = formData.get("packagePrice")?.toString().replace(",", ".") ?? "0"
  const packagePrice     = parseFloat(packagePriceRaw) || 0
  const packageDateRaw   = formData.get("packageDate")?.toString()
  const packageDate      = packageDateRaw ? new Date(packageDateRaw) : new Date()
  const packageExpiresIn = parseInt(formData.get("packageExpires")?.toString() ?? "0") || 0
  const packageExpiresAt = packageExpiresIn > 0
    ? new Date(packageDate.getTime() + packageExpiresIn * 86400000)
    : null

  // Aulas passadas
  let lessonCount = 0
  const rawPastLessons = formData.get("pastLessons")?.toString()
  let parsedLessons: Array<{ date: string; time: string; teacherId: string; subjectId: string; duration: string; modality: "PRESENCIAL" | "ONLINE"; topics?: string; status: "COMPLETED" | "MISSED" }> = []
  if (rawPastLessons) {
    let lessonsJson: unknown
    try { lessonsJson = JSON.parse(rawPastLessons) } catch { lessonsJson = [] }
    const rows = z.array(pastLessonSchema).safeParse(lessonsJson)
    if (rows.success) parsedLessons = rows.data
  }

  // Pagamentos passados
  let paymentCount = 0
  const rawPastPayments = formData.get("pastPayments")?.toString()
  let parsedPayments: Array<{ amount: string; dueDate: string; paidAt?: string; status: "PAID" | "PENDING" | "OVERDUE"; method?: string; description?: string }> = []
  if (rawPastPayments) {
    let paymentsJson: unknown
    try { paymentsJson = JSON.parse(rawPastPayments) } catch { paymentsJson = [] }
    const rows = z.array(pastPaymentSchema).safeParse(paymentsJson)
    if (rows.success) parsedPayments = rows.data
  }

  // Motivo de inatividade → notes
  const inactiveDate   = formData.get("inactiveDate")?.toString()
  const inactiveReason = formData.get("inactiveReason")?.toString()
  const inactiveNote   = inactive
    ? [
        inactiveDate   ? `Saída: ${inactiveDate}` : null,
        inactiveReason ? `Motivo: ${inactiveReason}` : null,
      ].filter(Boolean).join(" — ") || "Ex-aluno"
    : null

  let createdStudentId = ""

  const gPass = guardianName ? await bcrypt.hash(`Resp@${Math.random().toString(36).slice(2, 8)}`, 12) : ""

  await prisma.$transaction(async (tx) => {
    // Aluno não tem telefone: o contato é sempre o do responsável.
    const studentUser = await tx.user.create({
      data: { name, email: studentEmail, password: hashed, role: "STUDENT", active: !inactive },
    })

    let guardianId: string | undefined

    if (guardianName) {
      const existingGuardian = await tx.user.findUnique({ where: { email: guardianEmail } })

      if (existingGuardian) {
        const g = await tx.guardian.findUnique({ where: { userId: existingGuardian.id } })
        if (g) guardianId = g.id
      } else {
        const gUser = await tx.user.create({
          data: { name: guardianName, email: guardianEmail, password: gPass, phone: guardianPhone, role: "GUARDIAN" },
        })
        const g = await tx.guardian.create({ data: { userId: gUser.id } })
        guardianId = g.id
      }
    }

    const student = await tx.student.create({
      data: {
        userId:    studentUser.id,
        ra:        await gerarRA(tx),
        name:      studentUser.name,
        grade:     normalizeGrade(grade) ?? "Não informado",
        school,
        guardianId,
        notes:     inactiveNote,
      },
    })
    createdStudentId = student.id

    // ── Pacote inicial ───────────────────────────────────────────────────────
    if (packageLessons > 0) {
      await tx.lessonPackage.create({
        data: {
          studentId:        student.id,
          totalLessons:     packageLessons,
          remainingLessons: Math.min(packageRemaining, packageLessons),
          pricePerLesson:   packagePrice,
          purchaseDate:     packageDate,
          expiresAt:        packageExpiresAt,
          status:           "ACTIVE",
        },
      })
    }

    // ── Aulas já realizadas ──────────────────────────────────────────────────
    for (const row of parsedLessons) {
      const scheduledAt = parseBrazilDateTime(row.date, row.time)
      await tx.lesson.create({
        data: {
          teacherId:     row.teacherId,
          subjectId:     row.subjectId,
          scheduledAt,
          duration:      parseInt(row.duration) || 60,
          modality:      row.modality,
          status:        row.status,
          topicsCovered: row.topics || null,
          participants:  { create: { studentId: student.id } },
        },
      })
      lessonCount++
    }

    // ── Pagamentos anteriores ────────────────────────────────────────────────
    for (const p of parsedPayments) {
      const amount = parseFloat(p.amount.replace(",", ".")) || 0
      if (amount <= 0) continue
      await tx.payment.create({
        data: {
          studentId:   student.id,
          amount,
          dueDate:     new Date(p.dueDate),
          paidAt:      p.paidAt ? new Date(p.paidAt) : (p.status === "PAID" ? new Date(p.dueDate) : null),
          status:      p.status,
          method:      p.method || null,
          description: p.description || null,
        },
      })
      paymentCount++
    }
  })

  revalidatePath("/colaborador/alunos")
  revalidatePath("/admin/usuarios")

  // Envia e-mail com a senha apenas se o modo automático estiver ativo e o aluno tiver e-mail
  const emailWasSent = !skipEmail && Boolean(studentEmail)
  if (emailWasSent) {
    try {
      await sendWelcomeEmail(studentEmail!, name, plainPassword)
    } catch {
      // Não bloqueia o cadastro se o e-mail falhar
    }
  }

  const params = new URLSearchParams({
    success:   "digitalizado",
    aulas:     String(lessonCount),
    pagamentos: String(paymentCount),
    ...(emailWasSent ? { emailEnviado: "1" } : {}),
  })
  redirect(`/colaborador/alunos/${createdStudentId}?${params.toString()}`)
}

// ─── Importar Alunos via CSV ───────────────────────────────────────────────────

const importRowSchema = z.object({
  nome:                z.string().min(1),
  email:               z.string().email(),
  senha:               z.string().min(6).default("Aluno@2025"),
  dataNascimento:      z.string().optional(),
  serie:               z.string().optional(),
  escola:              z.string().optional(),
  nomeResponsavel:     z.string().optional(),
  telefoneResponsavel: z.string().optional(),
  emailResponsavel:    z.string().optional(),
})

export type ImportResult = {
  success: number
  errors: { row: number; email: string; reason: string }[]
}

export async function importStudentsAction(rows: unknown[]): Promise<ImportResult> {
  await requireCollaboratorOrAdmin()

  const result: ImportResult = { success: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const parsed = importRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      result.errors.push({
        row:    i + 2,
        email:  String((rows[i] as Record<string, unknown>).email ?? ""),
        reason: parsed.error.issues[0]?.message ?? "Dados inválidos",
      })
      continue
    }

    const {
      nome, email, senha, serie, escola,
      nomeResponsavel, telefoneResponsavel, emailResponsavel,
    } = parsed.data

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      result.errors.push({ row: i + 2, email, reason: "E-mail já cadastrado" })
      continue
    }

    try {
      const hashed = await bcrypt.hash(senha, 12)

      await prisma.$transaction(async (tx) => {
        const studentUser = await tx.user.create({
          data: { name: nome, email, password: hashed, role: "STUDENT" },
        })

        let guardianId: string | undefined
        if (nomeResponsavel) {
          const gEmail = emailResponsavel || `resp.${Date.now()}@interno.lcasa`
          const gPass  = await bcrypt.hash(`Resp@${Math.random().toString(36).slice(2, 8)}`, 12)
          const existingG = emailResponsavel
            ? await tx.user.findUnique({ where: { email: emailResponsavel } })
            : null

          if (existingG) {
            const g = await tx.guardian.findUnique({ where: { userId: existingG.id } })
            if (g) guardianId = g.id
          } else {
            const gUser = await tx.user.create({
              data: { name: nomeResponsavel, email: gEmail, password: gPass, phone: telefoneResponsavel, role: "GUARDIAN" },
            })
            const g = await tx.guardian.create({ data: { userId: gUser.id } })
            guardianId = g.id
          }
        }

        await tx.student.create({
          data: {
            userId:    studentUser.id,
            ra:        await gerarRA(tx),
            name:      studentUser.name,
            grade:     normalizeGrade(serie) ?? "Não informado",
            school:    escola,
            guardianId,
          },
        })
      })

      result.success++
    } catch {
      result.errors.push({ row: i + 2, email, reason: "Erro interno ao cadastrar" })
    }
  }

  revalidatePath("/colaborador/alunos")
  revalidatePath("/admin/usuarios")
  return result
}

// ─── Editar Aluno ──────────────────────────────────────────────────────────────

const updateStudentSchema = z.object({
  studentId:     z.string().min(1),
  name:          z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  grade:         z.string().min(1, "Série é obrigatória"),
  school:        z.string().optional(),
  email:         z.string().email("E-mail inválido").optional().or(z.literal("")),
  notes:         z.string().optional(),
  tags:          z.string().optional(),
  active:        z.boolean().optional(),
  guardianName:  z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email("E-mail do responsável inválido").optional().or(z.literal("")),
})

export async function updateStudentAction(input: {
  studentId:      string
  name:           string
  grade:          string
  school?:        string
  email?:         string
  notes?:         string
  tags?:          string
  active?:        boolean
  guardianName?:  string
  guardianPhone?: string
  guardianEmail?: string
}) {
  await requireCollaboratorOrAdmin()

  const parsed = updateStudentSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos")

  const { studentId, name, grade, school, email, notes, tags, active,
          guardianName, guardianPhone, guardianEmail } = parsed.data

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true, guardian: { include: { user: true } } },
  })
  if (!student) throw new Error("Aluno não encontrado")

  const tagList = tags
    ? tags.split(",").map(t => t.trim()).filter(Boolean)
    : []

  await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: studentId },
      data: { name, grade: normalizeGrade(grade) ?? grade, school: school || null, notes: notes || null, tags: tagList },
    })

    if (student.userId) {
      await tx.user.update({
        where: { id: student.userId },
        data: {
          name,
          ...(email ? { email } : {}),
          ...(active !== undefined ? { active } : {}),
        },
      })
    }

    if (student.guardian?.user) {
      await tx.user.update({
        where: { id: student.guardian.userId },
        data: {
          ...(guardianName  ? { name: guardianName }   : {}),
          ...(guardianPhone ? { phone: guardianPhone }  : { phone: null }),
          ...(guardianEmail ? { email: guardianEmail }  : {}),
        },
      })
    }
  })

  revalidatePath(`/colaborador/alunos/${studentId}`)
  revalidatePath("/colaborador/alunos")
}

// ─── Adicionar Pagamento Avulso ao Aluno ──────────────────────────────────────

const installmentSchema = z.object({
  dueDate: z.string().min(1, "Data da parcela é obrigatória"),
  amount:  z.number().positive("Valor da parcela deve ser positivo"),
})

const addPaymentSchema = z.object({
  studentId:   z.string().min(1),
  amount:      z.number().positive("Valor deve ser positivo"),
  dueDate:     z.string().min(1, "Data de vencimento é obrigatória"),
  paidAt:      z.string().optional(),
  status:      z.enum(["PAID", "PENDING", "OVERDUE"]),
  method:      z.string().optional(),
  description: z.string().optional(),
  // Quando presente (boleto/cartão parcelado), cria uma cobrança por parcela.
  installments: z.array(installmentSchema).min(2).optional(),
})

export async function addStudentPaymentAction(input: {
  studentId:   string
  amount:      number
  dueDate:     string
  paidAt?:     string
  status:      "PAID" | "PENDING" | "OVERDUE"
  method?:     string
  description?: string
  installments?: { dueDate: string; amount: number }[]
}) {
  await requireCollaboratorOrAdmin()

  const parsed = addPaymentSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos")

  const { studentId, dueDate, paidAt, status, method, description, installments } = parsed.data
  const feeRates = await loadFeeRates()

  if (installments && installments.length >= 2) {
    // Parcelamento: uma cobrança (PENDING) por parcela, ligadas por grupo.
    const groupId = randomUUID()
    const total   = installments.length
    await prisma.payment.createMany({
      data: installments.map((inst, i) => ({
        studentId,
        amount:             inst.amount,
        dueDate:            new Date(inst.dueDate),
        paidAt:             null,
        status:             "PENDING" as const,
        method:             method || null,
        feeAmount:          calcFee(feeRates, method, total, inst.amount),
        description:        description || null,
        installmentNumber:  i + 1,
        installmentTotal:   total,
        installmentGroupId: groupId,
      })),
    })
  } else {
    await prisma.payment.create({
      data: {
        studentId,
        amount:      parsed.data.amount,
        dueDate:     new Date(dueDate),
        paidAt:      paidAt ? new Date(paidAt) : (status === "PAID" ? new Date() : null),
        status,
        method:      method || null,
        feeAmount:   calcFee(feeRates, method, 1, parsed.data.amount),
        description: description || null,
      },
    })
  }

  revalidatePath(`/colaborador/alunos/${studentId}`)
  revalidatePath("/colaborador/financeiro")
  revalidatePath("/admin/financeiro/pagamentos")
}

// ─── Marcar Pagamento como Pago ───────────────────────────────────────────────

/**
 * Quita a cobrança. A forma de pagamento é obrigatória: sem ela a taxa da
 * maquininha não é calculada, `feeAmount` fica em zero e a receita líquida de
 * todos os relatórios sai maior do que o valor que caiu na conta. A tela
 * pergunta o método quando a cobrança ainda não tem um.
 */
export async function markPaymentPaidColaboradorAction(id: string, method?: string) {
  await requireCollaboratorOrAdmin()

  const existing = await prisma.payment.findUnique({
    where:  { id },
    select: { amount: true, method: true, installmentTotal: true },
  })
  if (!existing) throw new Error("Cobrança não encontrada")

  const forma = (method ?? existing.method ?? "").trim()
  if (!forma) throw new Error("Informe a forma de pagamento para registrar o recebimento")

  const rates = await loadFeeRates()
  await prisma.payment.update({
    where: { id },
    data:  {
      status:    "PAID",
      paidAt:    new Date(),
      method:    forma,
      feeAmount: calcFee(rates, forma, existing.installmentTotal ?? 1, Number(existing.amount)),
    },
  })
  revalidatePath("/colaborador/financeiro")
  revalidatePath("/admin/financeiro/pagamentos")
  revalidatePath("/admin/relatorios", "layout")
}

// ─── Enviar confirmações em massa (rodada do dia) ─────────────────────────────

/**
 * Envia as mensagens da rodada do dia e fecha o ciclo: as aulas cujo
 * responsável/aluno foi avisado passam de "Agendada" para "Confirmada".
 *
 * Por que o responsável é quem confirma, e não o professor: no modal os itens de
 * professor são agrupados por professor (um item cobre várias aulas), então não
 * há como amarrar a confirmação de professor a uma aula específica. Itens de
 * `pacote` são cobrança de pacote vencido e nunca confirmam nada.
 */
export async function sendConfirmationsBatchAction(items: {
  key:      string
  lessonId: string
  tipo:     "responsavel" | "professor" | "pacote"
  mensagem: string
}[]): Promise<{ sent: number; delivered: number; confirmed: number; problema: string | null }> {
  await requireCollaboratorOrAdmin()

  const results: DeliveryResult[] = []
  const avisados = new Set<string>()   // lessonIds cujo responsável foi avisado

  for (const item of items) {
    // "pacote" (cobrança) também vai para o responsável — só não confirma a aula
    const paraProfessor = item.tipo === "professor"
    const lesson = await prisma.lesson.findUnique({
      where:   { id: item.lessonId },
      include: {
        participants: {
          include: {
            student: {
              include: {
                user:     true,
                guardian: { include: { user: true } },
              },
            },
          },
          take: 1,
        },
        teacher: { include: { user: true } },
        subject: true,
      },
    })
    if (!lesson) continue

    if (!paraProfessor) {
      const first    = lesson.participants[0]
      const student  = first?.student
      const guardian = student?.guardian
      const userId   = guardian?.userId ?? student?.userId
      if (!userId) continue

      const r = await notify({
        userId,
        type:    "LESSON_CONFIRMATION_REQUEST",
        title:   "Confirmação de aula",
        message: item.mensagem,
        phone:   guardian?.user.phone   ?? student?.user?.phone   ?? undefined,
        email:   guardian?.user.email   ?? student?.user?.email   ?? undefined,
        data: {
          "Matéria":  lesson.subject?.name ?? "–",
          "Horário":  formatBR(lesson.scheduledAt, "HH:mm"),
        },
      })
      results.push(r)
      // Só confirma a aula se a mensagem realmente saiu (itens de cobrança de
      // pacote não confirmam nada, mesmo indo para o responsável).
      if (item.tipo === "responsavel" && countsAsSent(r)) avisados.add(item.lessonId)
    } else {
      results.push(await notify({
        userId:  lesson.teacher.userId,
        type:    "LESSON_CONFIRMATION_REQUEST",
        title:   "Confirmação de presença",
        message: item.mensagem,
        phone:   lesson.teacher.user.phone ?? undefined,
        email:   lesson.teacher.user.email ?? undefined,
        data: {
          "Matéria":  lesson.subject?.name ?? "–",
          "Horário":  formatBR(lesson.scheduledAt, "HH:mm"),
        },
      }))
    }
  }

  // Fecha o ciclo: só aulas ainda agendadas cujo responsável/aluno foi avisado
  // de fato. O filtro de status evita ressuscitar aula cancelada/realizada.
  const toConfirm = [...avisados]

  let confirmed = 0
  if (toConfirm.length > 0) {
    const { count } = await prisma.lesson.updateMany({
      where: { id: { in: toConfirm }, status: "SCHEDULED" },
      data:  { status: "CONFIRMED" },
    })
    confirmed = count
  }

  const resumo = resumirEnvios(results)

  revalidatePath("/colaborador/agenda")
  revalidatePath("/colaborador/dashboard")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")

  return {
    sent:      items.length,
    delivered: resumo.entregues,
    confirmed,
    problema:  resumo.problema,
  }
}

// ─── Notificações de confirmação de aula ──────────────────────────────────────
// Helpers privados (não são server actions): recebem a aula já carregada, para
// que a confirmação manual e os botões de reenvio compartilhem o mesmo texto.

const CONFIRMATION_INCLUDE = {
  participants: {
    include: {
      student: {
        include: {
          user:     true,
          guardian: { include: { user: true } },
        },
      },
    },
  },
  teacher: { include: { user: true } },
  subject: true,
} as const

type LessonForConfirmation = Prisma.LessonGetPayload<{ include: typeof CONFIRMATION_INCLUDE }>

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Realizada",
  CANCELLED: "Cancelada",
  MISSED:    "Falta",
}

/**
 * Resultado de um envio, do ponto de vista de quem clicou no botão.
 * `problema` vem preenchido quando nada saiu — para a interface dizer o motivo
 * em vez de um "enviado!" que não aconteceu.
 */
export interface EnvioResultado {
  destinatarios: number
  entregues:     number
  canais:        string[]
  problema:      string | null
}

function resumirEnvios(results: DeliveryResult[]): EnvioResultado {
  const entregues = results.filter((r) => !nothingDelivered(r))
  const canais    = [...new Set(entregues.flatMap(deliveredChannels))]
  const problema  = entregues.length > 0
    ? null
    : (results.length === 0
        ? "Ninguém para notificar: o aluno não tem login nem responsável com contato cadastrado."
        : describeDeliveryFailure(results[0]))

  return { destinatarios: results.length, entregues: entregues.length, canais, problema }
}

/** Notifica o responsável de cada participante — ou o próprio aluno, se ele tiver login. */
async function notifyConfirmationToStudents(lesson: LessonForConfirmation): Promise<EnvioResultado> {
  const scheduledAt = formatBR(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const results: DeliveryResult[] = []

  for (const { student } of lesson.participants) {
    // Aluno com login próprio recebe direto; senão vai para o responsável
    const recipientId = student.userId ?? student.guardian?.userId
    if (!recipientId) continue
    const contact = student.userId ? student.user : student.guardian?.user

    results.push(await notify({
      userId:  recipientId,
      type:    "LESSON_CONFIRMED",
      title:   "Confirmação de aula",
      message: `A aula de ${lesson.subject?.name ?? "–"} de ${student.name} com ${lesson.teacher.user.name} está confirmada para ${scheduledAt}.`,
      email:   contact?.email ?? undefined,
      phone:   contact?.phone ?? undefined,
      data: {
        "Aluno":      student.name,
        "Matéria":    lesson.subject?.name ?? "–",
        "Professor":  lesson.teacher.user.name,
        "Data/Hora":  scheduledAt,
        "Modalidade": lesson.modality === "ONLINE" ? "Online" : "Presencial",
      },
    }))
  }

  return resumirEnvios(results)
}

async function notifyConfirmationToTeacher(lesson: LessonForConfirmation): Promise<EnvioResultado> {
  const result = await notifyLessonConfirmedToTeacher({
    teacherUserId: lesson.teacher.userId,
    teacherEmail:  lesson.teacher.user.email,
    teacherPhone:  lesson.teacher.user.phone,
    subject:       lesson.subject?.name ?? "–",
    scheduledAt:   formatBR(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    modality:      lesson.modality === "ONLINE" ? "Online" : "Presencial",
  })
  return resumirEnvios([result])
}

// ─── Confirmar aula (única transição para CONFIRMED) ──────────────────────────

/**
 * Passa a aula de "Agendada" para "Confirmada" e avisa professor e
 * responsável/aluno. É a ÚNICA porta para o status CONFIRMED: a criação de aulas
 * nasce em SCHEDULED e `updateLessonDirectAction` recusa a transição.
 */
export async function confirmLessonAction(
  lessonId: string,
): Promise<ActionResult<{ professor: EnvioResultado; responsaveis: EnvioResultado }>> {
  return comResultado(() => confirmarAula(lessonId))
}

async function confirmarAula(lessonId: string) {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: CONFIRMATION_INCLUDE,
  })
  if (!lesson) throw new Error("Aula não encontrada")

  if (lesson.status === "CONFIRMED") throw new Error("Esta aula já está confirmada")
  if (lesson.status !== "SCHEDULED") {
    throw new Error(`Só é possível confirmar aulas agendadas — esta está como ${STATUS_LABEL[lesson.status] ?? lesson.status}`)
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data:  { status: "CONFIRMED" },
  })

  // Notificações depois da gravação: uma falha de e-mail/WhatsApp não desfaz a
  // confirmação, mas o resultado volta para a interface avisar o atendente.
  const professor    = await notifyConfirmationToTeacher(lesson)
  const responsaveis = await notifyConfirmationToStudents(lesson)

  revalidatePath("/colaborador/agenda")
  revalidatePath("/colaborador/dashboard")
  revalidatePath("/admin/agenda")
  revalidatePath("/professor/agenda")
  for (const { studentId } of lesson.participants) {
    revalidatePath(`/colaborador/alunos/${studentId}`)
  }

  return { professor, responsaveis }
}

// ─── Reenviar confirmação (sem mexer no status) ───────────────────────────────

export async function sendConfirmationToGuardianAction(lessonId: string): Promise<EnvioResultado> {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: CONFIRMATION_INCLUDE,
  })
  if (!lesson) throw new Error("Aula não encontrada")

  return notifyConfirmationToStudents(lesson)
}

export async function sendConfirmationToTeacherAction(lessonId: string): Promise<EnvioResultado> {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: CONFIRMATION_INCLUDE,
  })
  if (!lesson) throw new Error("Aula não encontrada")

  return notifyConfirmationToTeacher(lesson)
}

// ─── Excluir Aula ──────────────────────────────────────────────────────────────

export async function deleteLessonAction(lessonId: string) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")

  // A aula é o que precisa existir — uma aula sem inscritos (aulão vazio,
  // compromisso) também pode ser excluída.
  const lesson = await prisma.lesson.findUnique({
    where:  { id: lessonId },
    select: { id: true, participants: { select: { studentId: true } } },
  })
  if (!lesson) throw new Error("Aula não encontrada")
  const participants = lesson.participants

  await prisma.lesson.delete({ where: { id: lessonId } })

  for (const p of participants) {
    revalidatePath(`/colaborador/alunos/${p.studentId}`)
  }
}

export async function updatePaymentStatusAction(id: string, status: "PENDING" | "PAID" | "OVERDUE") {
  await requireCollaboratorOrAdmin()

  const payment = await prisma.payment.findUnique({
    where: { id },
    select: { studentId: true, method: true },
  })
  if (!payment) throw new Error("Pagamento não encontrado")

  // Sem forma de pagamento a taxa não é calculada e a receita líquida infla.
  if (status === "PAID" && !temMetodo(payment.method)) {
    throw new Error("Informe a forma de pagamento antes de marcar como paga — use o botão de editar a cobrança")
  }

  await prisma.payment.update({
    where: { id },
    data: {
      status,
      paidAt: status === "PAID" ? new Date() : null,
    },
  })

  revalidatePath(`/colaborador/alunos/${payment.studentId}`)
  revalidatePath(`/admin/usuarios/${payment.studentId}`)
  revalidatePath("/colaborador/financeiro")
  revalidatePath("/admin/financeiro/pagamentos")
}
