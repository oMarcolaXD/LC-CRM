/**
 * Auditoria de contagem de aulas — SOMENTE LEITURA.
 *
 * Não escreve nada. Roda um SELECT em cima do banco apontado pelas variáveis de
 * ambiente e compara o que está GRAVADO com o que a regra do sistema diz que
 * DEVERIA estar lá. É a ferramenta para conferir a contagem manual sem ter que
 * abrir tela por tela.
 *
 * A regra (ver src/lib/lessons.ts):
 *   • A unidade é a HORA-AULA: uma aula de 2h são 2 aulas, uma de 30min é 0,5.
 *   • Só INDIVIDUAL e GROUP saem do pacote. AULÃO é cobrança avulsa e
 *     COMPROMISSO não é aula.
 *   • Aula CANCELLED é estornada; MISSED (falta) consome o saldo.
 *   • Repasse do professor = Σ hora-aula × taxa vigente NA DATA da aula,
 *     e aí AULÃO e COMPROMISSO entram (ver src/lib/reports/costs.ts).
 *
 * Uso (Git Bash), carregando o env na mão porque dotenv-cli não está instalado:
 *
 *   # banco de DEV
 *   export $(grep -E "^(DATABASE_URL|DIRECT_URL)=" .env.local | sed 's/"//g' | xargs -d '\n')
 *   npx tsx scripts/auditar-contagem.ts
 *
 *   # PRODUÇÃO (leitura apenas)
 *   export $(grep -E "^(DATABASE_URL|DIRECT_URL)=" .env.production.local | sed 's/"//g' | xargs -d '\n')
 *   npx tsx scripts/auditar-contagem.ts
 *
 * Filtros opcionais:
 *   npx tsx scripts/auditar-contagem.ts --aluno "Maria"
 *   npx tsx scripts/auditar-contagem.ts --mes 2026-08
 *   npx tsx scripts/auditar-contagem.ts --tudo     (lista também quem está OK)
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ─── Helpers ──────────────────────────────────────────────────────────────────

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const has = (flag: string) => process.argv.includes(flag)

/** "1" · "1,5" · "8" — mesma formatação das telas (fmtAulas). */
const fmt = (n: number) =>
  Math.abs(n % 1) < 1e-9 ? String(Math.round(n)) : n.toFixed(1).replace(".", ",")

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n))
const padL = (s: string, n: number) => s.padStart(n)

/** Diferença relevante? Decimal(5,1) no banco, então 0,05 já é ruído. */
const difere = (a: number, b: number) => Math.abs(a - b) > 0.051

function titulo(t: string) {
  console.log("\n" + "═".repeat(78))
  console.log("  " + t)
  console.log("═".repeat(78))
}

// ─── 1. Saldo de pacote por aluno ─────────────────────────────────────────────

async function auditarPacotes(filtroAluno?: string, verTudo = false) {
  titulo("1. SALDO DE PACOTE  —  gravado vs. consumido")
  console.log(
    "  esperado = Σ(aulas compradas) − Σ(hora-aula das aulas de pacote não canceladas)\n" +
    "  aulão e compromisso NÃO entram; falta (MISSED) consome.\n",
  )

  const alunos = await prisma.student.findMany({
    where:  filtroAluno ? { name: { contains: filtroAluno, mode: "insensitive" } } : undefined,
    select: {
      id: true, name: true,
      packages: { select: { totalLessons: true, remainingLessons: true } },
    },
    orderBy: { name: "asc" },
  })

  if (alunos.length === 0) { console.log("  Nenhum aluno encontrado."); return }

  // Consumo em hora-aula, por aluno, só de aula que sai do pacote.
  const consumo = await prisma.$queryRaw<{ studentId: string; minutos: number }[]>`
    SELECT lp."studentId"                      AS "studentId",
           COALESCE(SUM(l.duration), 0)::int   AS minutos
    FROM "lesson_participants" lp
    JOIN "lessons" l ON l.id = lp."lessonId"
    WHERE l."lessonType" IN ('INDIVIDUAL', 'GROUP')
      AND l.status <> 'CANCELLED'
    GROUP BY lp."studentId"
  `
  const consumoDe = new Map(consumo.map(r => [r.studentId, r.minutos / 60]))

  console.log(
    "  " + pad("ALUNO", 28) + padL("COMPRADAS", 10) + padL("USADAS", 9) +
    padL("ESPERADO", 10) + padL("GRAVADO", 9) + padL("DIF", 8),
  )
  console.log("  " + "─".repeat(74))

  let divergentes = 0, somaDif = 0
  for (const a of alunos) {
    if (a.packages.length === 0) continue
    const compradas = a.packages.reduce((s, p) => s + Number(p.totalLessons), 0)
    const gravado   = a.packages.reduce((s, p) => s + Number(p.remainingLessons), 0)
    const usadas    = consumoDe.get(a.id) ?? 0
    const esperado  = compradas - usadas
    const dif       = gravado - esperado

    const ok = !difere(gravado, esperado)
    if (ok && !verTudo) continue
    if (!ok) { divergentes++; somaDif += dif }

    console.log(
      "  " + pad(a.name, 28) + padL(fmt(compradas), 10) + padL(fmt(usadas), 9) +
      padL(fmt(esperado), 10) + padL(fmt(gravado), 9) +
      padL(ok ? "ok" : (dif > 0 ? "+" : "") + fmt(dif), 8),
    )
  }

  console.log("  " + "─".repeat(74))
  if (divergentes === 0) {
    console.log("  ✔ Todos os saldos batem com o consumo.")
  } else {
    console.log(`  ⚠ ${divergentes} aluno(s) com saldo divergente · soma das diferenças: ${fmt(somaDif)} aulas`)
    console.log(
      "\n  Diferença POSITIVA = saldo gravado maior que o devido (aluno tem crédito a mais).\n" +
      "  Diferença NEGATIVA = saldo gravado menor (aluno foi debitado a mais).\n" +
      "  Causas conhecidas: pacote editado à mão em Financeiro, aula registrada\n" +
      "  fora do fluxo, ou débito antigo de 1 aula fixa numa aula de outra duração.",
    )
  }
}

