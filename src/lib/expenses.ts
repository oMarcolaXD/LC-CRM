// Vocabulário das despesas da empresa.
//
// Módulo puro (sem I/O, sem "use server"): as server actions validam com este
// schema e os formulários client reusam os mesmos rótulos e cores, sem
// duplicar a lista de categorias em dois lugares que saem de sincronia.

import { z } from "zod"
import type { ExpenseCategory } from "@prisma/client"

export const EXPENSE_CATEGORIES = [
  "ALUGUEL", "SALARIOS", "MARKETING", "SOFTWARE", "MATERIAL",
  "IMPOSTOS", "CONTABILIDADE", "MANUTENCAO", "OUTROS",
] as const

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  ALUGUEL:       "Aluguel",
  SALARIOS:      "Salários (equipe)",
  MARKETING:     "Marketing",
  SOFTWARE:      "Software / ferramentas",
  MATERIAL:      "Material",
  IMPOSTOS:      "Impostos",
  CONTABILIDADE: "Contabilidade",
  MANUTENCAO:    "Manutenção",
  OUTROS:        "Outros",
}

/** Cor de cada categoria nos gráficos de composição. */
export const EXPENSE_CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  ALUGUEL:       "#FB8500",
  SALARIOS:      "#219EBC",
  MARKETING:     "#8b5cf6",
  SOFTWARE:      "#10b981",
  MATERIAL:      "#f97316",
  IMPOSTOS:      "#ef4444",
  CONTABILIDADE: "#3b82f6",
  MANUTENCAO:    "#ec4899",
  OUTROS:        "#94a3b8",
}

export const expenseSchema = z.object({
  description: z.string().trim().min(1, "Descreva a despesa"),
  category:    z.enum(EXPENSE_CATEGORIES),
  amount:      z.coerce.number().positive("Valor deve ser maior que zero"),
  /** "YYYY-MM" — o dia não importa, a competência é o mês inteiro. */
  competencia: z.string().regex(/^\d{4}-\d{2}$/, "Mês de competência inválido"),
  /** "YYYY-MM-DD" quando já foi paga. */
  paidAt:      z.string().optional().nullable(),
  recurrence:  z.enum(["UNICA", "MENSAL"]),
  /** Só para MENSAL: por quantos meses repetir (incluindo o primeiro). */
  months:      z.coerce.number().int().min(1).max(60).optional(),
  notes:       z.string().trim().optional().nullable(),
})

export type ExpenseInput = z.input<typeof expenseSchema>
