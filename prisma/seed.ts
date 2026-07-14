import {
  PrismaClient, Role, LessonStatus, LessonModality,
  PaymentStatus, PackageStatus, RequestStatus,
  TeacherMode, EducationLevel,
} from "@prisma/client"
import bcrypt from "bcryptjs"
import { subMonths, addHours, addDays, startOfMonth, setHours, setMinutes } from "date-fns"

const prisma = new PrismaClient()
const hash   = (pwd: string) => bcrypt.hash(pwd, 12)
const now    = new Date()

const PRECO_AULA = 90

const TOPICS_BY_SUBJECT: Record<string, string[]> = {
  "sub-mat": ["Funções quadráticas","Equações do 2º grau","Logaritmos e exponenciais","Trigonometria — seno e cosseno","Geometria analítica","Matrizes e determinantes","Probabilidade e estatística","Progressões aritméticas"],
  "sub-por": ["Dissertação argumentativa","Coesão e coerência textual","Funções sintáticas","Análise de texto literário","Crase e pontuação","Redação ENEM — estrutura","Interpretação de texto"],
  "sub-fis": ["Cinemática — MRU e MRUV","Leis de Newton","Trabalho e energia","Termodinâmica","Eletrostática","Eletrodinâmica — corrente e resistência","Óptica geométrica"],
  "sub-qui": ["Ácidos e bases — pH e pOH","Reações de oxirredução","Estequiometria","Funções orgânicas","Termoquímica","Cinética química","Equilíbrio químico"],
  "sub-bio": ["Divisão celular — mitose e meiose","Genética mendeliana","Ecologia — cadeias alimentares","Fisiologia humana","Evolução e seleção natural","Bioquímica — proteínas e enzimas","Botânica — fotossíntese"],
  "sub-his": ["Revolução Industrial","Segunda Guerra Mundial","Brasil Colônia","Era Vargas","Guerra Fria","Ditadura Militar no Brasil","Movimentos sociais do século XX"],
  "sub-geo": ["Clima e vegetação no Brasil","Geopolítica mundial","Urbanização e êxodo rural","Cartografia e mapas","Recursos naturais","Globalização e blocos econômicos"],
  "sub-ing": ["Present Perfect vs Simple Past","Phrasal verbs no cotidiano","Reading comprehension","Essay writing","Conditional sentences","Passive voice","Vocabulary — academic English"],
}

const TAXAS_PROFESSOR: Record<string, number> = {
  "teacher-1": 65,
  "teacher-2": 60,
  "teacher-3": 70,
  "teacher-4": 58,
  "teacher-5": 65,
  "teacher-6": 60,
}

function pastDate(monthsAgo: number, dayOffset = 0, hour = 10) {
  const d = subMonths(now, monthsAgo)
  d.setDate(Math.min(28, Math.max(1, dayOffset)))
  return setMinutes(setHours(d, hour), 0)
}

function todayAt(hour: number, minute = 0) {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d
}

// Cria data futura em horário de funcionamento (evita horários fora do expediente)
function futureAt(daysAhead: number, hour: number, minute = 0) {
  const d = addDays(now, daysAhead)
  d.setHours(hour, minute, 0, 0)
  return d
}

function gerarAulasMes(
  studentId: string,
  teacherId: string,
  subjectId: string,
  monthsAgo: number,
  quantidade: number,
  status: LessonStatus,
  rating: number | null,
  teacherMode: TeacherMode,
  hours: number[] = [9, 10, 11, 14, 15, 16, 17],
): Array<{
  studentId: string; teacherId: string; subjectId: string
  scheduledAt: Date; modality: LessonModality; teacherOnsite: boolean
  status: LessonStatus; studentRating: number | null; topicsCovered: string | null
}> {
  return Array.from({ length: quantidade }, (_, i) => {
    const day      = 2 + i * Math.floor(28 / quantidade)
    const hour     = hours[i % hours.length]
    const modality = i % 3 === 0 ? LessonModality.ONLINE : LessonModality.PRESENCIAL
    const teacherOnsite =
      teacherMode === TeacherMode.PRESENCIAL ||
      (teacherMode === TeacherMode.HYBRID && modality === LessonModality.PRESENCIAL)
    return {
      studentId,
      teacherId, subjectId,
      scheduledAt: pastDate(monthsAgo, day, hour),
      modality, teacherOnsite, status,
      studentRating: rating,
      topicsCovered: status === LessonStatus.COMPLETED
        ? (TOPICS_BY_SUBJECT[subjectId] ?? ["Revisão do conteúdo"])[i % (TOPICS_BY_SUBJECT[subjectId]?.length ?? 1)]
        : null,
    }
  })
}

