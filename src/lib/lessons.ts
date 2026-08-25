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
