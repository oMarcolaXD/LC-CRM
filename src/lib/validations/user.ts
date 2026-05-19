import { z } from "zod"
import { passwordSchema } from "./auth"

export const createUserSchema = z.object({
  name:          z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email:         z.string().email("E-mail inválido").optional().or(z.literal("")),
  password:      passwordSchema,
  phone:         z.string().optional(),
  role:          z.enum(["ADMIN", "COLLABORATOR", "TEACHER", "STUDENT", "GUARDIAN"]),
  grade:         z.string().optional(),
  educationLevel: z.enum(["EF2", "EM", "SUPERIOR", "VESTIBULAR"]).optional(),
  school:        z.string().optional(),
  hourlyRate:    z.coerce.number().min(0).optional(),
  bio:           z.string().optional(),
  teachingMode:  z.enum(["ONLINE_ONLY", "PRESENCIAL", "HYBRID"]).optional(),
  // Guardian ↔ Student linking
  guardianId:    z.string().optional().or(z.literal("")),
  relationship:  z.string().optional(),
  selfGuardian:  z.string().optional(),
})

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .extend({ password: passwordSchema.optional().or(z.literal("")) })

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
