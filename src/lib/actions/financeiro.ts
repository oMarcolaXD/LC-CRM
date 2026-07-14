"use server"

import { prisma }        from "@/lib/prisma"
import { auth }          from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect }      from "next/navigation"
import { z }             from "zod"
import { randomUUID }    from "crypto"
import { calcFee, type FeeRate } from "@/lib/fees"

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")
}

// ─── Taxas de cartão (helpers) ────────────────────────────────────────────────

/** Converte uma linha do banco (Decimal) para o formato numérico puro de fees.ts */
function toFeeRate(r: {
  method: string; minInstallments: number; maxInstallments: number
  percent: unknown; fixed: unknown; active: boolean
}): FeeRate {
  return {
    method:          r.method,
    minInstallments: r.minInstallments,
    maxInstallments: r.maxInstallments,
    percent:         Number(r.percent),
    fixed:           Number(r.fixed),
    active:          r.active,
  }
}

/** Carrega as regras de taxa ativas (uso interno nas actions). */
async function loadFeeRates(): Promise<FeeRate[]> {
  const rows = await prisma.cardFeeRate.findMany({ where: { active: true } })
  return rows.map(toFeeRate)
}

/** Exposto aos modais (client) para exibir a taxa estimada em tempo real. */
export async function getActiveFeeRatesAction(): Promise<FeeRate[]> {
  const session = await auth()
  if (!session?.user || !["ADMIN", "COLLABORATOR"].includes(session.user.role)) return []
  return loadFeeRates()
}

// ─── Criar Pacote para Aluno ──────────────────────────────────────────────────
const packageSchema = z.object({
  studentId:       z.string().min(1),
  totalLessons:    z.coerce.number().min(0.5).refine(
    v => Number.isInteger(v * 2),
    { message: "Quantidade de aulas deve ser múltiplo de 0,5 (ex: 1, 1,5, 8, 10)" }
  ),
  pricePerLesson:  z.coerce.number().min(0),
  expiresInDays:   z.coerce.number().int().min(1).optional(),
})

export async function createPackageAction(formData: FormData) {
  await requireAdmin()
  const parsed = packageSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    redirect(`/admin/financeiro/pacotes?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos")}`)
  }
  const { studentId, totalLessons, pricePerLesson, expiresInDays } = parsed.data
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400_000)
    : null

  await prisma.lessonPackage.create({
    data: {
      studentId, totalLessons, remainingLessons: totalLessons,
      pricePerLesson, expiresAt: expiresAt ?? undefined, status: "ACTIVE",
    },
  })
  revalidatePath("/admin/financeiro/pacotes")
  redirect("/admin/financeiro/pacotes?success=Pacote+criado+com+sucesso")
}

// ─── Criar Pacote (colaborador ou admin) ─────────────────────────────────────

