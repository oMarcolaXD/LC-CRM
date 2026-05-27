"use server"

import { prisma }            from "@/lib/prisma"
import { auth }              from "@/lib/auth"
import { revalidatePath }    from "next/cache"
import { redirect }          from "next/navigation"
import { notify }            from "@/lib/notifications"
import { sendWelcomeEmail }  from "@/lib/email"
import { format }            from "date-fns"
import { ptBR }              from "date-fns/locale"
import bcrypt                from "bcryptjs"
import { z }                 from "zod"

function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!"
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

// ─── Schemas internos ─────────────────────────────────────────────────────────

const pastLessonSchema = z.object({
  date:      z.string(),
  time:      z.string().default("08:00"),
  teacherId: z.string().min(1),
  subjectId: z.string().min(1),
  duration:  z.string().default("60"),
  modality:  z.enum(["PRESENCIAL", "ONLINE"]).default("PRESENCIAL"),
  topics:    z.string().optional(),
  status:    z.enum(["COMPLETED", "MISSED"]).default("COMPLETED"),
})

const pastPaymentSchema = z.object({
  amount:      z.string().min(1),
  dueDate:     z.string().min(1),
  paidAt:      z.string().optional(),
  status:      z.enum(["PAID", "PENDING", "OVERDUE"]).default("PAID"),
  method:      z.string().optional(),
  description: z.string().optional(),
})

async function requireCollaboratorOrAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")
  if (!["ADMIN", "COLLABORATOR"].includes(session.user.role)) throw new Error("Sem permissão")
  return session
}

// ─── Cadastrar Aluno (com responsável opcional) ────────────────────────────────

const newStudentSchema = z.object({
  name:          z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email:         z.string().email("E-mail inválido"),
  password:      z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional().or(z.literal("")),
  phone:         z.string().optional(),
  grade:         z.string().optional(),
  school:        z.string().optional(),
  guardianName:  z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email("E-mail do responsável inválido").optional().or(z.literal("")),
})

