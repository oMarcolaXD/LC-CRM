/**
 * Situação dos canais de envio, para a interface avisar ANTES do clique.
 *
 * Sem isso o atendente descobre que nada saiu só depois de "enviar" —
 * ou pior, nem descobre. Lê apenas variáveis de ambiente, então pode ser
 * chamado direto em server components (não toca no banco).
 */

export interface NotificationStatus {
  /** Z-API configurada (instância + token). */
  whatsapp: boolean
  /** Resend configurado. */
  email:    boolean
  /** Ambiente de desenvolvimento: envio externo é suprimido de propósito. */
  devMode:  boolean
  /** Nenhuma mensagem sai por nenhum canal externo. */
  silent:   boolean
  /** Explicação pronta para exibir, ou null quando está tudo certo. */
  aviso:    string | null
  /** Detalhe complementar do aviso (o que fazer). */
  comoResolver: string | null
}

export function getNotificationStatus(): NotificationStatus {
  const whatsapp = Boolean(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN)
  const email    = Boolean(process.env.RESEND_API_KEY)
  const devMode  = process.env.NODE_ENV === "development"

  // Em desenvolvimento nada externo sai, mesmo com as chaves preenchidas.
  const silent = devMode || (!whatsapp && !email)

  if (!silent) {
    // Envio automático de WhatsApp (Z-API) é opcional aqui: a escola dispara as
    // mensagens à mão pelo botão de WhatsApp de cada aluno. Enquanto o e-mail
    // estiver de pé, não há o que avisar — o banner só repetia todo dia uma
    // decisão que já foi tomada. Falta de e-mail continua sendo aviso.
    if (!email) {
      return {
        whatsapp, email, devMode, silent,
        aviso:        "E-mail não configurado — as confirmações saem só por WhatsApp.",
        comoResolver: "Preencha RESEND_API_KEY nas variáveis de ambiente.",
      }
    }
    return { whatsapp, email, devMode, silent, aviso: null, comoResolver: null }
  }

  if (devMode) {
    return {
      whatsapp, email, devMode, silent,
      aviso:        "Ambiente de teste: nenhuma mensagem é enviada de verdade para pais, alunos ou professores.",
      comoResolver: "As notificações ficam registradas no sistema (sino). O envio real acontece só em produção.",
    }
  }

  return {
    whatsapp, email, devMode, silent,
    aviso:        "Envio de WhatsApp e e-mail não configurado — nenhuma confirmação chega aos pais, alunos ou professores.",
    comoResolver: "Preencha ZAPI_INSTANCE_ID, ZAPI_TOKEN e RESEND_API_KEY nas variáveis de ambiente do servidor.",
  }
}
