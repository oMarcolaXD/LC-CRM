import { prisma }         from "@/lib/prisma"
import { PageHeader }     from "@/components/shared/page-header"
import { formatBR, nowBrazil } from "@/lib/datetime"
import { PAYMENT_METHODS } from "@/lib/payments"
import { LancarRecebimentosForm } from "./lancar-form"

/**
 * Lançar recebimentos em lote: "fulano pagou tanto", vários de uma vez, sem
 * abrir perfil por perfil. Cada linha quita uma cobrança em aberto do aluno ou
 * vira um pagamento avulso já pago.
 */
export default async function LancarRecebimentosPage() {
  const now     = nowBrazil()
  const hoje    = formatBR(new Date(), "yyyy-MM-dd")
  const desde   = new Date(Date.now() - 45 * 86_400_000)

  const [students, abertas, recentes] = await Promise.all([
    prisma.student.findMany({
      select:  { id: true, name: true, guardian: { select: { user: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    }),
    // Cobranças em aberto (a vencer ou vencidas), da mais antiga para a mais nova
    prisma.payment.findMany({
      where:   { status: { not: "PAID" } },
      select:  { id: true, studentId: true, amount: true, dueDate: true, description: true, installmentNumber: true, installmentTotal: true },
      orderBy: { dueDate: "asc" },
    }),
    // Pagos recentes: para avisar de lançamento repetido (mesmo aluno, valor e dia)
    prisma.payment.findMany({
      where:  { status: "PAID", paidAt: { gte: desde } },
      select: { studentId: true, amount: true, paidAt: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="LANÇAR RECEBIMENTOS"
        description="Registre vários pagamentos de uma vez — cada um vai direto para o perfil do aluno"
        backHref="/colaborador/financeiro"
      />
      <LancarRecebimentosForm
        hoje={hoje}
        metodos={[...PAYMENT_METHODS]}
        alunos={students.map((s) => ({ id: s.id, name: s.name, guardianName: s.guardian?.user.name ?? null }))}
        abertas={abertas.map((p) => ({
          id:        p.id,
          studentId: p.studentId,
          amount:    Number(p.amount),
          due:       formatBR(p.dueDate, "dd/MM/yyyy"),
          vencida:   p.dueDate < now,
          label:     [
            p.description,
            p.installmentTotal && p.installmentTotal > 1 ? `parcela ${p.installmentNumber}/${p.installmentTotal}` : null,
          ].filter(Boolean).join(" · ") || "Cobrança",
        }))}
        recentes={recentes.map((p) => ({
          studentId: p.studentId,
          amount:    Number(p.amount),
          dia:       p.paidAt ? formatBR(p.paidAt, "yyyy-MM-dd") : "",
        }))}
      />
    </div>
  )
}
