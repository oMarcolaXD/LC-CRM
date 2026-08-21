// Rentabilidade e desempenho por professor.
//
// Cruza três coisas que hoje vivem em telas separadas: o custo (repasse), a
// receita atribuída às aulas dele (estimativa — ver attribution.ts) e a
// execução (cancelamento, falta, avaliação). É o quadro que responde "este
// professor se paga?".

import { prisma } from "@/lib/prisma"
import { getTeacherCosts } from "./costs"
import { getAttributedByTeacher } from "./attribution"
import { margin } from "./format"

export interface TeacherPerformance {
  teacherId:   string
  name:        string
  hourlyRate:  number
  lessons:     number
  hours:       number
  cost:        number
  revenue:     number
  result:      number
  marginPct:   number
  cancelled:   number
  missed:      number
  cancelPct:   number
  avgRating:   number | null
  ratedCount:  number
  students:    number
  snapshot:    boolean
}

export interface TeacherReport {
  rows:        TeacherPerformance[]
  totalCost:   number
  totalRevenue: number
  paidOut:     number
  pendingOut:  number
}

export async function getTeacherPerformance(start: Date, end: Date): Promise<TeacherReport> {
  const [costs, attributed, quality] = await Promise.all([
    getTeacherCosts(start, end),
    getAttributedByTeacher(start, end),
    prisma.$queryRaw<{
      teacherId: string; cancelled: number; missed: number
      avg_rating: number | null; rated: number; students: number
    }[]>`
      SELECT l."teacherId"                                              AS "teacherId",
             COUNT(*) FILTER (WHERE l.status = 'CANCELLED')::int        AS cancelled,
             COUNT(*) FILTER (WHERE l.status = 'MISSED')::int           AS missed,
             AVG(l."studentRating")::float8                             AS avg_rating,
             COUNT(*) FILTER (WHERE l."studentRating" IS NOT NULL)::int AS rated,
             COUNT(DISTINCT lp."studentId")::int                        AS students
      FROM lessons l
      LEFT JOIN lesson_participants lp ON lp."lessonId" = l.id
      WHERE l."lessonType" <> 'COMPROMISSO'
        AND l."scheduledAt" >= ${start} AND l."scheduledAt" <= ${end}
      GROUP BY l."teacherId"
    `,
  ])

  const revenueOf = new Map(attributed.map((a) => [a.id, a.revenue]))
  const qualityOf = new Map(quality.map((q) => [q.teacherId, q]))

  const rows: TeacherPerformance[] = costs.byTeacher.map((c) => {
    const revenue = revenueOf.get(c.teacherId) ?? 0
    const q       = qualityOf.get(c.teacherId)
    const closed  = c.lessons + (q?.cancelled ?? 0) + (q?.missed ?? 0)

    return {
      teacherId:  c.teacherId,
      name:       c.name,
      hourlyRate: c.hourlyRate,
      lessons:    c.lessons,
      hours:      c.hours,
      cost:       c.cost,
      revenue,
      result:     revenue - c.cost,
      marginPct:  margin(revenue - c.cost, revenue),
      cancelled:  q?.cancelled ?? 0,
      missed:     q?.missed ?? 0,
      cancelPct:  closed > 0 ? ((q?.cancelled ?? 0) / closed) * 100 : 0,
      avgRating:  q?.avg_rating ?? null,
      ratedCount: q?.rated ?? 0,
      students:   q?.students ?? 0,
      snapshot:   c.snapshot,
    }
  })

  return {
    rows:         rows.sort((a, b) => b.result - a.result),
    totalCost:    costs.total,
    totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
    paidOut:      costs.paid,
    pendingOut:   costs.pending,
  }
}
