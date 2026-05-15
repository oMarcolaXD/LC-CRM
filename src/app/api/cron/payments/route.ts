import { type NextRequest } from "next/server"
import { prisma }           from "@/lib/prisma"
import { notifyPaymentDue, notifyPaymentOverdue } from "@/lib/notifications"
import { format }           from "date-fns"
import { ptBR }             from "date-fns/locale"

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const fmt = (d: Date)    => format(d, "dd/MM/yyyy", { locale: ptBR })

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now     = new Date()
  const in3days = new Date(now.getTime() + 3 * 86_400_000)

  const [dueSoon, overdueList] = await Promise.all([
    // Vencendo nos próximos 3 dias
    prisma.payment.findMany({
      where: { status: "PENDING", dueDate: { gte: now, lte: in3days } },
      include: { student: { include: { user: true } } },
    }),
    // Já vencidos (PENDING → OVERDUE)
    prisma.payment.findMany({
      where: { status: "PENDING", dueDate: { lt: now } },
      include: { student: { include: { user: true } } },
    }),
  ])

  // Atualiza status dos vencidos
  if (overdueList.length > 0) {
    await prisma.payment.updateMany({
      where: { id: { in: overdueList.map((p) => p.id) } },
      data:  { status: "OVERDUE" },
    })
  }

  await Promise.allSettled([
    ...dueSoon.map((p) =>
      notifyPaymentDue({
        studentUserId: p.student.userId,
        studentEmail:  p.student.user.email,
        studentPhone:  p.student.user.phone,
        amount:  brl(Number(p.amount)),
        dueDate: fmt(p.dueDate),
      })
    ),
    ...overdueList.map((p) =>
      notifyPaymentOverdue({
        studentUserId: p.student.userId,
        studentEmail:  p.student.user.email,
        studentPhone:  p.student.user.phone,
        amount:  brl(Number(p.amount)),
        dueDate: fmt(p.dueDate),
      })
    ),
  ])

  return Response.json({ ok: true, due: dueSoon.length, overdue: overdueList.length })
}
