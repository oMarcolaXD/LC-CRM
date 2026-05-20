"use server"

import { prisma }              from "@/lib/prisma"
import { auth }                from "@/lib/auth"
import { lessonRequestSchema } from "@/lib/validations/lesson"
import { revalidatePath }      from "next/cache"
import { redirect }            from "next/navigation"
import { notifyLessonRequest } from "@/lib/notifications"
import { isWithinAvailability, hasConflict } from "@/lib/availability"
import type { Availability }   from "@/lib/availability"
import { format }              from "date-fns"
import { ptBR }                from "date-fns/locale"

export async function requestLessonAction(formData: FormData) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const raw = Object.fromEntries(formData)
  const parsed = lessonRequestSchema.safeParse({
    ...raw,
    isGroupRequest: raw.isGroupRequest === "on" || raw.isGroupRequest === "true",
  })
  if (!parsed.success) {
    redirect(`/aluno/agendar?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos")}`)
  }

  const now = new Date()

  const rawStudentId = String(Object.fromEntries(formData).studentId ?? "")
  const guardian = await prisma.guardian.findFirst({
    where: { userId: session.user.id },
    include: { students: { select: { id: true } } },
  })
  if (!guardian) redirect("/aluno/agendar?error=Responsável+não+encontrado")

  const owns = guardian.students.some((s) => s.id === rawStudentId)
  if (!owns) redirect("/aluno/agendar?error=Aluno+não+vinculado+a+este+responsável")

  const student = await prisma.student.findUnique({
    where:   { id: rawStudentId },
    include: {
      user:     true,
      packages: {
        where: {
          status:           "ACTIVE",
          remainingLessons: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
    },
  })

  if (!student)                      redirect("/aluno/agendar?error=Perfil+de+aluno+não+encontrado")
  if (student.packages.length === 0) redirect("/aluno/agendar?error=Você+não+tem+aulas+disponíveis.+Adquira+um+pacote.")

  const { teacherId, subjectId, preferredAt, modality, notes, isGroupRequest, groupNote } = parsed.data
  const requestDate = new Date(preferredAt)

  // Busca professor com disponibilidade e aulas já marcadas
  const teacher = await prisma.teacher.findUnique({
    where:   { id: teacherId },
    include: {
      user:    true,
      lessons: {
        where: { status: { in: ["SCHEDULED", "CONFIRMED"] } },
        select: { scheduledAt: true },
      },
    },
  })

  if (!teacher) redirect("/aluno/agendar?error=Professor+não+encontrado")

  // Valida disponibilidade e conflito de horário no backend
  const availability = (teacher.availability ?? {}) as unknown as Availability
  if (!isWithinAvailability(requestDate, availability)) {
    redirect("/aluno/agendar?error=Horário+fora+da+disponibilidade+do+professor")
  }
  if (hasConflict(requestDate, teacher.lessons.map((l) => l.scheduledAt))) {
    redirect("/aluno/agendar?error=Horário+já+está+ocupado")
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } })

  await prisma.lessonRequest.create({
    data: {
      studentId:     student.id,
      teacherId,
      subjectId,
      preferredAt:   requestDate,
      modality,
      status:        "PENDING",
      reason:        notes,
      isGroupRequest: isGroupRequest ?? false,
      groupNote:     groupNote,
    },
  })

  try {
    await notifyLessonRequest({
      teacherId:    teacher.user.id,
      teacherEmail: teacher.user.email ?? "",
      teacherPhone: teacher.user.phone,
      studentName:  student.user?.name ?? "Aluno",
      subject:      subject?.name ?? "–",
      preferredAt:  format(requestDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    })
  } catch {
    // Notificação falha silenciosamente — o agendamento já foi criado
  }

  revalidatePath("/aluno/aulas")
  redirect("/aluno/agendar/sucesso")
}