export async function createStudentPackageAction(data: {
  studentId:      string
  totalLessons:   number
  pricePerLesson: number
  expiresInDays?: number
  purchaseDate?:  string  // "YYYY-MM-DD" — para pacotes retroativos
  isClosed?:      boolean // true → status EXHAUSTED, remainingLessons = 0
  payment?: {
    amount:  number
    dueDate: string  // "YYYY-MM-DD"
    paidAt?: string  // "YYYY-MM-DD" — define status como PAID se preenchido
    method?: string
    // Quando presente (boleto/cartão parcelado), cria uma cobrança por parcela.
    installments?: { dueDate: string; amount: number }[]
  }
}) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "COLLABORATOR"].includes(session.user.role)) {
    throw new Error("Sem permissão")
  }

  const baseDate      = data.purchaseDate ? new Date(data.purchaseDate) : new Date()
  const expiresAt     = data.expiresInDays
    ? new Date(baseDate.getTime() + data.expiresInDays * 86_400_000)
    : null
  const status          = data.isClosed ? "EXHAUSTED" : "ACTIVE"
  const remainingLessons = data.isClosed ? 0 : data.totalLessons

  const feeRates = await loadFeeRates()

  await prisma.$transaction(async (tx) => {
    const pkg = await tx.lessonPackage.create({
      data: {
        studentId:        data.studentId,
        totalLessons:     data.totalLessons,
        remainingLessons,
        pricePerLesson:   data.pricePerLesson,
        expiresAt:        expiresAt ?? undefined,
        purchaseDate:     baseDate,
        status,
      },
    })

    if (data.payment) {
      const { amount, dueDate, paidAt, method, installments } = data.payment
      const lessonsLabel = Number(data.totalLessons) % 1 === 0
        ? data.totalLessons
        : Number(data.totalLessons).toFixed(1).replace(".", ",")
      const description = `Pacote de ${lessonsLabel} aulas`

      if (installments && installments.length >= 2) {
        // Parcelamento: uma cobrança (PENDING) por parcela, ligadas por grupo e ao pacote.
        const groupId = randomUUID()
        const total   = installments.length
        await tx.payment.createMany({
          data: installments.map((inst, i) => ({
            studentId:          data.studentId,
            packageId:          pkg.id,   // vincula a cobrança ao pacote (some junto se excluído)
            amount:             inst.amount,
            dueDate:            new Date(inst.dueDate),
            paidAt:             null,
            status:             "PENDING" as const,
            method:             method || null,
            feeAmount:          calcFee(feeRates, method, total, inst.amount),
            description:        `${description} (${i + 1}/${total})`,
            installmentNumber:  i + 1,
            installmentTotal:   total,
            installmentGroupId: groupId,
          })),
        })
      } else {
        const paidAtDate = paidAt ? new Date(paidAt) : undefined
        await tx.payment.create({
          data: {
            studentId:   data.studentId,
            packageId:   pkg.id,   // vincula a cobrança ao pacote (some junto se excluído)
            amount,
            dueDate:     new Date(dueDate),
            paidAt:      paidAtDate ?? undefined,
            method:      method || undefined,
            feeAmount:   calcFee(feeRates, method, 1, amount),
            status:      paidAtDate ? "PAID" : "PENDING",
            description,
          },
        })
      }
    }
  })

  revalidatePath(`/colaborador/alunos/${data.studentId}`)
  revalidatePath("/colaborador/financeiro")
  revalidatePath(`/admin/alunos/${data.studentId}`)
  revalidatePath("/admin/financeiro/pacotes")
  revalidatePath("/admin/financeiro/pagamentos")
  revalidatePath("/admin/dashboard")
}

// ─── Registrar Pagamento ──────────────────────────────────────────────────────
const paymentSchema = z.object({
  studentId:   z.string().min(1),
  amount:      z.coerce.number().min(0.01),
  dueDate:     z.string().min(1),
  description: z.string().optional(),
  method:      z.string().optional(),
})

export async function createPaymentAction(formData: FormData) {
  await requireAdmin()
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    redirect(`/admin/financeiro/pagamentos?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos")}`)
  }
  const { studentId, amount, dueDate, description, method } = parsed.data
  const feeRates = await loadFeeRates()
  await prisma.payment.create({
    data: {
      studentId, amount, dueDate: new Date(dueDate), description, method, status: "PENDING",
      feeAmount: calcFee(feeRates, method, 1, amount),
    },
  })
  revalidatePath("/admin/financeiro/pagamentos")
  redirect("/admin/financeiro/pagamentos?success=Cobrança+criada")
}

// ─── Marcar Pagamento como Pago ───────────────────────────────────────────────
export async function markPaymentPaidAction(id: string) {
  await requireAdmin()
  await prisma.payment.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } })
  revalidatePath("/admin/financeiro/pagamentos")
}

// ─── Marcar Pagamento como Vencido ────────────────────────────────────────────
export async function markPaymentOverdueAction(id: string) {
  await requireAdmin()
  await prisma.payment.update({ where: { id }, data: { status: "OVERDUE" } })
  revalidatePath("/admin/financeiro/pagamentos")
}

// ─── Repasse do Professor — cálculo automático ────────────────────────────────

/**
 * Calcula (sem persistir) o repasse de um professor num mês/ano: soma as horas
 * das aulas COMPLETED × hourlyRate. Reutilizado na tela de repasses e ao marcar
 * como pago. Retorna também `hourlyRate` para exibição.
 */
export async function computePayout(teacherId: string, month: number, year: number) {
  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0, 23, 59, 59)

  const [teacher, lessons] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { hourlyRate: true } }),
    prisma.lesson.findMany({
      where:  { teacherId, status: "COMPLETED", scheduledAt: { gte: start, lte: end } },
      select: { duration: true },
    }),
  ])

  const hourlyRate = Number(teacher?.hourlyRate ?? 0)
  const totalUnits = lessons.reduce((sum, l) => sum + l.duration / 60, 0)
  const totalAmount = totalUnits * hourlyRate

  return { totalLessons: totalUnits, totalAmount, hourlyRate, lessonCount: lessons.length }
}

