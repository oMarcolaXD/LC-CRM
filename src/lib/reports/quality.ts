// Qualidade dos dados: o que está inconsistente na base e custa dinheiro.
//
// Ao contrário das outras abas, esta NÃO respeita o filtro de período — um
// pacote sem cobrança de março continua sendo um problema em agosto. Auditoria
// olha a base inteira, senão o problema some ao trocar o filtro.
//
// Cada verificação responde três coisas: o que está errado, por que importa em
// reais, e onde resolver. Uma verificação que não leva a uma ação não entra.

import { prisma } from "@/lib/prisma"
import { startOfDay } from "date-fns"

export type Severity = "critico" | "atencao" | "info"

export interface QualityItem {
  label:  string
  detail: string
  href?:  string
  amount?: number
}

export interface QualityCheck {
  id:       string
  severity: Severity
  title:    string
  /** Por que isso importa — em dinheiro, sempre que der. */
  why:      string
  count:    number
  /** Valor envolvido, quando a inconsistência tem preço. */
  amount?:  number
  /** Unidade do count, para a frase ficar natural ("3 aulas", "2 alunos"). */
  unit:     [string, string]
  items:    QualityItem[]
  /** Frase quando está tudo certo. */
  ok:       string
}

export interface QualityReport {
  checks:    QualityCheck[]
  critical:  number
  warning:   number
  /** Total em reais em jogo nas verificações críticas e de atenção. */
  atRisk:    number
  /** Verificações que passaram limpas. */
  clean:     number
}

const SAMPLE = 8

/**
 * Data em que `Payment.packageId` passou a existir
 * (migration 20260712120000_link_payment_to_package). Pacote anterior a isto
 * não tinha como apontar para a cobrança, então a ausência do vínculo é
 * histórico, não erro.
 */
const PACKAGE_LINK_SINCE = new Date("2026-07-12T00:00:00.000Z")

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string): string {
  const v = d instanceof Date ? d : new Date(d)
  return v.toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

const AULAS: [string, string] = ["aula", "aulas"]

// ─── Relatório ────────────────────────────────────────────────────────────────

export async function getQualityReport(now: Date): Promise<QualityReport> {
  const today = startOfDay(now)

  const [
    semReceita, duplicadas, pacotesSemCobranca, semValorHora, conflitos,
    horaDobrada, naoFechadas, vencidasPendentes, pacotesDesatualizados,
    semMetodo, semMateria, alunosDuplicados, aulasSemAluno,
  ] = await Promise.all([
    checkAulasSemReceita(),
    checkCobrancasDuplicadas(),
    checkPacotesSemCobranca(),
    checkProfessoresSemValorHora(),
    checkConflitosDeAgenda(),
    checkHoraPagaEmDobro(),
    checkAulasNaoFechadas(today),
    checkVencidasPendentes(today),
    checkPacotesDesatualizados(today),
    checkPagamentosSemMetodo(),
    checkAulasSemMateria(),
    checkAlunosDuplicados(),
    checkAulasSemAluno(),
  ])

  const checks = [
    semReceita, duplicadas, pacotesSemCobranca, semValorHora, conflitos,
    horaDobrada, naoFechadas, vencidasPendentes, pacotesDesatualizados,
    semMetodo, semMateria, alunosDuplicados, aulasSemAluno,
  ]

  // Problemas primeiro, do mais grave ao mais leve; limpos vão para o fim.
  const rank: Record<Severity, number> = { critico: 0, atencao: 1, info: 2 }
  checks.sort((a, b) => {
    if ((a.count === 0) !== (b.count === 0)) return a.count === 0 ? 1 : -1
    if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity]
    return b.count - a.count
  })

  return {
    checks,
    critical: checks.filter((c) => c.severity === "critico" && c.count > 0).length,
    warning:  checks.filter((c) => c.severity === "atencao" && c.count > 0).length,
    atRisk:   checks
      .filter((c) => c.severity !== "info")
      .reduce((s, c) => s + (c.amount ?? 0), 0),
    clean:    checks.filter((c) => c.count === 0).length,
  }
}

