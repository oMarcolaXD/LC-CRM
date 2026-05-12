"use server"

import { signIn }      from "@/lib/auth"
import { loginSchema } from "@/lib/validations/auth"
import { AuthError }   from "next-auth"
import { redirect }    from "next/navigation"

export async function loginAction(formData: FormData) {
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
    // Re-throw o NEXT_REDIRECT para o Next.js processar o redirecionamento
    throw err
  }
}