/**
 * Marca (ou desmarca) o repasse de um professor como pago. Como o valor é
 * calculado sob demanda, o registro TeacherPayout é criado/atualizado aqui, no
 * momento do pagamento — o admin não precisa "calcular" nada antes.
 */
export async function setPayoutPaidAction(
  teacherId: string, month: number, year: number, paid: boolean,
) {
  await requireAdmin()
  const { totalLessons, totalAmount } = await computePayout(teacherId, month, year)

  await prisma.teacherPayout.upsert({
    where:  { teacherId_month_year: { teacherId, month, year } },
    update: { totalLessons, totalAmount, status: paid ? "PAID" : "PENDING", paidAt: paid ? new Date() : null },
    create: { teacherId, month, year, totalLessons, totalAmount, status: paid ? "PAID" : "PENDING", paidAt: paid ? new Date() : null },
  })

  revalidatePath("/admin/financeiro/professores")
  revalidatePath("/admin/financeiro")
}

/**
 * Repasses pendentes com dia de pagamento próximo/na janela (mês corrente).
 * Usado nos avisos in-app do hub financeiro e da tela de repasses. Considera
 * "próximo" quando hoje já passou de (payDayStart − 3).
 */
export async function getPayoutAlerts() {
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  const today = now.getDate()

  const teachers = await prisma.teacher.findMany({
    where:   { payDayStart: { not: null } },
    include: { user: { select: { name: true } } },
  })

  const paidThisMonth = await prisma.teacherPayout.findMany({
    where:  { month, year, status: "PAID" },
    select: { teacherId: true },
  })
  const paidSet = new Set(paidThisMonth.map((p) => p.teacherId))

  const alerts: {
    teacherId: string; name: string; totalAmount: number
    payDayStart: number; payDayEnd: number; overdue: boolean
  }[] = []

  for (const t of teachers) {
    if (paidSet.has(t.id)) continue
    const start = t.payDayStart!
    const end   = t.payDayEnd ?? t.payDayStart!
    if (today < start - 3) continue                 // ainda longe da janela
    const { totalAmount } = await computePayout(t.id, month, year)
    if (totalAmount <= 0) continue
    alerts.push({
      teacherId:   t.id,
      name:        t.user.name,
      totalAmount,
      payDayStart: start,
      payDayEnd:   end,
      overdue:     today > end,
    })
  }

  return alerts.sort((a, b) => a.payDayEnd - b.payDayEnd)
}

/** Define a janela de dias de pagamento do repasse de um professor. */
export async function updateTeacherPayWindowAction(
  teacherId: string, payDayStart: number | null, payDayEnd: number | null,
) {
  await requireAdmin()
  const clamp = (v: number | null) => (v == null ? null : Math.min(31, Math.max(1, Math.round(v))))
  await prisma.teacher.update({
    where: { id: teacherId },
    data:  { payDayStart: clamp(payDayStart), payDayEnd: clamp(payDayEnd) },
  })
  revalidatePath("/admin/financeiro/professores")
  revalidatePath("/admin/financeiro")
}

// ─── Config de Taxas de Cartão (CRUD) ─────────────────────────────────────────

const feeRateSchema = z.object({
  method:          z.string().min(1),
  minInstallments: z.coerce.number().int().min(1).max(24),
  maxInstallments: z.coerce.number().int().min(1).max(24),
  percent:         z.coerce.number().min(0).max(100),
  fixed:           z.coerce.number().min(0),
  active:          z.coerce.boolean().optional(),
}).refine((d) => d.maxInstallments >= d.minInstallments, {
  message: "Nº máximo de parcelas deve ser ≥ mínimo", path: ["maxInstallments"],
})

export async function createFeeRateAction(input: {
  method: string; minInstallments: number; maxInstallments: number
  percent: number; fixed: number; active?: boolean
}) {
  await requireAdmin()
  const parsed = feeRateSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos")
  await prisma.cardFeeRate.create({ data: { ...parsed.data, active: parsed.data.active ?? true } })
  revalidatePath("/admin/financeiro/taxas")
}

export async function updateFeeRateAction(input: {
  id: string; method: string; minInstallments: number; maxInstallments: number
  percent: number; fixed: number; active?: boolean
}) {
  await requireAdmin()
  const parsed = feeRateSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos")
  await prisma.cardFeeRate.update({
    where: { id: input.id },
    data:  { ...parsed.data, active: parsed.data.active ?? true },
  })
  revalidatePath("/admin/financeiro/taxas")
}

