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

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    token:           z.string().min(1, "Token inválido"),
    password:        passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path:    ["confirmPassword"],
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
