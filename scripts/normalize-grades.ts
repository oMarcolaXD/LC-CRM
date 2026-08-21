/**
 * Normaliza o campo Student.grade para a grafia canônica (src/lib/constants/grades.ts).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/normalize-grades.ts --dry-run   # simula
 *   npx tsx --env-file=.env.local scripts/normalize-grades.ts             # aplica
 */
import { PrismaClient } from "@prisma/client"
import { normalizeGrade, GRADES } from "../src/lib/constants/grades"

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes("--dry-run")
const CANON = new Set(GRADES)

async function main() {
  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (nada será gravado)" : "LIVE (gravará no banco)"}\n`)

  const students = await prisma.student.findMany({
    select: { id: true, name: true, grade: true },
  })

  // Panorama dos valores atuais
  const counts = new Map<string, number>()
  for (const s of students) {
    const key = s.grade ?? "(vazio)"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  console.log("Valores de `grade` atuais no banco:")
  for (const [g, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const canon = normalizeGrade(g === "(vazio)" ? null : g)
    const flag = g === "(vazio)"
      ? ""
      : canon !== g
      ? `  → normaliza para "${canon}"`
      : CANON.has(g)
      ? "  ✓ canônico"
      : "  ⚠ fora do catálogo (mantido)"
    console.log(`  ${String(n).padStart(3)}×  "${g}"${flag}`)
  }
  console.log("")

  // Aplica normalização
  const updates = students
    .map((s) => ({ id: s.id, name: s.name, from: s.grade, to: normalizeGrade(s.grade) }))
    .filter((u) => u.to !== u.from && u.to != null)

  console.log(`Alunos a atualizar: ${updates.length}`)
  for (const u of updates) {
    console.log(`  ${u.name}: "${u.from}" → "${u.to}"`)
  }

  if (updates.length === 0) {
    console.log("\nNada a fazer.")
    return
  }

  if (DRY_RUN) {
    console.log("\nDRY-RUN: nenhum dado alterado. Rode sem --dry-run para aplicar.")
    return
  }

  for (const u of updates) {
    await prisma.student.update({ where: { id: u.id }, data: { grade: u.to! } })
  }
  console.log(`\n✅ ${updates.length} aluno(s) atualizado(s).`)

  // Alerta sobre valores fora do catálogo que não têm alias (ex.: "Outro")
  const leftovers = [...counts.keys()].filter(
    (g) => g !== "(vazio)" && !CANON.has(g) && normalizeGrade(g) === g
  )
  if (leftovers.length > 0) {
    console.log("\n⚠ Valores fora do catálogo mantidos (revisar manualmente se desejar):")
    for (const g of leftovers) console.log(`   - "${g}"`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
