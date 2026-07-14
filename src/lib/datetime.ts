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
export const BRAZIL_UTC_OFFSET = "-03:00"

/**
 * Converte data ("YYYY-MM-DD") + hora ("HH:mm") no relógio local do Brasil
 * para um instante absoluto (Date), independente do fuso do servidor.
 */
export function parseBrazilDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${BRAZIL_UTC_OFFSET}`)
}
