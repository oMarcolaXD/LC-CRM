import { z } from "zod"

export const createUserSchema = z.object({
  name:      z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email:     z.string().email("E-mail inválido"),
  password:  z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  phone:     z.string().optional(),
  role:      z.enum(["ADMIN", "COLLABORATOR", "TEACHER", "STUDENT", "GUARDIAN"]),
  // Campos extras por role
  grade:      z.string().optional(),
  school:     z.string().optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
  bio:        z.string().optional(),
})

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .extend({ password: z.string().min(6).optional().or(z.literal("")) })

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