async function main() {
  console.log("🌱 Limpando dados antigos...")
  
  // Helper para retry em caso de erro de prepared statement
  const withRetry = async (fn: () => Promise<any>, maxRetries = 3, delay = 500) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error: any) {
        if (i === maxRetries - 1) throw error
        if (error.message?.includes("prepared statement") || error.message?.includes("does not exist")) {
          console.warn(`⚠️  Erro de conexão, tentando novamente em ${delay}ms...`)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
        throw error
      }
    }
  }
  
  // Deletar em sequência com pequeno delay
  await withRetry(() => prisma.activityLog.deleteMany())
  await withRetry(() => prisma.notification.deleteMany())
  await withRetry(() => prisma.teacherPayout.deleteMany())
  await withRetry(() => prisma.payment.deleteMany())
  await withRetry(() => prisma.homework.deleteMany())
  await withRetry(() => prisma.lesson.deleteMany())
  await withRetry(() => prisma.lessonRequest.deleteMany())
  await withRetry(() => prisma.lessonPackage.deleteMany())
  await withRetry(() => prisma.teacherSubject.deleteMany())
  await withRetry(() => prisma.material.deleteMany())
  await withRetry(() => prisma.studentNote.deleteMany())
  await withRetry(() => prisma.student.deleteMany())
  await withRetry(() => prisma.guardian.deleteMany())
  await withRetry(() => prisma.teacher.deleteMany())
  await withRetry(() => prisma.subject.deleteMany())
  await withRetry(() => prisma.user.deleteMany())
  console.log("✅ Banco limpo")

  // ─── Matérias ──────────────────────────────────────────────────────────────
  // Criar sequencialmente para evitar erros de prepared statement no Supabase
  const subjects = [
    { id: "sub-mat", name: "Matemática",  level: "Todos"                },
    { id: "sub-por", name: "Português",   level: "Todos"                },
    { id: "sub-fis", name: "Física",      level: "Ensino Médio/Superior" },
    { id: "sub-qui", name: "Química",     level: "Ensino Médio/Superior" },
    { id: "sub-bio", name: "Biologia",    level: "Ensino Médio/Superior" },
    { id: "sub-his", name: "História",    level: "Todos"                },
    { id: "sub-geo", name: "Geografia",   level: "Todos"                },
    { id: "sub-ing", name: "Inglês",      level: "Todos"                },
  ]
  for (const s of subjects) {
    await prisma.subject.create({ data: s })
  }
  console.log("✅ 8 matérias")

  // ─── Admin ─────────────────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      id: "user-admin", name: "Administrador",
      email: "admin@licaodecasa.com.br", password: await hash("Admin@123"),
      role: Role.ADMIN, phone: "15999990001",
    },
  })

  // ─── Colaboradora ──────────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      id: "user-colab1", name: "Júlia Mendes",
      email: "julia@licaodecasa.com.br", password: await hash("Colab@123"),
      role: Role.COLLABORATOR, phone: "15999990002",
    },
  })
  console.log("✅ Admin + Colaborador")

  // ─── Professores ───────────────────────────────────────────────────────────
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
      bio: "Professora de Matemática e Física com 8 anos de experiência em reforço escolar e pré-vestibular.",
      subs: [
        { id: "sub-mat", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR] },
        { id: "sub-fis", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR, EducationLevel.SUPERIOR] },
      ],
    },
    {
      uid: "user-prof2", tid: "teacher-2", name: "Carlos Eduardo Lima",
      email: "carlos@licaodecasa.com.br", avail: availSeg_Qua_Sex,
      mode: TeacherMode.ONLINE_ONLY,
      bio: "Mestre em Letras com foco em redação dissertativa. Atende exclusivamente online.",
      subs: [
        { id: "sub-por", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR, EducationLevel.SUPERIOR] },
        { id: "sub-his", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR] },
      ],
    },
    {
      uid: "user-prof3", tid: "teacher-3", name: "Fernanda Rocha",
      email: "fernanda@licaodecasa.com.br", avail: avail5dias,
      mode: TeacherMode.HYBRID,
      bio: "Bióloga e química formada pela USP. Atende presencialmente na sede e online.",
      subs: [
        { id: "sub-qui", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR, EducationLevel.SUPERIOR] },
        { id: "sub-bio", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR, EducationLevel.SUPERIOR] },
      ],
    },
    {
      uid: "user-prof4", tid: "teacher-4", name: "Marcos Oliveira",
      email: "marcos@licaodecasa.com.br", avail: availTer_Qui_Sab,
      mode: TeacherMode.PRESENCIAL,
      bio: "Especialista em Ensino Fundamental. Atende presencialmente na sede.",
      subs: [
        { id: "sub-mat", levels: [EducationLevel.EF2, EducationLevel.EM] },
        { id: "sub-geo", levels: [EducationLevel.EF2, EducationLevel.EM] },
      ],
    },
    {
      uid: "user-prof5", tid: "teacher-5", name: "Patricia Santos",
      email: "patricia@licaodecasa.com.br", avail: availSeg_Qua_Sex,
      mode: TeacherMode.ONLINE_ONLY,
      bio: "Fluente em 4 idiomas. Especialista em inglês para negócios. Atende apenas online.",
      subs: [
        { id: "sub-ing", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.SUPERIOR, EducationLevel.VESTIBULAR] },
        { id: "sub-por", levels: [EducationLevel.EM, EducationLevel.SUPERIOR, EducationLevel.VESTIBULAR] },
      ],
    },
    {
      uid: "user-prof6", tid: "teacher-6", name: "Renato Alves",
      email: "renato@licaodecasa.com.br", avail: availTer_Qui_Sab,
      mode: TeacherMode.HYBRID,
      bio: "Engenheiro convertido ao ensino. Física e Matemática com foco em resolução de problemas.",
      subs: [
        { id: "sub-fis", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.SUPERIOR] },
        { id: "sub-mat", levels: [EducationLevel.EF2, EducationLevel.EM, EducationLevel.VESTIBULAR] },
      ],
    },
  ]

  for (const t of professores) {
    const fone = `159${Math.floor(Math.random() * 9000 + 1000)}${Math.floor(Math.random() * 9000 + 1000)}`
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
  console.log(`✅ ${professores.length} professores`)

  // ─── Responsáveis (GUARDIAN) — os que fazem login no portal do aluno ────────
  //
  // Modelo: somente o RESPONSÁVEL faz login. Alunos não têm conta de usuário
  // (Student.userId é opcional). Exceção: alunos adultos são próprios responsáveis.
  //
  // Cenário especial: Sr. Martins tem 2 filhos (Bruno + Amanda) → testa seletor de aluno.
  // Camila e Pedro (adultos) são próprios responsáveis.

  // Guardião 1 — Mãe do Lucas (student-1)
  await prisma.user.create({ data: { id: "user-guard1", name: "Sandra Alves", email: "mae.lucas@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991001" } })
  await prisma.guardian.create({ data: { id: "guardian-1", userId: "user-guard1", relationship: "Mãe" } })

  // Guardião 2 — Mãe da Isabela (student-2)
  await prisma.user.create({ data: { id: "user-guard2", name: "Rita Ferreira", email: "mae.isabela@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991002" } })
  await prisma.guardian.create({ data: { id: "guardian-2", userId: "user-guard2", relationship: "Mãe" } })

  // Guardião 3 — Pai do Gabriel (student-3)
  await prisma.user.create({ data: { id: "user-guard3", name: "Roberto Souza", email: "pai.gabriel@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991003" } })
  await prisma.guardian.create({ data: { id: "guardian-3", userId: "user-guard3", relationship: "Pai" } })

  // Guardião 4 — Mãe da Maria Clara (student-4)
  await prisma.user.create({ data: { id: "user-guard4", name: "Fernanda Lima", email: "mae.mariaclara@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991004" } })
  await prisma.guardian.create({ data: { id: "guardian-4", userId: "user-guard4", relationship: "Mãe" } })

  // Guardião 5 — Pedro (vestibular, adulto, próprio responsável)
  await prisma.user.create({ data: { id: "user-guard5", name: "Pedro Henrique", email: "pedro@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991005" } })
  await prisma.guardian.create({ data: { id: "guardian-5", userId: "user-guard5", relationship: "Próprio" } })

  // Guardião 6 — Mãe da Larissa (student-6)
  await prisma.user.create({ data: { id: "user-guard6", name: "Marcia Costa", email: "mae.larissa@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991006" } })
  await prisma.guardian.create({ data: { id: "guardian-6", userId: "user-guard6", relationship: "Mãe" } })

  // Guardião 7 — Pai do Bruno E da Amanda (2 filhos — testa seletor!)
  await prisma.user.create({ data: { id: "user-guard7", name: "Carlos Martins", email: "pai.martins@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991007" } })
  await prisma.guardian.create({ data: { id: "guardian-7", userId: "user-guard7", relationship: "Pai" } })

  // Guardião 8 — Mãe do Thiago (student-9)
  await prisma.user.create({ data: { id: "user-guard8", name: "Luciana Barbosa", email: "mae.thiago@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991008" } })
  await prisma.guardian.create({ data: { id: "guardian-8", userId: "user-guard8", relationship: "Mãe" } })

  // Guardião 9 — Camila (Superior, adulta, própria responsável)
  await prisma.user.create({ data: { id: "user-guard9", name: "Camila Pereira", email: "camila@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991009" } })
  await prisma.guardian.create({ data: { id: "guardian-9", userId: "user-guard9", relationship: "Próprio" } })

  // Guardião 10 — Mãe do Vinícius (student-11)
  await prisma.user.create({ data: { id: "user-guard10", name: "Patrícia Rocha", email: "mae.vinicius@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991010" } })
  await prisma.guardian.create({ data: { id: "guardian-10", userId: "user-guard10", relationship: "Mãe" } })

  // Guardião 11 — Mãe da Letícia (student-12)
  await prisma.user.create({ data: { id: "user-guard11", name: "Claudia Gomes", email: "mae.leticia@email.com", password: await hash("Resp@123"), role: Role.GUARDIAN, phone: "15999991011" } })
  await prisma.guardian.create({ data: { id: "guardian-11", userId: "user-guard11", relationship: "Mãe" } })

  console.log("✅ 11 responsáveis (9 pais/mães + 2 adultos próprios responsáveis)")

  // ─── Alunos (SEM conta de usuário — Student.userId é opcional) ─────────────
  // Pedro e Camila são seus próprios responsáveis (guardian-5 e guardian-9)
  const alunosDefs: {
    id: string; name: string; grade: string
    educationLevel: EducationLevel; guardianId: string; school?: string; tags?: string[]
  }[] = [
    { id: "student-1",  name: "Lucas Alves",       grade: "9º EF",      educationLevel: EducationLevel.EF2,        guardianId: "guardian-1",  school: "E.E. João Paulo II",  tags: ["Reforço escolar"]                          },
    { id: "student-2",  name: "Isabela Ferreira",  grade: "1º EM",      educationLevel: EducationLevel.EM,         guardianId: "guardian-2",  school: "Colégio São Paulo",   tags: ["ENEM 2027"]                                 },
    { id: "student-3",  name: "Gabriel Souza",     grade: "2º EM",      educationLevel: EducationLevel.EM,         guardianId: "guardian-3",  school: "Colégio São Paulo",   tags: ["Foco exatas", "Pré-vestibular"]             },
    { id: "student-4",  name: "Maria Clara Lima",  grade: "3º EM",      educationLevel: EducationLevel.EM,         guardianId: "guardian-4",  school: "E.E. João Paulo II",  tags: ["ENEM 2026", "Pagamento Pix"]                },
    { id: "student-5",  name: "Pedro Henrique",    grade: "Vestibular", educationLevel: EducationLevel.VESTIBULAR, guardianId: "guardian-5",                                  tags: ["FUVEST 2026", "Foco exatas", "Pré-vestibular"]},
    { id: "student-6",  name: "Larissa Costa",     grade: "8º EF",      educationLevel: EducationLevel.EF2,        guardianId: "guardian-6",  school: "Escola Municipal ABC", tags: []                                           },
    { id: "student-7",  name: "Bruno Martins",     grade: "6º EF",      educationLevel: EducationLevel.EF2,        guardianId: "guardian-7",  school: "Escola Municipal ABC", tags: ["Reforço escolar"]                          },
    { id: "student-8",  name: "Amanda Martins",    grade: "7º EF",      educationLevel: EducationLevel.EF2,        guardianId: "guardian-7",  school: "Escola Municipal ABC", tags: ["Reforço escolar"]                          },
    { id: "student-9",  name: "Thiago Barbosa",    grade: "1º EM",      educationLevel: EducationLevel.EM,         guardianId: "guardian-8",  school: "Colégio São Paulo",   tags: ["Pagamento pendente"]                        },
    { id: "student-10", name: "Camila Pereira",    grade: "Superior",   educationLevel: EducationLevel.SUPERIOR,   guardianId: "guardian-9",                                  tags: ["Inglês avançado", "Superior"]               },
    { id: "student-11", name: "Vinícius Rocha",    grade: "2º EM",      educationLevel: EducationLevel.EM,         guardianId: "guardian-10", school: "Colégio São Paulo",   tags: ["ENEM 2026", "Pagamento pendente"]           },
    { id: "student-12", name: "Letícia Gomes",     grade: "3º EM",      educationLevel: EducationLevel.EM,         guardianId: "guardian-11", school: "E.E. João Paulo II",  tags: ["ENEM 2026"]                                 },
  ]

  for (const s of alunosDefs) {
    await prisma.student.create({
      data: {
        id: s.id, name: s.name, grade: s.grade, educationLevel: s.educationLevel,
        guardianId: s.guardianId, school: s.school ?? null, tags: s.tags ?? [],
      },
    })
  }
  console.log(`✅ ${alunosDefs.length} alunos (sem conta de login — login via responsável)`)

  // ─── Pacotes de Aulas ──────────────────────────────────────────────────────
  const pacotes = [
    { id: "pkg-1",  sid: "student-1",  total: 20, remaining: 8,  status: PackageStatus.ACTIVE    },
    { id: "pkg-2",  sid: "student-2",  total: 10, remaining: 3,  status: PackageStatus.ACTIVE    },
    { id: "pkg-3",  sid: "student-3",  total: 20, remaining: 12, status: PackageStatus.ACTIVE    },
    { id: "pkg-4",  sid: "student-4",  total: 10, remaining: 0,  status: PackageStatus.EXHAUSTED },
    { id: "pkg-4b", sid: "student-4",  total: 20, remaining: 14, status: PackageStatus.ACTIVE    },
    { id: "pkg-5",  sid: "student-5",  total: 20, remaining: 6,  status: PackageStatus.ACTIVE    },
    { id: "pkg-6",  sid: "student-6",  total: 10, remaining: 5,  status: PackageStatus.ACTIVE    },
    { id: "pkg-7",  sid: "student-7",  total: 10, remaining: 7,  status: PackageStatus.ACTIVE    },
    { id: "pkg-8",  sid: "student-8",  total: 20, remaining: 10, status: PackageStatus.ACTIVE    },
    { id: "pkg-9",  sid: "student-9",  total: 10, remaining: 2,  status: PackageStatus.ACTIVE    },
    { id: "pkg-10", sid: "student-10", total: 20, remaining: 11, status: PackageStatus.ACTIVE    },
    { id: "pkg-11", sid: "student-11", total: 10, remaining: 4,  status: PackageStatus.ACTIVE    },
    { id: "pkg-12", sid: "student-12", total: 10, remaining: 1,  status: PackageStatus.ACTIVE    },
  ]

  for (const p of pacotes) {
    await prisma.lessonPackage.create({
      data: {
        id: p.id, studentId: p.sid,
        totalLessons: p.total, remainingLessons: p.remaining,
        pricePerLesson: PRECO_AULA,
        purchaseDate:   subMonths(now, Math.floor(Math.random() * 4 + 1)),
        expiresAt:      new Date(now.getFullYear(), now.getMonth() + 6, 1),
        status:         p.status,
      },
    })
  }
  console.log(`✅ ${pacotes.length} pacotes (R$${PRECO_AULA}/aula)`)

  // ─── Aulas ────────────────────────────────────────────────────────────────
  const T1 = TeacherMode.PRESENCIAL
  const T2 = TeacherMode.ONLINE_ONLY
  const T3 = TeacherMode.HYBRID
  const T4 = TeacherMode.PRESENCIAL
  const T5 = TeacherMode.ONLINE_ONLY
  const T6 = TeacherMode.HYBRID

  const todasAulas: ReturnType<typeof gerarAulasMes>[0][] = [
    ...gerarAulasMes("student-1","teacher-1","sub-mat",5,7,LessonStatus.COMPLETED,5,T1),
    ...gerarAulasMes("student-1","teacher-1","sub-mat",4,7,LessonStatus.COMPLETED,4,T1),
    ...gerarAulasMes("student-1","teacher-1","sub-fis",3,4,LessonStatus.COMPLETED,5,T1),
    ...gerarAulasMes("student-1","teacher-1","sub-mat",2,7,LessonStatus.COMPLETED,5,T1),
    ...gerarAulasMes("student-1","teacher-1","sub-mat",1,6,LessonStatus.COMPLETED,4,T1),
    ...gerarAulasMes("student-1","teacher-1","sub-mat",0,2,LessonStatus.SCHEDULED,null,T1),

    ...gerarAulasMes("student-2","teacher-2","sub-por",5,4,LessonStatus.COMPLETED,4,T2),
    ...gerarAulasMes("student-2","teacher-2","sub-por",4,4,LessonStatus.COMPLETED,5,T2),
    ...gerarAulasMes("student-2","teacher-2","sub-his",3,4,LessonStatus.COMPLETED,4,T2),
    ...gerarAulasMes("student-2","teacher-2","sub-por",2,4,LessonStatus.COMPLETED,5,T2),
    ...gerarAulasMes("student-2","teacher-2","sub-por",1,3,LessonStatus.COMPLETED,4,T2),
    ...gerarAulasMes("student-2","teacher-2","sub-por",0,1,LessonStatus.CONFIRMED,null,T2),

    ...gerarAulasMes("student-3","teacher-3","sub-qui",5,5,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-3","teacher-3","sub-qui",4,5,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-3","teacher-3","sub-bio",3,5,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-3","teacher-3","sub-qui",2,5,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-3","teacher-3","sub-qui",1,4,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-3","teacher-3","sub-qui",0,2,LessonStatus.SCHEDULED,null,T3),

    ...gerarAulasMes("student-4","teacher-4","sub-mat",5,6,LessonStatus.COMPLETED,4,T4,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-4","teacher-4","sub-geo",4,6,LessonStatus.COMPLETED,4,T4,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-4","teacher-4","sub-mat",3,6,LessonStatus.COMPLETED,5,T4,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-4","teacher-4","sub-mat",2,6,LessonStatus.COMPLETED,4,T4,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-4","teacher-4","sub-mat",1,5,LessonStatus.COMPLETED,5,T4,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-4","teacher-4","sub-mat",0,2,LessonStatus.CONFIRMED,null,T4,[14,15,16,17,18,19,20]),

    ...gerarAulasMes("student-5","teacher-5","sub-ing",5,7,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-5","teacher-5","sub-ing",4,7,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-5","teacher-5","sub-por",3,7,LessonStatus.COMPLETED,4,T5),
    ...gerarAulasMes("student-5","teacher-5","sub-ing",2,7,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-5","teacher-5","sub-ing",1,6,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-5","teacher-5","sub-ing",0,2,LessonStatus.SCHEDULED,null,T5),

    ...gerarAulasMes("student-6","teacher-6","sub-fis",4,4,LessonStatus.COMPLETED,4,T6,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-6","teacher-6","sub-fis",3,4,LessonStatus.COMPLETED,4,T6,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-6","teacher-6","sub-mat",2,4,LessonStatus.COMPLETED,3,T6,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-6","teacher-6","sub-fis",1,3,LessonStatus.COMPLETED,4,T6,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-6","teacher-6","sub-fis",0,1,LessonStatus.SCHEDULED,null,T6,[14,15,16,17,18,19,20]),

    ...gerarAulasMes("student-7","teacher-4","sub-mat",3,4,LessonStatus.COMPLETED,4,T4,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-7","teacher-4","sub-mat",2,4,LessonStatus.COMPLETED,3,T4,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-7","teacher-4","sub-mat",1,3,LessonStatus.COMPLETED,4,T4,[14,15,16,17,18,19,20]),
    ...gerarAulasMes("student-7","teacher-4","sub-mat",0,1,LessonStatus.SCHEDULED,null,T4,[14,15,16,17,18,19,20]),

    // Amanda (irmã do Bruno — mesmo guardião guardian-7)
    ...gerarAulasMes("student-8","teacher-3","sub-bio",5,5,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-8","teacher-3","sub-bio",4,5,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-8","teacher-3","sub-qui",3,5,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-8","teacher-3","sub-bio",2,5,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-8","teacher-3","sub-bio",1,4,LessonStatus.COMPLETED,5,T3),
    ...gerarAulasMes("student-8","teacher-3","sub-bio",0,1,LessonStatus.CONFIRMED,null,T3),

    ...gerarAulasMes("student-9","teacher-1","sub-fis",4,4,LessonStatus.COMPLETED,4,T1),
    ...gerarAulasMes("student-9","teacher-1","sub-fis",3,4,LessonStatus.COMPLETED,5,T1),
    ...gerarAulasMes("student-9","teacher-1","sub-mat",2,4,LessonStatus.COMPLETED,4,T1),
    ...gerarAulasMes("student-9","teacher-1","sub-fis",1,3,LessonStatus.COMPLETED,4,T1),
    ...gerarAulasMes("student-9","teacher-1","sub-fis",0,1,LessonStatus.SCHEDULED,null,T1),

    ...gerarAulasMes("student-10","teacher-5","sub-ing",5,6,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-10","teacher-5","sub-ing",4,6,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-10","teacher-5","sub-por",3,6,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-10","teacher-5","sub-ing",2,6,LessonStatus.COMPLETED,5,T5),
    ...gerarAulasMes("student-10","teacher-5","sub-ing",1,5,LessonStatus.COMPLETED,4,T5),
    ...gerarAulasMes("student-10","teacher-5","sub-ing",0,2,LessonStatus.CONFIRMED,null,T5),

    ...gerarAulasMes("student-11","teacher-3","sub-qui",4,5,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-11","teacher-3","sub-qui",3,5,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-11","teacher-3","sub-qui",2,5,LessonStatus.COMPLETED,3,T3),
    ...gerarAulasMes("student-11","teacher-3","sub-qui",1,4,LessonStatus.COMPLETED,4,T3),
    ...gerarAulasMes("student-11","teacher-3","sub-qui",0,1,LessonStatus.SCHEDULED,null,T3),

    ...gerarAulasMes("student-12","teacher-2","sub-his",3,4,LessonStatus.COMPLETED,4,T2),
    ...gerarAulasMes("student-12","teacher-2","sub-por",2,4,LessonStatus.COMPLETED,5,T2),
    ...gerarAulasMes("student-12","teacher-2","sub-his",1,4,LessonStatus.COMPLETED,5,T2),
    ...gerarAulasMes("student-12","teacher-2","sub-his",0,1,LessonStatus.SCHEDULED,null,T2),
  ]

  for (const aula of todasAulas) {
    const { studentId, ...lessonData } = aula
    await prisma.lesson.create({
      data: { ...lessonData, participants: { create: { studentId } } },
    })
  }
  console.log(`✅ ${todasAulas.length} aulas criadas`)

  // ─── Pagamentos ────────────────────────────────────────────────────────────
  const pagamentoDefs: { sid: string; amount: number; monthsAgo: number; status: PaymentStatus }[] = [
    { sid: "student-1",  amount: 20 * PRECO_AULA, monthsAgo: 5, status: PaymentStatus.PAID    },
    { sid: "student-1",  amount: 20 * PRECO_AULA, monthsAgo: 2, status: PaymentStatus.PAID    },
    { sid: "student-2",  amount: 10 * PRECO_AULA, monthsAgo: 5, status: PaymentStatus.PAID    },
    { sid: "student-2",  amount: 10 * PRECO_AULA, monthsAgo: 2, status: PaymentStatus.PAID    },
    { sid: "student-2",  amount: 10 * PRECO_AULA, monthsAgo: 0, status: PaymentStatus.PENDING },
    { sid: "student-3",  amount: 20 * PRECO_AULA, monthsAgo: 4, status: PaymentStatus.PAID    },
    { sid: "student-3",  amount: 20 * PRECO_AULA, monthsAgo: 0, status: PaymentStatus.PENDING },
    { sid: "student-4",  amount: 10 * PRECO_AULA, monthsAgo: 4, status: PaymentStatus.PAID    },
    { sid: "student-4",  amount: 20 * PRECO_AULA, monthsAgo: 2, status: PaymentStatus.PAID    },
    { sid: "student-5",  amount: 20 * PRECO_AULA, monthsAgo: 5, status: PaymentStatus.PAID    },
    { sid: "student-5",  amount: 20 * PRECO_AULA, monthsAgo: 2, status: PaymentStatus.PAID    },
    { sid: "student-5",  amount: 20 * PRECO_AULA, monthsAgo: 0, status: PaymentStatus.PENDING },
    { sid: "student-6",  amount: 10 * PRECO_AULA, monthsAgo: 4, status: PaymentStatus.PAID    },
    { sid: "student-6",  amount: 10 * PRECO_AULA, monthsAgo: 1, status: PaymentStatus.PAID    },
    { sid: "student-7",  amount: 10 * PRECO_AULA, monthsAgo: 3, status: PaymentStatus.PAID    },
    { sid: "student-8",  amount: 20 * PRECO_AULA, monthsAgo: 5, status: PaymentStatus.PAID    },
    { sid: "student-8",  amount: 20 * PRECO_AULA, monthsAgo: 1, status: PaymentStatus.PAID    },
    { sid: "student-9",  amount: 10 * PRECO_AULA, monthsAgo: 4, status: PaymentStatus.PAID    },
    { sid: "student-9",  amount: 10 * PRECO_AULA, monthsAgo: 1, status: PaymentStatus.OVERDUE },
    { sid: "student-10", amount: 20 * PRECO_AULA, monthsAgo: 5, status: PaymentStatus.PAID    },
    { sid: "student-10", amount: 20 * PRECO_AULA, monthsAgo: 2, status: PaymentStatus.PAID    },
    { sid: "student-11", amount: 10 * PRECO_AULA, monthsAgo: 4, status: PaymentStatus.PAID    },
    { sid: "student-11", amount: 10 * PRECO_AULA, monthsAgo: 1, status: PaymentStatus.OVERDUE },
    { sid: "student-12", amount: 10 * PRECO_AULA, monthsAgo: 3, status: PaymentStatus.PAID    },
    { sid: "student-12", amount: 10 * PRECO_AULA, monthsAgo: 0, status: PaymentStatus.PENDING },
  ]

  for (const p of pagamentoDefs) {
    const dueDate = startOfMonth(subMonths(now, p.monthsAgo))
    dueDate.setDate(10)
    const paidAt = p.status === PaymentStatus.PAID
      ? new Date(dueDate.getTime() + Math.random() * 7 * 86_400_000) : null
    await prisma.payment.create({
      data: {
        studentId: p.sid, amount: p.amount, dueDate, paidAt, status: p.status,
        method: p.status === PaymentStatus.PAID ? ["PIX","Cartão de Crédito","Boleto"][Math.floor(Math.random() * 3)] : null,
        description: `Pacote de ${p.amount / PRECO_AULA} aulas — R$${PRECO_AULA}/aula`,
      },
    })
  }
  console.log(`✅ ${pagamentoDefs.length} pagamentos`)

  // ─── Repasses aos Professores ──────────────────────────────────────────────
  const mesAtual    = now.getMonth() + 1
  const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
  const anoAtual    = now.getFullYear()

  const repasseDefs = [
    { tid: "teacher-1", month: mesAnterior, year: anoAtual, lessons: 28, rate: TAXAS_PROFESSOR["teacher-1"], paid: true  },
    { tid: "teacher-2", month: mesAnterior, year: anoAtual, lessons: 16, rate: TAXAS_PROFESSOR["teacher-2"], paid: true  },
    { tid: "teacher-3", month: mesAnterior, year: anoAtual, lessons: 34, rate: TAXAS_PROFESSOR["teacher-3"], paid: true  },
    { tid: "teacher-4", month: mesAnterior, year: anoAtual, lessons: 19, rate: TAXAS_PROFESSOR["teacher-4"], paid: true  },
    { tid: "teacher-5", month: mesAnterior, year: anoAtual, lessons: 26, rate: TAXAS_PROFESSOR["teacher-5"], paid: true  },
    { tid: "teacher-6", month: mesAnterior, year: anoAtual, lessons: 12, rate: TAXAS_PROFESSOR["teacher-6"], paid: false },
    { tid: "teacher-1", month: mesAtual, year: anoAtual, lessons: 6,  rate: TAXAS_PROFESSOR["teacher-1"], paid: false },
    { tid: "teacher-3", month: mesAtual, year: anoAtual, lessons: 5,  rate: TAXAS_PROFESSOR["teacher-3"], paid: false },
    { tid: "teacher-5", month: mesAtual, year: anoAtual, lessons: 4,  rate: TAXAS_PROFESSOR["teacher-5"], paid: false },
  ]

  for (const r of repasseDefs) {
    await prisma.teacherPayout.create({
      data: {
        teacherId: r.tid, month: r.month, year: r.year,
        totalLessons: r.lessons, totalAmount: r.lessons * r.rate,
        status: r.paid ? "PAID" : "PENDING",
        paidAt: r.paid ? subMonths(now, 1) : null,
      },
    })
  }
  console.log(`✅ ${repasseDefs.length} repasses`)

  // ─── Solicitações Pendentes ────────────────────────────────────────────────
  await prisma.lessonRequest.createMany({
    data: [
      {
        studentId: "student-7",  teacherId: "teacher-4", subjectId: "sub-mat",
        modality: LessonModality.PRESENCIAL, preferredAt: futureAt(1, 15), status: RequestStatus.PENDING,
        reason: "Preciso de reforço urgente para prova de sexta",
      },
      {
        studentId: "student-9",  teacherId: "teacher-1", subjectId: "sub-fis",
        modality: LessonModality.ONLINE, preferredAt: futureAt(1, 15, 30), status: RequestStatus.PENDING,
        reason: "Prefiro online hoje",
      },
      {
        studentId: "student-11", teacherId: "teacher-3", subjectId: "sub-qui",
        modality: LessonModality.ONLINE, preferredAt: futureAt(2, 9), status: RequestStatus.PENDING,
        reason: "Dificuldade com reações químicas",
      },
      {
        studentId: "student-12", teacherId: "teacher-2", subjectId: "sub-his",
        modality: LessonModality.ONLINE, preferredAt: futureAt(3, 11), status: RequestStatus.PENDING,
        reason: "Revisão para ENEM",
      },
    ],
  })
  console.log("✅ 4 solicitações pendentes")

  // ─── Aulas em Grupo ───────────────────────────────────────────────────────
  const PRECO_GRUPO_QUIMICA = 70
  const PRECO_GRUPO_MAT     = 65

  const groupDate1 = pastDate(1, 12, 15)
  await prisma.lesson.create({
    data: {
      teacherId: "teacher-3", subjectId: "sub-qui", scheduledAt: groupDate1,
      modality: LessonModality.PRESENCIAL, status: LessonStatus.COMPLETED,
      teacherOnsite: true, priceOverride: PRECO_GRUPO_QUIMICA,
      topicsCovered: "Ácidos e bases — pH e escala pOH",
      participants: { create: [
        { studentId: "student-3"  },
        { studentId: "student-8"  },
        { studentId: "student-11" },
      ]},
    },
  })
  await prisma.payment.createMany({
    data: [
      { studentId: "student-3",  amount: PRECO_GRUPO_QUIMICA, dueDate: groupDate1, paidAt: groupDate1, status: PaymentStatus.PAID, description: "Aula em grupo – Química (3 alunos)" },
      { studentId: "student-8",  amount: PRECO_GRUPO_QUIMICA, dueDate: groupDate1, paidAt: groupDate1, status: PaymentStatus.PAID, description: "Aula em grupo – Química (3 alunos)" },
      { studentId: "student-11", amount: PRECO_GRUPO_QUIMICA, dueDate: groupDate1, paidAt: groupDate1, status: PaymentStatus.PAID, description: "Aula em grupo – Química (3 alunos)" },
    ],
  })

  const groupDate2 = addHours(now, 7 * 24)
  await prisma.lesson.create({
    data: {
      teacherId: "teacher-1", subjectId: "sub-mat", scheduledAt: groupDate2,
      modality: LessonModality.PRESENCIAL, status: LessonStatus.CONFIRMED,
      teacherOnsite: true, priceOverride: PRECO_GRUPO_MAT,
      participants: { create: [
        { studentId: "student-1" },
        { studentId: "student-7" },
      ]},
    },
  })
  await prisma.payment.createMany({
    data: [
      { studentId: "student-1", amount: PRECO_GRUPO_MAT, dueDate: groupDate2, status: PaymentStatus.PENDING, description: "Aula em grupo – Matemática (2 alunos)" },
      { studentId: "student-7", amount: PRECO_GRUPO_MAT, dueDate: groupDate2, status: PaymentStatus.PENDING, description: "Aula em grupo – Matemática (2 alunos)" },
    ],
  })

  await prisma.lessonRequest.create({
    data: {
      studentId: "student-5", teacherId: "teacher-1", subjectId: "sub-fis",
      modality: LessonModality.PRESENCIAL, preferredAt: futureAt(4, 17), status: RequestStatus.PENDING,
      reason: "Quero fazer aula em grupo com colegas",
      isGroupRequest: true,
      groupNote: "Quero aula com alguém revisando cinemática",
    },
  })
  console.log("✅ 5 aulas em grupo")

  // ─── Notificações (para admin, colab e guardiões) ─────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: "user-admin",  type: "PAYMENT_OVERDUE",     title: "Pagamentos em atraso",    message: "2 alunos com pagamentos vencidos (Thiago e Vinícius).", read: false },
      { userId: "user-admin",  type: "LESSON_REQUEST",      title: "Novas solicitações",       message: "4 agendamentos aguardando aprovação.", read: false },
      { userId: "user-colab1", type: "LESSON_REQUEST",      title: "Agendamento pendente",     message: "Bruno Martins solicitou aula de Matemática.", read: false },
      { userId: "user-guard1", type: "LESSON_CONFIRMED",    title: "Aula confirmada",           message: "Próxima aula de Matemática do Lucas está confirmada.", read: false },
      { userId: "user-guard5", type: "PACKAGE_LOW_BALANCE", title: "Saldo baixo",              message: "Pedro tem apenas 6 aulas restantes no pacote.", read: true  },
      { userId: "user-guard8", type: "PAYMENT_OVERDUE",     title: "Pagamento vencido",        message: "Pagamento do pacote do Thiago venceu. Regularize para continuar.", read: false },
    ],
  })
  console.log("✅ Notificações")

  // ─── Aulas confirmadas para HOJE ─────────────────────────────────────────
  const aulasDeHoje = [
    { studentId: "student-2",  teacherId: "teacher-2", subjectId: "sub-por",
      scheduledAt: todayAt(9),      modality: LessonModality.ONLINE,     teacherOnsite: false },
    { studentId: "student-4",  teacherId: "teacher-4", subjectId: "sub-mat",
      scheduledAt: todayAt(14, 30), modality: LessonModality.PRESENCIAL,  teacherOnsite: true  },
    { studentId: "student-5",  teacherId: "teacher-1", subjectId: "sub-fis",
      scheduledAt: todayAt(14),     modality: LessonModality.PRESENCIAL,  teacherOnsite: true  },
    { studentId: "student-10", teacherId: "teacher-5", subjectId: "sub-ing",
      scheduledAt: todayAt(16),     modality: LessonModality.ONLINE,     teacherOnsite: false },
  ]
  for (const a of aulasDeHoje) {
    const { studentId, ...lessonData } = a
    await prisma.lesson.create({
      data: { ...lessonData, status: LessonStatus.CONFIRMED, participants: { create: { studentId } } },
    })
  }
  console.log(`✅ ${aulasDeHoje.length} aulas confirmadas para hoje`)

  // ─── Solicitações adicionais ──────────────────────────────────────────────
  await prisma.lessonRequest.createMany({
    data: [
      {
        studentId: "student-3", teacherId: "teacher-3", subjectId: "sub-qui",
        modality: LessonModality.PRESENCIAL, preferredAt: futureAt(1, 14),
        status: RequestStatus.PENDING, reason: "Prova de Química na semana que vem",
      },
      {
        studentId: "student-6", teacherId: "teacher-6", subjectId: "sub-fis",
        modality: LessonModality.ONLINE, preferredAt: futureAt(2, 14, 30),
        status: RequestStatus.PENDING, reason: null,
      },
      {
        studentId: "student-1", teacherId: "teacher-1", subjectId: "sub-mat",
        modality: LessonModality.PRESENCIAL, preferredAt: futureAt(3, 16),
        status: RequestStatus.PENDING, reason: "Dificuldade com equações do 2º grau",
      },
      {
        studentId: "student-8", teacherId: "teacher-3", subjectId: "sub-bio",
        modality: LessonModality.PRESENCIAL, preferredAt: futureAt(4, 9, 30),
        status: RequestStatus.PENDING, reason: null,
      },
    ],
  })
  console.log("✅ 4 solicitações adicionais pendentes")

  // ─── Demo de conflito: Bruno solicita Ana às 14h30, mas ela já tem aula às 14h ──
  await prisma.lessonRequest.create({
    data: {
      studentId: "student-7",
      teacherId: "teacher-1",
      subjectId: "sub-mat",
      modality:  LessonModality.PRESENCIAL,
      preferredAt: todayAt(14, 30),
      status:    RequestStatus.PENDING,
      reason:    "Tenho prova amanhã, preciso de ajuda com geometria",
    },
  })
  console.log("✅ 1 solicitação com conflito (Bruno → Ana às 14h30, Pedro já confirmado às 14h)")

  // ─── Notificações extras para o colaborador ───────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: "user-colab1", type: "LESSON_REQUEST", read: false,
        title: "Novo pedido — Gabriel Souza",
        message: "Gabriel solicitou aula de Química com Fernanda para amanhã (presencial).",
      },
      {
        userId: "user-colab1", type: "LESSON_REQUEST", read: false,
        title: "Novo pedido — Lucas Alves",
        message: "Lucas quer aula de Matemática com Ana depois de amanhã.",
      },
      {
        userId: "user-colab1", type: "PAYMENT_OVERDUE", read: false,
        title: "Cobrança urgente — Thiago Barbosa",
        message: "Pacote de Thiago está há 41 dias sem pagamento (R$ 900).",
      },
      {
        userId: "user-colab1", type: "PAYMENT_OVERDUE", read: false,
        title: "Cobrança urgente — Vinícius Rocha",
        message: "Pacote de Vinícius está há 41 dias sem pagamento (R$ 900).",
      },
      {
        userId: "user-colab1", type: "LESSON_CONFIRMED", read: true,
        title: "Agenda do dia",
        message: "4 aulas confirmadas para hoje: Carlos (9h), Marcos (10h30), Ana (14h), Patrícia (16h).",
      },
    ],
  })
  console.log("✅ 5 notificações extras para colaborador")

  // ─── Aulas Faltadas (MISSED) — para heatmap ter pontos vermelhos ────────────
  const aulasFaltadas = [
    ...gerarAulasMes("student-1","teacher-1","sub-mat",2,2,LessonStatus.MISSED,null,T1),
    ...gerarAulasMes("student-4","teacher-4","sub-mat",1,1,LessonStatus.MISSED,null,T4,[14,15,16,17]),
    ...gerarAulasMes("student-9","teacher-1","sub-fis",1,2,LessonStatus.MISSED,null,T1),
    ...gerarAulasMes("student-10","teacher-5","sub-ing",0,1,LessonStatus.MISSED,null,T5),
  ]
  for (const aula of aulasFaltadas) {
    const { studentId, ...lessonData } = aula
    await prisma.lesson.create({
      data: { ...lessonData, participants: { create: { studentId } } },
    })
  }
  console.log(`✅ ${aulasFaltadas.length} aulas faltadas (MISSED)`)

  // ─── Notas dos Alunos (StudentNote) ──────────────────────────────────────
  await prisma.studentNote.createMany({
    data: [
      // student-4 (Maria Clara) — 2 notas
      {
        studentId: "student-4", authorId: "user-prof1",
        content: "Maria Clara está evoluindo bem em trigonometria, mas ainda tem dúvidas em logaritmos. Próxima aula focar em exercícios do ENEM.",
        createdAt: subMonths(now, 0),
      },
      {
        studentId: "student-4", authorId: "user-admin",
        content: "Mãe pediu para evitar aulas às sextas-feiras. Preferência por horários à tarde.",
        createdAt: subMonths(now, 1),
      },

      // student-5 (Pedro) — 2 notas
      {
        studentId: "student-5", authorId: "user-prof5",
        content: "Pedro tem fluência boa no inglês oral mas precisa melhorar writing acadêmico. Recomendo mais exercícios de essay.",
        createdAt: subMonths(now, 0),
      },
      {
        studentId: "student-5", authorId: "user-colab1",
        content: "Pedro pediu para encaixar aula extra antes do vestibular. Verificar disponibilidade da Patricia.",
        createdAt: subMonths(now, 0),
      },

      // student-10 (Camila) — 2 notas
      {
        studentId: "student-10", authorId: "user-prof5",
        content: "Camila está confiante em funções, mas tem dúvidas em vocabulário técnico de inglês para área de saúde. Próxima aula focar em medical English.",
        createdAt: addDays(now, -7),
      },
      {
        studentId: "student-10", authorId: "user-admin",
        content: "Responsável pediu relatório mensal de evolução. Configurar envio automático no dia 25.",
        createdAt: subMonths(now, 1),
      },
    ],
  })
  console.log("✅ 6 notas de alunos (StudentNote)")

  // ─── Resumo ────────────────────────────────────────────────────────────────
  const totalAulasRealizadas = todasAulas.filter((a) => a.status === LessonStatus.COMPLETED).length
  const receitaTotal = pagamentoDefs.filter((p) => p.status === PaymentStatus.PAID).reduce((s, p) => s + p.amount, 0)

  console.log("\n🎉 Seed concluído!")
  console.log("═".repeat(60))
  console.log("  CREDENCIAIS DE ACESSO")
  console.log("═".repeat(60))
  console.log("  Admin:        admin@licaodecasa.com.br   / Admin@123")
  console.log("  Colaborador:  julia@licaodecasa.com.br   / Colab@123")
  console.log("  Professor:    ana@licaodecasa.com.br     / Prof@123")
  console.log("─".repeat(60))
  console.log("  Responsável (1 filho):   mae.lucas@email.com      / Resp@123  → Lucas")
  console.log("  Responsável (1 filho):   mae.isabela@email.com    / Resp@123  → Isabela")
  console.log("  Responsável (2 filhos):  pai.martins@email.com    / Resp@123  → Bruno + Amanda ⭐")
  console.log("  Resp. adulto (próprio):  pedro@email.com          / Resp@123  → Pedro")
  console.log("  Resp. adulto (próprio):  camila@email.com         / Resp@123  → Camila")
  console.log("═".repeat(60))
  console.log(`  Alunos: ${alunosDefs.length} (sem login)  |  Responsáveis: 11  |  Professores: ${professores.length}`)
  console.log(`  Aulas: ${todasAulas.length} (${totalAulasRealizadas} realizadas)  |  Receita: R$${receitaTotal.toLocaleString("pt-BR")}`)
  console.log("═".repeat(60))
  console.log("  ⭐ pai.martins@email.com tem 2 filhos → testa seletor de aluno")
  console.log("═".repeat(60))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
