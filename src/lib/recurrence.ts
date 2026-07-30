/**
 * Geração de ocorrências semanais — funções puras, sem dependência de servidor,
 * para que o diálogo (client) e a validação (server) enxerguem exatamente as
 * mesmas datas. A aritmética é feita em dia de calendário ("yyyy-MM-dd"), então
 * não sofre com o fuso do servidor.
 */

import { addWeeks, format, parseISO } from "date-fns"

/** Uma ocorrência da série: dia de calendário + hora local de Brasília. */
export interface SlotRef {
  date: string   // "yyyy-MM-dd"
  time: string   // "HH:mm"
}

export const MIN_OCCURRENCES = 2
export const MAX_OCCURRENCES = 52

/** `count` ocorrências semanais a partir de uma data, sempre no mesmo dia da semana. */
export function weeklySlots(date: string, time: string, count: number): SlotRef[] {
  const first = parseISO(`${date}T00:00:00`)
  const total = Math.max(1, Math.floor(count))
  return Array.from({ length: total }, (_, i) => ({
    date: format(addWeeks(first, i), "yyyy-MM-dd"),
    time,
  }))
}

/** Ordena por data+hora — a série pode ser reordenada quando o usuário edita uma exceção. */
export function sortSlots(slots: SlotRef[]): SlotRef[] {
  return [...slots].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  )
}

// ─── Resultado da avaliação de uma série ──────────────────────────────────────
// Tipos aqui (e não no arquivo de server actions) para que o diálogo cliente
// possa importá-los sem arrastar o Prisma para o bundle.

export type SlotVerdict =
  | "OK"                 // será criada
  | "PAST"               // já passou: será registrada como realizada
  | "NO_BALANCE"         // saldo do pacote acabou antes desta ocorrência
  | "TEACHER_CONFLICT"   // professor já ocupado
  | "ROOM_CONFLICT"      // nenhuma sala livre

/** Ocorrências que efetivamente geram aula. */
export function isCreatable(verdict: SlotVerdict): boolean {
  return verdict === "OK" || verdict === "PAST"
}

/** Só estas o usuário consegue resolver mudando data/horário. */
export function isConflict(verdict: SlotVerdict): boolean {
  return verdict === "TEACHER_CONFLICT" || verdict === "ROOM_CONFLICT"
}

export interface RecurringSlotPreview extends SlotRef {
  label:   string       // "qua, 12/08 às 14:00"
  verdict: SlotVerdict
  reason:  string       // vazio quando OK
}

export interface RecurringPreview {
  slots:            RecurringSlotPreview[]
  creatableCount:   number
  blockedCount:     number
  costPerLesson:    number
  balanceRemaining: number
  /** Saldo que sobra se a série for confirmada como está. */
  balanceAfter:     number
}