export async function createStudentWithGuardianAction(formData: FormData) {
  await requireCollaboratorOrAdmin()

  const raw    = Object.fromEntries(formData)
  const parsed = newStudentSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos"
    redirect(`/colaborador/alunos/novo?error=${encodeURIComponent(msg)}`)
  }

  const { name, email, phone, grade, school,
          guardianName, guardianPhone, guardianEmail } = parsed.data

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) redirect("/colaborador/alunos/novo?error=E-mail+já+cadastrado")

  const skipEmail    = formData.get("skipEmail") === "on"
  const manualPass   = parsed.data.password
  const plainPassword = (skipEmail && manualPass) ? manualPass : generateRandomPassword()

  if (skipEmail && (!manualPass || manualPass.length < 6)) {
    redirect(`/colaborador/alunos/novo?error=${encodeURIComponent("Senha deve ter no mínimo 6 caracteres")}`)
  }

  const hashed  = await bcrypt.hash(plainPassword, 12)
  const inactive = formData.get("inactive") === "on"

  // Pacote inicial
  const packageLessons   = parseInt(formData.get("packageLessons")?.toString() ?? "0") || 0
  const packageRemaining = parseInt(formData.get("packageRemaining")?.toString() ?? String(packageLessons)) || packageLessons
  const packagePriceRaw  = formData.get("packagePrice")?.toString().replace(",", ".") ?? "0"
  const packagePrice     = parseFloat(packagePriceRaw) || 0
  const packageDateRaw   = formData.get("packageDate")?.toString()
  const packageDate      = packageDateRaw ? new Date(packageDateRaw) : new Date()
  const packageExpiresIn = parseInt(formData.get("packageExpires")?.toString() ?? "0") || 0
  const packageExpiresAt = packageExpiresIn > 0
    ? new Date(packageDate.getTime() + packageExpiresIn * 86400000)
    : null

  // Aulas passadas
  let lessonCount = 0
  const rawPastLessons = formData.get("pastLessons")?.toString()
  let parsedLessons: Array<{ date: string; time: string; teacherId: string; subjectId: string; duration: string; modality: "PRESENCIAL" | "ONLINE"; topics?: string; status: "COMPLETED" | "MISSED" }> = []
  if (rawPastLessons) {
    let lessonsJson: unknown
    try { lessonsJson = JSON.parse(rawPastLessons) } catch { lessonsJson = [] }
    const rows = z.array(pastLessonSchema).safeParse(lessonsJson)
    if (rows.success) parsedLessons = rows.data
  }

  // Pagamentos passados
  let paymentCount = 0
  const rawPastPayments = formData.get("pastPayments")?.toString()
  let parsedPayments: Array<{ amount: string; dueDate: string; paidAt?: string; status: "PAID" | "PENDING" | "OVERDUE"; method?: string; description?: string }> = []
  if (rawPastPayments) {
    let paymentsJson: unknown
    try { paymentsJson = JSON.parse(rawPastPayments) } catch { paymentsJson = [] }
    const rows = z.array(pastPaymentSchema).safeParse(paymentsJson)
    if (rows.success) parsedPayments = rows.data
  }

  // Motivo de inatividade → notes
  const inactiveDate   = formData.get("inactiveDate")?.toString()
  const inactiveReason = formData.get("inactiveReason")?.toString()
  const inactiveNote   = inactive
    ? [
        inactiveDate   ? `Saída: ${inactiveDate}` : null,
        inactiveReason ? `Motivo: ${inactiveReason}` : null,
      ].filter(Boolean).join(" — ") || "Ex-aluno"
    : null

  let createdStudentId = ""

  const gPass = guardianName ? await bcrypt.hash(`Resp@${Math.random().toString(36).slice(2, 8)}`, 12) : ""

  await prisma.$transaction(async (tx) => {
    const studentUser = await tx.user.create({
      data: { name, email, password: hashed, phone, role: "STUDENT", active: !inactive },
    })

    let guardianId: string | undefined

    if (guardianName) {
      const gEmail = guardianEmail || `resp.${Date.now()}@interno.lcasa`

      const existingGuardian = guardianEmail
        ? await tx.user.findUnique({ where: { email: guardianEmail } })
        : null

      if (existingGuardian) {
        const g = await tx.guardian.findUnique({ where: { userId: existingGuardian.id } })
        if (g) guardianId = g.id
      } else {
        const gUser = await tx.user.create({
          data: { name: guardianName, email: gEmail, password: gPass, phone: guardianPhone, role: "GUARDIAN" },
        })
        const g = await tx.guardian.create({ data: { userId: gUser.id } })
        guardianId = g.id
      }
    }

    const student = await tx.student.create({
      data: {
        userId:    studentUser.id,
        name:      studentUser.name,
        grade:     grade ?? "Não informado",
        school,
        guardianId,
        notes:     inactiveNote,
      },
    })
    createdStudentId = student.id

    // ── Pacote inicial ───────────────────────────────────────────────────────
    if (packageLessons > 0) {
      await tx.lessonPackage.create({
        data: {
          studentId:        student.id,
          totalLessons:     packageLessons,
          remainingLessons: Math.min(packageRemaining, packageLessons),
          pricePerLesson:   packagePrice,
          purchaseDate:     packageDate,
          expiresAt:        packageExpiresAt,
          status:           "ACTIVE",
        },
      })
    }

    // ── Aulas já realizadas ──────────────────────────────────────────────────
    for (const row of parsedLessons) {
      const scheduledAt = new Date(`${row.date}T${row.time}:00`)
      await tx.lesson.create({
        data: {
          teacherId:     row.teacherId,
          subjectId:     row.subjectId,
          scheduledAt,
          duration:      parseInt(row.duration) || 60,
          modality:      row.modality,
          status:        row.status,
          topicsCovered: row.topics || null,
          participants:  { create: { studentId: student.id } },
        },
      })
      lessonCount++
    }

    // ── Pagamentos anteriores ────────────────────────────────────────────────
    for (const p of parsedPayments) {
      const amount = parseFloat(p.amount.replace(",", ".")) || 0
      if (amount <= 0) continue
      await tx.payment.create({
        data: {
          studentId:   student.id,
          amount,
          dueDate:     new Date(p.dueDate),
          paidAt:      p.paidAt ? new Date(p.paidAt) : (p.status === "PAID" ? new Date(p.dueDate) : null),
          status:      p.status,
          method:      p.method || null,
          description: p.description || null,
        },
      })
      paymentCount++
    }
  })

  revalidatePath("/colaborador/alunos")
  revalidatePath("/admin/usuarios")

  // Envia e-mail com a senha apenas se o modo automático estiver ativo
  if (!skipEmail) {
    try {
      await sendWelcomeEmail(email, name, plainPassword)
    } catch {
      // Não bloqueia o cadastro se o e-mail falhar
    }
  }

  const params = new URLSearchParams({
    success:   "digitalizado",
    aulas:     String(lessonCount),
    pagamentos: String(paymentCount),
    ...(skipEmail ? {} : { emailEnviado: "1" }),
  })
  redirect(`/colaborador/alunos/${createdStudentId}?${params.toString()}`)
}

