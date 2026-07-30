/**
 * Lista sobreposições de horário já existentes na agenda (mesmo professor, duas
 * aulas ativas ao mesmo tempo). Serve para auditar o passivo criado antes da
 * validação em src/lib/scheduling.ts.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/check-schedule-conflicts.ts
 *   npx tsx --env-file=.env.local scripts/check-schedule-conflicts.ts --future   # só daqui pra frente
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ONLY_FUTURE = process.argv.includes("--future")

const BRAZIL_TZ = "America/Sao_Paulo"
const fmt = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: BRAZIL_TZ, dateStyle: "short", timeStyle: "short" })

async function main() {
  const lessons = await prisma.lesson.findMany({
    where: {
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      ...(ONLY_FUTURE ? { scheduledAt: { gte: new Date() } } : {}),
    },
    select: {
      id:           true,
      scheduledAt:  true,
      duration:     true,
      lessonType:   true,
      title:        true,
      teacher:      { select: { user: { select: { name: true } } } },
      subject:      { select: { name: true } },
      participants: { select: { student: { select: { name: true } } } },
    },
    orderBy: [{ teacherId: "asc" }, { scheduledAt: "asc" }],
  })

  console.log(`Aulas ativas analisadas: ${lessons.length}${ONLY_FUTURE ? " (apenas futuras)" : ""}\n`)

  // Agrupa por professor e compara vizinhos na ordem cronológica
  const byTeacher = new Map<string, typeof lessons>()
  for (const l of lessons) {
    const key = l.teacher.user.name
    if (!byTeacher.has(key)) byTeacher.set(key, [])
    byTeacher.get(key)!.push(l)
  }

  let total = 0

  for (const [teacherName, group] of byTeacher) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        const aStart = a.scheduledAt.getTime()
        const bStart = b.scheduledAt.getTime()
        const aEnd   = aStart + a.duration * 60_000
        // Ordenadas por horário: se b começa depois do fim de a, ninguém depois dela alcança
        if (bStart >= aEnd) break
        const bEnd = bStart + b.duration * 60_000
        if (!(aStart < bEnd && bStart < aEnd)) continue

        total++
        const label = (l: typeof a) =>
          `${fmt(l.scheduledAt)} +${l.duration}min · ${l.lessonType} · ` +
          `${l.title ?? l.subject?.name ?? "–"} · ` +
          `alunos: ${l.participants.map((p) => p.student.name).join(", ") || "(nenhum)"} · ${l.id}`

        console.log(`⚠ ${teacherName}`)
        console.log(`   A: ${label(a)}`)
        console.log(`   B: ${label(b)}\n`)
      }
    }
  }

  console.log(total === 0
    ? "✓ Nenhuma sobreposição encontrada."
    : `Total de sobreposições: ${total}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
