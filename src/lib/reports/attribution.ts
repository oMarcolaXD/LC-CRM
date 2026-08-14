// Atribuição de receita a uma aula.
//
// ── Por que é heurística ──────────────────────────────────────────────────────
// `Payment` não tem `lessonId`. Uma cobrança aponta no máximo para um pacote
// (`packageId`) ou uma turma (`courseId`) — e a do aulão não aponta para nada.
// Logo, "quanto esta aula faturou" não existe no banco: precisa ser estimado.
//
// A regra, em ordem de confiança:
//   1. `priceOverride`  → preço explícito por aluno (aulão / aula avulsa)
//   2. turma            → valor do contrato ÷ nº de aulas da turma, por aluno
//   3. pacote           → preço/aula do pacote mais recente do aluno × horas
//   4. nada disso       → 0 (aula de cortesia, reposição, compromisso)
//
// O total atribuído NÃO fecha com a receita de caixa e não deve: caixa é quando
// o dinheiro entrou, atribuição é qual aula o gerou. Serve para comparar
// professores, matérias e modalidades entre si — nunca para somar como receita.
//
// COMPROMISSO fica de fora: não é aula, não fatura.

import { prisma } from "@/lib/prisma"

const LESSON_VALUE_CTE = `
  WITH lesson_value AS (
    SELECT
      l.id                                                      AS lesson_id,
      l."teacherId"                                             AS teacher_id,
      l."subjectId"                                             AS subject_id,
      l."scheduledAt"                                           AS scheduled_at,
      l.duration                                                AS duration,
      l.modality::text                                          AS modality,
      l."lessonType"::text                                      AS lesson_type,
      COUNT(p."studentId")::int                                 AS participants,
      COALESCE(SUM(
        CASE
          -- Aula sem nenhum aluno inscrito não fatura, mesmo tendo preço.
          WHEN p."studentId" IS NULL         THEN NULL
          WHEN l."priceOverride" IS NOT NULL THEN l."priceOverride"
          WHEN l."courseId" IS NOT NULL
            THEN COALESCE(c."pricePerStudent", 0) / NULLIF(cl.total, 0)
          ELSE COALESCE(pkg."pricePerLesson", 0) * (l.duration::numeric / 60)
        END
      ), 0)::float8                                             AS revenue
    FROM lessons l
    LEFT JOIN lesson_participants p ON p."lessonId" = l.id
    LEFT JOIN courses c             ON c.id = l."courseId"
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total
      FROM lessons l2
      WHERE l2."courseId" = l."courseId" AND l2.status <> 'CANCELLED'
    ) cl ON l."courseId" IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT lp."pricePerLesson"
      FROM lesson_packages lp
      WHERE lp."studentId" = p."studentId"
        AND lp."purchaseDate" <= l."scheduledAt"
      ORDER BY lp."purchaseDate" DESC
      LIMIT 1
    ) pkg ON p."studentId" IS NOT NULL
    WHERE l.status = 'COMPLETED'
      AND l."lessonType" <> 'COMPROMISSO'
      AND l."scheduledAt" >= $1 AND l."scheduledAt" <= $2
    GROUP BY l.id, c."pricePerStudent", cl.total
  )
`

export interface AttributedRow {
  id:           string
  label:        string
  revenue:      number
  lessons:      number
  hours:        number
  participants: number
}

/** Receita atribuída e horas por professor. */
export async function getAttributedByTeacher(start: Date, end: Date) {
  return prisma.$queryRawUnsafe<AttributedRow[]>(
    `${LESSON_VALUE_CTE}
     SELECT v.teacher_id                          AS id,
            u.name                                AS label,
            SUM(v.revenue)::float8                AS revenue,
            COUNT(*)::int                         AS lessons,
            (SUM(v.duration)::float8 / 60)        AS hours,
            COALESCE(SUM(v.participants), 0)::int AS participants
     FROM lesson_value v
     JOIN teachers t ON t.id = v.teacher_id
     JOIN users    u ON u.id = t."userId"
     GROUP BY v.teacher_id, u.name
     ORDER BY revenue DESC`,
    start, end,
  )
}

/** Receita atribuída por matéria. */
export async function getAttributedBySubject(start: Date, end: Date) {
  return prisma.$queryRawUnsafe<AttributedRow[]>(
    `${LESSON_VALUE_CTE}
     SELECT COALESCE(v.subject_id, 'sem-materia') AS id,
            COALESCE(s.name, 'Sem matéria')       AS label,
            SUM(v.revenue)::float8                AS revenue,
            COUNT(*)::int                         AS lessons,
            (SUM(v.duration)::float8 / 60)        AS hours,
            COALESCE(SUM(v.participants), 0)::int AS participants
     FROM lesson_value v
     LEFT JOIN subjects s ON s.id = v.subject_id
     GROUP BY v.subject_id, s.name
     ORDER BY revenue DESC`,
    start, end,
  )
}

/** Receita atribuída por modalidade (presencial × online). */
export async function getAttributedByModality(start: Date, end: Date) {
  return prisma.$queryRawUnsafe<AttributedRow[]>(
    `${LESSON_VALUE_CTE}
     SELECT v.modality                            AS id,
            v.modality                            AS label,
            SUM(v.revenue)::float8                AS revenue,
            COUNT(*)::int                         AS lessons,
            (SUM(v.duration)::float8 / 60)        AS hours,
            COALESCE(SUM(v.participants), 0)::int AS participants
     FROM lesson_value v
     GROUP BY v.modality
     ORDER BY revenue DESC`,
    start, end,
  )
}

/** Receita atribuída por tipo de aula (individual × grupo × aulão). */
export async function getAttributedByType(start: Date, end: Date) {
  return prisma.$queryRawUnsafe<AttributedRow[]>(
    `${LESSON_VALUE_CTE}
     SELECT v.lesson_type                         AS id,
            v.lesson_type                         AS label,
            SUM(v.revenue)::float8                AS revenue,
            COUNT(*)::int                         AS lessons,
            (SUM(v.duration)::float8 / 60)        AS hours,
            COALESCE(SUM(v.participants), 0)::int AS participants
     FROM lesson_value v
     GROUP BY v.lesson_type
     ORDER BY revenue DESC`,
    start, end,
  )
}

export const MODALITY_LABEL: Record<string, string> = {
  PRESENCIAL: "Presencial",
  ONLINE:     "Online",
}

export const LESSON_TYPE_LABEL: Record<string, string> = {
  INDIVIDUAL:  "Individual",
  GROUP:       "Em grupo",
  AULAO:       "Aulão",
  COMPROMISSO: "Compromisso",
}