// ─── 2. Repasse do professor ──────────────────────────────────────────────────

async function auditarRepasses(mes?: string) {
  titulo("2. REPASSE DO PROFESSOR  —  gravado vs. recalculado")
  console.log(
    "  recalculado = Σ hora-aula × taxa vigente na DATA da aula (regra de computePayout).\n" +
    "  Aulão e compromisso ENTRAM aqui — é o que define o pagamento.\n",
  )

  const payouts = await prisma.teacherPayout.findMany({
    where:   mes ? { year: Number(mes.slice(0, 4)), month: Number(mes.slice(5, 7)) } : undefined,
    include: { teacher: { include: { user: { select: { name: true } } } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  })

  if (payouts.length === 0) {
    console.log(mes ? `  Nenhum repasse registrado em ${mes}.` : "  Nenhum repasse registrado.")
    return
  }

  const rates = await prisma.teacherRate.findMany({
    select:  { teacherId: true, hourlyRate: true, effectiveFrom: true },
    orderBy: { effectiveFrom: "desc" },
  })
  const faixasDe = new Map<string, { hourlyRate: number; effectiveFrom: Date }[]>()
  for (const r of rates) {
    const l = faixasDe.get(r.teacherId) ?? []
    l.push({ hourlyRate: Number(r.hourlyRate), effectiveFrom: r.effectiveFrom })
    faixasDe.set(r.teacherId, l)
  }

  console.log(
    "  " + pad("PROFESSOR", 22) + pad("MÊS", 9) + padL("AULAS", 7) + padL("A.CALC", 8) +
    padL("GRAVADO", 13) + padL("RECALC", 13) + padL("DIF", 11),
  )
  console.log("  " + "─".repeat(83))

  let divergentes = 0, somaDif = 0
  for (const p of payouts) {
    const start = new Date(p.year, p.month - 1, 1)
    const end   = new Date(p.year, p.month, 0, 23, 59, 59)

    const lessons = await prisma.lesson.findMany({
      where:  { teacherId: p.teacherId, status: "COMPLETED", scheduledAt: { gte: start, lte: end } },
      select: { duration: true, scheduledAt: true },
    })

    const faixas   = faixasDe.get(p.teacherId)
    const fallback = Number(p.teacher.hourlyRate)
    const aulas    = lessons.reduce((s, l) => s + l.duration / 60, 0)
    const valor    = lessons.reduce((s, l) => {
      const w = faixas?.find(f => f.effectiveFrom <= l.scheduledAt)
      return s + (l.duration / 60) * (w ? w.hourlyRate : fallback)
    }, 0)

    const gravadoAulas = Number(p.totalLessons)
    const gravadoValor = Number(p.totalAmount)
    const dif          = gravadoValor - valor
    const ok           = Math.abs(dif) < 0.01 && !difere(gravadoAulas, aulas)
    if (ok) continue

    divergentes++; somaDif += dif
    console.log(
      "  " + pad(p.teacher.user.name, 22) +
      pad(`${String(p.month).padStart(2, "0")}/${p.year}`, 9) +
      padL(fmt(gravadoAulas), 7) + padL(fmt(aulas), 8) +
      padL(brl(gravadoValor), 13) + padL(brl(valor), 13) +
      padL((dif > 0 ? "+" : "") + brl(dif), 11),
    )
  }

  console.log("  " + "─".repeat(83))
  if (divergentes === 0) {
    console.log(`  ✔ Os ${payouts.length} repasse(s) registrados batem com o recálculo.`)
  } else {
    console.log(`  ⚠ ${divergentes} repasse(s) divergentes · diferença total: ${brl(somaDif)}`)
    console.log(
      "\n  Repasse já PAGO congela o valor de propósito (é o que saiu do caixa).\n" +
      "  Divergência aqui costuma significar: aula lançada/editada depois do\n" +
      "  fechamento, ou repasse ajustado à mão.",
    )
  }
}

// ─── 3. Higiene dos dados de aula ─────────────────────────────────────────────

async function auditarAulas(mes?: string) {
  titulo("3. HIGIENE DOS DADOS DE AULA")

  const where = mes
    ? { scheduledAt: { gte: new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1),
                       lte: new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0, 23, 59, 59) } }
    : {}

  const porTipo = await prisma.lesson.groupBy({
    by: ["lessonType"], where, _count: { _all: true }, _sum: { duration: true },
  })

  console.log("\n  Volume por tipo:")
  console.log("  " + pad("TIPO", 16) + padL("LINHAS", 9) + padL("HORA-AULA", 12) + "   conta no…")
  console.log("  " + "─".repeat(64))
  const destino: Record<string, string> = {
    INDIVIDUAL:  "pacote + repasse",
    GROUP:       "pacote + repasse",
    AULAO:       "repasse (avulso p/ aluno)",
    COMPROMISSO: "só repasse",
  }
  for (const t of porTipo) {
    console.log(
      "  " + pad(t.lessonType, 16) + padL(String(t._count._all), 9) +
      padL(fmt((t._sum.duration ?? 0) / 60), 12) + "   " + (destino[t.lessonType] ?? "—"),
    )
  }

  // Durações fora do padrão: onde linha ≠ hora-aula.
  const durs = await prisma.lesson.groupBy({
    by: ["duration"], where, _count: { _all: true }, orderBy: { duration: "asc" },
  })
  const naoUnitarias = durs.filter(d => d.duration !== 60)
  console.log("\n  Durações registradas:")
  for (const d of durs) {
    const marca = d.duration === 60 ? "" : `   ← ${fmt(d.duration / 60)} aula por linha`
    console.log(`    ${padL(String(d.duration), 4)} min · ${padL(String(d._count._all), 5)} aula(s)${marca}`)
  }
  if (naoUnitarias.length === 0) {
    console.log("\n  ℹ Todas as aulas têm 60 min — contar linhas e contar hora-aula dá o mesmo")
    console.log("    número neste recorte. As correções só mudam algo quando houver aula")
    console.log("    de outra duração.")
  } else {
    const linhas = naoUnitarias.reduce((s, d) => s + d._count._all, 0)
    const horas  = naoUnitarias.reduce((s, d) => s + (d.duration / 60) * d._count._all, 0)
    console.log(`\n  ⚠ ${linhas} aula(s) fora de 60 min = ${fmt(horas)} hora-aula.`)
    console.log(`    Contar linhas subestimaria em ${fmt(horas - linhas)} aula(s) neste recorte.`)
  }

  // Aulas sem participante: não debitam ninguém e somem da ficha do aluno.
  const orfas = await prisma.lesson.count({
    where: { ...where, lessonType: { in: ["INDIVIDUAL", "GROUP"] }, participants: { none: {} } },
  })
  if (orfas > 0) {
    console.log(`\n  ⚠ ${orfas} aula(s) INDIVIDUAL/GROUP sem nenhum participante.`)
    console.log("    Elas contam para o professor mas não aparecem na ficha de aluno nenhum.")
  }

  // Saldo negativo: overdraft que passou pelo débito.
  const negativos = await prisma.lessonPackage.count({ where: { remainingLessons: { lt: 0 } } })
  if (negativos > 0) {
    console.log(`\n  ⚠ ${negativos} pacote(s) com saldo negativo.`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const alvo = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "")
    .replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@")
  console.log("\nBANCO: " + (alvo || "(env não carregado — veja o cabeçalho do arquivo)"))
  console.log("MODO:  somente leitura — este script não escreve nada.")

  if (!alvo) { process.exitCode = 1; return }

  const aluno = arg("--aluno")
  const mes   = arg("--mes")
  if (mes && !/^\d{4}-\d{2}$/.test(mes)) {
    console.error("\n--mes precisa estar no formato AAAA-MM (ex.: 2026-08)")
    process.exitCode = 1
    return
  }
  if (mes) console.log("MÊS:   " + mes)

  await auditarPacotes(aluno, has("--tudo"))
  await auditarRepasses(mes)
  await auditarAulas(mes)

  console.log("\n" + "═".repeat(78))
  console.log("  Fim. Nada foi alterado.")
  console.log("═".repeat(78) + "\n")
}

main()
  .catch((e) => { console.error("\nFalhou:", e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
