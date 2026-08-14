// Receita.
//
// ── Duas bases de reconhecimento ──────────────────────────────────────────────
// "caixa"      → agrupa por `paidAt`: dinheiro que entrou de fato.
// "vencimento" → agrupa por `dueDate`: o que era para ter entrado no mês.
// A diferença entre as duas curvas é, na prática, o atraso médio de recebimento.
//
// ── Fuso ──────────────────────────────────────────────────────────────────────
// O DATE_TRUNC aqui é deliberadamente SEM conversão de fuso. A maioria dos
// campos de data nasce de um <input type="date"> ("2026-03-01" → 2026-03-01T00:00Z),
// então o valor gravado JÁ É a data pretendida; converter para America/Sao_Paulo
// jogaria todo dia 1º para o mês anterior. É também o que o dashboard e o
// financeiro fazem — manter igual é o que faz os números baterem entre as telas.

import { prisma } from "@/lib/prisma"
import { monthKeyFromDb } from "./period"

export type RevenueBasis = "caixa" | "vencimento"

// ─── Resumo ───────────────────────────────────────────────────────────────────

export interface RevenueSummary {
  /** Recebido no período (status PAID, por paidAt). */
  gross:    number
  /** Taxas de cartão/boleto embutidas nesse recebimento. */
  fees:     number
  net:      number
  /** Nº de cobranças quitadas no período. */
  count:    number
  /** Ticket médio por cobrança quitada. */
  ticket:   number
  /** Alunos distintos que pagaram algo no período. */
  payers:   number
}

export async function getRevenueSummary(start: Date, end: Date): Promise<RevenueSummary> {
  const [row] = await prisma.$queryRaw<{
    gross: number; fees: number; count: number; payers: number
  }[]>`
    SELECT COALESCE(SUM(amount), 0)::float8               AS gross,
           COALESCE(SUM("feeAmount"), 0)::float8          AS fees,
           COUNT(*)::int                                  AS count,
           COUNT(DISTINCT "studentId")::int               AS payers
    FROM payments
    WHERE status = 'PAID'
      AND "paidAt" IS NOT NULL
      AND "paidAt" >= ${start} AND "paidAt" <= ${end}
  `

  const gross = row?.gross ?? 0
  const count = row?.count ?? 0
  return {
    gross,
    fees:   row?.fees ?? 0,
    net:    gross - (row?.fees ?? 0),
    count,
    ticket: count > 0 ? gross / count : 0,
    payers: row?.payers ?? 0,
  }
}

// ─── Série mensal ─────────────────────────────────────────────────────────────

export interface RevenueMonth {
  key:   string
  gross: number
  fees:  number
}

/** Receita mês a mês no intervalo, na base escolhida. */
export async function getRevenueByMonth(
  start: Date,
  end: Date,
  basis: RevenueBasis = "caixa",
): Promise<Map<string, RevenueMonth>> {
  const rows = basis === "caixa"
    ? await prisma.$queryRaw<{ month: Date; gross: number; fees: number }[]>`
        SELECT DATE_TRUNC('month', "paidAt")            AS month,
               COALESCE(SUM(amount), 0)::float8         AS gross,
               COALESCE(SUM("feeAmount"), 0)::float8    AS fees
        FROM payments
        WHERE status = 'PAID' AND "paidAt" IS NOT NULL
          AND "paidAt" >= ${start} AND "paidAt" <= ${end}
        GROUP BY DATE_TRUNC('month', "paidAt")
      `
    : await prisma.$queryRaw<{ month: Date; gross: number; fees: number }[]>`
        SELECT DATE_TRUNC('month', "dueDate")           AS month,
               COALESCE(SUM(amount), 0)::float8         AS gross,
               COALESCE(SUM("feeAmount"), 0)::float8    AS fees
        FROM payments
        WHERE "dueDate" >= ${start} AND "dueDate" <= ${end}
        GROUP BY DATE_TRUNC('month', "dueDate")
      `

  return new Map(
    rows.map((r) => {
      const key = monthKeyFromDb(r.month)
      return [key, { key, gross: r.gross, fees: r.fees }]
    }),
  )
}

// ─── Origem ───────────────────────────────────────────────────────────────────

export type RevenueOrigin = "PACOTE" | "TURMA" | "AULAO" | "AVULSO"

export const ORIGIN_LABEL: Record<RevenueOrigin, string> = {
  PACOTE: "Pacotes de aula",
  TURMA:  "Turmas / acompanhamento",
  AULAO:  "Aulões e aulas em grupo",
  AVULSO: "Cobranças avulsas",
}

export const ORIGIN_COLOR: Record<RevenueOrigin, string> = {
  PACOTE: "#FB8500",
  TURMA:  "#219EBC",
  AULAO:  "#8b5cf6",
  AVULSO: "#94a3b8",
}

/**
 * Receita por origem.
 *
 * Pacote e turma têm FK (`packageId` / `courseId`). Aulão **não tem**: a cobrança
 * criada em `aulao.ts` nasce solta, e o único vínculo é o texto da descrição
 * ("Aulão – …" / "Aula em grupo – …"). Daí o casamento por texto abaixo — se
 * algum dia a Payment ganhar `lessonId`, é este CASE que some.
 */