export async function deleteFeeRateAction(id: string) {
  await requireAdmin()
  await prisma.cardFeeRate.delete({ where: { id } })
  revalidatePath("/admin/financeiro/taxas")
}

// ─── Editar Pacote do Aluno ───────────────────────────────────────────────────

export async function updateStudentPackageAction(data: {
  packageId:       string
  studentId:       string
  totalLessons:    number
  pricePerLesson:  number
  remainingLessons: number
  status:          "ACTIVE" | "EXHAUSTED" | "EXPIRED"
  purchaseDate:    string   // "YYYY-MM-DD"
  expiresAt?:      string   // "YYYY-MM-DD" | undefined
}) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "COLLABORATOR"].includes(session.user.role)) {
    throw new Error("Sem permissão")
  }

  await prisma.lessonPackage.update({
    where: { id: data.packageId },
    data: {
      totalLessons:     data.totalLessons,
      pricePerLesson:   data.pricePerLesson,
      remainingLessons: data.remainingLessons,
      status:           data.status,
      purchaseDate:     new Date(data.purchaseDate),
      expiresAt:        data.expiresAt ? new Date(data.expiresAt) : null,
    },
  })

  revalidatePath(`/colaborador/alunos/${data.studentId}`)
  revalidatePath(`/admin/usuarios/${data.studentId}`)
  revalidatePath("/admin/financeiro/pacotes")
}

// ─── Editar Cobrança ─────────────────────────────────────────────────────────

export async function updatePaymentAction(data: {
  id:           string
  amount:       number
  dueDate:      string   // "YYYY-MM-DD"
  description?: string
  method?:      string
  status:       "PENDING" | "PAID" | "OVERDUE"
  paidAt?:      string   // "YYYY-MM-DD" | undefined
}) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "COLLABORATOR"].includes(session.user.role)) {
    throw new Error("Sem permissão")
  }

  // Recalcula a taxa: método/valor podem ter mudado. Usa o nº de parcelas do
  // grupo (registrado na própria cobrança) para ratear o valor fixo.
  const existing = await prisma.payment.findUnique({
    where:  { id: data.id },
    select: { installmentTotal: true },
  })
  const feeRates = await loadFeeRates()
  const feeAmount = calcFee(feeRates, data.method || null, existing?.installmentTotal ?? 1, data.amount)

  await prisma.payment.update({
    where: { id: data.id },
    data: {
      amount:      data.amount,
      dueDate:     new Date(data.dueDate),
      description: data.description || null,
      method:      data.method      || null,
      status:      data.status,
      feeAmount,
      paidAt:      data.paidAt ? new Date(data.paidAt) : (data.status === "PAID" ? new Date() : null),
    },
  })

  revalidatePath("/colaborador/financeiro")
  revalidatePath("/admin/financeiro/pagamentos")
  revalidatePath("/admin/dashboard")
}

// ─── Excluir Cobrança ─────────────────────────────────────────────────────────

export async function deletePaymentAction(id: string) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "COLLABORATOR"].includes(session.user.role)) {
    throw new Error("Sem permissão")
  }

  await prisma.payment.delete({ where: { id } })

  revalidatePath("/colaborador/financeiro")
  revalidatePath("/admin/financeiro/pagamentos")
  revalidatePath("/admin/dashboard")
}

// ─── Excluir todas as parcelas de um parcelamento ─────────────────────────────

export async function deletePaymentGroupAction(groupId: string) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "COLLABORATOR"].includes(session.user.role)) {
    throw new Error("Sem permissão")
  }

  const { count } = await prisma.payment.deleteMany({ where: { installmentGroupId: groupId } })

  revalidatePath("/colaborador/financeiro")
  revalidatePath("/admin/financeiro/pagamentos")
  revalidatePath("/admin/dashboard")
  return count
}

// ─── Excluir Pacote do Aluno ──────────────────────────────────────────────────

export async function deleteStudentPackageAction(packageId: string, studentId: string) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "COLLABORATOR"].includes(session.user.role)) {
    throw new Error("Sem permissão")
  }

  // A cobrança vinculada (packageId) é excluída junto via ON DELETE CASCADE,
  // removendo a receita do pacote do dashboard.
  await prisma.lessonPackage.delete({ where: { id: packageId } })

  revalidatePath(`/colaborador/alunos/${studentId}`)
  revalidatePath(`/admin/usuarios/${studentId}`)
  revalidatePath("/admin/financeiro/pacotes")
  revalidatePath("/admin/financeiro/pagamentos")
  revalidatePath("/colaborador/financeiro")
  revalidatePath("/admin/dashboard")
}
