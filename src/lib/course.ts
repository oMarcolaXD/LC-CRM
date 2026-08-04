/**
 * Regras puras das turmas de acompanhamento (sem acesso a banco).
 *
 * Fica fora de `actions/course.ts` porque aquele arquivo é `"use server"` e só
 * pode exportar funções async — estas aqui também são usadas no cliente.
 */

import { addWeeks, format } from "date-fns"
import { ptBR }             from "date-fns/locale"
import { parseBrazilDateTime, toBrazilDate } from "@/lib/datetime"

/** Teto de segurança: 2 anos de encontros semanais. */
const MAX_OCCURRENCES = 104

export const WEEKDAY_LABELS = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
] as const

/**
 * Gera os encontros semanais entre `startDate` e `endDate`, no dia da semana e
 * horário da grade. O primeiro encontro é o primeiro `weekday` que cai em
 * `startDate` ou depois dela.
 */
export function gerarEncontros(
  startDate: string, endDate: string, weekday: number, startTime: string,
): Date[] {
  const fim = parseBrazilDateTime(endDate, "23:59")

  // Avança dia a dia até bater o dia da semana escolhido, sempre lendo o dia
  // pelo relógio de Brasília (o servidor roda em UTC).
  let atual = parseBrazilDateTime(startDate, startTime)
  for (let i = 0; i < 7 && toBrazilDate(atual).getDay() !== weekday; i++) {
    atual = new Date(atual.getTime() + 86400000)
  }

  const datas: Date[] = []
  while (atual <= fim && datas.length < MAX_OCCURRENCES) {
    datas.push(atual)
    atual = addWeeks(atual, 1)
  }
  return datas
}

/** Divide o valor em N parcelas, jogando os centavos que sobram na primeira. */
export function dividirParcelas(total: number, parcelas: number): number[] {
  const centavos = Math.round(total * 100)
  const base     = Math.floor(centavos / parcelas)
  const resto    = centavos - base * parcelas
  return Array.from({ length: parcelas }, (_, i) => (base + (i === 0 ? resto : 0)) / 100)
}

/** "Sábados às 10:00" — descrição curta da grade fixa. */
export function descreverGrade(weekday: number | null, startTime: string | null): string | null {
  if (weekday == null || !startTime) return null
  const dia = WEEKDAY_LABELS[weekday]
  if (!dia) return null
  // Domingo e sábado pluralizam sozinhos; nos dias úteis as duas partes vão
  // para o plural: "Terças-feiras", não "Terças-feira".
  const plural = weekday === 0 || weekday === 6 ? `${dia}s` : `${dia}s-feiras`
  return `${plural} às ${startTime}`
}

/** "fev/2026 → jul/2026" — período do contrato. */
export function descreverPeriodo(start: Date | string | null, end: Date | string | null): string | null {
  if (!start || !end) return null
  const ini = typeof start === "string" ? new Date(start) : start
  const fim = typeof end   === "string" ? new Date(end)   : end
  return `${format(toBrazilDate(ini), "MMM/yyyy", { locale: ptBR })} → ${format(toBrazilDate(fim), "MMM/yyyy", { locale: ptBR })}`
}

export const COURSE_STATUS_LABELS = {
  ACTIVE:    { label: "Em andamento", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
  FINISHED:  { label: "Encerrada",    cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"    },
  CANCELLED: { label: "Cancelada",    cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"         },
} as const