export async function getRevenueByOrigin(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<{ origin: RevenueOrigin; total: number; count: number }[]>`
    SELECT CASE
             WHEN "packageId" IS NOT NULL THEN 'PACOTE'
             WHEN "courseId"  IS NOT NULL THEN 'TURMA'
             WHEN description ILIKE 'aulão%' OR description ILIKE 'aula em grupo%' THEN 'AULAO'
             ELSE 'AVULSO'
           END                                     AS origin,
           COALESCE(SUM(amount), 0)::float8        AS total,
           COUNT(*)::int                           AS count
    FROM payments
    WHERE status = 'PAID' AND "paidAt" IS NOT NULL
      AND "paidAt" >= ${start} AND "paidAt" <= ${end}
    GROUP BY 1
  `
  return rows.sort((a, b) => b.total - a.total)
}

// ─── Método de pagamento ──────────────────────────────────────────────────────

export interface RevenueByMethod {
  method:      string
  total:       number
  fees:        number
  count:       number
  /** Taxa efetiva: quanto por cento do recebido evaporou em taxa. */
  effectivePct: number
}

/**
 * Receita por método, com a taxa efetiva de cada um — o número que responde
 * "quanto me custa aceitar boleto em vez de Pix".
 */
export async function getRevenueByMethod(start: Date, end: Date): Promise<RevenueByMethod[]> {
  const rows = await prisma.$queryRaw<{
    method: string | null; total: number; fees: number; count: number
  }[]>`
    SELECT COALESCE(NULLIF(TRIM(method), ''), 'Não informado') AS method,
           COALESCE(SUM(amount), 0)::float8                    AS total,
           COALESCE(SUM("feeAmount"), 0)::float8               AS fees,
           COUNT(*)::int                                       AS count
    FROM payments
    WHERE status = 'PAID' AND "paidAt" IS NOT NULL
      AND "paidAt" >= ${start} AND "paidAt" <= ${end}
    GROUP BY 1
  `
  return rows
    .map((r) => ({
      method:       r.method ?? "Não informado",
      total:        r.total,
      fees:         r.fees,
      count:        r.count,
      effectivePct: r.total > 0 ? (r.fees / r.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

// ─── Alunos que mais pagam ────────────────────────────────────────────────────

export interface StudentRevenue {
  studentId: string
  name:      string
  ra:        string
  total:     number
  count:     number
}

export async function getTopStudentsByRevenue(start: Date, end: Date, take = 10) {
  return prisma.$queryRaw<StudentRevenue[]>`
    SELECT s.id                              AS "studentId",
           s.name                            AS name,
           s.ra                              AS ra,
           COALESCE(SUM(p.amount), 0)::float8 AS total,
           COUNT(*)::int                     AS count
    FROM payments p
    JOIN students s ON s.id = p."studentId"
    WHERE p.status = 'PAID' AND p."paidAt" IS NOT NULL
      AND p."paidAt" >= ${start} AND p."paidAt" <= ${end}
    GROUP BY s.id, s.name, s.ra
    ORDER BY total DESC
    LIMIT ${take}
  `
}

/**
 * Concentração de receita: que fatia do faturamento vem dos N maiores alunos.
 * Acima de ~40% nos 5 maiores, perder um único aluno já dói no mês.
 */
export function concentration(top: StudentRevenue[], totalRevenue: number, n = 5): number {
  if (totalRevenue <= 0) return 0
  const slice = top.slice(0, n).reduce((s, r) => s + r.total, 0)
  return (slice / totalRevenue) * 100
}

// ─── Passivo de aulas (receita diferida) ──────────────────────────────────────

export interface DeferredRevenue {
  /** Créditos comprados e ainda não usados, avaliados ao preço de compra. */
  total:    number
  lessons:  number
  students: number
}

/**
 * Quanto do dinheiro já recebido ainda é dívida de aula.
 *
 * É o número que a dona precisa ver antes de comemorar um mês forte de vendas:
 * um pacote vendido é caixa hoje, mas também obrigação de entregar aula depois
 * (e de pagar o professor por ela).
 */
export async function getDeferredRevenue(): Promise<DeferredRevenue> {
  const [row] = await prisma.$queryRaw<{
    total: number; lessons: number; students: number
  }[]>`
    SELECT COALESCE(SUM("remainingLessons" * "pricePerLesson"), 0)::float8 AS total,
           COALESCE(SUM("remainingLessons"), 0)::float8                    AS lessons,
           COUNT(DISTINCT "studentId")::int                                AS students
    FROM lesson_packages
    WHERE status = 'ACTIVE' AND "remainingLessons" > 0
  `
  return {
    total:    row?.total ?? 0,
    lessons:  row?.lessons ?? 0,
    students: row?.students ?? 0,
  }
}

// ─── Pacotes ──────────────────────────────────────────────────────────────────

/** Ticket médio e volume de pacotes vendidos no período (por data de compra). */
export async function getPackageSales(start: Date, end: Date) {
  const [row] = await prisma.$queryRaw<{
    count: number; value: number; lessons: number
  }[]>`
    SELECT COUNT(*)::int                                                AS count,
           COALESCE(SUM("totalLessons" * "pricePerLesson"), 0)::float8  AS value,
           COALESCE(SUM("totalLessons"), 0)::float8                     AS lessons
    FROM lesson_packages
    WHERE "purchaseDate" >= ${start} AND "purchaseDate" <= ${end}
  `
  const count = row?.count ?? 0
  const value = row?.value ?? 0
  return {
    count,
    value,
    lessons:     row?.lessons ?? 0,
    avgTicket:   count > 0 ? value / count : 0,
    avgPerLesson: (row?.lessons ?? 0) > 0 ? value / (row?.lessons ?? 1) : 0,
  }
}
