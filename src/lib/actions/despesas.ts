"use server"

// CRUD das despesas da empresa.
//
// A recorrência mensal é materializada como N linhas (uma por mês de
// competência) ligadas por `recurrenceGroupId` — mesmo padrão do parcelamento
// de Payment em `createStudentPackageAction`. Custa mais linhas no banco, mas
// permite que cada mês tenha valor próprio, seja quitado isoladamente e apareça
// no DRE sem nenhuma expansão em tempo de consulta.

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { addMonths, startOfMonth } from "date-fns"
import { comResultado, type ActionResult } from "@/lib/action-result"
import { expenseSchema, type ExpenseInput } from "@/lib/expenses"
import type { ExpenseCategory, ExpenseRecurrence } from "@prisma/client"

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")
}

/** "YYYY-MM" → 1º dia do mês, em horário local. */
function competenciaToDate(v: string): Date {
  const [year, month] = v.split("-").map(Number)
  return startOfMonth(new Date(year, month - 1, 1))
}

function revalidate() {
  revalidatePath("/admin/financeiro/despesas")
  revalidatePath("/admin/financeiro")
  revalidatePath("/admin/relatorios", "layout")
}

// ─── Criar ────────────────────────────────────────────────────────────────────

export async function createExpenseAction(input: ExpenseInput): Promise<ActionResult<number>> {
  return comResultado(async () => {
    await requireAdmin()
    const d = expenseSchema.parse(input)

    const first  = competenciaToDate(d.competencia)
    const paidAt = d.paidAt ? new Date(d.paidAt) : null

    if (d.recurrence === "UNICA") {
      await prisma.expense.create({
        data: {
          description: d.description,
          category:    d.category as ExpenseCategory,
          amount:      d.amount,
          competencia: first,
          paidAt,
          recurrence:  "UNICA",
          notes:       d.notes || null,
        },
      })
      return 1
    }

    // Recorrente: uma linha por mês. Só a primeira herda o paidAt informado —
    // as futuras nascem em aberto, senão o caixa mostraria saída que não houve.
    const total   = d.months ?? 12
    const groupId = randomUUID()

    await prisma.expense.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        description:       d.description,
        category:          d.category as ExpenseCategory,
        amount:            d.amount,
        competencia:       addMonths(first, i),
        paidAt:            i === 0 ? paidAt : null,
        recurrence:        "MENSAL" as ExpenseRecurrence,
        recurrenceGroupId: groupId,
        notes:             d.notes || null,
      })),
    })
    return total
  }).then((r) => { if (r.ok) revalidate(); return r })
}

// ─── Editar ───────────────────────────────────────────────────────────────────

export async function updateExpenseAction(
  id: string,
  input: ExpenseInput,
): Promise<ActionResult<undefined>> {
  return comResultado(async () => {
    await requireAdmin()
    const d = expenseSchema.parse(input)

    await prisma.expense.update({
      where: { id },
      data: {
        description: d.description,
        category:    d.category as ExpenseCategory,
        amount:      d.amount,
        competencia: competenciaToDate(d.competencia),
        paidAt:      d.paidAt ? new Date(d.paidAt) : null,
        notes:       d.notes || null,
      },
    })
    return undefined
  }).then((r) => { if (r.ok) revalidate(); return r })
}

/** Aplica o novo valor a esta despesa e a todas as futuras do mesmo grupo. */
export async function updateExpenseSeriesAmountAction(
  id: string,
  amount: number,
): Promise<ActionResult<number>> {
  return comResultado(async () => {
    await requireAdmin()
    const base = await prisma.expense.findUnique({
      where:  { id },
      select: { recurrenceGroupId: true, competencia: true },
    })
    if (!base?.recurrenceGroupId) throw new Error("Esta despesa não faz parte de uma série")

    const { count } = await prisma.expense.updateMany({
      where: {
        recurrenceGroupId: base.recurrenceGroupId,
        competencia:       { gte: base.competencia },
      },
      data: { amount },
    })
    return count
  }).then((r) => { if (r.ok) revalidate(); return r })
}

// ─── Pagar ────────────────────────────────────────────────────────────────────

export async function setExpensePaidAction(
  id: string,
  paid: boolean,
): Promise<ActionResult<undefined>> {
  return comResultado(async () => {
    await requireAdmin()
    await prisma.expense.update({
      where: { id },
      data:  { paidAt: paid ? new Date() : null },
    })
    return undefined
  }).then((r) => { if (r.ok) revalidate(); return r })
}

// ─── Excluir ──────────────────────────────────────────────────────────────────

export async function deleteExpenseAction(id: string): Promise<ActionResult<undefined>> {
  return comResultado(async () => {
    await requireAdmin()
    await prisma.expense.delete({ where: { id } })
    return undefined
  }).then((r) => { if (r.ok) revalidate(); return r })
}

/**
 * Exclui esta despesa e as futuras da mesma série. As passadas ficam — já são
 * histórico e apagá-las reescreveria resultados de meses fechados.
 */
export async function deleteExpenseSeriesAction(id: string): Promise<ActionResult<number>> {
  return comResultado(async () => {
    await requireAdmin()
    const base = await prisma.expense.findUnique({
      where:  { id },
      select: { recurrenceGroupId: true, competencia: true },
    })
    if (!base?.recurrenceGroupId) throw new Error("Esta despesa não faz parte de uma série")

    const { count } = await prisma.expense.deleteMany({
      where: {
        recurrenceGroupId: base.recurrenceGroupId,
        competencia:       { gte: base.competencia },
      },
    })
    return count
  }).then((r) => { if (r.ok) revalidate(); return r })
}
