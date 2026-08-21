// Integração com Z-API (WhatsApp) — ativa quando ZAPI_* estiver no .env

import type { NotificationPayload, ChannelOutcome } from "./types"

function formatPhone(phone: string): string {
  // Remove tudo que não é dígito e garante código do país 55
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("55") ? digits : `55${digits}`
}

export async function sendWhatsApp(payload: NotificationPayload): Promise<ChannelOutcome> {
  const instanceId    = process.env.ZAPI_INSTANCE_ID
  const token         = process.env.ZAPI_TOKEN
  const clientToken   = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token) return { ok: false, reason: "not_configured" }
  if (!payload.phone)        return { ok: false, reason: "no_destination" }

  const phone   = formatPhone(payload.phone)
  const message = `*${payload.title}*\n\n${payload.message}${
    payload.data ? "\n\n" + Object.entries(payload.data).map(([k, v]) => `• *${k}:* ${v}`).join("\n") : ""
  }\n\n_Lição de Casa CRM_`

  try {
    const res = await fetch(
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

    // A Z-API responde 4xx com o motivo no corpo — ignorar isso era o que fazia
    // um número inválido ou token errado passar por "enviado".
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const detail = `Z-API ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`
      console.error("[WhatsApp] Recusado", { to: phone, type: payload.type, detail })
      return { ok: false, reason: "failed", detail }
    }

    return { ok: true }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error("[WhatsApp] Falha ao enviar", { to: phone, type: payload.type, error: detail })
    return { ok: false, reason: "failed", detail }
  }
}
