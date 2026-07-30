import { prisma }       from "@/lib/prisma"
import { sendEmail }     from "./email"
import { sendWhatsApp }  from "./whatsapp"
import type { NotificationPayload, DeliveryResult, ChannelOutcome } from "./types"

export type {
  NotificationType, NotificationPayload, DeliveryResult, ChannelOutcome,
} from "./types"
export {
  deliveredChannels, nothingDelivered, countsAsSent, describeDeliveryFailure,
} from "./types"
export { getNotificationStatus, type NotificationStatus } from "./status"

/**
 * Envia uma notificação por todos os canais: in-app + email + WhatsApp.
 *
 * Devolve o resultado de cada canal externo: sem isso, a interface mostra
 * "enviado" mesmo quando nada saiu (chave ausente, destinatário sem telefone,
 * erro da API). Use `describeDeliveryFailure` para explicar ao usuário.
 */
export async function notify(payload: NotificationPayload): Promise<DeliveryResult> {
  // 1. In-app (sempre) — é o registro que garante que nada se perde
  await prisma.notification.create({
    data: {
      userId:  payload.userId,
      type:    payload.type,
      title:   payload.title,
      message: payload.message,
    },
  })

  // 2. Em desenvolvimento não disparamos nada externo (para não incomodar pais
  //    e professores reais), mas dizemos isso em voz alta em vez de fingir envio.
  if (process.env.NODE_ENV === "development") {
    const skipped: ChannelOutcome = { ok: false, reason: "dev_mode" }
    return { inApp: true, email: skipped, whatsapp: skipped }
  }

  const [email, whatsapp] = await Promise.all([
    sendEmail(payload),
    sendWhatsApp(payload),
  ])

  return { inApp: true, email, whatsapp }
}

/**
 * Envia para múltiplos usuários de uma vez. Uma falha de canal não interrompe
 * os demais destinatários — o resultado de cada um volta na ordem de entrada.
 */
export async function notifyMany(payloads: NotificationPayload[]): Promise<DeliveryResult[]> {
  const results = await Promise.allSettled(payloads.map(notify))
  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          inApp:    false,
          email:    { ok: false, reason: "failed", detail: String(r.reason) } as ChannelOutcome,
          whatsapp: { ok: false, reason: "failed", detail: String(r.reason) } as ChannelOutcome,
        }
  )
}

// ─── Helpers pré-formatados ───────────────────────────────────────────────────

export async function notifyLessonRequest(opts: {
  teacherId: string; teacherEmail: string | null; teacherPhone?: string | null
  studentName: string; subject: string; preferredAt: string
}) {
  return notify({
    userId:  opts.teacherId,
    type:    "LESSON_REQUEST",
    title:   "Nova solicitação de aula",
    message: `${opts.studentName} solicitou uma aula de ${opts.subject}.`,
    email:   opts.teacherEmail ?? undefined,
    phone:   opts.teacherPhone ?? undefined,
    data:    { "Matéria": opts.subject, "Aluno": opts.studentName, "Horário preferido": opts.preferredAt },
  })
}

/**
 * Aula criada e aguardando confirmação da escola. A confirmação em si é uma ação
 * manual do atendente (`confirmLessonAction`), que dispara `notifyLessonConfirmed`.
 */
export async function notifyLessonScheduled(opts: {
  studentUserId: string; studentEmail: string | null; studentPhone?: string | null
  teacherName: string; subject: string; scheduledAt: string; modality: string
}) {
  return notify({
    userId:  opts.studentUserId,
    type:    "LESSON_SCHEDULED",
    title:   "Aula agendada",
    message: `Sua aula de ${opts.subject} com ${opts.teacherName} foi agendada. Você receberá a confirmação da escola em breve.`,
    email:   opts.studentEmail ?? undefined,
    phone:   opts.studentPhone ?? undefined,
    data:    {
      "Matéria":    opts.subject,
      "Professor":  opts.teacherName,
      "Data/Hora":  opts.scheduledAt,
      "Modalidade": opts.modality,
      "Situação":   "Aguardando confirmação",
    },
  })
}

