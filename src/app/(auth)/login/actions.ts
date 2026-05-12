"use server"

import { signIn } from "@/lib/auth"
import { loginSchema } from "@/lib/validations/auth"
import { AuthError } from "next-auth"

export async function loginAction(_: unknown, formData: FormData) {
  const raw = {
    email:    formData.get("email"),
    password: formData.get("password"),
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Preencha o e-mail e a senha corretamente." }
  }

  try {
    await signIn("credentials", {
      email:      parsed.data.email,
      password:   parsed.data.password,
      redirectTo: "/",
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "E-mail ou senha incorretos." }
    }
    throw err // re-throw NEXT_REDIRECT
  }
}
