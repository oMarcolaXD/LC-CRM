"use server"

import { prisma }                  from "@/lib/prisma"
import { forgotPasswordSchema }    from "@/lib/validations/auth"
import { checkRateLimit }          from "@/lib/rate-limit"
import { createPasswordResetToken } from "@/lib/auth/password-reset"
import { sendPasswordResetEmail }  from "@/lib/email"
import { redirect }                from "next/navigation"
import { headers }                 from "next/headers"

export async function forgotPasswordAction(formData: FormData) {
  const headerList = await headers()
  const ip = headerList.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  const { allowed, retryAfterSeconds } = await checkRateLimit(`forgot-password:${ip}`)
  if (!allowed) {
    redirect(`/esqueci-senha?error=${encodeURIComponent(`Muitas tentativas. Aguarde ${Math.ceil(retryAfterSeconds / 60)} minuto(s).`)}`)
  }

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) {
    redirect("/esqueci-senha?error=invalid")
  }

  const email = parsed.data.email.trim().toLowerCase()

  // Sempre responde com a mesma mensagem de sucesso, exista ou não a conta,
  // para não permitir enumeração de e-mails cadastrados.
  try {
    const user = await prisma.user.findUnique({ where: { email, active: true } })
    if (user?.email) {
      const token    = await createPasswordResetToken(user.id)
      const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      const resetUrl = `${baseUrl}/redefinir-senha?token=${token}`
      await sendPasswordResetEmail(user.email, user.name, resetUrl)
    }
  } catch (err) {
    console.error("[ForgotPassword] Falha ao processar solicitação", err)
  }

  redirect("/esqueci-senha?sent=1")
}