/**
 * Versão enxuta para o painel inicial — só as contagens, sem as amostras.
 *
 * A aba Qualidade só ajuda quem lembra de abri-la. Este resumo aparece no
 * dashboard todo dia, com o valor em jogo e um atalho, para que problema novo
 * não fique meses invisível como os R$ 15,6 mil vencidos que ninguém via.
 */
export async function getQualitySummary(now: Date): Promise<{
  critical: number
  warning:  number
  atRisk:   number
  /** Os títulos dos problemas mais graves, para a frase do card. */
  top:      { title: string; count: number; unit: string; severity: Severity }[]
}> {
  const r = await getQualityReport(now)
  return {
    critical: r.critical,
    warning:  r.warning,
    atRisk:   r.atRisk,
    top: r.checks
      .filter((c) => c.count > 0 && c.severity !== "info")
      .slice(0, 3)
      .map((c) => ({
        title:    c.title,
        count:    c.count,
        unit:     c.count === 1 ? c.unit[0] : c.unit[1],
        severity: c.severity,
      })),
  }
}

// ─── 1. Aulas realizadas que não geraram receita ──────────────────────────────

async function checkAulasSemReceita(): Promise<QualityCheck> {
  // Sem priceOverride, sem contrato de turma com valor e sem nenhum pacote do
  // aluno anterior à aula: não existe de onde tirar o preço. O professor foi
  // pago, o aluno teve aula, e nada entrou.
  const rows = await prisma.$queryRaw<{
    id: string; scheduledAt: Date; teacher: string; subject: string
    students: string | null; cost: number
  }[]>`
    SELECT l.id                                             AS id,
           l."scheduledAt"                                  AS "scheduledAt",
           u.name                                           AS teacher,
           COALESCE(s.name, 'sem matéria')                  AS subject,
           STRING_AGG(DISTINCT st.name, ', ')               AS students,
           ((l.duration::float8 / 60) * t."hourlyRate"::float8) AS cost
    FROM lessons l
    JOIN teachers t                  ON t.id = l."teacherId"
    JOIN users u                     ON u.id = t."userId"
    LEFT JOIN subjects s             ON s.id = l."subjectId"
    LEFT JOIN courses c              ON c.id = l."courseId"
    LEFT JOIN lesson_participants lp ON lp."lessonId" = l.id
    LEFT JOIN students st            ON st.id = lp."studentId"
    WHERE l.status = 'COMPLETED'
      AND l."lessonType" <> 'COMPROMISSO'
      AND l."priceOverride" IS NULL
      AND (l."courseId" IS NULL OR COALESCE(c."pricePerStudent", 0) = 0)
      -- Sem exigir que o pacote seja anterior à aula: aqui a pergunta é se
      -- existe QUALQUER preço para esse aluno. Lançar o pacote depois de dar as
      -- aulas é rotina na escola e não é erro — erro é não haver preço nenhum.
      AND NOT EXISTS (
        SELECT 1
        FROM lesson_participants lp2
        JOIN lesson_packages pk
          ON pk."studentId" = lp2."studentId"
         AND pk."pricePerLesson" > 0
        WHERE lp2."lessonId" = l.id
      )
    GROUP BY l.id, l."scheduledAt", l.duration, u.name, s.name, t."hourlyRate"
    ORDER BY l."scheduledAt" DESC
  `

  const cost = rows.reduce((s, r) => s + r.cost, 0)

  return {
    id: "aulas-sem-receita",
    severity: "critico",
    title: "Aulas realizadas que não geraram receita",
    why: "Não há preço em lugar nenhum para essas aulas: nem valor do aulão, nem contrato de turma, nem pacote do aluno na data. O professor foi pago e nada entrou — é prejuízo direto.",
    count: rows.length,
    amount: cost,
    unit: AULAS,
    ok: "Toda aula realizada tem de onde tirar o preço.",
    items: rows.slice(0, SAMPLE).map((r) => ({
      label:  r.students || "sem aluno vinculado",
      detail: `${fmtDate(r.scheduledAt)} · ${r.subject} · ${r.teacher}`,
      amount: r.cost,
      href:   "/admin/agenda",
    })),
  }
}

// ─── 2. Cobranças duplicadas ──────────────────────────────────────────────────

