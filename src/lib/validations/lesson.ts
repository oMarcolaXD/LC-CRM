import { z } from "zod"

export const lessonRequestSchema = z.object({
  teacherId:     z.string().min(1, "Selecione um professor"),
  subjectId:     z.string().min(1, "Selecione uma matéria"),
  preferredAt:   z.string().min(1, "Selecione data e horário"),
  modality:      z.enum(["PRESENCIAL", "ONLINE"]),
  notes:         z.string().optional(),
  isGroupRequest: z.boolean().optional(),
  groupNote:     z.string().optional(),
})

export const lessonCompleteSchema = z.object({
  topicsCovered: z.string().min(1, "Informe o conteúdo da aula"),
  teacherNotes:  z.string().optional(),
})

export const groupLessonSchema = z.object({
  teacherId:       z.string().min(1, "Selecione um professor"),
  subjectId:       z.string().min(1, "Selecione uma matéria"),
  studentIds:      z.array(z.string()).min(2, "Selecione pelo menos 2 alunos").max(4, "Máximo 4 alunos"),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  time:            z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  modality:        z.enum(["PRESENCIAL", "ONLINE"]),
  pricePerStudent: z.number().positive("Valor deve ser positivo"),
  duration:        z.number().optional(),
  teacherOnsite:   z.boolean().optional(),
})

export type LessonRequestInput  = z.infer<typeof lessonRequestSchema>
export type LessonCompleteInput = z.infer<typeof lessonCompleteSchema>
export type GroupLessonInput    = z.infer<typeof groupLessonSchema>
