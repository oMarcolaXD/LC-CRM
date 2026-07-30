import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const term = process.argv[2] ?? "Alan"

  // Lista TODOS os alunos com seus campos name e user.name
  const all = await prisma.student.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  console.log(`Total de students no banco: ${all.length}`)
  for (const s of all) {
    console.log(`  id: ${s.id} | student.name: "${s.name}" | user.name: "${s.user?.name ?? "N/A"}" | user.email: "${s.user?.email ?? "N/A"}"`)
  }

  console.log(`\nBuscando "${term}":`)
  const found = all.filter(s =>
    s.name?.toLowerCase().includes(term.toLowerCase()) ||
    s.user?.name?.toLowerCase().includes(term.toLowerCase()) ||
    s.user?.email?.toLowerCase().includes(term.toLowerCase())
  )
  if (found.length === 0) {
    console.log("  Não encontrado.")
  } else {
    for (const s of found) {
      console.log(`  FOUND: id=${s.id} name="${s.name}"`)
      const student = await prisma.student.findUnique({
        where: { id: s.id },
        include: {
          packages: { include: { payments: true } },
          payments: true,
        },
      })
      console.log(`  Packages: ${student!.packages.length}`)
      for (const pkg of student!.packages) {
        console.log(`    Pacote ${pkg.id} | ${Number(pkg.totalLessons)} aulas | payments vinculados: ${pkg.payments.length}`)
      }
      const unlinked = student!.payments.filter(p => !p.packageId)
      console.log(`  Total payments: ${student!.payments.length} | Unlinked: ${unlinked.length}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