// ─── Importar Alunos via CSV ───────────────────────────────────────────────────

const importRowSchema = z.object({
  nome:                z.string().min(1),
  email:               z.string().email(),
  senha:               z.string().min(6).default("Aluno@2025"),
  telefone:            z.string().optional(),
  dataNascimento:      z.string().optional(),
  serie:               z.string().optional(),
  escola:              z.string().optional(),
  nomeResponsavel:     z.string().optional(),
  telefoneResponsavel: z.string().optional(),
  emailResponsavel:    z.string().optional(),
})

export type ImportResult = {
  success: number
  errors: { row: number; email: string; reason: string }[]
}

export async function importStudentsAction(rows: unknown[]): Promise<ImportResult> {
  await requireCollaboratorOrAdmin()

  const result: ImportResult = { success: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const parsed = importRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      result.errors.push({
        row:    i + 2,
        email:  String((rows[i] as Record<string, unknown>).email ?? ""),
        reason: parsed.error.issues[0]?.message ?? "Dados inválidos",
      })
      continue
    }

    const {
      nome, email, senha, telefone, serie, escola,
      nomeResponsavel, telefoneResponsavel, emailResponsavel,
    } = parsed.data

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      result.errors.push({ row: i + 2, email, reason: "E-mail já cadastrado" })
      continue
    }

    try {
      const hashed = await bcrypt.hash(senha, 12)

      await prisma.$transaction(async (tx) => {
        const studentUser = await tx.user.create({
          data: { name: nome, email, password: hashed, phone: telefone, role: "STUDENT" },
        })

        let guardianId: string | undefined
        if (nomeResponsavel) {
          const gEmail = emailResponsavel || `resp.${Date.now()}@interno.lcasa`
          const gPass  = await bcrypt.hash(`Resp@${Math.random().toString(36).slice(2, 8)}`, 12)
          const existingG = emailResponsavel
            ? await tx.user.findUnique({ where: { email: emailResponsavel } })
            : null

          if (existingG) {
            const g = await tx.guardian.findUnique({ where: { userId: existingG.id } })
            if (g) guardianId = g.id
          } else {
            const gUser = await tx.user.create({
              data: { name: nomeResponsavel, email: gEmail, password: gPass, phone: telefoneResponsavel, role: "GUARDIAN" },
            })
            const g = await tx.guardian.create({ data: { userId: gUser.id } })
            guardianId = g.id
          }
        }

        await tx.student.create({
          data: {
            userId:    studentUser.id,
            name:      studentUser.name,
            grade:     serie ?? "Não informado",
            school:    escola,
            guardianId,
          },
        })
      })

      result.success++
    } catch {
      result.errors.push({ row: i + 2, email, reason: "Erro interno ao cadastrar" })
    }
  }

  revalidatePath("/colaborador/alunos")
  revalidatePath("/admin/usuarios")
  return result
}

// ─── Editar Aluno ──────────────────────────────────────────────────────────────