export async function notifyLessonConfirmed(opts: {
  studentUserId: string; studentEmail: string | null; studentPhone?: string | null
  teacherName: string; subject: string; scheduledAt: string; modality: string
}) {
  return notify({
    userId:  opts.studentUserId,
    type:    "LESSON_CONFIRMED",
    title:   "Aula confirmada!",
    message: `Sua aula de ${opts.subject} com ${opts.teacherName} foi confirmada.`,
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

/** Confirmação enviada ao professor — usada tanto na rodada do dia quanto ao marcar já acertada. */
export async function notifyLessonConfirmedToTeacher(opts: {
  teacherUserId: string; teacherEmail: string | null; teacherPhone?: string | null
  subject: string; scheduledAt: string; modality: string
}) {
  return notify({
    userId:  opts.teacherUserId,
    type:    "LESSON_CONFIRMED",
    title:   "Confirmação de aula",
    message: `Sua aula de ${opts.subject} está confirmada para ${opts.scheduledAt}.`,
    email:   opts.teacherEmail ?? undefined,
    phone:   opts.teacherPhone ?? undefined,
    data:    {
      "Matéria":    opts.subject,
      "Data/Hora":  opts.scheduledAt,
      "Modalidade": opts.modality,
    },
  })
}

export async function notifyLowBalance(opts: {
  studentUserId: string; studentEmail: string | null; studentPhone?: string | null
  remaining: number
}) {
  return notify({
    userId:  opts.studentUserId,
    type:    "PACKAGE_LOW_BALANCE",
    title:   "Saldo de aulas baixo",
    message: `Você tem apenas ${opts.remaining} aula(s) restante(s). Renove seu pacote para não perder continuidade.`,
    email:   opts.studentEmail ?? undefined,
    phone:   opts.studentPhone ?? undefined,
    data:    { "Aulas restantes": String(opts.remaining) },
  })
}

export async function notifyPaymentDue(opts: {
  studentUserId: string; studentEmail: string | null; studentPhone?: string | null
  amount: string; dueDate: string
}) {
  return notify({
    userId:  opts.studentUserId,
    type:    "PAYMENT_DUE",
    title:   "Pagamento próximo do vencimento",
    message: `Você tem uma cobrança de ${opts.amount} com vencimento em ${opts.dueDate}.`,
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
  const message = opts.role === "student"
    ? `Sua aula de ${opts.subject} com ${opts.teacherName} começa ${timeLabel}.`
    : `Sua aula de ${opts.subject} com ${opts.studentName} começa ${timeLabel}.`
  return notify({
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
  return notify({
    userId:  opts.studentUserId,
    type:    "PAYMENT_OVERDUE",
    title:   "Pagamento em atraso",
    message: `Você tem uma cobrança de ${opts.amount} em atraso (venceu em ${opts.dueDate}). Regularize para continuar com suas aulas.`,
    email:   opts.studentEmail ?? undefined,
    phone:   opts.studentPhone ?? undefined,
    data:    { "Valor": opts.amount, "Vencido em": opts.dueDate },
  })
}

export async function notifyPayoutGenerated(opts: {
  teacherUserId: string; teacherEmail: string; teacherPhone?: string | null
  amount: string; month: string; totalLessons: number
}) {
  return notify({
    userId:  opts.teacherUserId,
    type:    "PAYOUT_GENERATED",
    title:   "Repasse calculado",
    message: `Seu repasse de ${opts.amount} referente a ${opts.month} está disponível (${opts.totalLessons} aulas realizadas).`,
    email:   opts.teacherEmail ?? undefined,
    phone:   opts.teacherPhone ?? undefined,
    data:    { "Valor": opts.amount, "Referência": opts.month, "Aulas realizadas": String(opts.totalLessons) },
  })
}
