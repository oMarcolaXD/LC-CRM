// Formato de disponibilidade armazenado no banco:
// { "1": [{"start": "09:00", "end": "12:00"}, {"start": "14:00", "end": "18:00"}], "3": [...] }
// Chave = dia da semana (0=Dom, 1=Seg, ..., 6=Sab)

import { parseBrazilDateTime } from "@/lib/datetime"

export interface TimeSlot   { start: string; end: string }
export type Availability    = Record<string, TimeSlot[]>  // dia -> intervalos

/** Aula já marcada que ocupa a agenda do professor. */
export interface BookedLesson { scheduledAt: Date; duration?: number | null }

export const DAY_NAMES = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]
export const DAY_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]

/** Gera slots de 1h dentro dos intervalos disponíveis de um dia */
function slotsForInterval(slot: TimeSlot, durationMin = 60): string[] {
  const result: string[] = []
  const [sh, sm] = slot.start.split(":").map(Number)
  const [eh, em] = slot.end.split(":").map(Number)
  let cur = sh * 60 + sm
  const end = eh * 60 + em
  while (cur + durationMin <= end) {
    const h = String(Math.floor(cur / 60)).padStart(2, "0")
    const m = String(cur % 60).padStart(2, "0")
    result.push(`${h}:${m}`)
    cur += durationMin
  }
  return result
}

/**
 * Lista os slots livres de uma data ("yyyy-MM-dd").
 *
 * A comparação com as aulas já marcadas é feita em tempo absoluto: o slot vira
 * um instante via `parseBrazilDateTime` e é testado por sobreposição real de
 * intervalos. Comparar "HH:mm" daria errado no servidor em UTC, e comparar só o
 * início deixaria passar uma aula de 90min que invade o slot seguinte.
 */
export function getAvailableSlotsForDate(
  dateStr:      string,        // "yyyy-MM-dd"
  availability: Availability,
  booked:       BookedLesson[],
  durationMin = 60,
): string[] {
  // Meio-dia evita que o fuso do servidor jogue o dia da semana para o vizinho.
  const dow   = parseBrazilDateTime(dateStr, "12:00").getDay().toString()
  const slots = availability[dow] ?? []

  return slots
    .flatMap((s) => slotsForInterval(s, durationMin))
    .filter((hhmm) => {
      const start = parseBrazilDateTime(dateStr, hhmm).getTime()
      const end   = start + durationMin * 60_000
      return !booked.some((b) => {
        const bStart = b.scheduledAt.getTime()
        const bEnd   = bStart + (b.duration ?? 60) * 60_000
        return start < bEnd && bStart < end
      })
    })
}

/** Retorna os dias disponíveis nos próximos N dias (incluindo hoje) */
export function getAvailableDates(
  availability: Availability,
  daysAhead = 30,
  minHoursAhead = 0,
): Date[] {
  const result: Date[] = []
  const now    = new Date()
  const today  = new Date()
  today.setHours(0, 0, 0, 0)
  const minMs  = minHoursAhead * 60 * 60 * 1000

  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dow      = d.getDay().toString()
    const daySlots = availability[dow] ?? []
    if (daySlots.length === 0) continue

    // Hoje só entra se ainda houver ao menos um horário que respeite a antecedência mínima
    if (i === 0) {
      const hasFutureSlot = daySlots.some((s) =>
        slotsForInterval(s).some((hhmm) => {
          const [h, m]  = hhmm.split(":").map(Number)
          const slotAt  = new Date(d)
          slotAt.setHours(h, m, 0, 0)
          return slotAt.getTime() - now.getTime() >= minMs
        })
      )
      if (!hasFutureSlot) continue
    }

    result.push(d)
  }
  return result
}

/** Verifica se uma data/hora está dentro da disponibilidade */
export function isWithinAvailability(
  requestedAt:  Date,
  availability: Availability,
  durationMin = 60,
): boolean {
  const dow   = requestedAt.getDay().toString()
  const slots = availability[dow] ?? []
  if (slots.length === 0) return false

  const h   = requestedAt.getHours()
  const m   = requestedAt.getMinutes()
  const cur = h * 60 + m

  return slots.some(({ start, end }) => {
    const [sh, sm] = start.split(":").map(Number)
    const [eh, em] = end.split(":").map(Number)
    return cur >= sh * 60 + sm && cur + durationMin <= eh * 60 + em
  })
}
