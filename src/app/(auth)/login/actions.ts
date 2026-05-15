"use server"

import { signIn }          from "@/lib/auth"
import { loginSchema }     from "@/lib/validations/auth"
import { checkRateLimit }  from "@/lib/rate-limit"
import { AuthError }       from "next-auth"
import { redirect }        from "next/navigation"
import { headers }         from "next/headers"

export async function loginAction(formData: FormData) {
  const headerList = await headers()
  const ip = headerList.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  const { allowed, retryAfterSeconds } = checkRateLimit(`login:${ip}`)
  if (!allowed) {
    redirect(`/login?error=${encodeURIComponent(`Muitas tentativas. Aguarde ${Math.ceil(retryAfterSeconds / 60)} minuto(s).`)}`)
  }

  const raw = {
    email:    formData.get("email"),
    password: formData.get("password"),
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    redirect("/login?error=invalid")
  }

  try {
    await signIn("credentials", {
      email:      parsed.data.email,
      password:   parsed.data.password,
      redirectTo: "/",
    })
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/login?error=credentials")
    }
    throw err
  }
}
