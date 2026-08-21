// Operação: volume de aulas, qualidade da execução e ocupação da agenda.
//
// COMPROMISSO é excluído de tudo aqui: é anotação de agenda, não aula. (No custo
// ele continua entrando, porque o repasse ao professor não filtra por tipo —
// ver costs.ts.)

import { prisma } from "@/lib/prisma"
import { monthKeyFromDb } from "./period"

// ─── Volume e qualidade ───────────────────────────────────────────────────────

export interface LessonStats {
  completed:  number
  cancelled:  number
  missed:     number
  scheduled:  number
  confirmed:  number
  total:      number
  hours:      number
  /** Realizadas ÷ (realizadas + canceladas + faltas). */
  completionPct: number
  cancelPct:  number
  missPct:    number
  avgRating:  number | null
  ratedCount: number
  byModality: { modality: string; count: number }[]
  byType:     { type: string; count: number }[]
  byMonth:    Map<string, number>
}

export async function getLessonStats(start: Date, end: Date): Promise<LessonStats> {
  const [statusRows, modalityRows, typeRows, monthRows, rating] = await Promise.all([
    prisma.$queryRaw<{ status: string; count: number; minutes: number }[]>`
      SELECT status::text                       AS status,
             COUNT(*)::int                      AS count,
             COALESCE(SUM(duration), 0)::int    AS minutes
      FROM lessons
      WHERE "lessonType" <> 'COMPROMISSO'
        AND "scheduledAt" >= ${start} AND "scheduledAt" <= ${end}
      GROUP BY status
    `,
    prisma.$queryRaw<{ modality: string; count: number }[]>`
      SELECT modality::text AS modality, COUNT(*)::int AS count
      FROM lessons
      WHERE "lessonType" <> 'COMPROMISSO' AND status = 'COMPLETED'
        AND "scheduledAt" >= ${start} AND "scheduledAt" <= ${end}
      GROUP BY modality
    `,
    prisma.$queryRaw<{ type: string; count: number }[]>`
      SELECT "lessonType"::text AS type, COUNT(*)::int AS count
      FROM lessons
      WHERE "lessonType" <> 'COMPROMISSO' AND status = 'COMPLETED'
        AND "scheduledAt" >= ${start} AND "scheduledAt" <= ${end}
      GROUP BY "lessonType"
    `,
    prisma.$queryRaw<{ month: Date; count: number }[]>`
      SELECT DATE_TRUNC('month', "scheduledAt") AS month, COUNT(*)::int AS count
      FROM lessons
      WHERE "lessonType" <> 'COMPROMISSO' AND status = 'COMPLETED'
        AND "scheduledAt" >= ${start} AND "scheduledAt" <= ${end}
      GROUP BY DATE_TRUNC('month', "scheduledAt")
    `,
    prisma.$queryRaw<{ avg: number | null; count: number }[]>`
      SELECT AVG("studentRating")::float8 AS avg, COUNT(*)::int AS count
      FROM lessons
      WHERE "studentRating" IS NOT NULL
        AND "scheduledAt" >= ${start} AND "scheduledAt" <= ${end}
    `,
  ])

  const pick = (s: string) => statusRows.find((r) => r.status === s)
  const completed = pick("COMPLETED")?.count ?? 0
  const cancelled = pick("CANCELLED")?.count ?? 0
  const missed    = pick("MISSED")?.count ?? 0
  const scheduled = pick("SCHEDULED")?.count ?? 0
  const confirmed = pick("CONFIRMED")?.count ?? 0
  const closed    = completed + cancelled + missed

  return {
    completed, cancelled, missed, scheduled, confirmed,
    total: statusRows.reduce((s, r) => s + r.count, 0),
    hours: (pick("COMPLETED")?.minutes ?? 0) / 60,
    completionPct: closed > 0 ? (completed / closed) * 100 : 0,
    cancelPct:     closed > 0 ? (cancelled / closed) * 100 : 0,
    missPct:       closed > 0 ? (missed / closed) * 100 : 0,
    avgRating:     rating[0]?.avg ?? null,
    ratedCount:    rating[0]?.count ?? 0,
    byModality:    modalityRows,
    byType:        typeRows,
    byMonth:       new Map(monthRows.map((r) => [monthKeyFromDb(r.month), r.count])),
  }
}

// ─── Horários de pico ─────────────────────────────────────────────────────────

export interface PeakHours {
  /** Horas presentes na grade (só as que têm ao menos uma aula). */
  hours:  number[]
  /** [diaDaSemana][hora] = nº de aulas. Dia 0 = segunda. */
  grid:   number[][]
  peak:   number
  total:  number
  busiest: { day: number; hour: number; count: number } | null
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // segunda → domingo
export const DAY_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

/**
 * Mapa dia × hora das aulas realizadas.
 *
 * O horário é extraído no fuso de Brasília: o banco guarda UTC e, sem o
 * AT TIME ZONE, uma aula das 19h apareceria como 22h.
 */
export async function getPeakHours(start: Date, end: Date): Promise<PeakHours> {
  const rows = await prisma.$queryRaw<{ dow: number; hour: number; count: number }[]>`
    SELECT EXTRACT(DOW  FROM "scheduledAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::int AS dow,
           EXTRACT(HOUR FROM "scheduledAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
           COUNT(*)::int AS count
    FROM lessons
    WHERE "lessonType" <> 'COMPROMISSO' AND status = 'COMPLETED'
      AND "scheduledAt" >= ${start} AND "scheduledAt" <= ${end}
    GROUP BY 1, 2
  `

  if (rows.length === 0) {
    return { hours: [], grid: [], peak: 0, total: 0, busiest: null }
  }

  const hours = [...new Set(rows.map((r) => r.hour))].sort((a, b) => a - b)
  const index = new Map(hours.map((h, i) => [h, i]))

  const grid = DAY_ORDER.map(() => hours.map(() => 0))
  let peak = 0, total = 0
  let busiest: PeakHours["busiest"] = null

  for (const r of rows) {
    const d = DAY_ORDER.indexOf(r.dow)
    const h = index.get(r.hour)
    if (d === -1 || h === undefined) continue
    grid[d][h] += r.count
    total += r.count
    if (grid[d][h] > peak) {
      peak = grid[d][h]
      busiest = { day: d, hour: r.hour, count: grid[d][h] }
    }
  }

  return { hours, grid, peak, total, busiest }
}

// ─── Ocupação de salas ────────────────────────────────────────────────────────

export interface RoomUsage {
  id:      string
  name:    string
  type:    string
  lessons: number
  hours:   number
}

export async function getRoomUsage(start: Date, end: Date): Promise<RoomUsage[]> {
  return prisma.$queryRaw<RoomUsage[]>`
    SELECT r.id                                AS id,
           r.name                              AS name,
           r.type::text                        AS type,
           COUNT(*)::int                       AS lessons,
           (SUM(l.duration)::float8 / 60)      AS hours
    FROM lessons l
    JOIN rooms r ON r.id = l."roomId"
    WHERE l.status = 'COMPLETED'
      AND l."scheduledAt" >= ${start} AND l."scheduledAt" <= ${end}
    GROUP BY r.id, r.name, r.type
    ORDER BY hours DESC
  `
}
