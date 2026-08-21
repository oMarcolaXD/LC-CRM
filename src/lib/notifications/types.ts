export type NotificationType =
  | "LESSON_REQUEST"        // aluno solicitou aula
  | "LESSON_SCHEDULED"      // aula agendada, aguardando confirmação da escola
  | "LESSON_CONFIRMED"      // aula confirmada pelo atendente
  | "LESSON_CANCELLED"      // aula cancelada
  | "LESSON_RESCHEDULED"    // aula remarcada pelo responsável
  | "LESSON_COMPLETED"      // aula realizada
  | "LESSON_REMINDER_24H"   // lembrete 24h antes
  | "LESSON_REMINDER_1H"    // lembrete 1h antes
  | "LESSON_MISSED"         // aluno faltou
  | "HOMEWORK_ASSIGNED"     // lição atribuída
  | "MATERIAL_UPLOADED"     // material novo
  | "PACKAGE_LOW_BALANCE"   // saldo ≤ 2 aulas
  | "PAYMENT_DUE"           // pagamento próximo do vencimento
  | "PAYMENT_OVERDUE"       // pagamento vencido
  | "PAYOUT_GENERATED"      // repasse calculado
  | "LESSON_CONFIRMATION_REQUEST" // solicitação de confirmação em massa
  | "CANCELLATION_REQUEST"        // admin recebe quando colab solicita cancelamento
  | "CANCELLATION_REVIEWED"       // colab recebe quando admin aprova/rejeita

export interface NotificationPayload {
  userId:   string
  type:     NotificationType
  title:    string
  message:  string
  // Para email/WhatsApp
  email?:   string
  phone?:   string
  data?:    Record<string, string>  // dados extras para o template
}

// ─── Resultado da entrega ─────────────────────────────────────────────────────
// Os canais externos falham por vários motivos silenciosos (chave ausente,
// destinatário sem telefone, erro HTTP). Sem devolver isso, a interface acaba
// dizendo "enviado" sem que nada tenha saído.

export type ChannelOutcome =
  | { ok: true }
  | {
      ok:      false
      reason:  "dev_mode"        // ambiente de desenvolvimento: envio suprimido
             | "not_configured"  // falta chave de API no .env
             | "no_destination"  // destinatário sem telefone/e-mail
             | "failed"          // a API recusou ou a rede caiu
      detail?: string
    }

export interface DeliveryResult {
  /** A notificação in-app foi gravada (isso nunca é suprimido). */
  inApp:    boolean
  email:    ChannelOutcome
  whatsapp: ChannelOutcome
}

/** Canais que realmente entregaram. */
export function deliveredChannels(r: DeliveryResult): string[] {
  const out: string[] = []
  if (r.whatsapp.ok) out.push("WhatsApp")
  if (r.email.ok)    out.push("e-mail")
  return out
}

/** Nada saiu por nenhum canal externo. */
export function nothingDelivered(r: DeliveryResult): boolean {
  return !r.whatsapp.ok && !r.email.ok
}

/**
 * Vale como "avisado" para fins de fluxo: ou saiu de verdade, ou foi suprimido
 * de propósito em desenvolvimento. Uma falha real (chave errada, número
 * inválido, API fora) NÃO conta — senão a aula seria marcada como confirmada
 * sem que ninguém tivesse sido avisado.
 */
export function countsAsSent(r: DeliveryResult): boolean {
  if (!nothingDelivered(r)) return true
  return !r.whatsapp.ok && r.whatsapp.reason === "dev_mode"
}

/**
 * Explica em português por que nada saiu — para mostrar ao atendente em vez de
 * um "enviado!" falso. Retorna null quando algo foi entregue.
 */
export function describeDeliveryFailure(r: DeliveryResult): string | null {
  if (!nothingDelivered(r)) return null

  // O motivo mais informativo entre os dois canais
  const reasons = [r.whatsapp, r.email].flatMap((c) => (c.ok ? [] : [c.reason]))

  if (reasons.includes("dev_mode")) {
    return "Ambiente de desenvolvimento: nenhuma mensagem é enviada de verdade. A notificação ficou registrada no sistema."
  }
  if (reasons.every((x) => x === "no_destination")) {
    return "Destinatário sem WhatsApp e sem e-mail cadastrado. A notificação ficou só no sistema."
  }
  if (reasons.includes("failed")) {
    const detail = [r.whatsapp, r.email].find((c) => !c.ok && c.reason === "failed")
    return `Falha no envio${detail && !detail.ok && detail.detail ? `: ${detail.detail}` : ""}. A notificação ficou registrada no sistema.`
  }
  if (reasons.includes("not_configured")) {
    return "Envio de WhatsApp/e-mail não configurado no servidor. A notificação ficou só no sistema."
  }
  return "Nenhuma mensagem foi enviada. A notificação ficou registrada no sistema."
}
