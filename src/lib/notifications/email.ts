// Integração com Resend — ativa quando RESEND_API_KEY estiver no .env

import type { NotificationPayload } from "./types"

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildEmailHtml(title: string, message: string, data?: Record<string, string>) {
  const safeTitle   = escapeHtml(title)
  const safeMessage = escapeHtml(message)
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Montserrat,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#FB8500,#219EBC);padding:28px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">LIÇÃO DE CASA</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;color:#000;font-size:18px;">${safeTitle}</h2>
          <p style="margin:0 0 24px;color:#444;font-size:15px;line-height:1.6;">${safeMessage}</p>
          ${data && Object.keys(data).length ? `
          <table cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:8px;width:100%;margin-bottom:24px;">
            ${Object.entries(data).map(([k, v]) => `
            <tr>
              <td style="padding:10px 16px;color:#777;font-size:13px;width:40%;">${escapeHtml(k)}</td>
              <td style="padding:10px 16px;color:#000;font-size:13px;font-weight:600;">${escapeHtml(v)}</td>
            </tr>`).join("")}
          </table>` : ""}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;background:#f9f9f9;border-top:1px solid #eee;">
          <p style="margin:0;color:#aaa;font-size:12px;">© Lição de Casa — Este é um e-mail automático, não responda.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildEmailText(title: string, message: string, data?: Record<string, string>): string {
  let text = `${title}\n\n${message}`
  if (data && Object.keys(data).length) {
    text += "\n\n" + Object.entries(data).map(([k, v]) => `${k}: ${v}`).join("\n")
  }
  text += "\n\n---\nLição de Casa — e-mail automático, não responda."
  return text
}

export async function sendEmail(payload: NotificationPayload): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key || !payload.email) return

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(key)

    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? "noreply@licaodecasa.com.br",
      to:      payload.email,
      subject: `[Lição de Casa] ${payload.title}`,
      html:    buildEmailHtml(payload.title, payload.message, payload.data),
      text:    buildEmailText(payload.title, payload.message, payload.data),
    })
  } catch (err) {
    console.error("[Email] Falha ao enviar", {
      to:    payload.email,
      type:  payload.type,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
