// Integração com Evolution API (WhatsApp) — ativa quando EVOLUTION_* estiver no .env

import type { NotificationPayload } from "./types"
import { isWhatsAppEnabled }        from "@/lib/config"

function formatPhone(phone: string): string {
  // Remove tudo que não é dígito e garante código do país 55
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("55") ? digits : `55${digits}`
}

export async function sendWhatsApp(payload: NotificationPayload): Promise<void> {
  const apiUrl   = process.env.EVOLUTION_API_URL
  const apiKey   = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE

  if (!apiUrl || !apiKey || !instance || !payload.phone) return  // silently skip
  if (!(await isWhatsAppEnabled())) return  // desligado em /admin/config

  const phone   = formatPhone(payload.phone)
  const message = `*${payload.title}*\n\n${payload.message}${
    payload.data ? "\n\n" + Object.entries(payload.data).map(([k, v]) => `• *${k}:* ${v}`).join("\n") : ""
  }\n\n_Lição de Casa CRM_`

  try {
    await fetch(
      `${apiUrl.replace(/\/$/, "")}/message/sendText/${instance}`,
      {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey":       apiKey,
        },
        body: JSON.stringify({ number: phone, text: message }),
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
