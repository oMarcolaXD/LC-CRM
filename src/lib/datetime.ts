/**
 * Utilitários de data/hora fixados no fuso do Brasil (America/Sao_Paulo).
 *
 * Toda a operação é presencial/online no Brasil, então interpretamos as
 * entradas de data+hora sempre como horário de Brasília. O Brasil não observa
 * horário de verão desde 2019, então o offset é fixo em UTC-3.
 *
 * Isto é essencial porque o servidor de produção (Vercel) roda em UTC. Sem o
 * offset explícito, `new Date("2026-07-14T15:00:00")` seria interpretado como
 * 15:00 UTC, e o navegador do usuário (UTC-3) exibiria 12:00 — 3 horas errado.
 */

import { format as dateFnsFormat } from "date-fns"
import { ptBR as ptBRLocale } from "date-fns/locale"

export const BRAZIL_UTC_OFFSET = "-03:00"
export const BRAZIL_TZ = "America/Sao_Paulo"

/**
 * Converte data ("YYYY-MM-DD") + hora ("HH:mm") no relógio local do Brasil
 * para um instante absoluto (Date), independente do fuso do servidor.
 */
export function parseBrazilDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${BRAZIL_UTC_OFFSET}`)
}

/**
 * Converte um instante UTC para um objeto Date cujos getHours/getMinutes
 * refletem o horário de Brasília — usando Intl nativo (sem dependência extra).
 *
 * Uso em server components: toBrazilDate(lesson.scheduledAt).getHours()
 * Em vez de: lesson.scheduledAt.getHours()  ← retornaria horas UTC no Vercel
 */
export function toBrazilDate(date: Date): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: BRAZIL_TZ }))
}

/**
 * Formata um Date usando o fuso de Brasília, independente do TZ do servidor.
 * Substitui `format(date, pattern)` em server components.
 */
export function formatBR(
  date: Date,
  pattern: string,
  options?: { locale?: typeof ptBRLocale },
): string {
  return dateFnsFormat(toBrazilDate(date), pattern, options)
}

/**
 * Retorna "now" no relógio de Brasília (útil em server components que precisam
 * da hora ou data local do Brasil, ex: calcular horário de início do dia).
 */
export function nowBrazil(): Date {
  return toBrazilDate(new Date())
}
