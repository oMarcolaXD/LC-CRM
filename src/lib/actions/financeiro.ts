"use server"

import { prisma }        from "@/lib/prisma"
import { auth }          from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect }      from "next/navigation"
import { z }             from "zod"

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")
}

// ─── Criar Pacote para Aluno ──────────────────────────────────────────────────
const packageSchema = z.object({
  studentId:       z.string().min(1),
  totalLessons:    z.coerce.number().int().min(1),
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

  await prisma.$transaction(async (tx) => {
    await tx.lessonPackage.create({
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
      const { amount, dueDate, paidAt, method } = data.payment
      const paidAtDate = paidAt ? new Date(paidAt) : undefined
      await tx.payment.create({
        data: {
          studentId:   data.studentId,
          amount,
          dueDate:     new Date(dueDate),
          paidAt:      paidAtDate ?? undefined,
          method:      method || undefined,
          status:      paidAtDate ? "PAID" : "PENDING",
          description: `Pacote de ${data.totalLessons} aulas`,
        },
      })
    }
  })

  revalidatePath(`/colaborador/alunos/${data.studentId}`)
  revalidatePath("/colaborador/financeiro")
  revalidatePath(`/admin/alunos/${data.studentId}`)
  revalidatePath("/admin/financeiro/pacotes")
  revalidatePath("/admin/financeiro/pagamentos")
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
  await prisma.payment.create({
    data: { studentId, amount, dueDate: new Date(dueDate), description, method, status: "PENDING" },
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

// ─── Calcular/Gerar Repasse do Professor ─────────────────────────────────────
export async function generatePayoutAction(teacherId: string, month: number, year: number) {
  await requireAdmin()

  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0, 23, 59, 59)

  const lessons = await prisma.lesson.findMany({
    where:   { teacherId, status: "COMPLETED", scheduledAt: { gte: start, lte: end } },
    include: { teacher: true },
  })

  if (lessons.length === 0) {
    redirect(`/admin/financeiro/professores?error=Nenhuma+aula+realizada+neste+período`)
  }

  const rate  = Number(lessons[0].teacher.hourlyRate)
  const total = lessons.length * rate

  await prisma.teacherPayout.upsert({
    where:  { teacherId_month_year: { teacherId, month, year } },
    update: { totalLessons: lessons.length, totalAmount: total },
    create: { teacherId, month, year, totalLessons: lessons.length, totalAmount: total, status: "PENDING" },
  })

  revalidatePath("/admin/financeiro/professores")
  redirect("/admin/financeiro/professores?success=Repasse+calculado+com+sucesso")
}

// ─── Marcar Repasse como Pago ─────────────────────────────────────────────────
export async function markPayoutPaidAction(id: string) {
  await requireAdmin()
  await prisma.teacherPayout.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } })
  revalidatePath("/admin/financeiro/professores")
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

// ─── Excluir Pacote do Aluno ──────────────────────────────────────────────────

export async function deleteStudentPackageAction(packageId: string, studentId: string) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "COLLABORATOR"].includes(session.user.role)) {
    throw new Error("Sem permissão")
  }

  await prisma.lessonPackage.delete({ where: { id: packageId } })

  revalidatePath(`/colaborador/alunos/${studentId}`)
  revalidatePath(`/admin/usuarios/${studentId}`)
  revalidatePath("/admin/financeiro/pacotes")
}
