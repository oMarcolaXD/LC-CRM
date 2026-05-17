"use server"

import { prisma }         from "@/lib/prisma"
import { auth }           from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { EducationLevel, TeacherMode } from "@prisma/client"

async function requireCollaboratorOrAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")
  if (!["ADMIN", "COLLABORATOR"].includes(session.user.role)) throw new Error("Sem permissão")
  return session
}

// ─── Atualizar matérias e níveis de um professor ──────────────────────────────

export async function updateTeacherSubjectsAction(
  teacherId: string,
  subjects: { subjectId: string; levels: EducationLevel[] }[],
) {
  await requireCollaboratorOrAdmin()

  await prisma.$transaction([
    prisma.teacherSubject.deleteMany({ where: { teacherId } }),
    prisma.teacherSubject.createMany({
      data: subjects
        .filter((s) => s.levels.length > 0)
        .map((s) => ({ teacherId, subjectId: s.subjectId, levels: s.levels })),
    }),
  ])

  revalidatePath("/admin/usuarios")
  revalidatePath("/colaborador/professores")
}

// ─── Atualizar modo de ensino do professor ────────────────────────────────────

export async function updateTeacherModeAction(teacherId: string, formData: FormData) {
  await requireCollaboratorOrAdmin()

  const teachingMode = formData.get("teachingMode") as TeacherMode
  if (!teachingMode) throw new Error("Modalidade inválida")

  await prisma.teacher.update({
    where: { id: teacherId },
    data:  { teachingMode },
  })

  revalidatePath("/admin/usuarios")
  revalidatePath("/colaborador/professores")
}
