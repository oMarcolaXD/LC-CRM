import {
  PrismaClient, Role, LessonStatus, LessonModality,
  PaymentStatus, PackageStatus, RequestStatus,
  TeacherMode, EducationLevel,
} from "@prisma/client"
import bcrypt from "bcryptjs"
import { subMonths, addHours, startOfMonth, setHours, setMinutes } from "date-fns"

const prisma = new PrismaClient()
const hash   = (pwd: string) => bcrypt.hash(pwd, 12)
const now    = new Date()

// Preço padrão por aula (R$90) — alinhado com a operação real
const PRECO_AULA = 90

// Taxa paga ao professor por aula — escola fica com a diferença
// Ex: R$90 - R$65 = R$25 de margem por aula
const TAXAS_PROFESSOR: Record<string, number> = {
  "teacher-1": 65, // Ana Beatriz
  "teacher-2": 60, // Carlos Eduardo
  "teacher-3": 70, // Fernanda
  "teacher-4": 58, // Marcos
  "teacher-5": 65, // Patricia
  "teacher-6": 60, // Renato
}

function pastDate(monthsAgo: number, dayOffset = 0, hour = 10) {
  const d = subMonths(now, monthsAgo)
  d.setDate(Math.min(28, Math.max(1, dayOffset)))
  return setMinutes(setHours(d, hour), 0)
}

// Gera N aulas distribuídas em um mês, variando hora e dia
function gerarAulasMes(
  studentId: string,
  teacherId: string,
  subjectId: string,
  monthsAgo: number,
  quantidade: number,
  status: LessonStatus,
  rating: number | null,
  teacherMode: TeacherMode,
): Array<{
  studentId: string; teacherId: string; subjectId: string
  scheduledAt: Date; modality: LessonModality; teacherOnsite: boolean
  status: LessonStatus; studentRating: number | null; topicsCovered: string | null
}> {
  const hours = [9, 10, 11, 14, 15, 16, 17]
  return Array.from({ length: quantidade }, (_, i) => {
    const day      = 2 + i * Math.floor(28 / quantidade)
    const hour     = hours[i % hours.length]
    const modality = i % 3 === 0 ? LessonModality.ONLINE : LessonModality.PRESENCIAL
    // Professor na sede: sempre se for PRESENCIAL, ou se for HYBRID com aula presencial
    const teacherOnsite =
      teacherMode === TeacherMode.PRESENCIAL ||
      (teacherMode === TeacherMode.HYBRID && modality === LessonModality.PRESENCIAL)
    return {
      studentId, teacherId, subjectId,
      scheduledAt: pastDate(monthsAgo, day, hour),
      modality,
      teacherOnsite,
      status,
      studentRating: rating,
      topicsCovered: status === LessonStatus.COMPLETED
        ? "Revisão do conteúdo + exercícios práticos" : null,
    }
  })
}

