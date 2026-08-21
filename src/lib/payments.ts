// Situação de uma cobrança.
//
// ── Por que "vencido" não é o status gravado ──────────────────────────────────
// `PaymentStatus.OVERDUE` só muda se alguém clicar — nada no sistema o aplica
// sozinho. Na prática ninguém clicava, e o resultado é que uma cobrança podia
// estar 198 dias no vermelho enquanto a tela dizia "pendente" e a inadimplência
// total aparecia como R$ 0,00.
//
// A situação real é sempre derivada da data. O status gravado continua existindo
// (é o que a tela de edição salva), mas quem manda na exibição e nos totais é
// esta função. Cobrança paga é paga; não paga com vencimento no passado é
// vencida, tenha o status que tiver.
//
// Módulo puro: serve tanto ao servidor quanto aos componentes de cliente.

import type { PaymentStatus } from "@prisma/client"

export type SituacaoCobranca = "PAID" | "OVERDUE" | "PENDING"

export interface CobrancaBase {
  status:  PaymentStatus
  dueDate: Date | string
}

/** Início do dia — vencimento de hoje ainda não está atrasado. */
function hoje(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Situação real da cobrança, independente do status gravado. */
export function situacao(p: CobrancaBase, now?: Date): SituacaoCobranca {
  if (p.status === "PAID") return "PAID"
  const due = p.dueDate instanceof Date ? p.dueDate : new Date(p.dueDate)
  return due < hoje(now) ? "OVERDUE" : "PENDING"
}

export function estaVencida(p: CobrancaBase, now?: Date): boolean {
  return situacao(p, now) === "OVERDUE"
}

/** Dias de atraso; 0 quando ainda não venceu ou já foi paga. */
export function diasDeAtraso(p: CobrancaBase, now?: Date): number {
  if (situacao(p, now) !== "OVERDUE") return 0
  const due = p.dueDate instanceof Date ? p.dueDate : new Date(p.dueDate)
  return Math.floor((hoje(now).getTime() - due.getTime()) / 86_400_000)
}

// ─── Filtros Prisma ───────────────────────────────────────────────────────────

/** `where` das cobranças efetivamente vencidas. */
export function whereVencida(now?: Date) {
  return { status: { not: "PAID" as const }, dueDate: { lt: hoje(now) } }
}

/** `where` das cobranças em aberto que ainda não venceram. */
export function whereAVencer(now?: Date) {
  return { status: { not: "PAID" as const }, dueDate: { gte: hoje(now) } }
}

/** `where` de uma aba de filtro da tela de cobranças. */
export function whereSituacao(s: SituacaoCobranca, now?: Date) {
  if (s === "PAID")    return { status: "PAID" as const }
  if (s === "OVERDUE") return whereVencida(now)
  return whereAVencer(now)
}

// ─── Rótulos ──────────────────────────────────────────────────────────────────

export const SITUACAO_LABEL: Record<SituacaoCobranca, string> = {
  PAID:    "Pago",
  OVERDUE: "Vencido",
  PENDING: "Pendente",
}

export const SITUACAO_VARIANT: Record<SituacaoCobranca, "default" | "secondary" | "destructive"> = {
  PAID:    "default",
  OVERDUE: "destructive",
  PENDING: "secondary",
}

// ─── Formas de pagamento ──────────────────────────────────────────────────────

/**
 * Lista única das formas de pagamento.
 *
 * O texto tem de bater exatamente com `CardFeeRate.method`, porque é assim que
 * `calcFee` acha a taxa da maquininha (casamento por texto, não por enum).
 * Antes havia duas listas divergentes: o formulário de cobrança oferecia
 * "PIX"/"CARTAO"/"BOLETO" e a tela de taxas cadastrava "Pix"/"Cartão de
 * crédito"/"Boleto" — nenhuma taxa casava, e toda cobrança criada por ali saía
 * com taxa zero.
 */
export const PAYMENT_METHODS = [
  "Pix",
  "Dinheiro",
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
  "Transferência",
  "TED",
] as const

export type PaymentMethod = typeof PAYMENT_METHODS[number]

/** Texto vazio ou só espaço não conta como forma de pagamento informada. */
export function temMetodo(method: string | null | undefined): boolean {
  return !!method && method.trim().length > 0
}
