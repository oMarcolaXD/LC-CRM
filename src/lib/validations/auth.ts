import { z } from "zod"

export const passwordSchema = z
  .string()
  .min(8, "Senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
  .regex(/[0-9]/, "Senha deve conter ao menos um número")
  .regex(/[^A-Za-z0-9]/, "Senha deve conter ao menos um caractere especial")

export const loginSchema = z.object({
  emailOrPhone: z.string().min(1, "Informe o e-mail ou telefone"),
  password:     z.string().min(1, "Informe a senha"),
})

export type LoginInput = z.infer<typeof loginSchema>