async function checkCobrancasDuplicadas(): Promise<QualityCheck> {
  // Mesmo aluno, mesmo valor, mesmo vencimento, mais de uma linha. Parcelamento
  // legítimo tem vencimentos diferentes, então não cai aqui.
  const rows = await prisma.$queryRaw<{
    name: string; ra: string; amount: number; dueDate: Date; n: number; excess: number
  }[]>`
    SELECT s.name                                   AS name,
           s.ra                                     AS ra,
           p.amount::float8                         AS amount,
           p."dueDate"                              AS "dueDate",
           COUNT(*)::int                            AS n,
           ((COUNT(*) - 1) * p.amount)::float8      AS excess
    FROM payments p
    JOIN students s ON s.id = p."studentId"
    GROUP BY p."studentId", s.name, s.ra, p.amount, p."dueDate"
    HAVING COUNT(*) > 1
    ORDER BY excess DESC
  `

  const excess = rows.reduce((s, r) => s + r.excess, 0)

  return {
    id: "cobrancas-duplicadas",
    severity: "critico",
    title: "Cobranças possivelmente duplicadas",
    why: "Mesmo aluno, mesmo valor e mesmo vencimento aparecendo mais de uma vez. Ou a família foi cobrada em dobro, ou o faturamento está inflado por um lançamento repetido.",
    count: rows.length,
    amount: excess,
    unit: ["grupo de cobranças", "grupos de cobranças"],
    ok: "Nenhuma cobrança repetida.",
    items: rows.slice(0, SAMPLE).map((r) => ({
      label:  r.name,
      detail: `${r.n}× de R$ ${r.amount.toFixed(2).replace(".", ",")} vencendo em ${fmtDate(r.dueDate)} · RA ${r.ra}`,
      amount: r.excess,
      href:   "/admin/financeiro/pagamentos",
    })),
  }
}

// ─── 3. Pacotes sem cobrança vinculada ────────────────────────────────────────

async function checkPacotesSemCobranca(): Promise<QualityCheck> {
  const rows = await prisma.$queryRaw<{
    id: string; name: string; ra: string; purchaseDate: Date; value: number; lessons: number
  }[]>`
    SELECT lp.id                                                  AS id,
           s.name                                                 AS name,
           s.ra                                                   AS ra,
           lp."purchaseDate"                                      AS "purchaseDate",
           (lp."totalLessons" * lp."pricePerLesson")::float8       AS value,
           lp."totalLessons"::float8                              AS lessons
    FROM lesson_packages lp
    JOIN students s ON s.id = lp."studentId"
    WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p."packageId" = lp.id)
      AND lp."pricePerLesson" > 0
      -- Só pacotes posteriores ao dia em que o vínculo cobrança↔pacote passou a
      -- existir (migration 20260712120000_link_payment_to_package). Antes disso
      -- a cobrança nascia solta por construção; apontar isso como erro seria
      -- acusar 100% do histórico e enterrar os casos que realmente importam.
      AND lp."purchaseDate" >= ${PACKAGE_LINK_SINCE}
    ORDER BY value DESC
  `

  const value = rows.reduce((s, r) => s + r.value, 0)

  return {
    id: "pacotes-sem-cobranca",
    severity: "critico",
    title: "Pacotes vendidos sem cobrança vinculada",
    why: "O aluno tem crédito de aula, mas não existe cobrança ligada ao pacote. Ou alguém esqueceu de lançar a cobrança, ou o pagamento foi registrado solto e o relatório não consegue ligar a receita à venda. Conta só pacotes de 12/07/2026 em diante — antes disso o sistema não tinha o vínculo.",
    count: rows.length,
    amount: value,
    unit: ["pacote", "pacotes"],
    ok: "Todo pacote com preço tem cobrança vinculada.",
    items: rows.slice(0, SAMPLE).map((r) => ({
      label:  r.name,
      detail: `${r.lessons.toFixed(1).replace(".0", "").replace(".", ",")} aulas compradas em ${fmtDate(r.purchaseDate)} · RA ${r.ra}`,
      amount: r.value,
      href:   `/admin/financeiro/alunos`,
    })),
  }
}

// ─── 4. Professores sem valor/hora ────────────────────────────────────────────

