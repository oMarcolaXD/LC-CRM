// Valor/hora do professor com vigência.
//
// `Teacher.hourlyRate` é o valor de hoje — é o que as telas editam e exibem.
// `teacher_rates` guarda desde quando cada valor vale, e é ele que manda no
// custo de uma aula: a aula de março custa a taxa de março, não a de hoje.
//
// Sem isso, um reajuste reescrevia o custo de todos os meses ainda não pagos, e
// o resultado de um mês já fechado mudava sozinho depois do aumento.

import { prisma } from "@/lib/prisma"

export interface RateWindow {
  hourlyRate:    number
  effectiveFrom: Date
}

/** Histórico de taxas de vários professores, já ordenado do mais novo ao mais antigo. */
export async function loadRateHistory(
  teacherIds?: string[],
): Promise<Map<string, RateWindow[]>> {
  const rows = await prisma.teacherRate.findMany({
    where:   teacherIds ? { teacherId: { in: teacherIds } } : undefined,
    select:  { teacherId: true, hourlyRate: true, effectiveFrom: true },
    orderBy: { effectiveFrom: "desc" },
  })

  const map = new Map<string, RateWindow[]>()
  for (const r of rows) {
    const list = map.get(r.teacherId) ?? []
    list.push({ hourlyRate: Number(r.hourlyRate), effectiveFrom: r.effectiveFrom })
    map.set(r.teacherId, list)
  }
  return map
}

/**
 * Taxa vigente numa data.
 *
 * `history` precisa estar em ordem decrescente de vigência (é o que
 * `loadRateHistory` devolve). Sem nenhuma faixa aplicável — professor sem
 * histórico, ou aula anterior à primeira vigência — cai no valor atual.
 */
export function rateAt(
  history: RateWindow[] | undefined,
  when: Date,
  fallback: number,
): number {
  const w = history?.find((r) => r.effectiveFrom <= when)
  return w ? w.hourlyRate : fallback
}

/**
 * Registra uma nova vigência quando o valor/hora muda.
 *
 * A vigência começa hoje: um reajuste combinado hoje não deve reescrever o que
 * já foi trabalhado. Se já existe faixa começando hoje (dois ajustes no mesmo
 * dia), ela é sobrescrita em vez de duplicar.
 */
export async function recordRateChange(
  teacherId: string,
  newRate: number,
  when: Date = new Date(),
): Promise<void> {
  const effectiveFrom = new Date(when)
  effectiveFrom.setHours(0, 0, 0, 0)

  const atual = await prisma.teacherRate.findFirst({
    where:   { teacherId },
    orderBy: { effectiveFrom: "desc" },
    select:  { hourlyRate: true },
  })
  if (atual && Number(atual.hourlyRate) === newRate) return

  await prisma.teacherRate.upsert({
    where:  { teacherId_effectiveFrom: { teacherId, effectiveFrom } },
    update: { hourlyRate: newRate },
    create: { teacherId, hourlyRate: newRate, effectiveFrom },
  })
}

/** Primeira vigência de um professor recém-criado. */
export async function seedInitialRate(teacherId: string, rate: number): Promise<void> {
  await prisma.teacherRate.create({
    data: { teacherId, hourlyRate: rate, effectiveFrom: new Date("1970-01-01T00:00:00.000Z") },
  })
}
