import { prisma }       from "@/lib/prisma"
import { sendEmail }     from "./email"
import { sendWhatsApp }  from "./whatsapp"
import { getMessageTemplate, renderTemplate } from "./templates"
import type { NotificationPayload } from "./types"

export type { NotificationType, NotificationPayload } from "./types"

/**
 * Envia uma notificação por todos os canais: in-app + email + WhatsApp.
 * Email e WhatsApp falham silenciosamente se as chaves não estiverem configuradas.
 */
export async function notify(payload: NotificationPayload): Promise<void> {
  // 1. In-app (sempre)
  await prisma.notification.create({
    data: {
      userId:  payload.userId,
      type:    payload.type,
      title:   payload.title,
      message: payload.message,
    },
  })

  // 2. Email + WhatsApp em paralelo — apenas em produção
  if (process.env.NODE_ENV !== "development") {
    await Promise.allSettled([
      sendEmail(payload),
      sendWhatsApp(payload),
    ])
  }
}

/**
 * Envia para múltiplos usuários de uma vez.
 */
export async function notifyMany(payloads: NotificationPayload[]): Promise<void> {
  await Promise.allSettled(payloads.map(notify))
}

// ─── Helpers pré-formatados ───────────────────────────────────────────────────

export async function notifyLessonRequest(opts: {
  teacherId: string; teacherEmail: string | null; teacherPhone?: string | null
  studentName: string; subject: string; preferredAt: string
}) {
  const template = await getMessageTemplate("lesson_request")
  const message  = renderTemplate(template, {
    aluno:             opts.studentName,
    materia:           opts.subject,
    horario_preferido: opts.preferredAt,
  })
  await notify({
    userId:  opts.teacherId,
    type:    "LESSON_REQUEST",
    title:   "Nova solicitação de aula",
    message,
    email:   opts.teacherEmail ?? undefined,
    phone:   opts.teacherPhone ?? undefined,
    data:    { "Matéria": opts.subject, "Aluno": opts.studentName, "Horário preferido": opts.preferredAt },
  })
}

export async function notifyLessonConfirmed(opts: {
  studentUserId: string; studentEmail: string | null; studentPhone?: string | null
  teacherName: string; subject: string; scheduledAt: string; modality: string
}) {
  const template = await getMessageTemplate("lesson_confirmed_student")
  const message  = renderTemplate(template, {
    materia:    opts.subject,
    professor:  opts.teacherName,
    data_hora:  opts.scheduledAt,
    modalidade: opts.modality,
  })
  await notify({
    userId:  opts.studentUserId,
    type:    "LESSON_CONFIRMED",
    title:   "Aula confirmada!",
    message,
    email:   opts.studentEmail ?? undefined,
    phone:   opts.studentPhone ?? undefined,
    data:    {
      "Matéria":    opts.subject,
      "Professor":  opts.teacherName,
      "Data/Hora":  opts.scheduledAt,
      "Modalidade": opts.modality,
    },
  })
}

export async function notifyLowBalance(opts: {
  studentUserId: string; studentEmail: string | null; studentPhone?: string | null
  remaining: number
}) {
  const template = await getMessageTemplate("package_low_balance")
  const message  = renderTemplate(template, { aulas_restantes: String(opts.remaining) })
  await notify({
    userId:  opts.studentUserId,
    type:    "PACKAGE_LOW_BALANCE",
    title:   "Saldo de aulas baixo",
    message,
    email:   opts.studentEmail ?? undefined,
    phone:   opts.studentPhone ?? undefined,
    data:    { "Aulas restantes": String(opts.remaining) },
  })
}

export async function notifyPaymentDue(opts: {
  studentUserId: string; studentEmail: string | null; studentPhone?: string | null
  amount: string; dueDate: string
}) {
  const template = await getMessageTemplate("payment_due")
  const message  = renderTemplate(template, { valor: opts.amount, vencimento: opts.dueDate })
  await notify({
    userId:  opts.studentUserId,
    type:    "PAYMENT_DUE",
    title:   "Pagamento próximo do vencimento",
    message,
    email:   opts.studentEmail ?? undefined,
    phone:   opts.studentPhone ?? undefined,
    data:    { "Valor": opts.amount, "Vencimento": opts.dueDate },
  })
}

export async function notifyLessonReminder(opts: {
  userId: string; email: string | null; phone?: string | null
  role: "student" | "teacher"
  type: "LESSON_REMINDER_24H" | "LESSON_REMINDER_1H"
  teacherName: string; studentName: string; subject: string; scheduledAt: string
}) {
  const timeLabel = opts.type === "LESSON_REMINDER_24H" ? "em 24 horas" : "em 1 hora"
  const template  = await getMessageTemplate("lesson_reminder")
  const message   = renderTemplate(template, {
    materia:   opts.subject,
    pessoa:    opts.role === "student" ? opts.teacherName : opts.studentName,
    tempo:     timeLabel,
    data_hora: opts.scheduledAt,
  })
  await notify({
    userId:  opts.userId,
    type:    opts.type,
    title:   `Lembrete: aula ${timeLabel}`,
    message,
    email:   opts.email ?? undefined,
    phone:   opts.phone ?? undefined,
    data:    {
      "Matéria":   opts.subject,
      ...(opts.role === "student" ? { "Professor": opts.teacherName } : { "Aluno": opts.studentName }),
      "Data/Hora": opts.scheduledAt,
    },
  })
}

export async function notifyPaymentOverdue(opts: {
  studentUserId: string; studentEmail: string | null; studentPhone?: string | null
  amount: string; dueDate: string
}) {
  const template = await getMessageTemplate("payment_overdue")
  const message  = renderTemplate(template, { valor: opts.amount, vencimento: opts.dueDate })
  await notify({
    userId:  opts.studentUserId,
    type:    "PAYMENT_OVERDUE",
    title:   "Pagamento em atraso",
    message,
    email:   opts.studentEmail ?? undefined,
    phone:   opts.studentPhone ?? undefined,
    data:    { "Valor": opts.amount, "Vencido em": opts.dueDate },
  })
}

export async function notifyPayoutGenerated(opts: {
  teacherUserId: string; teacherEmail: string; teacherPhone?: string | null
  amount: string; month: string; totalLessons: number
}) {
  const template = await getMessageTemplate("payout_generated")
  const message  = renderTemplate(template, {
    valor:            opts.amount,
    mes:              opts.month,
    aulas_realizadas: String(opts.totalLessons),
  })
  await notify({
    userId:  opts.teacherUserId,
    type:    "PAYOUT_GENERATED",
    title:   "Repasse calculado",
    message,
    email:   opts.teacherEmail ?? undefined,
    phone:   opts.teacherPhone ?? undefined,
    data:    { "Valor": opts.amount, "Referência": opts.month, "Aulas realizadas": String(opts.totalLessons) },
  })
}