async function checkProfessoresSemValorHora(): Promise<QualityCheck> {
  const rows = await prisma.$queryRaw<{
    id: string; name: string; lessons: number; hours: number
  }[]>`
    SELECT t.id                                  AS id,
           u.name                                AS name,
           COUNT(l.id)::int                      AS lessons,
           COALESCE(SUM(l.duration), 0)::float8 / 60 AS hours
    FROM teachers t
    JOIN users u   ON u.id = t."userId"
    LEFT JOIN lessons l ON l."teacherId" = t.id AND l.status = 'COMPLETED'
    WHERE COALESCE(t."hourlyRate", 0) = 0
    GROUP BY t.id, u.name
    HAVING COUNT(l.id) > 0
    ORDER BY hours DESC
  `

  return {
    id: "professor-sem-valor-hora",
    severity: "critico",
    title: "Professores sem valor/hora cadastrado",
    why: "O custo desses professores entra como zero em todo lugar — DRE, margem, ponto de equilíbrio. O lucro que o sistema mostra está maior do que o real enquanto isso não for preenchido.",
    count: rows.length,
    unit: ["professor", "professores"],
    ok: "Todo professor com aula tem valor/hora definido.",
    items: rows.slice(0, SAMPLE).map((r) => ({
      label:  r.name,
      detail: `${r.lessons} aulas realizadas · ${r.hours.toFixed(1).replace(".", ",")} h contadas com custo zero`,
      href:   `/admin/professores/${r.id}`,
    })),
  }
}

// ─── 5. Conflitos de agenda ───────────────────────────────────────────────────

/**
 * SQL comum dos dois checks de sobreposição.
 *
 * Só conta o que bloqueia agenda — anotação (`blocksAgenda = false`) existe
 * justamente para não disputar horário. `b.id > a.id` evita contar o par duas
 * vezes. `overlap` é o tempo em minutos que as duas aulas dividem.
 */
const OVERLAP_SQL = `
  FROM lessons a
  JOIN lessons b
    ON b."teacherId" = a."teacherId"
   AND b.id > a.id
   AND a."scheduledAt" <  b."scheduledAt" + make_interval(mins => b.duration)
   AND b."scheduledAt" <  a."scheduledAt" + make_interval(mins => a.duration)
  JOIN teachers t ON t.id = a."teacherId"
  JOIN users u    ON u.id = t."userId"
  WHERE a.status <> 'CANCELLED' AND b.status <> 'CANCELLED'
    AND a."blocksAgenda" AND b."blocksAgenda"
`

const OVERLAP_MIN = `
  EXTRACT(EPOCH FROM (
    LEAST(a."scheduledAt" + make_interval(mins => a.duration),
          b."scheduledAt" + make_interval(mins => b.duration))
    - GREATEST(a."scheduledAt", b."scheduledAt")
  )) / 60
`

async function checkConflitosDeAgenda(): Promise<QualityCheck> {
  // Só o que ainda vai acontecer: aula futura sobreposta dá para remarcar hoje.
  const rows = await prisma.$queryRawUnsafe<{
    teacher: string; a_at: Date; b_at: Date; a_dur: number; b_dur: number
    a_type: string; b_type: string
  }[]>(`
    SELECT u.name          AS teacher,
           a."scheduledAt" AS a_at,
           b."scheduledAt" AS b_at,
           a.duration      AS a_dur,
           b.duration      AS b_dur,
           a."lessonType"::text AS a_type,
           b."lessonType"::text AS b_type
    ${OVERLAP_SQL}
      AND a.status IN ('SCHEDULED', 'CONFIRMED')
      AND b.status IN ('SCHEDULED', 'CONFIRMED')
    ORDER BY a."scheduledAt" ASC
  `)

  return {
    id: "conflito-agenda",
    severity: "critico",
    title: "Aulas futuras marcadas no mesmo horário",
    why: "O mesmo professor está agendado em duas aulas que se sobrepõem. Uma das duas vai furar — dá para remarcar antes que o aluno apareça e não tenha professor.",
    count: rows.length,
    unit: ["conflito", "conflitos"],
    ok: "Nenhuma aula futura sobreposta.",
    items: rows.slice(0, SAMPLE).map((r) => ({
      label:  r.teacher,
      detail: `${fmtDate(r.a_at)} · ${hhmm(r.a_at)} (${r.a_dur} min, ${tipo(r.a_type)}) sobrepõe ${hhmm(r.b_at)} (${r.b_dur} min, ${tipo(r.b_type)})`,
      href:   "/admin/agenda",
    })),
  }
}

