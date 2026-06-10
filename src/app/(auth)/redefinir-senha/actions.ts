"use server"

import bcrypt                from "bcryptjs"
import { prisma }            from "@/lib/prisma"
import { resetPasswordSchema } from "@/lib/validations/auth"
import { checkRateLimit }    from "@/lib/rate-limit"
import {
  validatePasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/auth/password-reset"
import { redirect } from "next/navigation"
import { headers }  from "next/headers"

export async function resetPasswordAction(formData: FormData) {
  const headerList = await headers()
  const ip = headerList.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  const { allowed, retryAfterSeconds } = await checkRateLimit(`reset-password:${ip}`)
  if (!allowed) {
    redirect(`/redefinir-senha?error=${encodeURIComponent(`Muitas tentativas. Aguarde ${Math.ceil(retryAfterSeconds / 60)} minuto(s).`)}`)
  }

  const raw = {
    token:           formData.get("token"),
    password:        formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  }

  const parsed = resetPasswordSchema.safeParse(raw)
  if (!parsed.success) {
    const token = typeof raw.token === "string" ? raw.token : ""
    redirect(`/redefinir-senha?token=${encodeURIComponent(token)}&error=invalid`)
  }

  const { token, password } = parsed.data

  const result = await validatePasswordResetToken(token)
  if (!result) {
    redirect("/redefinir-senha?error=expired")
  }

  const hashed = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: result.userId },
    data:  { password: hashed },
  })
  await consumePasswordResetToken(token)

  redirect("/login?success=password_reset")
}