const updateStudentSchema = z.object({
  studentId:     z.string().min(1),
  name:          z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  grade:         z.string().min(1, "Série é obrigatória"),
  school:        z.string().optional(),
  phone:         z.string().optional(),
  email:         z.string().email("E-mail inválido").optional().or(z.literal("")),
  notes:         z.string().optional(),
  tags:          z.string().optional(),
  active:        z.boolean().optional(),
  guardianName:  z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email("E-mail do responsável inválido").optional().or(z.literal("")),
})

export async function updateStudentAction(input: {
  studentId:      string
  name:           string
  grade:          string
  school?:        string
  phone?:         string
  email?:         string
  notes?:         string
  tags?:          string
  active?:        boolean
  guardianName?:  string
  guardianPhone?: string
  guardianEmail?: string
}) {
  await requireCollaboratorOrAdmin()

  const parsed = updateStudentSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos")

  const { studentId, name, grade, school, phone, email, notes, tags, active,
          guardianName, guardianPhone, guardianEmail } = parsed.data

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true, guardian: { include: { user: true } } },
  })
  if (!student) throw new Error("Aluno não encontrado")

  const tagList = tags
    ? tags.split(",").map(t => t.trim()).filter(Boolean)
    : []

  await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: studentId },
      data: { name, grade, school: school || null, notes: notes || null, tags: tagList },
    })

    if (student.userId) {
      await tx.user.update({
        where: { id: student.userId },
        data: {
          name,
          phone: phone || null,
          ...(email ? { email } : {}),
          ...(active !== undefined ? { active } : {}),
        },
      })
    }

    if (student.guardian?.user) {
      await tx.user.update({
        where: { id: student.guardian.userId },
        data: {
          ...(guardianName  ? { name: guardianName }   : {}),
          ...(guardianPhone ? { phone: guardianPhone }  : { phone: null }),
          ...(guardianEmail ? { email: guardianEmail }  : {}),
        },
      })
    }
  })

  revalidatePath(`/colaborador/alunos/${studentId}`)
  revalidatePath("/colaborador/alunos")
}

// ─── Adicionar Pagamento Avulso ao Aluno ──────────────────────────────────────

const addPaymentSchema = z.object({
  studentId:   z.string().min(1),
  amount:      z.number().positive("Valor deve ser positivo"),
  dueDate:     z.string().min(1, "Data de vencimento é obrigatória"),
  paidAt:      z.string().optional(),
  status:      z.enum(["PAID", "PENDING", "OVERDUE"]),
  method:      z.string().optional(),
  description: z.string().optional(),
})

export async function addStudentPaymentAction(input: {
  studentId:   string
  amount:      number
  dueDate:     string
  paidAt?:     string
  status:      "PAID" | "PENDING" | "OVERDUE"
  method?:     string
  description?: string
}) {
  await requireCollaboratorOrAdmin()

  const parsed = addPaymentSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos")

  const { studentId, amount, dueDate, paidAt, status, method, description } = parsed.data

  await prisma.payment.create({
    data: {
      studentId,
      amount,
      dueDate:     new Date(dueDate),
      paidAt:      paidAt ? new Date(paidAt) : (status === "PAID" ? new Date() : null),
      status,
      method:      method || null,
      description: description || null,
    },
  })

  revalidatePath(`/colaborador/alunos/${studentId}`)
  revalidatePath("/colaborador/financeiro")
  revalidatePath("/admin/financeiro/pagamentos")
}

// ─── Marcar Pagamento como Pago ───────────────────────────────────────────────

export async function markPaymentPaidColaboradorAction(id: string) {
  await requireCollaboratorOrAdmin()
  await prisma.payment.update({
    where: { id },
    data:  { status: "PAID", paidAt: new Date() },
  })
  revalidatePath("/colaborador/financeiro")
  revalidatePath("/admin/financeiro/pagamentos")
}

// ─── Enviar confirmações em massa ─────────────────────────────────────────────