async function checkHoraPagaEmDobro(): Promise<QualityCheck> {
  // Duas aulas realizadas do mesmo professor no mesmo horário. Pode ser
  // intencional — dois irmãos atendidos juntos, lançados como duas aulas
  // individuais em vez de uma aula em grupo. Mas `computePayout` soma a duração
  // de cada aula, então a mesma hora entra duas vezes no repasse.
  const rows = await prisma.$queryRawUnsafe<{
    teacher: string; at: Date; overlap: number; cost: number; pattern: string
  }[]>(`
    SELECT u.name                                    AS teacher,
           a."scheduledAt"                           AS at,
           ${OVERLAP_MIN}                            AS overlap,
           ((${OVERLAP_MIN}) / 60 * t."hourlyRate"::float8) AS cost,
           (a."lessonType"::text || ' + ' || b."lessonType"::text) AS pattern
    ${OVERLAP_SQL}
      AND a.status = 'COMPLETED' AND b.status = 'COMPLETED'
    ORDER BY a."scheduledAt" DESC
  `)

  const cost = rows.reduce((s, r) => s + r.cost, 0)

  return {
    id: "hora-paga-em-dobro",
    severity: "atencao",
    title: "Mesma hora de professor contada duas vezes no repasse",
    why: "Duas aulas realizadas do mesmo professor no mesmo horário. Costuma ser proposital — dois irmãos atendidos juntos, lançados como duas aulas individuais em vez de uma aula em grupo. Só que o repasse soma a duração das duas, então a hora é paga em dobro. Se a intenção é pagar por aluno, está certo; se é pagar por hora dada, está saindo caro.",
    count: rows.length,
    amount: cost,
    unit: ["ocorrência", "ocorrências"],
    ok: "Nenhuma hora contada em duplicidade.",
    items: rows.slice(0, SAMPLE).map((r) => ({
      label:  r.teacher,
      detail: `${fmtDate(r.at)} · ${hhmm(r.at)} · ${Math.round(r.overlap)} min sobrepostos · ${r.pattern.toLowerCase().replace(/individual/g, "individual")}`,
      amount: r.cost,
      href:   "/admin/financeiro/professores",
    })),
  }
}

const TIPO: Record<string, string> = {
  INDIVIDUAL: "individual", GROUP: "em grupo", AULAO: "aulão", COMPROMISSO: "compromisso",
}
function tipo(t: string): string { return TIPO[t] ?? t.toLowerCase() }

function hhmm(d: Date | string): string {
  const v = d instanceof Date ? d : new Date(d)
  return v.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
}

// ─── 6. Aulas passadas ainda não fechadas ─────────────────────────────────────

async function checkAulasNaoFechadas(today: Date): Promise<QualityCheck> {
  const rows = await prisma.$queryRaw<{
    scheduledAt: Date; teacher: string; students: string | null; status: string; days: number
  }[]>`
    SELECT l."scheduledAt"                        AS "scheduledAt",
           u.name                                 AS teacher,
           STRING_AGG(DISTINCT st.name, ', ')     AS students,
           l.status::text                         AS status,
           DATE_PART('day', ${today}::timestamp - l."scheduledAt")::int AS days
    FROM lessons l
    JOIN teachers t                  ON t.id = l."teacherId"
    JOIN users u                     ON u.id = t."userId"
    LEFT JOIN lesson_participants lp ON lp."lessonId" = l.id
    LEFT JOIN students st            ON st.id = lp."studentId"
    WHERE l.status IN ('SCHEDULED', 'CONFIRMED')
      AND l."scheduledAt" < ${today}
      AND l."lessonType" <> 'COMPROMISSO'
    GROUP BY l.id, l."scheduledAt", u.name, l.status
    ORDER BY l."scheduledAt" ASC
  `

  return {
    id: "aulas-nao-fechadas",
    severity: "atencao",
    title: "Aulas passadas ainda não fechadas",
    why: "A aula já aconteceu mas continua como agendada ou confirmada. Enquanto não virar realizada ou falta, ela não entra no repasse do professor nem nas contas de aula do relatório.",
    count: rows.length,
    unit: AULAS,
    ok: "Nenhuma aula passada em aberto.",
    items: rows.slice(0, SAMPLE).map((r) => ({
      label:  r.students || "sem aluno vinculado",
      detail: `${fmtDate(r.scheduledAt)} · ${r.teacher} · ${r.days} dia${r.days !== 1 ? "s" : ""} em aberto`,
      href:   "/admin/agenda",
    })),
  }
}

