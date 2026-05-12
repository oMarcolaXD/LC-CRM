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

  const existing = await prisma.teacherPayout.findFirst({
    where: { teacherId, month, year },
  })

  if (existing) {
    await prisma.teacherPayout.update({
      where: { id: existing.id },
      data:  { totalLessons: lessons.length, totalAmount: total },
    })
  } else {
    await prisma.teacherPayout.create({
      data: { teacherId, month, year, totalLessons: lessons.length, totalAmount: total, status: "PENDING" },
    })
  }

  revalidatePath("/admin/financeiro/professores")
  redirect("/admin/financeiro/professores?success=Repasse+calculado+com+sucesso")
}

// ─── Marcar Repasse como Pago ─────────────────────────────────────────────────
export async function markPayoutPaidAction(id: string) {
  await requireAdmin()
  await prisma.teacherPayout.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } })
  revalidatePath("/admin/financeiro/professores")
}