async function main() {
  console.log("🌱 Limpando dados antigos...")
  await prisma.activityLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.teacherPayout.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.homework.deleteMany()
  await prisma.lesson.deleteMany()
  await prisma.lessonRequest.deleteMany()
  await prisma.lessonPackage.deleteMany()
  await prisma.teacherSubject.deleteMany()
  await prisma.material.deleteMany()
  await prisma.student.deleteMany()
  await prisma.guardian.deleteMany()
  await prisma.teacher.deleteMany()
  await prisma.subject.deleteMany()
  await prisma.user.deleteMany()
  console.log("✅ Banco limpo")

  // ─── Matérias ──────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.subject.create({ data: { id: "sub-mat", name: "Matemática",  level: "Todos"                } }),
    prisma.subject.create({ data: { id: "sub-por", name: "Português",   level: "Todos"                } }),
    prisma.subject.create({ data: { id: "sub-fis", name: "Física",      level: "Ensino Médio/Superior" } }),
    prisma.subject.create({ data: { id: "sub-qui", name: "Química",     level: "Ensino Médio/Superior" } }),
    prisma.subject.create({ data: { id: "sub-bio", name: "Biologia",    level: "Ensino Médio/Superior" } }),
    prisma.subject.create({ data: { id: "sub-his", name: "História",    level: "Todos"                } }),
    prisma.subject.create({ data: { id: "sub-geo", name: "Geografia",   level: "Todos"                } }),
    prisma.subject.create({ data: { id: "sub-ing", name: "Inglês",      level: "Todos"                } }),
  ])
  console.log("✅ 8 matérias")

  // ─── Admin ─────────────────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      id: "user-admin", name: "Administrador",
      email: "admin@licaodecasa.com.br", password: await hash("Admin@123"),
      role: Role.ADMIN, phone: "(15) 99999-0001",
    },
  })

  // ─── Colaboradora ──────────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      id: "user-colab1", name: "Júlia Mendes",
      email: "julia@licaodecasa.com.br", password: await hash("Colab@123"),
      role: Role.COLLABORATOR, phone: "(15) 99999-0002",
    },
  })
  console.log("✅ Admin + Colaborador")

  // ─── Professores ───────────────────────────────────────────────────────────
  // Disponibilidade: seg-sex ampla para absorver ~400 aulas/mês
  const avail5dias = {
    "1": [{ start: "08:00", end: "19:00" }],
    "2": [{ start: "08:00", end: "19:00" }],
    "3": [{ start: "08:00", end: "19:00" }],
    "4": [{ start: "08:00", end: "19:00" }],
    "5": [{ start: "08:00", end: "18:00" }],
  }
  const availSeg_Qua_Sex = {
    "1": [{ start: "09:00", end: "20:00" }],
    "3": [{ start: "09:00", end: "20:00" }],
    "5": [{ start: "09:00", end: "18:00" }],
  }
  const availTer_Qui_Sab = {
    "2": [{ start: "14:00", end: "21:00" }],
    "4": [{ start: "14:00", end: "21:00" }],
    "6": [{ start: "09:00", end: "15:00" }],
  }

  type SubDef = { id: string; levels: EducationLevel[] }
  const professores: {
    uid: string; tid: string; name: string; email: string
    avail: object; mode: TeacherMode; bio: string; subs: SubDef[]
  }[] = [
    {
      uid: "user-prof1", tid: "teacher-1", name: "Ana Beatriz Silva",
      email: "ana@licaodecasa.com.br", avail: avail5dias,
      mode: TeacherMode.PRESENCIAL,
      bio: "Professora de Matemática e Física com 8 anos de experiência em reforço escolar e pré-vestibular. Especialista em tornar o abstrato concreto.",
      subs: [
        { id: "sub-mat", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR] },
        { id: "sub-fis", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR, EducationLevel.SUPERIOR] },
      ],
    },
    {
      uid: "user-prof2", tid: "teacher-2", name: "Carlos Eduardo Lima",
      email: "carlos@licaodecasa.com.br", avail: availSeg_Qua_Sex,
      mode: TeacherMode.ONLINE_ONLY,
      bio: "Mestre em Letras com foco em redação dissertativa e literatura. Atende exclusivamente online com metodologia comprovada para ENEM.",
      subs: [
        { id: "sub-por", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR, EducationLevel.SUPERIOR] },
        { id: "sub-his", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR] },
      ],
    },
    {
      uid: "user-prof3", tid: "teacher-3", name: "Fernanda Rocha",
      email: "fernanda@licaodecasa.com.br", avail: avail5dias,
      mode: TeacherMode.HYBRID,
      bio: "Bióloga e química formada pela USP. Trabalha tanto presencialmente na sede quanto online, com ótimos resultados em Ciências da Natureza.",
      subs: [
        { id: "sub-qui", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR, EducationLevel.SUPERIOR] },
        { id: "sub-bio", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR, EducationLevel.SUPERIOR] },
      ],
    },
    {
      uid: "user-prof4", tid: "teacher-4", name: "Marcos Oliveira",
      email: "marcos@licaodecasa.com.br", avail: availTer_Qui_Sab,
      mode: TeacherMode.PRESENCIAL,
      bio: "Professor de Matemática e Geografia, especialista em Ensino Fundamental. Atende presencialmente na sede com metodologia lúdica e prática.",
      subs: [
        { id: "sub-mat", levels: [EducationLevel.EF2, EducationLevel.EM] },
        { id: "sub-geo", levels: [EducationLevel.EF2, EducationLevel.EM] },
      ],
    },
    {
      uid: "user-prof5", tid: "teacher-5", name: "Patricia Santos",
      email: "patricia@licaodecasa.com.br", avail: availSeg_Qua_Sex,
      mode: TeacherMode.ONLINE_ONLY,
      bio: "Fluente em 4 idiomas, com MBA no exterior. Especialista em inglês para negócios e proficiência. Atende apenas online.",
      subs: [
        { id: "sub-ing", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.SUPERIOR, EducationLevel.VESTIBULAR] },
        { id: "sub-por", levels: [EducationLevel.EM, EducationLevel.SUPERIOR, EducationLevel.VESTIBULAR] },
      ],
    },
    {
      uid: "user-prof6", tid: "teacher-6", name: "Renato Alves",
      email: "renato@licaodecasa.com.br", avail: availTer_Qui_Sab,
      mode: TeacherMode.HYBRID,
      bio: "Engenheiro de formação convertido ao ensino. Leciona Física e Matemática com foco em resolução de problemas e aplicações do dia a dia.",
      subs: [
        { id: "sub-fis", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.SUPERIOR] },
        { id: "sub-mat", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR] },
      ],
    },
  ]

  for (const t of professores) {
    const fone = `(15) 9${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`
    await prisma.user.create({
      data: { id: t.uid, name: t.name, email: t.email, password: await hash("Prof@123"), role: Role.TEACHER, phone: fone },
    })
    await prisma.teacher.create({
      data: {
        id: t.tid, userId: t.uid,
        hourlyRate: TAXAS_PROFESSOR[t.tid],
        teachingMode: t.mode,
        bio: t.bio,
        availability: t.avail,
        subjects: { create: t.subs.map((s) => ({ subjectId: s.id, levels: s.levels })) },
      },
    })
  }
  console.log(`✅ ${professores.length} professores (taxa R$${Math.min(...Object.values(TAXAS_PROFESSOR))}–R$${Math.max(...Object.values(TAXAS_PROFESSOR))}/aula)`)

  // ─── Alunos ────────────────────────────────────────────────────────────────
  // 12 alunos com perfis variados (4–7 aulas/mês cada)
  const alunos: { uid: string; sid: string; name: string; email: string; grade: string; educationLevel: EducationLevel }[] = [
    { uid: "user-stu1",  sid: "student-1",  name: "Lucas Alves",       email: "lucas@email.com",       grade: "9º EF",      educationLevel: EducationLevel.EF2        },
    { uid: "user-stu2",  sid: "student-2",  name: "Isabela Ferreira",  email: "isabela@email.com",     grade: "1º EM",      educationLevel: EducationLevel.EM         },
    { uid: "user-stu3",  sid: "student-3",  name: "Gabriel Souza",     email: "gabriel@email.com",     grade: "2º EM",      educationLevel: EducationLevel.EM         },
    { uid: "user-stu4",  sid: "student-4",  name: "Maria Clara Lima",  email: "mariaclara@email.com",  grade: "3º EM",      educationLevel: EducationLevel.EM         },
    { uid: "user-stu5",  sid: "student-5",  name: "Pedro Henrique",    email: "pedro@email.com",       grade: "Vestibular", educationLevel: EducationLevel.VESTIBULAR },
    { uid: "user-stu6",  sid: "student-6",  name: "Larissa Costa",     email: "larissa@email.com",     grade: "8º EF",      educationLevel: EducationLevel.EF2        },
    { uid: "user-stu7",  sid: "student-7",  name: "Bruno Martins",     email: "bruno@email.com",       grade: "6º EF",      educationLevel: EducationLevel.EF2        },
    { uid: "user-stu8",  sid: "student-8",  name: "Amanda Ribeiro",    email: "amanda@email.com",      grade: "7º EF",      educationLevel: EducationLevel.EF2        },
    { uid: "user-stu9",  sid: "student-9",  name: "Thiago Barbosa",    email: "thiago@email.com",      grade: "1º EM",      educationLevel: EducationLevel.EM         },
    { uid: "user-stu10", sid: "student-10", name: "Camila Pereira",    email: "camila@email.com",      grade: "Superior",   educationLevel: EducationLevel.SUPERIOR   },
    { uid: "user-stu11", sid: "student-11", name: "Vinícius Rocha",    email: "vinicius@email.com",    grade: "2º EM",      educationLevel: EducationLevel.EM         },
    { uid: "user-stu12", sid: "student-12", name: "Letícia Gomes",     email: "leticia@email.com",     grade: "3º EM",      educationLevel: EducationLevel.EM         },
  ]

  for (const s of alunos) {
    await prisma.user.create({
      data: { id: s.uid, name: s.name, email: s.email, password: await hash("Aluno@123"), role: Role.STUDENT },
    })
    await prisma.student.create({ data: { id: s.sid, userId: s.uid, grade: s.grade, educationLevel: s.educationLevel } })
  }
  console.log(`✅ ${alunos.length} alunos`)

  // ─── Pacotes de Aulas ──────────────────────────────────────────────────────
  // Pacotes de 10 ou 20 aulas a R$90/aula
  // 10 aulas = R$900  → cobre ~1,5–2,5 meses (4–7 aulas/mês)
  // 20 aulas = R$1.800 → cobre ~3–5 meses
  const pacotes = [
    // [id, studentId, total, remaining, status]
    { id: "pkg-1",  sid: "student-1",  total: 20, remaining: 8,  status: PackageStatus.ACTIVE    }, // Lucas: 7 aulas/mês → ~1,1 mês restante
    { id: "pkg-2",  sid: "student-2",  total: 10, remaining: 3,  status: PackageStatus.ACTIVE    }, // Isabela: 4 aulas/mês
    { id: "pkg-3",  sid: "student-3",  total: 20, remaining: 12, status: PackageStatus.ACTIVE    }, // Gabriel: 5 aulas/mês
    { id: "pkg-4",  sid: "student-4",  total: 10, remaining: 0,  status: PackageStatus.EXHAUSTED }, // Maria Clara: esgotado
    { id: "pkg-4b", sid: "student-4",  total: 20, remaining: 14, status: PackageStatus.ACTIVE    }, // novo pacote ativo
    { id: "pkg-5",  sid: "student-5",  total: 20, remaining: 6,  status: PackageStatus.ACTIVE    }, // Pedro: 7 aulas/mês (vestibular)
    { id: "pkg-6",  sid: "student-6",  total: 10, remaining: 5,  status: PackageStatus.ACTIVE    }, // Larissa: 4 aulas/mês
    { id: "pkg-7",  sid: "student-7",  total: 10, remaining: 7,  status: PackageStatus.ACTIVE    }, // Bruno: 4 aulas/mês (iniciante)
    { id: "pkg-8",  sid: "student-8",  total: 20, remaining: 10, status: PackageStatus.ACTIVE    }, // Amanda: 5 aulas/mês
    { id: "pkg-9",  sid: "student-9",  total: 10, remaining: 2,  status: PackageStatus.ACTIVE    }, // Thiago: 4 aulas/mês
    { id: "pkg-10", sid: "student-10", total: 20, remaining: 11, status: PackageStatus.ACTIVE    }, // Camila: 6 aulas/mês (Superior)
    { id: "pkg-11", sid: "student-11", total: 10, remaining: 4,  status: PackageStatus.ACTIVE    }, // Vinícius: 5 aulas/mês
    { id: "pkg-12", sid: "student-12", total: 10, remaining: 1,  status: PackageStatus.ACTIVE    }, // Letícia: 4 aulas/mês
  ]

  for (const p of pacotes) {
    await prisma.lessonPackage.create({
      data: {
        id: p.id, studentId: p.sid,
        totalLessons:     p.total,
        remainingLessons: p.remaining,
        pricePerLesson:   PRECO_AULA,        // R$90 por aula
        purchaseDate:     subMonths(now, Math.floor(Math.random() * 4 + 1)),
        expiresAt:        new Date(now.getFullYear(), now.getMonth() + 6, 1), // expira em 6 meses
        status:           p.status,
      },
    })
  }
  console.log(`✅ ${pacotes.length} pacotes (R$${PRECO_AULA}/aula · 10 ou 20 aulas)`)

  // ─── Aulas (6 meses de histórico) ─────────────────────────────────────────
  // Volume: 4–7 aulas/mês por aluno, refletindo a operação real (~400 aulas/mês)
  // Modos de ensino por professor (mesma ordem da array professores acima)
  const T1 = TeacherMode.PRESENCIAL   // Ana
  const T2 = TeacherMode.ONLINE_ONLY  // Carlos
  const T3 = TeacherMode.HYBRID       // Fernanda
  const T4 = TeacherMode.PRESENCIAL   // Marcos
  const T5 = TeacherMode.ONLINE_ONLY  // Patricia
  const T6 = TeacherMode.HYBRID       // Renato

  const todasAulas: ReturnType<typeof gerarAulasMes>[0][] = [
    // Lucas — 7 aulas/mês com Ana (PRESENCIAL)
    ...gerarAulasMes("student-1","teacher-1","sub-mat",5,7,LessonStatus.COMPLETED,5,T1),
    ...gerarAulasMes("student-1","teacher-1","sub-mat",4,7,LessonStatus.COMPLETED,4,T1),
    ...gerarAulasMes("student-1","teacher-1","sub-fis",3,4,LessonStatus.COMPLETED,5,T1),
    ...gerarAulasMes("student-1","teacher-1","sub-mat",2,7,LessonStatus.COMPLETED,5,T1),
    ...gerarAulasMes("student-1","teacher-1","sub-mat",1,6,LessonStatus.COMPLETED,4,T1),
    ...gerarAulasMes("student-1","teacher-1","sub-mat",0,2,LessonStatus.SCHEDULED,null,T1),

    // Isabela — 4 aulas/mês com Carlos (ONLINE_ONLY)
    ...gerarAulasMes("student-2","teacher-2","sub-por",5,4,LessonStatus.COMPLETED,4,T2),
    ...gerarAulasMes("student-2","teacher-2","sub-por",4,4,LessonStatus.COMPLETED,5,T2),
    ...gerarAulasMes("student-2","teacher-2","sub-his",3,4,LessonStatus.COMPLETED,4,T2),
    ...gerarAulasMes("student-2","teacher-2","sub-por",2,4,LessonStatus.COMPLETED,5,T2),
    ...gerarAulasMes("student-2","teacher-2","sub-por",1,3,LessonStatus.COMPLETED,4,T2),
    ...gerarAulasMes("student-2","teacher-2","sub-por",0,1,LessonStatus.CONFIRMED,null,T2),

    // Gabriel — 5 aulas/mês com Fernanda (HYBRID)
    ...gerarAulasMes("student-3","teacher-3","sub-qui",5,5,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-3","teacher-3","sub-qui",4,5,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-3","teacher-3","sub-bio",3,5,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-3","teacher-3","sub-qui",2,5,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-3","teacher-3","sub-qui",1,4,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-3","teacher-3","sub-qui",0,2,LessonStatus.SCHEDULED,null,T3),

    // Maria Clara — 6 aulas/mês com Marcos (PRESENCIAL)
    ...gerarAulasMes("student-4","teacher-4","sub-mat",5,6,LessonStatus.COMPLETED,4,T4),
    ...gerarAulasMes("student-4","teacher-4","sub-geo",4,6,LessonStatus.COMPLETED,4,T4),
    ...gerarAulasMes("student-4","teacher-4","sub-mat",3,6,LessonStatus.COMPLETED,5,T4),
    ...gerarAulasMes("student-4","teacher-4","sub-mat",2,6,LessonStatus.COMPLETED,4,T4),
    ...gerarAulasMes("student-4","teacher-4","sub-mat",1,5,LessonStatus.COMPLETED,5,T4),
    ...gerarAulasMes("student-4","teacher-4","sub-mat",0,2,LessonStatus.CONFIRMED,null,T4),

    // Pedro — 7 aulas/mês com Patricia (ONLINE_ONLY)
    ...gerarAulasMes("student-5","teacher-5","sub-ing",5,7,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-5","teacher-5","sub-ing",4,7,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-5","teacher-5","sub-por",3,7,LessonStatus.COMPLETED,4,T5),
    ...gerarAulasMes("student-5","teacher-5","sub-ing",2,7,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-5","teacher-5","sub-ing",1,6,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-5","teacher-5","sub-ing",0,2,LessonStatus.SCHEDULED,null,T5),

    // Larissa — 4 aulas/mês com Renato (HYBRID)
    ...gerarAulasMes("student-6","teacher-6","sub-fis",4,4,LessonStatus.COMPLETED,4,T6),
    ...gerarAulasMes("student-6","teacher-6","sub-fis",3,4,LessonStatus.COMPLETED,4,T6),
    ...gerarAulasMes("student-6","teacher-6","sub-mat",2,4,LessonStatus.COMPLETED,3,T6),
    ...gerarAulasMes("student-6","teacher-6","sub-fis",1,3,LessonStatus.COMPLETED,4,T6),
    ...gerarAulasMes("student-6","teacher-6","sub-fis",0,1,LessonStatus.SCHEDULED,null,T6),

    // Bruno — 4 aulas/mês com Marcos (PRESENCIAL)
    ...gerarAulasMes("student-7","teacher-4","sub-mat",3,4,LessonStatus.COMPLETED,4,T4),
    ...gerarAulasMes("student-7","teacher-4","sub-mat",2,4,LessonStatus.COMPLETED,3,T4),
    ...gerarAulasMes("student-7","teacher-4","sub-mat",1,3,LessonStatus.COMPLETED,4,T4),
    ...gerarAulasMes("student-7","teacher-4","sub-mat",0,1,LessonStatus.SCHEDULED,null,T4),

    // Amanda — 5 aulas/mês com Fernanda (HYBRID)
    ...gerarAulasMes("student-8","teacher-3","sub-bio",5,5,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-8","teacher-3","sub-bio",4,5,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-8","teacher-3","sub-qui",3,5,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-8","teacher-3","sub-bio",2,5,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-8","teacher-3","sub-bio",1,4,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-8","teacher-3","sub-bio",0,1,LessonStatus.CONFIRMED,null,T3),

    // Thiago — 4 aulas/mês com Ana (PRESENCIAL)
    ...gerarAulasMes("student-9","teacher-1","sub-fis",4,4,LessonStatus.COMPLETED,4,T1),
    ...gerarAulasMes("student-9","teacher-1","sub-fis",3,4,LessonStatus.COMPLETED,5,T1),
    ...gerarAulasMes("student-9","teacher-1","sub-mat",2,4,LessonStatus.COMPLETED,4,T1),
    ...gerarAulasMes("student-9","teacher-1","sub-fis",1,3,LessonStatus.COMPLETED,4,T1),
    ...gerarAulasMes("student-9","teacher-1","sub-fis",0,1,LessonStatus.SCHEDULED,null,T1),

    // Camila — 6 aulas/mês com Patricia (ONLINE_ONLY)
    ...gerarAulasMes("student-10","teacher-5","sub-ing",5,6,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-10","teacher-5","sub-ing",4,6,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-10","teacher-5","sub-por",3,6,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-10","teacher-5","sub-ing",2,6,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-10","teacher-5","sub-ing",1,5,LessonStatus.COMPLETED,4,T5),
    ...gerarAulasMes("student-10","teacher-5","sub-ing",0,2,LessonStatus.CONFIRMED,null,T5),

    // Vinícius — 5 aulas/mês com Fernanda (HYBRID)
    ...gerarAulasMes("student-11","teacher-3","sub-qui",4,5,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-11","teacher-3","sub-qui",3,5,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-11","teacher-3","sub-qui",2,5,LessonStatus.COMPLETED,3,T3),
    ...gerarAulasMes("student-11","teacher-3","sub-qui",1,4,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-11","teacher-3","sub-qui",0,1,LessonStatus.SCHEDULED,null,T3),

    // Letícia — 4 aulas/mês com Carlos (ONLINE_ONLY)
    ...gerarAulasMes("student-12","teacher-2","sub-his",3,4,LessonStatus.COMPLETED,4,T2),
    ...gerarAulasMes("student-12","teacher-2","sub-por",2,4,LessonStatus.COMPLETED,5,T2),
    ...gerarAulasMes("student-12","teacher-2","sub-his",1,4,LessonStatus.COMPLETED,5,T2),
    ...gerarAulasMes("student-12","teacher-2","sub-his",0,1,LessonStatus.SCHEDULED,null,T2),
  ]

  for (const aula of todasAulas) {
    await prisma.lesson.create({ data: aula })
  }
  console.log(`✅ ${todasAulas.length} aulas criadas`)

  // ─── Pagamentos ────────────────────────────────────────────────────────────
  // Cada pagamento = compra de um pacote
  // 10 aulas × R$90 = R$900 | 20 aulas × R$90 = R$1.800
  const pagamentoDefs: { sid: string; amount: number; monthsAgo: number; status: PaymentStatus }[] = [
    // Lucas — pacote de 20 aulas a cada ~3 meses
    { sid: "student-1",  amount: 20 * PRECO_AULA, monthsAgo: 5, status: PaymentStatus.PAID    },
    { sid: "student-1",  amount: 20 * PRECO_AULA, monthsAgo: 2, status: PaymentStatus.PAID    },
    // Isabela — pacote de 10 aulas a cada ~2,5 meses
    { sid: "student-2",  amount: 10 * PRECO_AULA, monthsAgo: 5, status: PaymentStatus.PAID    },
    { sid: "student-2",  amount: 10 * PRECO_AULA, monthsAgo: 2, status: PaymentStatus.PAID    },
    { sid: "student-2",  amount: 10 * PRECO_AULA, monthsAgo: 0, status: PaymentStatus.PENDING },
    // Gabriel — pacote de 20 aulas a cada ~4 meses
    { sid: "student-3",  amount: 20 * PRECO_AULA, monthsAgo: 4, status: PaymentStatus.PAID    },
    { sid: "student-3",  amount: 20 * PRECO_AULA, monthsAgo: 0, status: PaymentStatus.PENDING },
    // Maria Clara — dois pacotes (um esgotado, outro ativo)
    { sid: "student-4",  amount: 10 * PRECO_AULA, monthsAgo: 4, status: PaymentStatus.PAID    },
    { sid: "student-4",  amount: 20 * PRECO_AULA, monthsAgo: 2, status: PaymentStatus.PAID    },
    // Pedro — pacote de 20 aulas (alta frequência, vestibular)
    { sid: "student-5",  amount: 20 * PRECO_AULA, monthsAgo: 5, status: PaymentStatus.PAID    },
    { sid: "student-5",  amount: 20 * PRECO_AULA, monthsAgo: 2, status: PaymentStatus.PAID    },
    { sid: "student-5",  amount: 20 * PRECO_AULA, monthsAgo: 0, status: PaymentStatus.PENDING },
    // Larissa — pacote de 10 aulas
    { sid: "student-6",  amount: 10 * PRECO_AULA, monthsAgo: 4, status: PaymentStatus.PAID    },
    { sid: "student-6",  amount: 10 * PRECO_AULA, monthsAgo: 1, status: PaymentStatus.PAID    },
    // Bruno — pacote de 10 aulas (aluno novo)
    { sid: "student-7",  amount: 10 * PRECO_AULA, monthsAgo: 3, status: PaymentStatus.PAID    },
    // Amanda — pacote de 20 aulas
    { sid: "student-8",  amount: 20 * PRECO_AULA, monthsAgo: 5, status: PaymentStatus.PAID    },
    { sid: "student-8",  amount: 20 * PRECO_AULA, monthsAgo: 1, status: PaymentStatus.PAID    },
    // Thiago — pacote de 10 aulas
    { sid: "student-9",  amount: 10 * PRECO_AULA, monthsAgo: 4, status: PaymentStatus.PAID    },
    { sid: "student-9",  amount: 10 * PRECO_AULA, monthsAgo: 1, status: PaymentStatus.OVERDUE }, // em atraso
    // Camila — pacote de 20 aulas (Superior, alta frequência)
    { sid: "student-10", amount: 20 * PRECO_AULA, monthsAgo: 5, status: PaymentStatus.PAID    },
    { sid: "student-10", amount: 20 * PRECO_AULA, monthsAgo: 2, status: PaymentStatus.PAID    },
    // Vinícius — pacote de 10 aulas
    { sid: "student-11", amount: 10 * PRECO_AULA, monthsAgo: 4, status: PaymentStatus.PAID    },
    { sid: "student-11", amount: 10 * PRECO_AULA, monthsAgo: 1, status: PaymentStatus.OVERDUE }, // em atraso
    // Letícia — pacote de 10 aulas (aluna recente)
    { sid: "student-12", amount: 10 * PRECO_AULA, monthsAgo: 3, status: PaymentStatus.PAID    },
    { sid: "student-12", amount: 10 * PRECO_AULA, monthsAgo: 0, status: PaymentStatus.PENDING },
  ]

  for (const p of pagamentoDefs) {
    const dueDate = startOfMonth(subMonths(now, p.monthsAgo))
    dueDate.setDate(10)
    const paidAt = p.status === PaymentStatus.PAID
      ? new Date(dueDate.getTime() + Math.random() * 7 * 86_400_000)
      : null
    await prisma.payment.create({
      data: {
        studentId:   p.sid,
        amount:      p.amount,
        dueDate,
        paidAt,
        status:      p.status,
        method:      p.status === PaymentStatus.PAID ? ["PIX","Cartão de Crédito","Boleto"][Math.floor(Math.random() * 3)] : null,
        description: `Pacote de ${p.amount / PRECO_AULA} aulas — R$${PRECO_AULA}/aula`,
      },
    })
  }
  console.log(`✅ ${pagamentoDefs.length} pagamentos (pacotes a R$${PRECO_AULA}/aula)`)

  // ─── Repasses aos Professores ──────────────────────────────────────────────
  // Taxa do professor × número de aulas realizadas no mês
  const mesAtual  = now.getMonth() + 1
  const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
  const anoAtual  = now.getFullYear()

  const repasseDefs = [
    // Mês anterior — todos pagos
    { tid: "teacher-1", month: mesAnterior, year: anoAtual, lessons: 28, rate: TAXAS_PROFESSOR["teacher-1"], paid: true  }, // Ana: Lucas + Thiago
    { tid: "teacher-2", month: mesAnterior, year: anoAtual, lessons: 16, rate: TAXAS_PROFESSOR["teacher-2"], paid: true  }, // Carlos: Isabela + Letícia
    { tid: "teacher-3", month: mesAnterior, year: anoAtual, lessons: 34, rate: TAXAS_PROFESSOR["teacher-3"], paid: true  }, // Fernanda: Gabriel + Amanda + Vinícius
    { tid: "teacher-4", month: mesAnterior, year: anoAtual, lessons: 19, rate: TAXAS_PROFESSOR["teacher-4"], paid: true  }, // Marcos: Maria Clara + Bruno
    { tid: "teacher-5", month: mesAnterior, year: anoAtual, lessons: 26, rate: TAXAS_PROFESSOR["teacher-5"], paid: true  }, // Patricia: Pedro + Camila
    { tid: "teacher-6", month: mesAnterior, year: anoAtual, lessons: 12, rate: TAXAS_PROFESSOR["teacher-6"], paid: false }, // Renato: Larissa — pendente
    // Mês atual — todos pendentes
    { tid: "teacher-1", month: mesAtual, year: anoAtual, lessons: 6,  rate: TAXAS_PROFESSOR["teacher-1"], paid: false },
    { tid: "teacher-3", month: mesAtual, year: anoAtual, lessons: 5,  rate: TAXAS_PROFESSOR["teacher-3"], paid: false },
    { tid: "teacher-5", month: mesAtual, year: anoAtual, lessons: 4,  rate: TAXAS_PROFESSOR["teacher-5"], paid: false },
  ]

  for (const r of repasseDefs) {
    await prisma.teacherPayout.create({
      data: {
        teacherId:    r.tid,
        month:        r.month,
        year:         r.year,
        totalLessons: r.lessons,
        totalAmount:  r.lessons * r.rate,
        status:       r.paid ? "PAID" : "PENDING",
        paidAt:       r.paid ? subMonths(now, 1) : null,
      },
    })
  }
  console.log(`✅ ${repasseDefs.length} repasses (taxa R$${Math.min(...Object.values(TAXAS_PROFESSOR))}–R$${Math.max(...Object.values(TAXAS_PROFESSOR))}/aula)`)

  // ─── Solicitações Pendentes ────────────────────────────────────────────────
  // Cenário 1: aluno pede presencial com prof PRESENCIAL (normal)
  // Cenário 2: aluno pede ONLINE com prof PRESENCIAL → colaborador vê toggle "em casa / na sede"
  // Cenário 3: aluno pede ONLINE com prof HYBRID → toggle de localização disponível
  // Cenário 4: aluno pede com prof ONLINE_ONLY → colaborador só pode aprovar como Online
  await prisma.lessonRequest.createMany({
    data: [
      {
        studentId: "student-7",  teacherId: "teacher-4", subjectId: "sub-mat",
        modality:  LessonModality.PRESENCIAL,
        preferredAt: addHours(now, 26), status: RequestStatus.PENDING,
        reason: "Preciso de reforço urgente para prova de sexta",
      },
      {
        studentId: "student-9",  teacherId: "teacher-1", subjectId: "sub-fis",
        modality:  LessonModality.ONLINE,
        preferredAt: addHours(now, 27), status: RequestStatus.PENDING,
        reason: "Prefiro online hoje, mas o professor pode ficar na sede se quiser",
      },
      {
        studentId: "student-11", teacherId: "teacher-3", subjectId: "sub-qui",
        modality:  LessonModality.ONLINE,
        preferredAt: addHours(now, 50), status: RequestStatus.PENDING,
        reason: "Dificuldade com reações químicas — quero aula online",
      },
      {
        studentId: "student-12", teacherId: "teacher-2", subjectId: "sub-his",
        modality:  LessonModality.ONLINE,
        preferredAt: addHours(now, 72), status: RequestStatus.PENDING,
        reason: "Revisão para ENEM — Carlos é só online mesmo",
      },
    ],
  })
  console.log("✅ 4 solicitações pendentes (todos os cenários de modalidade)")

  // ─── Notificações ──────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: "user-admin",  type: "PAYMENT_OVERDUE",  title: "Pagamentos em atraso",    message: "2 alunos com pagamentos vencidos (Thiago e Vinícius).", read: false },
      { userId: "user-admin",  type: "LESSON_REQUEST",   title: "Novas solicitações",       message: "4 agendamentos aguardando aprovação.", read: false },
      { userId: "user-colab1", type: "LESSON_REQUEST",   title: "Agendamento pendente",     message: "Bruno Martins solicitou aula de Matemática.", read: false },
      { userId: "user-stu1",   type: "LESSON_CONFIRMED", title: "Aula confirmada",           message: "Sua próxima aula de Matemática está confirmada.", read: false },
      { userId: "user-stu5",   type: "PACKAGE_LOW_BALANCE", title: "Saldo baixo",          message: "Você tem apenas 6 aulas restantes no pacote.", read: true },
      { userId: "user-stu9",   type: "PAYMENT_OVERDUE",  title: "Pagamento vencido",        message: "Seu pacote de aulas venceu. Regularize para continuar.", read: false },
    ],
  })
  console.log("✅ Notificações")

  // ─── Resumo Final ──────────────────────────────────────────────────────────
  const totalAulasRealizadas = todasAulas.filter((a) => a.status === LessonStatus.COMPLETED).length
  const receitaTotal = pagamentoDefs.filter((p) => p.status === PaymentStatus.PAID).reduce((s, p) => s + p.amount, 0)

  console.log("\n🎉 Seed concluído!")
  console.log("═".repeat(60))
  console.log("  PARÂMETROS DE OPERAÇÃO")
  console.log("═".repeat(60))
  console.log(`  Preço por aula:     R$${PRECO_AULA}`)
  console.log(`  Taxa dos professores: R$${Math.min(...Object.values(TAXAS_PROFESSOR))}–R$${Math.max(...Object.values(TAXAS_PROFESSOR))}/aula`)
  console.log(`  Margem por aula:    R$${PRECO_AULA - Math.max(...Object.values(TAXAS_PROFESSOR))}–R$${PRECO_AULA - Math.min(...Object.values(TAXAS_PROFESSOR))}`)
  console.log("─".repeat(60))
  console.log(`  Alunos: ${alunos.length}  |  Professores: ${professores.length}  |  Matérias: 8`)
  console.log(`  Aulas criadas: ${todasAulas.length}  (${totalAulasRealizadas} realizadas)`)
  console.log(`  Receita histórica: R$${receitaTotal.toLocaleString("pt-BR")}`)
  console.log("═".repeat(60))
  console.log("  CREDENCIAIS")
  console.log("═".repeat(60))
  console.log("  Admin:       admin@licaodecasa.com.br   / Admin@123")
  console.log("  Colaborador: julia@licaodecasa.com.br   / Colab@123")
  console.log("  Professor:   ana@licaodecasa.com.br     / Prof@123")
  console.log("  Aluno:       lucas@email.com            / Aluno@123")
  console.log("═".repeat(60))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
