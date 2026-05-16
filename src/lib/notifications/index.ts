import { prisma }       from "@/lib/prisma"
import { sendEmail }     from "./email"
import { sendWhatsApp }  from "./whatsapp"
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
  teacherId: string; teacherEmail: string; teacherPhone?: string | null
  studentName: string; subject: string; preferredAt: string
}) {
  await notify({
    userId:  opts.teacherId,
    type:    "LESSON_REQUEST",
    title:   "Nova solicitação de aula",
    message: `${opts.studentName} solicitou uma aula de ${opts.subject}.`,
    email:   opts.teacherEmail,
    phone:   opts.teacherPhone ?? undefined,
    data:    { "Matéria": opts.subject, "Aluno": opts.studentName, "Horário preferido": opts.preferredAt },
  })
}

export async function notifyLessonConfirmed(opts: {
  studentUserId: string; studentEmail: string; studentPhone?: string | null
  teacherName: string; subject: string; scheduledAt: string; modality: string
}) {
  await notify({
    userId:  opts.studentUserId,
    type:    "LESSON_CONFIRMED",
    title:   "Aula confirmada!",
    message: `Sua aula de ${opts.subject} com ${opts.teacherName} foi confirmada.`,
    email:   opts.studentEmail,
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
  studentUserId: string; studentEmail: string; studentPhone?: string | null
  remaining: number
}) {
  await notify({
    userId:  opts.studentUserId,
    type:    "PACKAGE_LOW_BALANCE",
    title:   "Saldo de aulas baixo",
    message: `Você tem apenas ${opts.remaining} aula(s) restante(s). Renove seu pacote para não perder continuidade.`,
    email:   opts.studentEmail,
    phone:   opts.studentPhone ?? undefined,
    data:    { "Aulas restantes": String(opts.remaining) },
  })
}

export async function notifyPaymentDue(opts: {
  studentUserId: string; studentEmail: string; studentPhone?: string | null
  amount: string; dueDate: string
}) {
  await notify({
    userId:  opts.studentUserId,
    type:    "PAYMENT_DUE",
    title:   "Pagamento próximo do vencimento",
    message: `Você tem uma cobrança de ${opts.amount} com vencimento em ${opts.dueDate}.`,
    email:   opts.studentEmail,
    phone:   opts.studentPhone ?? undefined,
    data:    { "Valor": opts.amount, "Vencimento": opts.dueDate },
  })
}

export async function notifyLessonReminder(opts: {
  userId: string; email: string; phone?: string | null
  role: "student" | "teacher"
  type: "LESSON_REMINDER_24H" | "LESSON_REMINDER_1H"
  teacherName: string; studentName: string; subject: string; scheduledAt: string
}) {
  const timeLabel = opts.type === "LESSON_REMINDER_24H" ? "em 24 horas" : "em 1 hora"
  const message = opts.role === "student"
    ? `Sua aula de ${opts.subject} com ${opts.teacherName} começa ${timeLabel}.`
    : `Sua aula de ${opts.subject} com ${opts.studentName} começa ${timeLabel}.`
  await notify({
    userId:  opts.userId,
    type:    opts.type,
    title:   `Lembrete: aula ${timeLabel}`,
    message,
    email:   opts.email,
    phone:   opts.phone ?? undefined,
    data:    {
      "Matéria":   opts.subject,
      ...(opts.role === "student" ? { "Professor": opts.teacherName } : { "Aluno": opts.studentName }),
      "Data/Hora": opts.scheduledAt,
    },
  })
}

export async function notifyPaymentOverdue(opts: {
  studentUserId: string; studentEmail: string; studentPhone?: string | null
  amount: string; dueDate: string
}) {
  await notify({
    userId:  opts.studentUserId,
    type:    "PAYMENT_OVERDUE",
    title:   "Pagamento em atraso",
    message: `Você tem uma cobrança de ${opts.amount} em atraso (venceu em ${opts.dueDate}). Regularize para continuar com suas aulas.`,
    email:   opts.studentEmail,
    phone:   opts.studentPhone ?? undefined,
    data:    { "Valor": opts.amount, "Vencido em": opts.dueDate },
  })
}

export async function notifyPayoutGenerated(opts: {
  teacherUserId: string; teacherEmail: string; teacherPhone?: string | null
  amount: string; month: string; totalLessons: number
}) {
  await notify({
    userId:  opts.teacherUserId,
    type:    "PAYOUT_GENERATED",
    title:   "Repasse calculado",
    message: `Seu repasse de ${opts.amount} referente a ${opts.month} está disponível (${opts.totalLessons} aulas realizadas).`,
    email:   opts.teacherEmail,
    phone:   opts.teacherPhone ?? undefined,
    data:    { "Valor": opts.amount, "Referência": opts.month, "Aulas realizadas": String(opts.totalLessons) },
  })
}
