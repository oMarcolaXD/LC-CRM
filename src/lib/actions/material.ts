"use server"

import { prisma }         from "@/lib/prisma"
import { auth }           from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { notify }         from "@/lib/notifications"

async function requireTeacher() {
  const session = await auth()
  if (!session?.user) throw new Error("Sem permissão")
  if (!["ADMIN", "TEACHER"].includes(session.user.role)) throw new Error("Sem permissão")
  return session
}

export async function createMaterialAction(
  title:      string,
  fileUrl:    string,
  fileType:   string,
  subjectId?: string,
  studentId?: string,
) {
  const session = await requireTeacher()

  const teacher = await prisma.teacher.findFirst({
    where:   { userId: session.user.id },
    include: { user: true },
  })
  if (!teacher) throw new Error("Professor não encontrado")

  const ALLOWED_URL_PREFIXES = [
    "https://drive.google.com",
    "https://docs.google.com",
    "https://dropbox.com",
    "https://www.dropbox.com",
    "https://storage.googleapis.com",
    "https://onedrive.live.com",
    "https://1drv.ms",
  ]
  if (!ALLOWED_URL_PREFIXES.some((p) => fileUrl.startsWith(p))) {
    throw new Error("URL não permitida. Use links do Google Drive, Google Docs, Dropbox ou OneDrive.")
  }

  await prisma.material.create({
    data: {
      teacherId: teacher.id,
      title,
      fileUrl,
      fileType,
      subjectId: subjectId || null,
      studentId: studentId || null,
    },
  })

  if (studentId) {
    const student = await prisma.student.findUnique({
      where:   { id: studentId },
      include: { user: true },
    })
    if (student) {
      if (!student.userId) return
      await notify({
        userId:  student.userId,
        type:    "MATERIAL_UPLOADED",
        title:   "Novo material disponível!",
        message: `${teacher.user.name} compartilhou um novo material: "${title}".`,
        email:   student.user?.email ?? undefined,
        phone:   student.user?.phone ?? undefined,
      })
    }
  }

  revalidatePath("/professor/materiais")
  revalidatePath("/aluno/materiais")
}

export async function deleteMaterialAction(materialId: string) {
  const session = await requireTeacher()

  const material = await prisma.material.findUnique({
    where:   { id: materialId },
    include: { teacher: { include: { user: true } } },
  })
  if (!material) throw new Error("Material não encontrado")

  if (session.user.role === "TEACHER" && material.teacher.userId !== session.user.id) {
    throw new Error("Sem permissão para excluir este material")
  }

  await prisma.material.delete({ where: { id: materialId } })

  revalidatePath("/professor/materiais")
  revalidatePath("/aluno/materiais")
}
