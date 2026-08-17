// Situação de um pacote de aulas.
//
// ── Por que não basta o status gravado ────────────────────────────────────────
// `PackageStatus` é atualizado no débito de crédito (zera → EXHAUSTED), mas
// nada olha o prazo: um pacote que venceu em março continua ACTIVE para sempre.
// Ele então segue contando como saldo disponível — infla o passivo de aulas,
// mantém o aluno na lista de "ativos" e aparece como crédito na hora de
// agendar, mesmo sem valer mais.
//
// A regra aqui é a mesma de src/lib/payments.ts: o banco guarda, a data manda.

import type { PackageStatus } from "@prisma/client"

export type SituacaoPacote = "ACTIVE" | "EXHAUSTED" | "EXPIRED"

export interface PacoteBase {
  status:           PackageStatus
  remainingLessons: unknown          // Decimal do Prisma ou number
  expiresAt:        Date | string | null
}

function fimDoDia(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Situação real do pacote — prazo vence antes de saldo. */
export function situacaoPacote(p: PacoteBase, now?: Date): SituacaoPacote {
  if (Number(p.remainingLessons) <= 0) return "EXHAUSTED"
  if (p.expiresAt) {
    const exp = p.expiresAt instanceof Date ? p.expiresAt : new Date(p.expiresAt)
    if (exp < fimDoDia(now)) return "EXPIRED"
  }
  return p.status === "ACTIVE" ? "ACTIVE" : (p.status as SituacaoPacote)
}

/** true quando o pacote ainda pode ser usado para agendar. */
export function pacoteUtilizavel(p: PacoteBase, now?: Date): boolean {
  return situacaoPacote(p, now) === "ACTIVE"
}

/**
 * `where` dos pacotes que valem como crédito de verdade: ativos, com saldo e
 * dentro do prazo. É o filtro que deve estar em qualquer lugar que fale de
 * "saldo disponível", "aluno ativo" ou "passivo de aulas".
 */
export function wherePacoteUtilizavel(now: Date = new Date()) {
  return {
    status:           "ACTIVE" as const,
    remainingLessons: { gt: 0 },
    OR: [
      { expiresAt: null },
      { expiresAt: { gte: fimDoDia(now) } },
    ],
  }
}

/** `where` dos pacotes cujo status gravado está desatualizado. */
export function wherePacoteDesatualizado(now: Date = new Date()) {
  return {
    status: "ACTIVE" as const,
    OR: [
      { remainingLessons: { lte: 0 } },
      { expiresAt: { lt: fimDoDia(now) } },
    ],
  }
}

export const PACOTE_LABEL: Record<SituacaoPacote, string> = {
  ACTIVE:    "Ativo",
  EXHAUSTED: "Esgotado",
  EXPIRED:   "Expirado",
}
