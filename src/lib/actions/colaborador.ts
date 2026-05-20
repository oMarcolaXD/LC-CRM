"use server"

import { prisma }         from "@/lib/prisma"
import { auth }           from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect }       from "next/navigation"
import { notify }         from "@/lib/notifications"
import { format }         from "date-fns"
import { ptBR }           from "date-fns/locale"
import bcrypt             from "bcryptjs"
import { z }              from "zod"

// ─── Tipo interno de aula passada ──────────────────────────────────────────────

const pastLessonSchema = z.object({
  date:      z.string(),
  time:      z.string().default("08:00"),
  teacherId: z.string().min(1),
  subjectId: z.string().min(1),
  duration:  z.string().default("60"),
  modality:  z.enum(["PRESENCIAL", "ONLINE"]).default("PRESENCIAL"),
  topics:    z.string().optional(),
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
  password:      z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
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

  const { name, email, password, phone, grade, school,
          guardianName, guardianPhone, guardianEmail } = parsed.data

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) redirect("/colaborador/alunos/novo?error=E-mail+já+cadastrado")

  const hashed = await bcrypt.hash(password, 12)

  await prisma.$transaction(async (tx) => {
    const studentUser = await tx.user.create({
      data: { name, email, password: hashed, phone, role: "STUDENT" },
    })

    let guardianId: string | undefined

    if (guardianName) {
      const gEmail = guardianEmail || `resp.${Date.now()}@interno.lcasa`
      const gPass  = await bcrypt.hash(`Resp@${Math.random().toString(36).slice(2, 8)}`, 12)

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
      },
    })

    // ── Aulas já realizadas (opcional) ───────────────────────────────────────
    const rawPastLessons = formData.get("pastLessons")?.toString()
    if (rawPastLessons) {
      let lessonsJson: unknown
      try { lessonsJson = JSON.parse(rawPastLessons) } catch { lessonsJson = [] }

      const rows = z.array(pastLessonSchema).safeParse(lessonsJson)
      if (rows.success) {
        for (const row of rows.data) {
          const scheduledAt = new Date(`${row.date}T${row.time}:00`)
          await tx.lesson.create({
            data: {
              teacherId:    row.teacherId,
              subjectId:    row.subjectId,
              scheduledAt,
              duration:     parseInt(row.duration) || 60,
              modality:     row.modality,
              status:       "COMPLETED",
              topicsCovered: row.topics || null,
              participants: { create: { studentId: student.id } },
            },
          })
        }
      }
    }
  })

  revalidatePath("/colaborador/alunos")
  revalidatePath("/admin/usuarios")
  redirect("/colaborador/alunos?success=Aluno+cadastrado+com+sucesso")
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
      nome, email, senha, telefone, dataNascimento, serie, escola,
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

// ─── Enviar WhatsApp de confirmação de aula ────────────────────────────────────

export async function sendLessonWhatsAppAction(lessonId: string) {
  await requireCollaboratorOrAdmin()

  const lesson = await prisma.lesson.findUnique({
    where:   { id: lessonId },
    include: {
      participants: { include: { student: { include: { user: true } } } },
      teacher: { include: { user: true } },
      subject: true,
    },
  })
  if (!lesson) throw new Error("Aula não encontrada")

  const scheduledAt = format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  for (const p of lesson.participants) {
    await notify({
      userId:  p.student.userId ?? "",
      type:    "LESSON_CONFIRMED",
      title:   "Lembrete de aula confirmada",
      message: `Sua aula de ${lesson.subject.name} com ${lesson.teacher.user.name} está confirmada para ${scheduledAt}.`,
      email:   p.student.user?.email ?? undefined,
      phone:   p.student.user?.phone ?? undefined,
      data: {
        "Matéria":    lesson.subject.name,
        "Professor":  lesson.teacher.user.name,
        "Data/Hora":  scheduledAt,
        "Modalidade": lesson.modality === "ONLINE" ? "Online" : "Presencial",
      },
    })
  }
}
