/**
 * A unidade de "aula" do sistema é a HORA-AULA.
 *
 * Uma aula de 2 horas é *duas* aulas: debita 2 do pacote, paga 2 ao professor e
 * deve aparecer como 2 em qualquer contagem. Uma de 30 minutos é meia aula. É
 * assim que a escola vende (pacote de 10 aulas = 10 horas) e é assim que
 * `computePayout` calcula o repasse — as telas precisam falar a mesma língua,
 * senão o professor vê 4 aulas onde recebeu por 5.
 *
 * Módulo puro de propósito: é importado por server actions e por componentes de
 * tela, então não pode arrastar o Prisma junto.
 */

import type { LessonType } from "@prisma/client"

/** Duração padrão de uma aula, em minutos (espelha o default do schema). */
export const DEFAULT_DURATION = 60

/** Quantas aulas vale uma aula de N minutos. 120min → 2 · 30min → 0,5. */
export function aulasDe(durationMinutes: number | null | undefined): number {
  return (durationMinutes ?? DEFAULT_DURATION) / 60
}

/** Soma em aulas de uma lista de aulas. */
export function somaAulas(lessons: { duration: number | null }[]): number {
  return lessons.reduce((total, l) => total + aulasDe(l.duration), 0)
}

/** "1" · "1,5" · "8" — sem casa decimal quando é inteiro. */
export function fmtAulas(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",")
}

/** "1 aula" · "2 aulas" · "1,5 aula" */
export function labelAulas(n: number): string {
  return `${fmtAulas(n)} ${n === 1 ? "aula" : "aulas"}`
}

/**
 * Minutos somados no banco → aulas. Par de `somaAulas` para quando a contagem
 * vem de um `_sum: { duration: true }` em vez de uma lista carregada.
 */
export function aulasDeMinutos(totalMinutes: number | null | undefined): number {
  return (totalMinutes ?? 0) / 60
}

/**
 * COMPROMISSO é anotação de agenda (reunião, bloqueio), não aula: não debita
 * pacote, não fatura e não pode entrar em nenhuma contagem de aulas. O único
 * lugar que o inclui de propósito é o repasse ao professor — ver
 * src/lib/reports/costs.ts.
 *
 * Espalhe em qualquer `where` de aula: `{ ...AULA_WHERE, status: "COMPLETED" }`.
 */
export const AULA_WHERE = { lessonType: { not: "COMPROMISSO" } } as const

/** Versão em memória do filtro acima, para listas já carregadas. */
export function ehAula(l: { lessonType?: string | null }): boolean {
  return l.lessonType !== "COMPROMISSO"
}

/**
 * Aula que sai do pacote: INDIVIDUAL e GROUP (dupla). Ambas debitam
 * `remainingLessons` em hora-aula.
 *
 * AULÃO fica de fora de propósito: é vendido à parte — cada inscrito ganha uma
 * cobrança avulsa (`pricePerStudent`) e o pacote nunca é tocado (ver
 * `criarAulaoAction` em src/lib/actions/lesson-request.ts). Somá-lo ao "aulas
 * realizadas" do aluno faz o número divergir do saldo, que é exatamente o que
 * levava as pessoas a conferir na mão.
 *
 * ⚠ Do lado do PROFESSOR vale o oposto: `computePayout` paga o aulão como
 * qualquer outra aula, então repasse, custo e ocupação usam `AULA_WHERE`.
 * Este filtro é só para números que o aluno/responsável lê ao lado do saldo.
 */
export const AULA_PACOTE_WHERE = {
  lessonType: { in: ["INDIVIDUAL", "GROUP"] as LessonType[] },
}

/** `where` só dos aulões — contados por encontro, não em hora-aula. */
export const AULAO_WHERE = { lessonType: "AULAO" as LessonType }

/** Versão em memória de `AULA_PACOTE_WHERE`. */
export function ehAulaDePacote(l: { lessonType?: string | null }): boolean {
  return l.lessonType === "INDIVIDUAL" || l.lessonType === "GROUP"
}