export async function sendConfirmationsBatchAction(items: {
  key:          string
  lessonId:     string
  destinatario: "responsavel" | "professor"
  mensagem:     string
}[]) {
  await requireCollaboratorOrAdmin()

  for (const item of items) {
    const lesson = await prisma.lesson.findUnique({
      where:   { id: item.lessonId },
      include: {
        participants: {
          include: {
            student: {
              include: {
                user:     true,
                guardian: { include: { user: true } },
              },
            },
          },
          take: 1,
        },
        teacher: { include: { user: true } },
        subject: true,
      },
    })
    if (!lesson) continue

    if (item.destinatario === "responsavel") {
      const first    = lesson.participants[0]
      const student  = first?.student
      const guardian = student?.guardian
      const userId   = guardian?.userId ?? student?.userId
      if (!userId) continue

      await notify({
        userId,
        type:    "LESSON_CONFIRMATION_REQUEST",
        title:   "Confirmação de aula",
        message: item.mensagem,
        phone:   guardian?.user.phone   ?? student?.user?.phone   ?? undefined,
        email:   guardian?.user.email   ?? student?.user?.email   ?? undefined,
        data: {
          "Matéria":  lesson.subject?.name ?? "–",
          "Horário":  format(lesson.scheduledAt, "HH:mm"),
        },
      })
    } else {
      await notify({
        userId:  lesson.teacher.userId,
        type:    "LESSON_CONFIRMATION_REQUEST",
        title:   "Confirmação de presença",
        message: item.mensagem,
        phone:   lesson.teacher.user.phone ?? undefined,
        email:   lesson.teacher.user.email ?? undefined,
        data: {
          "Matéria":  lesson.subject?.name ?? "–",
          "Horário":  format(lesson.scheduledAt, "HH:mm"),
        },
      })
    }
  }
}

// ─── Enviar confirmação para o responsável/aluno ──────────────────────────────

export async function sendConfirmationToGuardianAction(lessonId: string) {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: {
      participants: {
        include: {
          student: {
            include: {
              guardian: { include: { user: true } },
            },
          },
        },
      },
      teacher: { include: { user: true } },
      subject: true,
    },
  })
  if (!lesson) throw new Error("Aula não encontrada")

  const scheduledAt = format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  for (const p of lesson.participants) {
    const { student } = p
    const guardian    = student.guardian
    if (!guardian) continue

    await notify({
      userId:  guardian.userId,
      type:    "LESSON_CONFIRMED",
      title:   "Confirmação de aula",
      message: `A aula de ${lesson.subject?.name ?? "–"} de ${student.name} com ${lesson.teacher.user.name} está confirmada para ${scheduledAt}.`,
      email:   guardian.user?.email ?? undefined,
      phone:   guardian.user?.phone ?? undefined,
      data: {
        "Aluno":      student.name,
        "Matéria":    lesson.subject?.name ?? "–",
        "Professor":  lesson.teacher.user.name,
        "Data/Hora":  scheduledAt,
        "Modalidade": lesson.modality === "ONLINE" ? "Online" : "Presencial",
      },
    })
  }
}

// ─── Enviar confirmação para o professor ───────────────────────────────────────

export async function sendConfirmationToTeacherAction(lessonId: string) {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: {
      teacher: { include: { user: true } },
      subject: true,
    },
  })
  if (!lesson) throw new Error("Aula não encontrada")

  const scheduledAt = format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  await notify({
    userId:  lesson.teacher.userId,
    type:    "LESSON_CONFIRMED",
    title:   "Confirmação de aula",
    message: `Sua aula de ${lesson.subject?.name ?? "–"} está confirmada para ${scheduledAt}.`,
    email:   lesson.teacher.user.email ?? undefined,
    phone:   lesson.teacher.user.phone ?? undefined,
    data: {
      "Matéria":    lesson.subject?.name ?? "–",
      "Data/Hora":  scheduledAt,
      "Modalidade": lesson.modality === "ONLINE" ? "Online" : "Presencial",
    },
  })
}

// ─── Excluir Aula ──────────────────────────────────────────────────────────────

export async function deleteLessonAction(lessonId: string) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") throw new Error("Sem permissão")

  const participants = await prisma.lessonParticipant.findMany({
    where: { lessonId },
    select: { studentId: true },
  })
  if (participants.length === 0) throw new Error("Aula não encontrada")

  await prisma.lesson.delete({ where: { id: lessonId } })

  for (const p of participants) {
    revalidatePath(`/colaborador/alunos/${p.studentId}`)
  }
}
