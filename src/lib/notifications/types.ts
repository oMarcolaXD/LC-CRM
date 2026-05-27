export type NotificationType =
  | "LESSON_REQUEST"        // aluno solicitou aula
  | "LESSON_CONFIRMED"      // aula confirmada
  | "LESSON_CANCELLED"      // aula cancelada
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
