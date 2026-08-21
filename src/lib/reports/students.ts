// Economia de alunos: entrada, saída, quanto cada um vale e por quanto tempo fica.
//
// "Ativo" aqui é comportamento, não cadastro: aluno que teve aula nos últimos 60
// dias ou tem pacote com saldo. Contar cadastro daria um número bonito e inútil —
// aluno que sumiu há um ano continuaria no total.

import { prisma } from "@/lib/prisma"
import { subDays, startOfMonth, format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { monthKey, monthKeyFromDb, dateFromDbMonth, type ChartPoint } from "./period"

const INACTIVE_DAYS = 60

// ─── Base ativa ───────────────────────────────────────────────────────────────

export interface StudentBase {
  total:    number
  active:   number
  inactive: number
  /** Nunca teve aula nem pacote — cadastro que não virou aluno. */
  never:    number
  withCredits: number
}

export async function getStudentBase(now: Date): Promise<StudentBase> {
  const cutoff = subDays(now, INACTIVE_DAYS)

  const [row] = await prisma.$queryRaw<{
    total: number; active: number; never: number; with_credits: number
  }[]>`
    WITH last_lesson AS (
      SELECT p."studentId" AS student_id, MAX(l."scheduledAt") AS last_at
      FROM lesson_participants p
      JOIN lessons l ON l.id = p."lessonId" AND l.status <> 'CANCELLED'
      GROUP BY p."studentId"
    ),
    credits AS (
      SELECT "studentId" AS student_id
      FROM lesson_packages
      WHERE status = 'ACTIVE' AND "remainingLessons" > 0
        AND ("expiresAt" IS NULL OR "expiresAt" >= NOW())
      GROUP BY "studentId"
    )
    SELECT COUNT(*)::int                                                   AS total,
           COUNT(*) FILTER (
             WHERE ll.last_at >= ${cutoff} OR cr.student_id IS NOT NULL
           )::int                                                          AS active,
           COUNT(*) FILTER (
             WHERE ll.last_at IS NULL AND cr.student_id IS NULL
           )::int                                                          AS never,
           COUNT(*) FILTER (WHERE cr.student_id IS NOT NULL)::int          AS with_credits
    FROM students s
    LEFT JOIN last_lesson ll ON ll.student_id = s.id
    LEFT JOIN credits     cr ON cr.student_id = s.id
  `

  const total  = row?.total ?? 0
  const active = row?.active ?? 0
  return {
    total,
    active,
    inactive:    total - active,
    never:       row?.never ?? 0,
    withCredits: row?.with_credits ?? 0,
  }
}

// ─── Entradas e saídas ────────────────────────────────────────────────────────

export interface Churn {
  /** Alunos cadastrados no período. */
  joined:   number
  /** Alunos cuja última aula caiu no período e que hoje estão inativos. */
  lost:     number
  net:      number
  joinedByMonth: Map<string, number>
  lostByMonth:   Map<string, number>
  /** Perdidos ÷ base ativa no início — aproximação de churn. */
  churnPct: number
}

export async function getChurn(
  start: Date, end: Date, now: Date, activeBase: number,
): Promise<Churn> {
  const cutoff = subDays(now, INACTIVE_DAYS)

  const [joinedRows, lostRows] = await Promise.all([
    prisma.$queryRaw<{ month: Date; total: number }[]>`
      SELECT DATE_TRUNC('month', "createdAt") AS month, COUNT(*)::int AS total
      FROM students
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY DATE_TRUNC('month', "createdAt")
    `,
    // Perdido = última aula dentro do período E já passou da janela de inatividade.
    prisma.$queryRaw<{ month: Date; total: number }[]>`
      WITH last_lesson AS (
        SELECT p."studentId" AS student_id, MAX(l."scheduledAt") AS last_at
        FROM lesson_participants p
        JOIN lessons l ON l.id = p."lessonId" AND l.status = 'COMPLETED'
        GROUP BY p."studentId"
      )
      SELECT DATE_TRUNC('month', ll.last_at) AS month, COUNT(*)::int AS total
      FROM last_lesson ll
      LEFT JOIN lesson_packages lp
        ON lp."studentId" = ll.student_id AND lp.status = 'ACTIVE' AND lp."remainingLessons" > 0
       AND (lp."expiresAt" IS NULL OR lp."expiresAt" >= NOW())
      WHERE ll.last_at >= ${start} AND ll.last_at <= ${end}
        AND ll.last_at < ${cutoff}
        AND lp.id IS NULL
      GROUP BY DATE_TRUNC('month', ll.last_at)
    `,
  ])

  const joinedByMonth = new Map(joinedRows.map((r) => [monthKeyFromDb(r.month), r.total]))
  const lostByMonth   = new Map(lostRows.map((r) => [monthKeyFromDb(r.month), r.total]))

  const joined = joinedRows.reduce((s, r) => s + r.total, 0)
  const lost   = lostRows.reduce((s, r) => s + r.total, 0)

  return {
    joined, lost,
    net: joined - lost,
    joinedByMonth, lostByMonth,
    churnPct: activeBase > 0 ? (lost / activeBase) * 100 : 0,
  }
}

// ─── Valor por aluno ──────────────────────────────────────────────────────────

export interface StudentValue {
  /** Receita média por aluno ativo no período. */
  arpu:       number
  /** Receita total já paga ÷ alunos que já pagaram algo. */
  ltv:        number
  /** Meses médios entre a 1ª e a última compra de quem comprou mais de uma vez. */
  lifespanMonths: number
  /** Alunos que compraram 2 ou mais pacotes. */
  repeaters:  number
  buyers:     number
  repeatPct:  number
  /** Dias médios entre pacotes consecutivos. */
  daysBetweenPackages: number
}

export async function getStudentValue(
  periodRevenue: number, activeBase: number,
): Promise<StudentValue> {
  const [ltvRow] = await prisma.$queryRaw<{
    ltv: number | null; buyers: number
  }[]>`
    SELECT AVG(t.total)::float8 AS ltv, COUNT(*)::int AS buyers
    FROM (
      SELECT "studentId", SUM(amount) AS total
      FROM payments
      WHERE status = 'PAID'
      GROUP BY "studentId"
    ) t
  `

  const [repeatRow] = await prisma.$queryRaw<{
    repeaters: number; total_buyers: number; avg_days: number | null; avg_span: number | null
  }[]>`
    WITH pkg AS (
      SELECT "studentId",
             COUNT(*)::int                                                    AS n,
             MIN("purchaseDate")                                              AS first_at,
             MAX("purchaseDate")                                              AS last_at
      FROM lesson_packages
      GROUP BY "studentId"
    )
    SELECT COUNT(*) FILTER (WHERE n >= 2)::int                                AS repeaters,
           COUNT(*)::int                                                      AS total_buyers,
           AVG(
             CASE WHEN n >= 2
                  THEN DATE_PART('day', last_at - first_at) / NULLIF(n - 1, 0)
             END
           )::float8                                                          AS avg_days,
           AVG(
             CASE WHEN n >= 2
                  THEN DATE_PART('day', last_at - first_at) / 30.0
             END
           )::float8                                                          AS avg_span
    FROM pkg
  `

  const buyers    = repeatRow?.total_buyers ?? 0
  const repeaters = repeatRow?.repeaters ?? 0

  return {
    arpu:      activeBase > 0 ? periodRevenue / activeBase : 0,
    ltv:       ltvRow?.ltv ?? 0,
    lifespanMonths: repeatRow?.avg_span ?? 0,
    repeaters,
    buyers:    ltvRow?.buyers ?? 0,
    repeatPct: buyers > 0 ? (repeaters / buyers) * 100 : 0,
    daysBetweenPackages: Math.round(repeatRow?.avg_days ?? 0),
  }
}

// ─── Coortes ──────────────────────────────────────────────────────────────────

export interface CohortRow {
  cohort:   string
  label:    string
  size:     number
  /** Receita acumulada por aluno, mês a mês desde a entrada. */
  values:   (number | null)[]
}

export interface CohortMatrix {
  rows:       CohortRow[]
  maxOffset:  number
  /** Maior valor da matriz, para normalizar a intensidade da cor. */
  peak:       number
}

/**
 * Coorte de entrada × meses de vida, em receita acumulada por aluno.
 *
 * Lê-se na horizontal: quanto um aluno que entrou naquele mês já rendeu ao fim
 * de 1, 2, 3 meses. Coortes recentes têm poucas colunas — não é falha, é que
 * ainda não viveram tempo suficiente.
 */
export async function getCohorts(now: Date, monthsBack = 12): Promise<CohortMatrix> {
  const from = startOfMonth(subDays(now, monthsBack * 31))

  const [sizes, revenue] = await Promise.all([
    prisma.$queryRaw<{ cohort: Date; size: number }[]>`
      SELECT DATE_TRUNC('month', "createdAt") AS cohort, COUNT(*)::int AS size
      FROM students
      WHERE "createdAt" >= ${from}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY 1
    `,
    // O offset é calculado numa CTE e só depois agrupado: filtrar por ele no
    // HAVING não funciona, porque a expressão ali não é idêntica à do GROUP BY
    // (o cast ::int já basta para o Postgres tratar como outra expressão).
    prisma.$queryRaw<{ cohort: Date; offset: number; total: number }[]>`
      WITH base AS (
        SELECT DATE_TRUNC('month', s."createdAt")                                  AS cohort,
               ((DATE_PART('year',  p."paidAt") - DATE_PART('year',  s."createdAt")) * 12
              + (DATE_PART('month', p."paidAt") - DATE_PART('month', s."createdAt")))::int AS off,
               p.amount                                                            AS amount
        FROM students s
        JOIN payments p ON p."studentId" = s.id
        WHERE s."createdAt" >= ${from}
          AND p.status = 'PAID' AND p."paidAt" IS NOT NULL
      )
      SELECT cohort                            AS cohort,
             off                               AS "offset",
             COALESCE(SUM(amount), 0)::float8  AS total
      FROM base
      WHERE off >= 0
      GROUP BY cohort, off
      ORDER BY cohort, off
    `,
  ])

  if (sizes.length === 0) return { rows: [], maxOffset: 0, peak: 0 }

  const nowMonth = startOfMonth(now)
  const offsetOf = (cohort: Date) =>
    (nowMonth.getFullYear() - cohort.getFullYear()) * 12 +
    (nowMonth.getMonth() - cohort.getMonth())

  // dateFromDbMonth: o DATE_TRUNC volta como meia-noite UTC — ler com getters
  // locais jogaria toda coorte um mês para trás fora de servidores em UTC.
  const maxOffset = Math.max(0, ...sizes.map((s) => offsetOf(dateFromDbMonth(s.cohort))))

  const revMap = new Map<string, number>()
  for (const r of revenue) {
    revMap.set(`${monthKeyFromDb(r.cohort)}|${r.offset}`, r.total)
  }

  let peak = 0
  const rows: CohortRow[] = sizes.map((s) => {
    const cohortDate = dateFromDbMonth(s.cohort)
    const key        = monthKey(cohortDate)
    const alive      = offsetOf(cohortDate)

    let acc = 0
    const values = Array.from({ length: maxOffset + 1 }, (_, i) => {
      if (i > alive) return null                       // coorte ainda não viveu esse mês
      acc += revMap.get(`${key}|${i}`) ?? 0
      const perStudent = s.size > 0 ? acc / s.size : 0
      peak = Math.max(peak, perStudent)
      return perStudent
    })

    return {
      cohort: key,
      label:  format(cohortDate, "MMM/yy", { locale: ptBR }),
      size:   s.size,
      values,
    }
  })

  return { rows: rows.reverse(), maxOffset, peak }
}

// ─── Séries auxiliares ────────────────────────────────────────────────────────

export function joinLeaveSeries(points: ChartPoint[], churn: Churn) {
  return points.map((p) => ({
    label:   p.label,
    entrada: churn.joinedByMonth.get(p.key) ?? 0,
    saida:   churn.lostByMonth.get(p.key) ?? 0,
  }))
}

// ─── Saldo de créditos por aluno ──────────────────────────────────────────────

export interface CreditRow {
  studentId: string
  name:      string
  ra:        string
  lessons:   number
  value:     number
}

export async function getCreditBalances(take = 20): Promise<CreditRow[]> {
  return prisma.$queryRaw<CreditRow[]>`
    SELECT s.id                                                        AS "studentId",
           s.name                                                      AS name,
           s.ra                                                        AS ra,
           SUM(lp."remainingLessons")::float8                          AS lessons,
           SUM(lp."remainingLessons" * lp."pricePerLesson")::float8     AS value
    FROM lesson_packages lp
    JOIN students s ON s.id = lp."studentId"
    WHERE lp.status = 'ACTIVE' AND lp."remainingLessons" > 0
      AND (lp."expiresAt" IS NULL OR lp."expiresAt" >= NOW())
    GROUP BY s.id, s.name, s.ra
    ORDER BY value DESC
    LIMIT ${take}
  `
}
