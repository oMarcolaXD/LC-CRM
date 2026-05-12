import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Iniciando seed...")

  const hash = (pwd: string) => bcrypt.hash(pwd, 12)

  // ─── Matérias ───────────────────────────────────────────────────────────────
  const subjects = await Promise.all([
    prisma.subject.upsert({ where: { id: "sub-mat" }, update: {}, create: { id: "sub-mat", name: "Matemática",  level: "Todos"              } }),
    prisma.subject.upsert({ where: { id: "sub-por" }, update: {}, create: { id: "sub-por", name: "Português",   level: "Todos"              } }),
    prisma.subject.upsert({ where: { id: "sub-fis" }, update: {}, create: { id: "sub-fis", name: "Física",      level: "Ensino Médio/Superior" } }),
    prisma.subject.upsert({ where: { id: "sub-qui" }, update: {}, create: { id: "sub-qui", name: "Química",     level: "Ensino Médio/Superior" } }),
    prisma.subject.upsert({ where: { id: "sub-bio" }, update: {}, create: { id: "sub-bio", name: "Biologia",    level: "Ensino Médio/Superior" } }),
    prisma.subject.upsert({ where: { id: "sub-his" }, update: {}, create: { id: "sub-his", name: "História",    level: "Todos"              } }),
    prisma.subject.upsert({ where: { id: "sub-geo" }, update: {}, create: { id: "sub-geo", name: "Geografia",   level: "Todos"              } }),
    prisma.subject.upsert({ where: { id: "sub-ing" }, update: {}, create: { id: "sub-ing", name: "Inglês",      level: "Todos"              } }),
  ])
  console.log(`✅ ${subjects.length} matérias`)

  // ─── Admin ──────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where:  { email: "admin@licaodecasa.com.br" },
    update: {},
    create: {
      id:       "user-admin",
      name:     "Administrador",
      email:    "admin@licaodecasa.com.br",
      password: await hash("Admin@123"),
      role:     Role.ADMIN,
      phone:    "(11) 99999-0001",
    },
  })
  console.log(`✅ Admin: ${admin.email}`)

  // ─── Colaboradores ──────────────────────────────────────────────────────────
  const colab1 = await prisma.user.upsert({
    where:  { email: "julia@licaodecasa.com.br" },
    update: {},
    create: {
      id:       "user-colab1",
      name:     "Júlia Mendes",
      email:    "julia@licaodecasa.com.br",
      password: await hash("Colab@123"),
      role:     Role.COLLABORATOR,
      phone:    "(11) 99999-0002",
    },
  })
  const colab2 = await prisma.user.upsert({
    where:  { email: "rafael@licaodecasa.com.br" },
    update: {},
    create: {
      id:       "user-colab2",
      name:     "Rafael Costa",
      email:    "rafael@licaodecasa.com.br",
      password: await hash("Colab@123"),
      role:     Role.COLLABORATOR,
      phone:    "(11) 99999-0003",
    },
  })
  console.log(`✅ Colaboradores: ${colab1.name}, ${colab2.name}`)

  // ─── Professores ────────────────────────────────────────────────────────────
  const teacherData = [
    { id: "user-prof1", name: "Ana Beatriz Silva",  email: "ana@licaodecasa.com.br",    rate: 80,  subjects: ["sub-mat", "sub-fis"] },
    { id: "user-prof2", name: "Carlos Eduardo Lima", email: "carlos@licaodecasa.com.br", rate: 75,  subjects: ["sub-por", "sub-his"] },
    { id: "user-prof3", name: "Fernanda Rocha",      email: "fernanda@licaodecasa.com.br",rate: 90, subjects: ["sub-qui", "sub-bio"] },
    { id: "user-prof4", name: "Marcos Oliveira",     email: "marcos@licaodecasa.com.br", rate: 70,  subjects: ["sub-mat", "sub-geo"] },
    { id: "user-prof5", name: "Patricia Santos",     email: "patricia@licaodecasa.com.br",rate: 85, subjects: ["sub-ing", "sub-por"] },
  ]

  for (const t of teacherData) {
    const user = await prisma.user.upsert({
      where:  { email: t.email },
      update: {},
      create: {
        id:       t.id,
        name:     t.name,
        email:    t.email,
        password: await hash("Prof@123"),
        role:     Role.TEACHER,
      },
    })
    const teacher = await prisma.teacher.upsert({
      where:  { userId: user.id },
      update: {},
      create: {
        userId:     user.id,
        hourlyRate: t.rate,
        bio:        `Professor(a) de ${t.subjects.length} matérias na Lição de Casa.`,
      },
    })
    for (const subId of t.subjects) {
      await prisma.teacherSubject.upsert({
        where:  { teacherId_subjectId: { teacherId: teacher.id, subjectId: subId } },
        update: {},
        create: { teacherId: teacher.id, subjectId: subId },
      })
    }
  }
  console.log(`✅ ${teacherData.length} professores`)

  // ─── Alunos ──────────────────────────────────────────────────────────────────
  const studentData = [
    { name: "Lucas Alves",        email: "lucas@email.com",    grade: "9º EF"       },
    { name: "Isabela Ferreira",   email: "isabela@email.com",  grade: "1º EM"       },
    { name: "Gabriel Souza",      email: "gabriel@email.com",  grade: "2º EM"       },
    { name: "Maria Clara Lima",   email: "mariaclara@email.com",grade: "3º EM"      },
    { name: "Pedro Henrique",     email: "pedro@email.com",    grade: "Vestibular"  },
    { name: "Larissa Costa",      email: "larissa@email.com",  grade: "8º EF"       },
    { name: "Bruno Martins",      email: "bruno@email.com",    grade: "6º EF"       },
    { name: "Amanda Ribeiro",     email: "amanda@email.com",   grade: "7º EF"       },
    { name: "Thiago Barbosa",     email: "thiago@email.com",   grade: "1º EM"       },
    { name: "Camila Pereira",     email: "camila@email.com",   grade: "Superior"    },
    { name: "Vinícius Rocha",     email: "vinicius@email.com", grade: "2º EM"       },
    { name: "Letícia Gomes",      email: "leticia@email.com",  grade: "3º EM"       },
    { name: "Matheus Carvalho",   email: "matheus@email.com",  grade: "9º EF"       },
    { name: "Beatriz Nunes",      email: "beatriz@email.com",  grade: "Vestibular"  },
    { name: "Felipe Monteiro",    email: "felipe@email.com",   grade: "1º EM"       },
    { name: "Carolina Azevedo",   email: "carolina@email.com", grade: "8º EF"       },
    { name: "Rodrigo Teixeira",   email: "rodrigo@email.com",  grade: "Superior"    },
    { name: "Natália Correia",    email: "natalia@email.com",  grade: "2º EM"       },
    { name: "Eduardo Pinto",      email: "eduardo@email.com",  grade: "7º EF"       },
    { name: "Juliana Mendonça",   email: "juliana@email.com",  grade: "3º EM"       },
  ]

  for (const s of studentData) {
    const user = await prisma.user.upsert({
      where:  { email: s.email },
      update: {},
      create: {
        name:     s.name,
        email:    s.email,
        password: await hash("Aluno@123"),
        role:     Role.STUDENT,
      },
    })
    await prisma.student.upsert({
      where:  { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        grade:  s.grade,
      },
    })
  }
  console.log(`✅ ${studentData.length} alunos`)

  console.log("\n🎉 Seed concluído!")
  console.log("─".repeat(50))
  console.log("Credenciais de acesso:")
  console.log("  Admin:       admin@licaodecasa.com.br  / Admin@123")
  console.log("  Colaborador: julia@licaodecasa.com.br  / Colab@123")
  console.log("  Professor:   ana@licaodecasa.com.br    / Prof@123")
  console.log("  Aluno:       lucas@email.com           / Aluno@123")
  console.log("─".repeat(50))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