// ─── 7. Vencidas ainda como pendentes ─────────────────────────────────────────

async function checkVencidasPendentes(today: Date): Promise<QualityCheck> {
  const [row] = await prisma.$queryRaw<{ n: number; total: number; oldest: number | null }[]>`
    SELECT COUNT(*)::int                                              AS n,
           COALESCE(SUM(amount), 0)::float8                           AS total,
           MAX(DATE_PART('day', ${today}::timestamp - "dueDate"))::int AS oldest
    FROM payments
    WHERE status = 'PENDING' AND "dueDate" < ${today}
  `

  const n = row?.n ?? 0

  return {
    id: "vencidas-pendentes",
    severity: "atencao",
    title: "Cobranças vencidas ainda marcadas como pendentes",
    why: "Nada no sistema muda o status para vencido sozinho. Os relatórios já contam essas cobranças como inadimplência pela data, mas as telas antigas de financeiro não — por isso o número parecia menor lá.",
    count: n,
    amount: row?.total ?? 0,
    unit: ["cobrança", "cobranças"],
    ok: "Nenhuma cobrança vencida sem o status certo.",
    items: n > 0
      ? [{
          label:  `${n} cobrança${n !== 1 ? "s" : ""} vencida${n !== 1 ? "s" : ""}`,
          detail: `A mais antiga venceu há ${row?.oldest ?? 0} dias`,
          amount: row?.total ?? 0,
          href:   "/admin/relatorios/cobranca",
        }]
      : [],
  }
}

// ─── 8. Pacotes ativos desatualizados ─────────────────────────────────────────

async function checkPacotesDesatualizados(today: Date): Promise<QualityCheck> {
  const rows = await prisma.$queryRaw<{
    name: string; ra: string; remaining: number; expiresAt: Date | null; motivo: string
  }[]>`
    SELECT s.name                        AS name,
           s.ra                          AS ra,
           lp."remainingLessons"::float8 AS remaining,
           lp."expiresAt"                AS "expiresAt",
           CASE
             WHEN lp."remainingLessons" <= 0 THEN 'saldo zerado'
             ELSE 'prazo expirado'
           END                           AS motivo
    FROM lesson_packages lp
    JOIN students s ON s.id = lp."studentId"
    WHERE lp.status = 'ACTIVE'
      AND (lp."remainingLessons" <= 0
        OR (lp."expiresAt" IS NOT NULL AND lp."expiresAt" < ${today}))
    ORDER BY lp."purchaseDate" DESC
  `

  return {
    id: "pacotes-desatualizados",
    severity: "atencao",
    title: "Pacotes ativos que já acabaram ou venceram",
    why: "Continuam contando como saldo disponível: inflam o passivo de aulas e mantêm o aluno na lista de ativos sem que ele tenha crédito de verdade.",
    count: rows.length,
    unit: ["pacote", "pacotes"],
    ok: "Nenhum pacote ativo fora do prazo ou sem saldo.",
    items: rows.slice(0, SAMPLE).map((r) => ({
      label:  r.name,
      detail: r.motivo === "saldo zerado"
        ? `saldo zerado, mas ainda marcado como ativo · RA ${r.ra}`
        : `venceu em ${r.expiresAt ? fmtDate(r.expiresAt) : "—"} com ${r.remaining.toFixed(1).replace(".", ",")} aulas de saldo · RA ${r.ra}`,
      href:   "/admin/financeiro/pacotes",
    })),
  }
}

// ─── 9. Pagamentos sem forma de pagamento ─────────────────────────────────────

