import { Resend } from "resend"

const FROM = "Lição de Casa <noreply@licaocasaoficial.com>"

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from:    FROM,
    to,
    subject: "Redefinição de senha — Lição de Casa",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #FB8500; margin-bottom: 8px;">Olá, ${name}!</h2>
        <p style="color: #444; margin-bottom: 20px;">
          Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Lição de Casa</strong>.
          Clique no botão abaixo para criar uma nova senha. Este link expira em 1 hora.
        </p>
        <div style="text-align: center; margin-bottom: 20px;">
          <a href="${resetUrl}" style="background: #FB8500; color: #fff; text-decoration: none; font-weight: bold; padding: 12px 28px; border-radius: 8px; display: inline-block;">
            Redefinir senha
          </a>
        </div>
        <p style="color: #666; font-size: 13px;">
          Se você não solicitou essa alteração, pode ignorar este e-mail — sua senha continuará a mesma.
        </p>
        <p style="color: #999; font-size: 12px; word-break: break-all;">
          Ou copie e cole este link no navegador: ${resetUrl}
        </p>
      </div>
    `,
  })
}

export async function sendWelcomeEmail(to: string, name: string, password: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from:    FROM,
    to,
    subject: "Bem-vindo(a) à Lição de Casa! Seus dados de acesso",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #FB8500; margin-bottom: 8px;">Bem-vindo(a), ${name}!</h2>
        <p style="color: #444; margin-bottom: 20px;">
          Sua conta no sistema <strong>Lição de Casa</strong> foi criada com sucesso.
          Abaixo estão seus dados de acesso:
        </p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px; color: #666; font-size: 13px;">E-mail</p>
          <p style="margin: 0 0 16px; font-weight: bold; color: #222;">${to}</p>
          <p style="margin: 0 0 8px; color: #666; font-size: 13px;">Senha temporária</p>
          <p style="margin: 0; font-weight: bold; color: #222; font-size: 18px; letter-spacing: 2px;">${password}</p>
        </div>
        <p style="color: #666; font-size: 13px;">
          Recomendamos trocar sua senha após o primeiro acesso. Em caso de dúvidas, entre em contato com seu responsável.
        </p>
      </div>
    `,
  })
}
