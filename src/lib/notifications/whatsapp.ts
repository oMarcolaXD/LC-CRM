// Integração com Z-API (WhatsApp) — ativa quando ZAPI_* estiver no .env

import type { NotificationPayload } from "./types"

function formatPhone(phone: string): string {
  // Remove tudo que não é dígito e garante código do país 55
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("55") ? digits : `55${digits}`
}

export async function sendWhatsApp(payload: NotificationPayload): Promise<void> {
  const instanceId    = process.env.ZAPI_INSTANCE_ID
  const token         = process.env.ZAPI_TOKEN
  const clientToken   = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token || !payload.phone) return  // silently skip

  const phone   = formatPhone(payload.phone)
  const message = `*${payload.title}*\n\n${payload.message}${
    payload.data ? "\n\n" + Object.entries(payload.data).map(([k, v]) => `• *${k}:* ${v}`).join("\n") : ""
  }\n\n_Lição de Casa CRM_`

  try {
    await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Client-Token":  clientToken ?? "",
        },
        body: JSON.stringify({ phone, message }),
      }
    )
  } catch (err) {
    console.error("[WhatsApp] Falha ao enviar", {
      to:    phone,
      type:  payload.type,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