async function checkPagamentosSemMetodo(): Promise<QualityCheck> {
  const [row] = await prisma.$queryRaw<{ n: number; total: number }[]>`
    SELECT COUNT(*)::int                      AS n,
           COALESCE(SUM(amount), 0)::float8   AS total
    FROM payments
    WHERE status = 'PAID'
      AND (method IS NULL OR TRIM(method) = '')
  `

  const n = row?.n ?? 0

  return {
    id: "pagamento-sem-metodo",
    severity: "atencao",
    title: "Pagamentos recebidos sem forma de pagamento",
    why: "Sem o método, o sistema não consegue calcular a taxa da maquininha. A receita líquida desses recebimentos aparece maior do que realmente caiu na conta.",
    count: n,
    amount: row?.total ?? 0,
    unit: ["cobrança", "cobranças"],
    ok: "Todo pagamento recebido tem forma de pagamento.",
    items: n > 0
      ? [{
          label:  `${n} pagamento${n !== 1 ? "s" : ""} sem método`,
          detail: "A taxa fica em R$ 0,00 e a receita líquida sai superestimada",
          amount: row?.total ?? 0,
          href:   "/admin/financeiro/pagamentos?filter=PAID",
        }]
      : [],
  }
}

// ─── 10. Aulas realizadas sem matéria ─────────────────────────────────────────

async function checkAulasSemMateria(): Promise<QualityCheck> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM lessons
    WHERE status = 'COMPLETED' AND "lessonType" <> 'COMPROMISSO' AND "subjectId" IS NULL
  `
  const n = row?.n ?? 0

  return {
    id: "aula-sem-materia",
    severity: "info",
    title: "Aulas realizadas sem matéria",
    why: "Caem em “sem matéria” nos relatórios de receita e margem por disciplina, o que distorce a comparação entre matérias.",
    count: n,
    unit: AULAS,
    ok: "Toda aula realizada tem matéria.",
    items: n > 0
      ? [{ label: `${n} aula${n !== 1 ? "s" : ""} sem matéria`, detail: "Aparecem agrupadas em “Sem matéria” nos relatórios", href: "/admin/agenda" }]
      : [],
  }
}

// ─── 11. Alunos com nome duplicado ────────────────────────────────────────────

async function checkAlunosDuplicados(): Promise<QualityCheck> {
  const rows = await prisma.$queryRaw<{ name: string; n: number; ras: string }[]>`
    SELECT MIN(s.name)                  AS name,
           COUNT(*)::int                AS n,
           STRING_AGG(s.ra, ', ')       AS ras
    FROM students s
    GROUP BY LOWER(TRIM(s.name))
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `

  return {
    id: "alunos-duplicados",
    severity: "info",
    title: "Alunos com o mesmo nome",
    why: "Pode ser homônimo legítimo, mas também pode ser o mesmo aluno cadastrado duas vezes — o que espalha pacotes, cobranças e histórico entre dois registros.",
    count: rows.length,
    unit: ["nome repetido", "nomes repetidos"],
    ok: "Nenhum nome de aluno repetido.",
    items: rows.slice(0, SAMPLE).map((r) => ({
      label:  r.name,
      detail: `${r.n} cadastros · RA ${r.ras}`,
      href:   `/admin/alunos?q=${encodeURIComponent(r.name)}`,
    })),
  }
}

// ─── 12. Aulas sem aluno vinculado ────────────────────────────────────────────

async function checkAulasSemAluno(): Promise<QualityCheck> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM lessons l
    WHERE l."lessonType" <> 'COMPROMISSO'
      AND l.status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED')
      AND NOT EXISTS (SELECT 1 FROM lesson_participants p WHERE p."lessonId" = l.id)
  `
  const n = row?.n ?? 0

  return {
    id: "aula-sem-aluno",
    severity: "info",
    title: "Aulas sem nenhum aluno vinculado",
    why: "Ocupam horário do professor e entram no repasse, mas não têm a quem cobrar. Costuma ser aula criada e nunca completada com o aluno.",
    count: n,
    unit: AULAS,
    ok: "Toda aula tem pelo menos um aluno.",
    items: n > 0
      ? [{ label: `${n} aula${n !== 1 ? "s" : ""} sem aluno`, detail: "Entram no custo do professor sem gerar receita", href: "/admin/agenda" }]
      : [],
  }
}
