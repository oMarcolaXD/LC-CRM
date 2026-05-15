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
  birthDate:     z.string().optional(),
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

  const { name, email, password, phone, grade, school, birthDate,
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

    await tx.student.create({
      data: {
        userId:    studentUser.id,
        grade:     grade ?? "Não informado",
        school,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        guardianId,
      },
    })
  })

  revalidatePath("/colaborador/alunos")
  revalidatePath("/admin/usuarios")
  redirect("/colaborador/alunos?success=Aluno+cadastrado+com+sucesso")
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
      student: { include: { user: true } },
      teacher: { include: { user: true } },
      subject: true,
    },
  })
  if (!lesson) throw new Error("Aula não encontrada")

  const scheduledAt = format(lesson.scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  await notify({
    userId:  lesson.student.userId,
    type:    "LESSON_CONFIRMED",
    title:   "Lembrete de aula confirmada",
    message: `Sua aula de ${lesson.subject.name} com ${lesson.teacher.user.name} está confirmada para ${scheduledAt}.`,
    email:   lesson.student.user.email,
    phone:   lesson.student.user.phone ?? undefined,
    data: {
      "Matéria":    lesson.subject.name,
      "Professor":  lesson.teacher.user.name,
      "Data/Hora":  scheduledAt,
      "Modalidade": lesson.modality === "ONLINE" ? "Online" : "Presencial",
    },
  })
}
